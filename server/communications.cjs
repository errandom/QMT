const sql = require('mssql');
const { z } = require('zod');
const { randomUUID } = require('node:crypto');
const { HttpError, ids, transaction } = require('./bookings.cjs');
const { requestDto } = require('./requests.cjs');
const { applyWorkflowAction } = require('./facility-workflow.cjs');
const { createMailbox } = require('./mail.cjs');

const sendSchema = z.object({
  id: z.string().uuid(), recipient: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(220), message: z.string().trim().min(1).max(16000),
  action: z.enum(['acknowledge', 'send', 'notify', 'followup']),
  expectedVersion: z.number().int().min(0), approved: z.literal(true),
});

function registerCommunicationRoutes(app, { getPool, logger, mailbox = createMailbox() }) {
  const route = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      logger.error('Communication operation failed', error);
      res.status(error instanceof HttpError ? error.status : 503)
        .json({ error: error instanceof HttpError ? error.message : 'Communications unavailable; retry later' });
    }
  };
  async function request(source, id) {
    const row = (await source.request().input('id', sql.Int, id).query('SELECT * FROM requests WHERE id = @id')).recordset[0];
    if (!row) throw new HttpError(404, 'Request not found');
    const dto = requestDto(row);
    if (dto.type !== 'facility') throw new HttpError(400, 'Select a facility request');
    return { row, dto };
  }
  app.get('/api/operations/requests/:id/messages', route(async (req, res) => {
    const id = ids([req.params.id])[0];
    const pool = await getPool();
    await request(pool, id);
    const messages = (await pool.request().input('id', sql.Int, id)
      .query('SELECT TOP (1001) * FROM request_communications WHERE request_id = @id ORDER BY created_at, id')).recordset;
    if (messages.length > 1000) throw new HttpError(409, 'Thread limit reached; archive before continuing');
    res.json({ configured: mailbox.configured, messages });
  }));
  app.post('/api/operations/requests/:id/messages', route(async (req, res) => {
    const id = ids([req.params.id])[0];
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Approve the exact recipient, subject and message with a current revision and unique message ID');
    if (!mailbox.configured) throw new HttpError(503, 'Mail is not configured; no message was sent');
    const body = parsed.data;
    const subject = `[QMT-${id}] ${body.subject}`;
    const action = { action: body.action === 'followup' ? 'note' : body.action,
      expectedVersion: body.expectedVersion, channel: 'Email', message: body.message };
    const existing = await transaction(await getPool(), async tx => {
      const source = { request: () => new sql.Request(tx) };
      const prior = (await source.request().input('id', sql.UniqueIdentifier, body.id)
        .query('SELECT * FROM request_communications WHERE id = @id')).recordset[0];
      if (prior) {
        if (prior.request_id !== id || prior.recipient !== body.recipient || prior.subject !== subject || prior.message !== body.message ||
            prior.workflow_action !== body.action || prior.expected_version !== body.expectedVersion) throw new HttpError(409, 'Message ID was already used for different content');
        return prior;
      }
      const { dto } = await request(source, id);
      applyWorkflowAction(dto, action, req.user.username); // Validate before reserving or contacting the provider.
      await source.request().input('id', sql.UniqueIdentifier, body.id).input('request', sql.Int, id)
        .input('recipient', sql.NVarChar(254), body.recipient).input('subject', sql.NVarChar(255), subject)
        .input('message', sql.NVarChar(sql.MAX), body.message).input('action', sql.NVarChar(20), body.action)
        .input('version', sql.Int, body.expectedVersion).input('actor', sql.NVarChar(255), req.user.username)
        .query(`INSERT INTO request_communications (id, request_id, direction, status, recipient, subject, message, workflow_action, expected_version, recorded_by)
          VALUES (@id, @request, 'outbound', 'sending', @recipient, @subject, @message, @action, @version, @actor)`);
      return null;
    });
    if (existing) return res.json({ status: existing.status, duplicate: true });
    let status;
    try { status = await mailbox.send({ ...body, subject }); }
    catch (error) {
      const status = error.deliveryUnknown ? 'unknown' : 'failed';
      await (await getPool()).request().input('id', sql.UniqueIdentifier, body.id).input('status', sql.NVarChar(20), status)
        .query('UPDATE request_communications SET status = @status WHERE id = @id');
      throw error;
    }
    const workflowApplied = await transaction(await getPool(), async tx => {
      const source = { request: () => new sql.Request(tx) };
      await source.request().input('id', sql.UniqueIdentifier, body.id).input('status', sql.NVarChar(20), status)
        .query('UPDATE request_communications SET status = @status WHERE id = @id');
      const { row, dto } = await request(source, id);
      if ((dto.workflow?.version || 0) !== body.expectedVersion) return false;
      const workflow = applyWorkflowAction(dto, { ...action,
        message: `Email accepted by mailbox (delivery not confirmed). See linked communication ${body.id}.` }, req.user.username);
      await source.request().input('id', sql.Int, id)
        .input('payload', sql.NVarChar(sql.MAX), JSON.stringify({ ...JSON.parse(row.payload), workflow }))
        .query('UPDATE requests SET payload = @payload, updated_at = SYSUTCDATETIME() WHERE id = @id');
      return true;
    });
    res.json({ status, workflowApplied });
  }));
  app.post('/api/operations/requests/:id/sync-replies', route(async (req, res) => {
    const id = ids([req.params.id])[0];
    const pool = await getPool();
    const { dto } = await request(pool, id);
    const contacts = [dto.requestorEmail, dto.workflow?.contactEmail].filter(Boolean).map(value => value.toLowerCase());
    const messages = await mailbox.replies(id, dto.createdAt);
    let imported = 0;
    await transaction(pool, async tx => {
      for (const raw of messages) {
        const parsed = z.object({
          id: z.string().min(1).max(512), subject: z.string().max(255),
          from: z.object({ emailAddress: z.object({ address: z.string().email().max(254) }) }),
          body: z.object({ contentType: z.string(), content: z.string().max(100000) }),
        }).safeParse(raw);
        if (!parsed.success) throw new HttpError(503, 'Mailbox returned an invalid or oversized reply; nothing imported');
        const item = parsed.data;
        if (!item.subject.includes(`[QMT-${id}]`) || !contacts.includes(item.from.emailAddress.address.toLowerCase())) continue;
        const prior = await new sql.Request(tx).input('provider', sql.NVarChar(512), item.id)
          .query('SELECT id FROM request_communications WHERE provider_id = @provider');
        if (prior.recordset.length) continue;
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, randomUUID()).input('request', sql.Int, id)
          .input('recipient', sql.NVarChar(254), item.from.emailAddress.address).input('subject', sql.NVarChar(255), item.subject)
          .input('message', sql.NVarChar(sql.MAX), item.body.content).input('provider', sql.NVarChar(512), item.id)
          .input('actor', sql.NVarChar(255), req.user.username).query(`INSERT INTO request_communications
            (id, request_id, direction, status, recipient, subject, message, provider_id, recorded_by)
            VALUES (@id, @request, 'inbound', 'received', @recipient, @subject, @message, @provider, @actor)`);
        imported++;
      }
    });
    res.json({ imported });
  }));
}
module.exports = { registerCommunicationRoutes, sendSchema };
