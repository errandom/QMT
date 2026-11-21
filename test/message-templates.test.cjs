const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sql = require('mssql');
const { templateCatalog, templateDefinition, validateTemplate, renderTemplate } = require('../server/message-template-domain.mjs');
const { templateRecipients, validateRecipient } = require('../server/message-template-domain.mjs');
const { registerMessageTemplateRoutes } = require('../server/message-templates.cjs');

test('seeded templates render both languages, reject invalid placeholders and preserve literal user content', () => {
  assert.equal(templateCatalog.length, 32);
  for (const definition of templateCatalog) {
    validateTemplate(definition, definition);
    const values = Object.fromEntries(definition.placeholders.map(token => [token, `Example ${token}`]));
    const draft = renderTemplate(definition.key, definition.language, values);
    assert.ok(draft.message.length > 0);
    assert.equal(draft.message.includes('{{'), false);
    for (const token of definition.required) {
      assert.throws(() => validateTemplate(definition, { ...definition, message: definition.message.replace(`{{${token}}}`, '') }), /Keep/);
      assert.throws(() => validateTemplate(definition, { ...definition, message: `${definition.message}\n{{${token}}}` }), /Keep/);
    }
    assert.throws(() => validateTemplate(definition, { ...definition, message: `${definition.message}\n{{password}}` }), /Unknown placeholder/);
    assert.throws(() => validateTemplate(definition, { ...definition, message: `${definition.message}\n{{broken` }), /form/);
  }
  const signature = templateDefinition('shared.signature', 'en');
  const overrides = [{ ...signature, message: 'Club office\n{{sender_name}}' }];
  assert.equal(renderTemplate(signature.key, 'en', { sender_name: '{{not_recursive}}' }, overrides).message, 'Club office\n{{not_recursive}}');
  assert.throws(() => renderTemplate(signature.key, 'en', {}, overrides), /Missing value/);
  assert.throws(() => renderTemplate(signature.key, 'en', { sender_name: 'x'.repeat(16001) }), /limits/);
  const event = templateDefinition('event.create', 'en');
  assert.throws(() => validateTemplate(event, { ...event, subject: 'Injected\nsubject' }), /single-line/);
  assert.throws(() => validateTemplate(event, { ...event, subject: '{{details}}' }), /not supported/);
});

test('template HTTP routes enforce roles, persist exact edits, reject stale writes and retain reset revisions', async t => {
  const store = new Map(), errors = [];
  class Transaction {
    on() {}
    async begin() { this.before = new Map(store); }
    async commit() {}
    async rollback() { store.clear(); for (const [key, value] of this.before) store.set(key, value); }
  }
  class Request {
    constructor() { this.values = {}; }
    input(key, _type, value) { this.values[key] = value; return this; }
    async query(query) {
      const values = this.values, key = `${values.key}/${values.language}`;
      if (query.includes('sp_getapplock')) return { recordset: [] };
      if (query === 'SELECT * FROM dbo.message_templates') return { recordset: [...store.values()] };
      if (query.includes('WITH (UPDLOCK, HOLDLOCK)')) return { recordset: store.has(key) ? [{ revision: store.get(key).revision }] : [] };
      if (query.includes('OUTPUT INSERTED.*')) {
        const row = { template_key: values.key, language: values.language, subject: values.subject, message: values.message, recipient: values.recipient,
          revision: values.revision, customized: values.customized, updated_by: values.actor, updated_at: new Date('2026-11-21T12:00:00Z') };
        store.set(key, row);
        return { recordset: [row] };
      }
      throw new Error('Unexpected template SQL');
    }
  }
  const original = { Request: sql.Request, Transaction: sql.Transaction };
  sql.Request = Request; sql.Transaction = Transaction;
  t.after(() => Object.assign(sql, original));
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    req.authChecked = req.headers['x-checked'] !== 'false';
    req.user = { role: req.headers['x-role'] || 'admin', username: 'synthetic-admin' }; next();
  });

  registerMessageTemplateRoutes(app, { getPool: async () => ({ request: () => new Request() }), logger: { error: (...args) => errors.push(args) } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/message-templates`;
  const send = async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await send('', 'GET', undefined, { 'x-checked': 'false' })).status, 403);
  assert.equal((await send('', 'GET', undefined, { 'x-role': 'user' })).status, 403);
  const listing = await send('', 'GET', undefined, { 'x-role': 'mgmt' });
  assert.equal(listing.body.length, 32);
  const definition = listing.body.find(item => item.key === 'facility.acknowledge' && item.language === 'en');
  const body = { expectedRevision: 0, subject: 'Receipt: {{requester_name}}', message: definition.message.replace('Hi ', 'Hello '), recipient: 'office@example.invalid' };
  assert.equal((await send('/facility.acknowledge/en', 'PUT', body, { 'x-role': 'mgmt' })).status, 403);
  assert.equal((await send('/unknown/en', 'PUT', body)).status, 404);
  assert.equal((await send('/facility.acknowledge/en', 'PUT', { ...body, message: 'Missing required details' })).status, 400);
  assert.equal(store.size, 0);
  const saved = await send('/facility.acknowledge/en', 'PUT', body);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.message, body.message);
  assert.equal(saved.body.recipient, body.recipient);
  assert.equal(saved.body.revision, 1);
  assert.equal(saved.body.updatedBy, 'synthetic-admin');
  assert.equal((await send('/facility.acknowledge/en', 'PUT', body)).status, 409);
  const reloaded = (await send('')).body;
  assert.equal(reloaded.find(item => item.key === definition.key && item.language === 'en').subject, body.subject);
  assert.equal(reloaded.find(item => item.key === definition.key && item.language === 'de').customized, false);
  const reset = await send('/facility.acknowledge/en/reset', 'POST', { expectedRevision: 1 });
  assert.equal(reset.body.revision, 2);
  assert.equal(reset.body.customized, false);
  assert.equal(reset.body.recipient, '');
  assert.equal(reset.body.message, definition.message);
  assert.equal((await send('/facility.acknowledge/en', 'PUT', body)).status, 409);
  assert.ok(errors.length >= 3, 'Validation and conflict errors are surfaced and logged');
});

test('recipient overrides preserve automatic routing, reject invalid lists and remain language-specific', () => {
  assert.deepEqual(templateRecipients('facility.inquiry', 'en', ['department@example.invalid']), ['department@example.invalid']);
  const overrides = [{ key: 'facility.inquiry', language: 'en', recipient: 'override@example.invalid' }];
  assert.deepEqual(templateRecipients('facility.inquiry', 'en', ['department@example.invalid'], overrides), ['override@example.invalid']);
  assert.deepEqual(templateRecipients('facility.inquiry', 'de', ['department@example.invalid'], overrides), ['department@example.invalid']);
  assert.throws(() => validateRecipient(templateDefinition('facility.inquiry', 'en'), 'one@example.invalid,two@example.invalid'), /allows 1/);
  assert.throws(() => validateRecipient(templateDefinition('event.share', 'en'), 'one@example.invalid\nBcc: hidden@example.invalid'), /single line/);
  assert.throws(() => validateRecipient(templateDefinition('event.share', 'en'), 'invalid'), /valid email/);
  assert.throws(() => validateRecipient(templateDefinition('shared.signature', 'en'), 'one@example.invalid'), /allows 0/);
  assert.deepEqual(validateRecipient(templateDefinition('event.share', 'en'), 'one@example.invalid;ONE@example.invalid,two@example.invalid'), ['one@example.invalid', 'two@example.invalid']);
});

test('reply sync recognizes explicitly sent custom recipients, excludes strangers and never sends a message', async t => {
  const { registerCommunicationRoutes } = require('../server/communications.cjs');
  const imported = [];
  class Transaction { on() {} async begin() {} async commit() {} async rollback() {} }
  class Request {
    constructor() { this.values = {}; }
    input(key, _type, value) { this.values[key] = value; return this; }
    async query(query) {
      if (query.includes('sp_getapplock')) return { recordset: [] };
      if (query.includes('SELECT * FROM requests')) return { recordset: [{ id: 1, request_type: 'facility', status: 'pending', created_at: '2026-11-21T12:00:00Z',
        payload: JSON.stringify({ type: 'facility', requestorName: 'Synthetic requester', requestorPhone: '5550100', requestorEmail: 'requester@example.invalid', date: '2027-04-26', startTime: '18:00', duration: 90, eventType: 'Practice' }) }] };
      if (query.includes('SELECT TOP (1001) recipient')) return { recordset: [{ recipient: 'custom@example.invalid' }] };
      if (query.includes('WHERE provider_id')) return { recordset: imported.filter(item => item.provider === this.values.provider) };
      if (query.includes('INSERT INTO request_communications')) { imported.push({ ...this.values }); return { recordset: [] }; }
      throw new Error('Unexpected reply-sync SQL');
    }
  }
  const original = { Request: sql.Request, Transaction: sql.Transaction };
  sql.Request = Request; sql.Transaction = Transaction;
  t.after(() => Object.assign(sql, original));
  const app = express();
  app.use(express.json(), (req, _res, next) => { req.user = { username: 'synthetic-admin' }; next(); });
  const reply = (id, sender) => ({ id, subject: '[QMT-1] Reply', from: { emailAddress: { address: sender } }, body: { contentType: 'Text', content: 'Synthetic reply' } });
  registerCommunicationRoutes(app, { getPool: async () => ({ request: () => new Request() }), logger: { error() {} },
    mailbox: { configured: true, async send() { assert.fail('Sync must not send email'); }, async replies() { return [reply('known', 'custom@example.invalid'), reply('stranger', 'stranger@example.invalid')]; } } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const sync = () => fetch(`http://127.0.0.1:${server.address().port}/api/operations/requests/1/sync-replies`, { method: 'POST' });
  const response = await sync();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imported, 1);
  assert.equal(imported[0].recipient, 'custom@example.invalid');
  assert.equal((await (await sync()).json()).imported, 0);
});
