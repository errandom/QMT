const sql = require('mssql');
const { z } = require('zod');
const { HttpError, transaction } = require('./bookings.cjs');
const { templateCatalog, templateDefinition, validateTemplate } = require('./message-template-domain.mjs');

const revisionSchema = z.object({ expectedRevision: z.number().int().min(0).max(2147483646) }).strict();
const updateSchema = revisionSchema.extend({ subject: z.string().max(220), message: z.string().max(16000), recipient: z.string().max(5200).default('') }).strict();

function templateDto(definition, row) {
  const content = row?.customized ? { subject: row.subject, message: row.message, recipient: row.recipient || '' } : definition;
  validateTemplate(definition, content);
  return { ...definition, subject: content.subject, message: content.message, recipient: content.recipient,
    revision: row?.revision || 0, customized: Boolean(row?.customized),
    updatedBy: row?.updated_by || null, updatedAt: row?.updated_at || null };
}

function registerMessageTemplateRoutes(app, { getPool, logger }) {
  const route = (admin, handler) => async (req, res) => {
    if (!req.authChecked || !['admin', 'mgmt'].includes(req.user?.role) || (admin && req.user.role !== 'admin')) {
      return res.status(403).json({ error: admin ? 'Administrator access required' : 'Operations access required' });
    }
    try { await handler(req, res); }
    catch (error) {
      logger.error('Message template operation failed', error);
      res.status(error instanceof HttpError ? error.status : 503)
        .json({ error: error instanceof HttpError ? error.message : 'Template library unavailable; retry later' });
    }
  };
  app.get('/api/message-templates', route(false, async (_req, res) => {
    const rows = (await (await getPool()).request().query('SELECT * FROM dbo.message_templates')).recordset;
    res.json(templateCatalog.map(definition => templateDto(definition,
      rows.find(row => row.template_key === definition.key && row.language === definition.language))));
  }));
  const save = reset => route(true, async (req, res) => {
    let definition;
    try { definition = templateDefinition(req.params.key, req.params.language); }
    catch { throw new HttpError(404, 'Unknown message template or language'); }
    const parsed = (reset ? revisionSchema : updateSchema).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Supply the template content and current revision');
    const body = parsed.data;
    if (!reset) {
      try { validateTemplate(definition, body); }
      catch (error) { throw new HttpError(400, error.message); }
    }
    const row = await transaction(await getPool(), async tx => {
      const request = () => new sql.Request(tx).input('key', sql.NVarChar(80), definition.key)
        .input('language', sql.NVarChar(2), definition.language);
      const prior = (await request().query(`SELECT revision FROM dbo.message_templates WITH (UPDLOCK, HOLDLOCK)
        WHERE template_key = @key AND language = @language`)).recordset[0];
      if ((prior?.revision || 0) !== body.expectedRevision) throw new HttpError(409, 'Template changed; reload the library before saving');
      const result = await request().input('revision', sql.Int, body.expectedRevision + 1)
        .input('customized', sql.Bit, !reset).input('subject', sql.NVarChar(220), reset ? null : body.subject)
        .input('message', sql.NVarChar(sql.MAX), reset ? null : body.message)
        .input('recipient', sql.NVarChar(5200), reset ? null : body.recipient.trim())
        .input('actor', sql.NVarChar(255), req.user.username).query(prior ? `
          UPDATE dbo.message_templates SET subject = @subject, message = @message, recipient = @recipient, revision = @revision,
            customized = @customized, updated_by = @actor, updated_at = SYSUTCDATETIME()
          OUTPUT INSERTED.* WHERE template_key = @key AND language = @language` : `
          INSERT INTO dbo.message_templates (template_key, language, subject, message, recipient, revision, customized, updated_by)
          OUTPUT INSERTED.* VALUES (@key, @language, @subject, @message, @recipient, @revision, @customized, @actor)`);
      return result.recordset[0];
    });
    res.json(templateDto(definition, row));
  });
  app.put('/api/message-templates/:key/:language', save(false));
  app.post('/api/message-templates/:key/:language/reset', save(true));
}

module.exports = { registerMessageTemplateRoutes, templateDto };
