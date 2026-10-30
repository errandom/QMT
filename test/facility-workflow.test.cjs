const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { requestSchema, requestDto } = require('../server/requests.cjs');
const { workflowActionSchema, applyWorkflowAction, reviewFacility } = require('../server/facility-workflow.cjs');

const filename = path.join(__dirname, '..', 'src', 'lib', 'facilityWorkflow.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { facilityStage, needsFacilityAttention, facilityLocations, facilityMessage } = loaded.exports;

const submission = {
  type: 'facility', requestorName: 'Synthetic requester', requestorPhone: '5550100',
  eventType: 'Practice', teamIds: ['1'], date: '2027-04-26', startTime: '08:00', duration: 540,
  description: 'Training camp through April 30; no overnight stay',
};
const row = (payload = submission, status = 'pending') => ({
  id: 1, request_type: payload.type, payload: JSON.stringify(payload), status,
  created_at: '2026-10-30T08:00:00.000Z',
});
const routing = {
  locationType: 'field', route: 'ZVIS', department: 'Synthetic allocation office',
  contactEmail: 'allocation@example.invalid', reference: 'TEST-1', followUpDate: '2026-11-02', permitNotes: '',
};
const advance = (request, action) => ({
  ...request, workflow: applyWorkflowAction(request,
    workflowActionSchema.parse({ expectedVersion: request.workflow?.version || 0, ...action }),
    'synthetic-operator', '2026-10-30T08:30:00.000Z'),
});
const acknowledge = request => advance(request, { action: 'acknowledge', channel: 'WhatsApp', message: 'Receipt acknowledged, not a booking confirmation.' });
const evaluate = request => advance(acknowledge(request), { action: 'evaluate' });
const waiting = () => advance(advance(evaluate(requestDto(row())), { action: 'configure', ...routing }),
  { action: 'send', channel: 'Email', message: 'Please review this request.' });
const reviewed = () => advance(waiting(), { action: 'response', message: 'Available on the requested date, subject to conditions.' });

test('legacy payloads remain readable and public submissions cannot inject workflow or decisions', () => {
  const legacy = requestDto(row());
  assert.equal(legacy.workflow, undefined);
  assert.equal(facilityStage(legacy), 'Received');
  assert.equal(needsFacilityAttention(legacy), true);
  const parsed = requestSchema.parse({ ...submission, requestorEmail: 'requester@example.invalid',
    locationType: 'meeting_room', status: 'Approved', workflow: { stage: 'Approved' } });
  assert.equal(parsed.workflow, undefined);
  assert.equal(parsed.status, undefined);
  assert.equal(parsed.locationType, 'meeting_room');
  assert.equal(requestSchema.safeParse({ ...submission, requestorEmail: 'not-an-email' }).success, false);
  const equipment = { type: 'equipment', requestorName: 'Synthetic fixture', requestorPhone: '555',
    teamIds: ['1'], date: '2027-04-26', equipmentDescription: 'Cones' };
  assert.equal(requestDto(row(equipment)).status, 'Pending');
  assert.throws(() => advance(requestDto(row(equipment)), { action: 'note', message: 'Not a facility' }),
    error => error.status === 400);
});

test('external evaluation records each communication and response without deciding or notifying automatically', () => {
  const request = reviewed();
  assert.equal(request.status, 'Pending');
  assert.equal(request.workflow.stage, 'Response received');
  assert.equal(request.workflow.version, 5);
  assert.equal(request.workflow.outcomeNotifiedAt, undefined);
  assert.deepEqual(request.workflow.history.map(entry => entry.action), ['acknowledge', 'evaluate', 'configure', 'send', 'response']);
  assert.equal(request.workflow.history[0].channel, 'WhatsApp');
  assert.equal(request.workflow.history[3].channel, 'Email');
  assert.ok(request.workflow.history.every(entry => entry.by === 'synthetic-operator' && entry.at === '2026-10-30T08:30:00.000Z'));
  const persisted = requestDto(row({ ...submission, workflow: request.workflow }));
  assert.deepEqual(persisted.workflow, JSON.parse(JSON.stringify(request.workflow)));
  assert.equal(persisted.locationType, 'field');
});

test('invalid, stale and out-of-order transitions cannot skip acknowledgment, evaluation or response', () => {
  const received = requestDto(row());
  for (const action of [
    { action: 'evaluate' },
    { action: 'send', channel: 'Email', message: 'Inquiry' },
    { action: 'response', message: 'Reply' },
    { action: 'notify', channel: 'Phone', message: 'Outcome' },
  ]) assert.throws(() => advance(received, action), error => error.status === 409);
  assert.throws(() => reviewFacility(received, 'Approved', 0, '', 'test'), error => error.status === 409);
  assert.throws(() => reviewFacility(received, 'Rejected', 0, '   ', 'test'), error => error.status === 400);
  const ready = reviewed();
  assert.throws(() => applyWorkflowAction(ready, { action: 'note', message: 'Stale write', expectedVersion: 0 }, 'test'),
    error => error.status === 409);
  assert.throws(() => reviewFacility(ready, 'Approved', 0, '', 'test'), error => error.status === 409);
  assert.equal(workflowActionSchema.safeParse({ action: 'acknowledge', expectedVersion: 0, channel: 'Email', message: ' ' }).success, false);
  assert.equal(workflowActionSchema.safeParse({ action: 'send', expectedVersion: 0, channel: 'Email', message: 'x'.repeat(5000) }).success, true);
  assert.equal(workflowActionSchema.safeParse({ action: 'configure', expectedVersion: 0, ...routing, followUpDate: '2026-02-31' }).success, false);
  const unassigned = evaluate(received);
  assert.throws(() => advance(unassigned, { action: 'send', channel: 'Email', message: 'Inquiry' }), error => error.status === 400);
  const incomplete = advance(unassigned, { action: 'configure', ...routing, department: '' });
  assert.throws(() => advance(incomplete, { action: 'send', channel: 'Email', message: 'Inquiry' }), error => error.status === 400);
});

test('internal reviews need an explicit route and rationale, rather than a fictitious external response', () => {
  const evaluating = evaluate(requestDto(row()));
  assert.throws(() => advance(evaluating, { action: 'internal', message: 'No external decision needed' }), error => error.status === 400);
  const configured = advance(evaluating, { action: 'configure', ...routing, locationType: 'meeting_room', route: 'Internal' });
  assert.throws(() => advance(configured, { action: 'send', channel: 'Email', message: 'Inquiry' }), error => error.status === 400);
  const ready = advance(configured, { action: 'internal', message: 'Club-managed room; internal allocation verified.' });
  const decision = reviewFacility(ready, 'Approved', ready.workflow.version, 'Room reserved.', 'synthetic-operator');
  assert.equal(decision.stage, 'Approved');
  assert.equal(decision.locationType, 'meeting_room');
});

test('follow-up changes preserve the waiting stage, but responsibility changes restart evaluation', () => {
  const pending = waiting();
  const followup = advance(pending, { action: 'configure', ...routing, followUpDate: '2026-11-05', reference: 'NEW-REF' });
  assert.equal(followup.workflow.stage, 'Awaiting response');
  const changed = advance(followup, { action: 'configure', ...routing, route: 'City of Zurich' });
  assert.equal(changed.workflow.stage, 'In evaluation');
  const rechecking = advance(reviewed(), { action: 'configure', ...routing, locationType: 'meeting_room' });
  assert.equal(rechecking.workflow.stage, 'In evaluation');
  assert.throws(() => reviewFacility(rechecking, 'Approved', rechecking.workflow.version, '', 'test'), error => error.status === 409);
});

test('decisions and outcome notification stay separate; closed requests cannot restart evaluation', () => {
  const request = reviewed();
  const workflow = reviewFacility(request, 'Approved', request.workflow.version, 'Allocated as reviewed.', 'test');
  const decided = { ...request, status: 'Approved', workflow };
  assert.equal(needsFacilityAttention(decided), true);
  const notified = advance(decided, { action: 'notify', channel: 'Email', message: 'Your request was approved.' });
  assert.equal(needsFacilityAttention(notified), false);
  assert.ok(notified.workflow.outcomeNotifiedAt);
  assert.throws(() => advance(notified, { action: 'evaluate' }), error => error.status === 409);
  assert.throws(() => advance(notified, { action: 'notify', channel: 'Email', message: 'Duplicate' }), error => error.status === 409);
  const legacyDecision = requestDto(row(submission, 'denied'));
  assert.equal(needsFacilityAttention(legacyDecision), false);
  const legacyNotified = advance(legacyDecision, { action: 'notify', channel: 'Phone', message: 'Historical decision explained.' });
  assert.equal(needsFacilityAttention(legacyNotified), false);
  assert.equal(legacyNotified.status, 'Rejected');
});

test('facility routing filters fields and meeting rooms independently of event type and sports-site flags', () => {
  const sites = [{ id: '1', name: 'Sports site', isActive: true, isSportsFacility: true },
    { id: '2', name: 'Office', isActive: true, isSportsFacility: false }, { id: '3', name: 'Closed', isActive: false }];
  const fields = [{ id: '1', name: 'Pitch', siteId: '1', isActive: true },
    { id: '2', name: 'Room', siteId: '2', isActive: true, locationType: 'meeting_room' },
    { id: '3', name: 'Closed room', siteId: '3', isActive: true, locationType: 'meeting_room' },
    { id: '4', name: 'Inactive room', siteId: '2', isActive: false, locationType: 'meeting_room' }];
  const request = requestDto(row());
  assert.deepEqual(facilityLocations(request, fields, sites), []);
  assert.deepEqual(facilityLocations({ ...request, locationType: 'field' }, fields, sites).map(item => item.id), ['1']);
  assert.deepEqual(facilityLocations({ ...request, locationType: 'meeting_room' }, fields, sites).map(item => item.id), ['2']);
});

test('editable drafts preserve request scope and clearly distinguish receipt, booking allocation and game permits', () => {
  const request = { ...requestDto(row()), eventType: 'Game', opponent: 'Synthetic visitors' };
  const ack = facilityMessage(request, 'acknowledge', [], [], []);
  assert.ok(ack.includes('not a booking confirmation'));
  assert.ok(ack.includes('Training camp through April 30'));
  const inquiry = facilityMessage(request, 'send', [], [], []);
  assert.ok(inquiry.includes('separate approvals'));
  assert.ok(inquiry.includes('Opponent: Synthetic visitors'));
  const outcome = facilityMessage({ ...request, status: 'Approved' }, 'notify', [], [], []);
  assert.ok(outcome.includes('allocation must still be confirmed'));
  assert.ok(outcome.includes('separate game permits'));
  const rejected = facilityMessage({ ...request, status: 'Rejected', workflow: { decisionNote: 'Unavailable.' } }, 'notify', [], [], []);
  assert.ok(rejected.includes('Unavailable.'));
  assert.ok(!rejected.includes('One booking has been created'));
});

test('HTTP workflow updates persist, stale writes fail, and booking decisions remain atomic and facility-specific', async t => {
  const express = require('express');
  const sql = require('mssql');
  const { randomUUID } = require('node:crypto');
  const { registerRequestRoutes } = require('../server/requests.cjs');
  const store = { rows: [], events: [], nextId: 1 };
  class Transaction {
    async begin() { this.snapshot = structuredClone(store); }
    on() {}
    async commit() {}
    async rollback() { Object.assign(store, this.snapshot); }
  }
  class Request {
    constructor() { this.values = {}; }
    input(key, _type, value) { this.values[key] = value; return this; }
    async query(query) {
      const value = this.values;
      const rows = records => ({ recordset: structuredClone(records) });
      if (query.includes('sp_getapplock')) return rows([]);
      if (query.includes('WHERE client_key = @key')) return rows(store.rows.filter(row => row.client_key === value.key));
      if (query.startsWith('INSERT INTO requests')) {
        const inserted = { id: store.nextId++, request_type: value.type, payload: value.payload,
          client_key: value.key, status: 'pending', created_at: '2026-10-30T08:00:00.000Z' };
        store.rows.push(inserted);
        return rows([{ id: inserted.id }]);
      }
      if (query.startsWith('SELECT TOP (500)')) return rows(store.rows.filter(row => row.id > value.after));
      if (query.startsWith('SELECT * FROM requests')) return rows(store.rows.filter(row => row.id === value.id));
      if (query.startsWith('UPDATE requests')) {
        const row = store.rows.find(row => row.id === value.id);
        row.payload = value.payload;
        if (value.status) Object.assign(row, { status: value.status, reviewed_by: value.reviewer, reviewed_at: '2026-10-30T09:00:00.000Z' });
        return rows([row]);
      }
      if (query.startsWith('SELECT location_type')) return rows([{ location_type: value.id === 2 ? 'meeting_room' : 'field' }]);
      if (query.startsWith('SELECT f.id FROM fields') || query.startsWith('SELECT id FROM teams')) return rows([{ id: value.id }]);
      if (query.includes('FROM OPENJSON')) return rows([]);
      if (query.startsWith('INSERT INTO events')) {
        const event = { id: store.events.length + 1, ...value };
        store.events.push(event);
        return rows([event]);
      }
      if (query.startsWith('SELECT id FROM events')) return rows(store.events.filter(event => event.id === value.id));
      if (query.includes("UPDATE events SET status = 'Cancelled'")) {
        const event = store.events.find(event => event.id === value.id);
        if (event) event.status = 'Cancelled';
        return rows(event ? [event] : []);
      }
      throw new Error(`Unexpected SQL in request regression: ${query}`);
    }
  }
  const original = { Transaction: sql.Transaction, Request: sql.Request };
  sql.Transaction = Transaction;
  sql.Request = Request;
  t.after(() => Object.assign(sql, original));
  const app = express();
  app.use(express.json(), (req, _res, next) => { req.user = { username: 'synthetic-operator' }; next(); });
  registerRequestRoutes(app, { getPool: async () => ({ request: () => new Request() }), logger: { error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (url, body, expected = 200, key) => {
    const response = await fetch(base + url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
  const key = randomUUID();
  const created = await post('/api/requests', submission, 201, key);
  const url = `/api/requests/${created.id}`;
  await post(`${url}/workflow`, { action: 'notify', expectedVersion: 0, channel: 'Phone', message: 'Too early' }, 409);
  await post(`${url}/workflow`, { action: 'acknowledge', expectedVersion: 0, channel: 'Phone', message: 'Acknowledged.' });
  await post(`${url}/workflow`, { action: 'note', expectedVersion: 0, message: 'Stale note' }, 409);
  assert.equal((await post('/api/requests', submission, 201, key)).id, created.id);
  await post(`${url}/workflow`, { action: 'evaluate', expectedVersion: 1 });
  await post(`${url}/workflow`, { action: 'configure', ...routing, route: 'Internal', locationType: 'meeting_room', expectedVersion: 2 });
  await post(`${url}/workflow`, { action: 'internal', message: 'Club-managed room; no external allocation required.', expectedVersion: 3 });
  const listed = await (await fetch(base + '/api/requests')).json();
  assert.equal(listed[0].workflow.version, 4);
  assert.equal(listed[0].locationType, 'meeting_room');
  await post(`${url}/review`, { status: 'Approved', fieldId: '1', expectedVersion: 4 }, 400);
  assert.equal(store.events.length, 0);
  assert.equal(store.rows[0].status, 'pending');
  const approved = await post(`${url}/review`, { status: 'Approved', fieldId: '2', expectedVersion: 4, decisionNote: 'Room allocated.' });
  assert.equal(approved.request.workflow.bookingEventId, '1');
  assert.equal(approved.request.workflow.approvedFieldId, '2');
  assert.equal(approved.request.workflow.outcomeNotifiedAt, undefined);
  assert.equal(approved.event.field_id, 2);
  assert.equal(store.events.length, 1);
  await post(`${url}/review`, { status: 'Approved', fieldId: '2', expectedVersion: 5 }, 409);
  const notified = await post(`${url}/workflow`, { action: 'notify', expectedVersion: 5, channel: 'Email', message: 'Outcome sent manually.' });
  assert.ok(notified.workflow.outcomeNotifiedAt);
  assert.equal(store.events.length, 1);

  const rejected = await post('/api/requests', submission, 201, randomUUID());
  await post(`/api/requests/${rejected.id}/review`, { status: 'Rejected', expectedVersion: 0 }, 400);
  const decision = await post(`/api/requests/${rejected.id}/review`, { status: 'Rejected', expectedVersion: 0, decisionNote: 'Unavailable.' });
  assert.equal(decision.request.workflow.decisionNote, 'Unavailable.');
  assert.equal(decision.request.workflow.outcomeNotifiedAt, undefined);

  const equipment = await post('/api/requests', { type: 'equipment', requestorName: 'Synthetic fixture', requestorPhone: '555',
    date: submission.date, teamIds: ['1'], equipmentDescription: 'Cones' }, 201, randomUUID());
  await post(`/api/requests/${equipment.id}/workflow`, { action: 'note', expectedVersion: 0, message: 'Wrong workflow' }, 400);
  const equipmentDecision = await post(`/api/requests/${equipment.id}/review`, { status: 'Approved' });
  assert.equal(equipmentDecision.request.status, 'Approved');
  assert.equal(equipmentDecision.request.workflow, undefined);
  const cancellation = await post('/api/requests', { type: 'cancellation', requestorName: 'Synthetic fixture', requestorPhone: '555',
    eventId: '1', eventTitle: 'Synthetic meeting', eventDate: submission.date, eventTime: '08:00', justification: 'No longer needed' }, 201, randomUUID());
  const cancellationDecision = await post(`/api/requests/${cancellation.id}/review`, { status: 'Approved' });
  assert.equal(cancellationDecision.request.status, 'Approved');
  assert.equal(cancellationDecision.request.workflow, undefined);
  assert.equal(cancellationDecision.event.status, 'Cancelled');
});
