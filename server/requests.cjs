const sql = require('mssql');
const { z } = require('zod');
const { HttpError, ids, transaction, saveBooking } = require('./bookings.cjs');

const text = z.string().trim().min(1).max(255);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const positiveId = z.string().regex(/^[1-9]\d*$/).refine(value => Number(value) <= 2147483647);
const teamIds = z.array(positiveId).max(20);
const base = { requestorName: text, requestorPhone: text.max(50) };
const requestSchema = z.discriminatedUnion('type', [
  z.object({
    ...base, type: z.literal('facility'), eventType: z.enum(['Practice', 'Game', 'Meeting', 'Other']),
    teamIds: teamIds.optional(), purpose: z.string().max(500).optional(), opponent: z.string().max(500).optional(),
    date, startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration: z.number().int().min(1).max(1440), description: z.string().max(1000).optional(),
  }),
  z.object({
    ...base, type: z.literal('equipment'), teamIds: teamIds.min(1), date,
    equipmentDescription: z.string().trim().min(1).max(1000),
  }),
  z.object({
    ...base, type: z.literal('cancellation'), eventId: positiveId,
    eventTitle: text, eventDate: date, eventTime: z.string().max(50),
    justification: z.string().trim().min(1).max(1000),
  }),
]);

function requestDto(row) {
  if (!row.payload) throw new HttpError(409, 'Legacy requests must be migrated before request management can resume');
  let payload;
  try { payload = JSON.parse(row.payload); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new HttpError(409, 'Stored request payload is invalid and requires reviewed recovery');
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success || parsed.data.type !== row.request_type || !['pending', 'approved', 'denied'].includes(row.status)) {
    throw new HttpError(409, 'Stored request details or status require reviewed migration');
  }
  return {
    ...parsed.data, id: String(row.id),
    status: row.status === 'pending' ? 'Pending' : row.status === 'denied' ? 'Rejected' : 'Approved',
    createdAt: row.created_at, reviewedAt: row.reviewed_at, reviewedBy: row.reviewed_by,
  };
}

function registerRequestRoutes(app, { getPool, logger }) {
  const route = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      logger.error('Request operation failed', error);
      res.status(error instanceof HttpError ? error.status : 503)
        .json({ error: error instanceof HttpError ? error.message : 'Request operation unavailable; retry later' });
    }
  };

  app.post('/api/requests', route(async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    const key = z.string().uuid().safeParse(req.headers['idempotency-key']);
    if (!parsed.success || !key.success) throw new HttpError(400, 'Provide valid request details and an Idempotency-Key UUID');
    const body = parsed.data;
    const payload = JSON.stringify(body);
    const result = await transaction(await getPool(), async tx => {
      const existing = await new sql.Request(tx).input('key', sql.UniqueIdentifier, key.data)
        .query('SELECT id, payload FROM requests WHERE client_key = @key');
      if (existing.recordset.length) {
        if (existing.recordset[0].payload !== payload) throw new HttpError(409, 'Idempotency key was already used for different details');
        return existing.recordset[0].id;
      }
      if (body.type === 'cancellation') {
        const event = await new sql.Request(tx).input('id', sql.Int, ids([body.eventId])[0])
          .query('SELECT id FROM events WHERE id = @id');
        if (!event.recordset.length) throw new HttpError(404, 'Event not found');
      }
      const inserted = await new sql.Request(tx)
        .input('type', sql.NVarChar(50), body.type).input('name', sql.NVarChar(255), body.requestorName)
        .input('phone', sql.NVarChar(50), body.requestorPhone)
        .input('payload', sql.NVarChar(sql.MAX), payload).input('key', sql.UniqueIdentifier, key.data)
        .query(`INSERT INTO requests (request_type, requestor_name, requestor_phone, payload, client_key, status)
          OUTPUT INSERTED.id VALUES (@type, @name, @phone, @payload, @key, 'pending')`);
      return inserted.recordset[0].id;
    });
    res.status(201).json({ id: String(result), status: 'Pending' });
  }));

  app.get('/api/requests', route(async (req, res) => {
    const after = Number(req.query.after || 0);
    if (!Number.isSafeInteger(after) || after < 0 || after > 2147483647) throw new HttpError(400, 'Invalid request cursor');
    const result = await (await getPool()).request().input('after', sql.Int, after)
      .query('SELECT TOP (500) * FROM requests WHERE id > @after ORDER BY id');
    res.json(result.recordset.map(requestDto));
  }));

  app.post('/api/requests/:id/review', route(async (req, res) => {
    if (!['Approved', 'Rejected'].includes(req.body.status)) throw new HttpError(400, 'Choose Approved or Rejected');
    const id = ids([req.params.id])[0];
    const result = await transaction(await getPool(), async tx => {
      const found = await new sql.Request(tx).input('id', sql.Int, id)
        .query('SELECT * FROM requests WHERE id = @id');
      const row = found.recordset[0];
      if (!row) throw new HttpError(404, 'Request not found');
      if (row.status !== 'pending') throw new HttpError(409, 'Request has already been reviewed; refresh before retrying');
      const request = requestDto(row);
      let event;
      if (req.body.status === 'Approved' && request.type === 'facility') {
        const start = new Date(`${request.date}T${request.startTime}:00Z`);
        const end = new Date(start.getTime() + request.duration * 60000);
        event = await saveBooking(tx, {
          team_ids: request.teamIds?.join(','), field_ids: req.body.fieldId || null,
          event_type: request.eventType, start_time: start.toISOString(), end_time: end.toISOString(),
          description: request.opponent ? `${request.eventType} vs ${request.opponent}` : request.purpose || request.eventType,
          notes: request.description, status: req.body.fieldId ? 'Confirmed' : 'Planned',
          other_participants: request.opponent,
        });
      } else if (req.body.status === 'Approved' && request.type === 'cancellation') {
        const changed = await new sql.Request(tx).input('id', sql.Int, ids([request.eventId])[0])
          .query(`UPDATE events SET status = 'Cancelled', updated_at = SYSUTCDATETIME()
            OUTPUT INSERTED.* WHERE id = @id`);
        if (!changed.recordset.length) throw new HttpError(404, 'Event no longer exists; request was not approved');
        event = changed.recordset[0];
      }
      const changed = await new sql.Request(tx).input('id', sql.Int, id)
        .input('status', sql.NVarChar(50), req.body.status === 'Approved' ? 'approved' : 'denied')
        .input('reviewer', sql.NVarChar(255), req.user.username)
        .query(`UPDATE requests SET status = @status, reviewed_at = SYSUTCDATETIME(),
          reviewed_by = @reviewer, updated_at = SYSUTCDATETIME() OUTPUT INSERTED.* WHERE id = @id`);
      return { request: requestDto(changed.recordset[0]), event };
    });
    res.json(result);
  }));
}

module.exports = { requestSchema, requestDto, registerRequestRoutes };
