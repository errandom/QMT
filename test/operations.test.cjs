const { test } = require('node:test');
const assert = require('node:assert/strict');
const sql = require('mssql');
const { randomUUID } = require('node:crypto');
const { recurrence, requestDates, conflictsFor, validateAllocations, eventOperations, readiness, nextAction } = require('../server/operations-domain.cjs');
const { saveBooking } = require('../server/bookings.cjs');
const { createMailbox } = require('../server/mail.cjs');
const { registerOperationsRoutes } = require('../server/operations.cjs');
const { registerCommunicationRoutes } = require('../server/communications.cjs');
const { requestDto } = require('../server/requests.cjs');

const start = '2026-11-05T18:00:00.000Z', end = '2026-11-05T19:30:00.000Z';
const fixture = { id: 1, field_ids: '1', event_type: 'Practice', status: 'Confirmed', description: 'Youth practice',
  start_time: start, end_time: end, updated_at: '2026-11-01T10:00:00.000Z' };
const half = (zone, from = start, until = end) => ({ fieldId: '1', zones: [zone], start: from, end: until });
const event = allocations => ({ ...fixture, allocation_json: JSON.stringify(allocations) });
const external = { id: randomUUID(), field_id: 1, participant: 'Synthetic Rugby Academy', active: true,
  start_time: '2026-11-05T17:30:00.000Z', end_time: '2026-11-05T19:00:00.000Z', zones: '["north"]', revision: 1 };

test('season dates exclude holidays, respect ISO weekdays and reject empty or oversized seasons', () => {
  const request = { date: '2026-11-02', recurrence: recurrence.parse({
    until: '2026-11-12', weekdays: [2, 4], excludedDates: ['2026-11-05'],
  }) };
  assert.deepEqual(requestDates(request), ['2026-11-03', '2026-11-10', '2026-11-12']);
  assert.throws(() => requestDates({ ...request, recurrence: { ...request.recurrence, until: '2028-01-01' } }), /366/);
  assert.throws(() => requestDates({ ...request, recurrence: { until: '2026-11-02', weekdays: [2] } }), /no requested dates/);
  assert.equal(recurrence.safeParse({ until: '2027-02-30', weekdays: [2] }).success, false);
});

test('time-dependent halves coexist with Rugby, but exclusive use and overlapping halves are blocked', () => {
  const candidate = event([half('south', start, external.end_time), { fieldId: '1', zones: [], start: external.end_time, end }]);
  assert.deepEqual(conflictsFor(candidate, [], [external]), []);
  assert.equal(conflictsFor(event([]), [], [external])[0].external, true);
  assert.equal(conflictsFor(event([half('north')]), [], [external]).length, 1);
  assert.equal(conflictsFor(event([half('south')]), [event([half('north')])]).length, 0);
  assert.equal(conflictsFor(event([]), [{ ...event([]), status: 'Cancelled' }]).length, 0);
  assert.equal(conflictsFor(event([]), [{ ...event([]), id: 2 }], [], [2]).length, 0);
  validateAllocations(JSON.parse(candidate.allocation_json), [{ id: 1, location_type: 'field' }], start, end);
  assert.throws(() => validateAllocations([half('south', start, external.end_time)], [{ id: 1 }], start, end), /whole booking/);
  assert.throws(() => validateAllocations([half('south')], [{ id: 1, location_type: 'meeting_room' }], start, end), /Meeting rooms/);
});

test('game readiness cannot be inferred from booking confirmation and closure requires evidence', () => {
  const game = { ...fixture, event_type: 'Game' };
  assert.equal(readiness(game), 'Not reviewed');
  const item = { id: randomUUID(), category: 'Music', title: 'Sound approval', status: 'Approved', owner: 'Operator', dueDate: '2026-11-04', evidence: '' };
  assert.equal(eventOperations.safeParse({ owner: 'Operator', checklist: [item] }).success, false);
  assert.equal(eventOperations.safeParse({ owner: '', checklist: [{ ...item, status: 'Not required' }] }).success, false);
  const metadata = eventOperations.parse({ owner: 'Operator', checklist: [{ ...item, evidence: 'Reference TEST-1' }] });
  assert.equal(readiness(game, metadata), 'Ready');
  assert.equal(readiness({ ...game, field_ids: '', game_location: 'home' }, metadata), 'Location needed');
  assert.equal(readiness(game, { ...metadata, checklist: [{ ...item, status: 'Blocked' }] }), 'Blocked');
  assert.equal(nextAction({ status: 'Pending', workflow: { stage: 'Awaiting response' } }), 'Follow up with department');
  assert.equal(nextAction({ status: 'Approved', workflow: {} }), 'Notify requester');
});

test('mail transport reports provider acceptance, rejects missing config and distinguishes uncertain sends', async () => {
  const env = { QMT_MAIL_TENANT_ID: 'test-tenant', QMT_MAIL_CLIENT_ID: 'test-client',
    QMT_MAIL_CLIENT_SECRET: 'synthetic-only', QMT_MAIL_SENDER: 'club@example.invalid' };
  const calls = [];
  const mailbox = createMailbox(env, async (url, options) => {
    calls.push({ url, options });
    return url.includes('/token') ? Response.json({ access_token: 'synthetic-token', expires_in: 3600 }) : new Response(null, { status: 202 });
  });
  const message = { recipient: 'requester@example.invalid', subject: '[QMT-1] Test', message: 'Synthetic receipt' };
  assert.equal(await mailbox.send(message), 'accepted');
  assert.equal(await mailbox.send(message), 'accepted');
  assert.equal(calls.filter(call => call.url.includes('/token')).length, 1);
  assert.equal(JSON.parse(calls[1].options.body).message.body.contentType, 'Text');
  await assert.rejects(createMailbox({}).send(message), /not configured/);
  const uncertain = createMailbox(env, async url => {
    if (url.includes('/token')) return Response.json({ access_token: 'test', expires_in: 3600 });
    throw new Error('Synthetic connection drop');
  });
  await assert.rejects(uncertain.send(message), error => error.deliveryUnknown === true && /unknown/.test(error.message));
  const rejected = createMailbox(env, async url => url.includes('/token')
    ? Response.json({ access_token: 'test', expires_in: 3600 }) : new Response(null, { status: 403 }));
  await assert.rejects(rejected.send(message), error => error.status === 503 && error.deliveryUnknown === false);
});

function harness(t, initial = {}) {
  const store = { events: [structuredClone(fixture)], external: [], metadata: [], communications: [], requests: [], ...initial };
  const queries = [];
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
      queries.push(query);
      const v = this.values, rows = records => ({ recordset: structuredClone(records) });
      if (query.includes('sp_getapplock')) return rows([]);
      if (query.startsWith('SELECT * FROM requests')) return rows(store.requests.filter(row => row.id === v.id));
      if (query.startsWith('UPDATE requests')) {
        const row = store.requests.find(row => row.id === v.id); row.payload = v.payload; return rows([row]);
      }
      if (query.startsWith('SELECT TOP (1001)')) return rows(store.communications.filter(row => row.request_id === v.id));
      if (query.startsWith('SELECT * FROM request_communications')) return rows(store.communications.filter(row => row.id === v.id));
      if (query.startsWith('SELECT id FROM request_communications')) return rows(store.communications.filter(row => row.provider_id === v.provider));
      if (query.startsWith('INSERT INTO request_communications')) {
        store.communications.push({ id: v.id, request_id: v.request, direction: v.provider ? 'inbound' : 'outbound',
          status: v.provider ? 'received' : 'sending', recipient: v.recipient, subject: v.subject, message: v.message,
          provider_id: v.provider, workflow_action: v.action, expected_version: v.version }); return rows([]);
      }
      if (query.startsWith('UPDATE request_communications')) {
        store.communications.find(row => row.id === v.id).status = v.status; return rows([]);
      }
      if (query.startsWith('SELECT TOP (368)') || query.includes('WHERE series_id = @series')) {
        return rows(store.events.filter(row => row.series_id === (v.id || v.series)));
      }
      if (query.startsWith('SELECT * FROM events')) return rows(store.events.filter(row => row.id === v.id));
      if (query.startsWith('SELECT TOP (5001) * FROM events')) return rows(store.events);
      if (query.startsWith('SELECT TOP (5001) * FROM external_allocations') || query.startsWith('SELECT * FROM external_allocations WHERE active')) return rows(store.external);
      if (query.startsWith('SELECT * FROM external_allocations')) return rows(store.external.filter(row => row.id === v.id));
      if (query.startsWith('SELECT revision FROM event_operations')) return rows(store.metadata.filter(row => row.event_id === v.id));
      if (query.startsWith('SELECT TOP (5001) event_id')) return rows(store.metadata);
      if (query.startsWith('INSERT INTO event_operations') || query.startsWith('UPDATE event_operations')) {
        const row = store.metadata.find(row => row.event_id === v.id);
        if (row) Object.assign(row, { revision: v.revision, payload: v.payload });
        else store.metadata.push({ event_id: v.id, revision: v.revision, payload: v.payload });
        return rows([]);
      }
      if (query.startsWith('SELECT f.id')) return rows([{ id: v.id || 1, location_type: 'field', name: 'Test field' }]);
      if (query.includes('FROM OPENJSON(@intervals)')) return rows([]);
      if (query.startsWith('SELECT id FROM teams')) return rows([{ id: v.id }]);
      if (query.startsWith('UPDATE events')) {
        const row = store.events.find(row => row.id === v.id);
        Object.assign(row, v); return rows([row]);
      }
      if (query.startsWith('INSERT INTO events')) {
        const row = { ...v, id: store.events.length + 1 }; store.events.push(row); return rows([row]);
      }
      if (query.startsWith('INSERT INTO external_allocations') || query.startsWith('UPDATE external_allocations')) {
        const row = { id: v.id, field_id: v.field, participant: v.participant, start_time: v.start,
          end_time: v.end, zones: v.zones, active: v.active, revision: v.revision };
        const prior = store.external.findIndex(item => item.id === v.id);
        if (prior < 0) store.external.push(row); else store.external[prior] = row;
        return rows([]);
      }
      throw new Error(`Unexpected operations SQL: ${query}`);
    }
  }
  t.mock.method(sql, 'Transaction', function () { return new Transaction(); });
  t.mock.method(sql, 'Request', function () { return new Request(); });
  const routes = new Map(), logs = [];
  const app = Object.fromEntries(['get', 'post', 'put'].map(method => [method, (url, handler) => routes.set(`${method} ${url}`, handler)]));
  const context = { getPool: async () => ({ request: () => new Request() }), logger: {
    error: (...args) => logs.push(args), warn() {}, info() {},
  } };
  const call = async (method, url, params, body = {}, query = {}) => {
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    await routes.get(`${method} ${url}`)({ params, body, query, user: { id: 1, username: 'Test operator' } }, response);
    return response;
  };
  return { store, context, app, call, queries, logs };
}

test('operations saves are revision-checked, persist readiness independently and validate external overlaps', async t => {
  const h = harness(t);
  registerOperationsRoutes(h.app, h.context);
  const body = { owner: 'Operations', checklist: [], expectedRevision: 0 };
  let response = await h.call('put', '/api/operations/events/:id', { id: '1' }, body);
  assert.equal(response.statusCode, 200);
  assert.equal(h.store.metadata[0].revision, 1);
  assert.equal(h.store.events[0].status, 'Confirmed');
  response = await h.call('put', '/api/operations/events/:id', { id: '1' }, body);
  assert.equal(response.statusCode, 409);
  const id = randomUUID();
  const block = { fieldId: '1', participant: external.participant, start: external.start_time, end: external.end_time,
    zones: ['north'], active: true, expectedRevision: 0 };
  response = await h.call('put', '/api/operations/external/:id', { id }, block);
  assert.equal(response.statusCode, 409);
  assert.equal(h.store.external.length, 0);
  response = await h.call('put', '/api/operations/external/:id', { id }, { ...block, allowConflicts: true });
  assert.equal(response.statusCode, 200);
  assert.equal(h.store.external[0].revision, 1);
  response = await h.call('put', '/api/operations/external/:id', { id }, { ...block, active: false });
  assert.equal(response.statusCode, 409);
  assert.ok(h.queries.filter(query => query.includes('sp_getapplock')).length >= 5);
});

test('seasonal approval preview checks each date and returns compatible alternatives', async t => {
  const request = { type: 'facility', requestorName: 'Test requester', requestorPhone: '555', locationType: 'field',
    eventType: 'Practice', date: '2026-11-05', startTime: '18:00', duration: 90,
    recurrence: { until: '2026-11-12', weekdays: [4], excludedDates: [] } };
  const h = harness(t, { requests: [{ id: 1, request_type: 'facility', status: 'pending', payload: JSON.stringify(request) }] });
  registerOperationsRoutes(h.app, h.context);
  const result = await h.call('post', '/api/operations/requests/:id/preview', { id: '1' }, { fieldId: '1' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.length, 2);
  assert.equal(result.body[0].conflicts.length, 1);
  assert.equal(result.body[1].conflicts.length, 0);
});

test('scoped changes reject stale membership, preserve series IDs and roll back invalid allocations', async t => {
  const seriesId = randomUUID();
  const rows = [0, 7, 14].map((offset, index) => ({ ...fixture, id: index + 1, series_id: seriesId,
    start_time: new Date(Date.parse(start) + offset * 86400000),
    end_time: new Date(Date.parse(end) + offset * 86400000) }));
  const h = harness(t, { events: rows });
  registerOperationsRoutes(h.app, h.context);
  const expected = rows.slice(1).map(row => ({ id: row.id, updatedAt: row.updated_at }));
  const body = { anchorId: 2, scope: 'future', startTime: '18:30', endTime: '20:00', status: 'Planned', expected };
  let result = await h.call('post', '/api/operations/series/:id', { id: seriesId }, { ...body, expected: expected.slice(0, 1) });
  assert.equal(result.statusCode, 409);
  result = await h.call('post', '/api/operations/series/:id', { id: seriesId }, body);
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.equal(h.store.events[0].start_time.toISOString(), start);
  assert.equal(new Date(h.store.events[1].start_time).toISOString().slice(11, 16), '18:30');
  assert.ok(h.store.events.every(row => row.series_id === seriesId));
  h.store.external = [{ ...external, start_time: '2026-11-19T18:45:00.000Z', end_time: '2026-11-19T20:30:00.000Z', zones: '[]' }];
  const snapshot = structuredClone(h.store.events);
  result = await h.call('post', '/api/operations/series/:id', { id: seriesId }, body);
  assert.equal(result.statusCode, 409);
  assert.deepEqual(h.store.events, snapshot);
});

test('booking saves keep recurrence identity and reject externally reserved zones', async t => {
  const h = harness(t, { external: [external] });
  const body = { event_type: 'Practice', status: 'Confirmed', start_time: start, end_time: end, field_ids: '1' };
  await assert.rejects(saveBooking({}, body), error => error.status === 409 && /External/.test(error.message));
  const saved = await saveBooking({}, { ...body, allocations: [half('south')] });
  assert.deepEqual(JSON.parse(saved.allocation_json)[0].zones, ['south']);
  h.store.external = [];
  const series = await saveBooking({}, { ...body, recurring_days: '4', recurring_end_date: '2026-11-12' });
  assert.equal(series.length, 2);
  assert.ok(series[0].series_id && series[0].series_id === series[1].series_id);
});

test('allocation edits preserve restrictions and recurrence starts on its first matching weekday', async t => {
  const h = harness(t, { events: [{ ...fixture, allocation_json: JSON.stringify([half('south')]) }] });
  const body = { event_type: 'Practice', status: 'Confirmed', start_time: start, end_time: end, field_ids: '1' };
  await assert.rejects(saveBooking({}, { ...body, end_time: '2026-11-05T20:00:00.000Z' }, 1),
    error => error.status === 400 && /complete allocation timeline/.test(error.message));
  assert.equal(h.store.events[0].end_time, end);
  const shifted = await saveBooking({}, { ...body, start_time: '2026-11-05T18:30:00.000Z', end_time: '2026-11-05T20:00:00.000Z' }, 1);
  assert.deepEqual(JSON.parse(shifted.allocation_json), [half('south', '2026-11-05T18:30:00.000Z', '2026-11-05T20:00:00.000Z')]);
  const series = await saveBooking({}, { ...body, recurring_days: '5', recurring_end_date: '2026-11-13',
    allocations: [half('north')] });
  assert.equal(series.length, 2);
  assert.equal(JSON.parse(series[0].allocation_json)[0].start, '2026-11-06T18:00:00.000Z');
  assert.equal(JSON.parse(series[1].allocation_json)[0].end, '2026-11-13T19:30:00.000Z');
});

test('approved email sends are durable and idempotent; reply sync never automatically approves requests', async t => {
  const request = { type: 'facility', requestorName: 'Test requester', requestorPhone: '555',
    requestorEmail: 'requester@example.invalid', locationType: 'field', eventType: 'Practice',
    date: '2026-11-05', startTime: '18:00', duration: 90 };
  const h = harness(t, { requests: [{ id: 1, request_type: 'facility', status: 'pending',
    payload: JSON.stringify(request), created_at: '2026-11-01T10:00:00Z' }] });
  let sends = 0;
  registerCommunicationRoutes(h.app, { ...h.context, mailbox: { configured: true,
    async send() { sends++; return 'accepted'; },
    async replies() { return [{ id: 'reply-1', subject: 'Re: [QMT-1] Receipt', from: { emailAddress: { address: 'requester@example.invalid' } },
      body: { contentType: 'text', content: 'Thanks; can we discuss the allocation?' } }]; },
  } });
  const body = { id: randomUUID(), recipient: request.requestorEmail, subject: 'Receipt', message: 'Received, not confirmed.',
    action: 'acknowledge', expectedVersion: 0, approved: true };
  let response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, { ...body, approved: false });
  assert.equal(response.statusCode, 400);
  assert.equal(sends, 0);
  response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, body);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'accepted');
  assert.equal(requestDto(h.store.requests[0]).workflow.stage, 'Acknowledged');
  response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, body);
  assert.equal(response.body.duplicate, true);
  assert.equal(sends, 1);
  response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, { ...body, message: 'Changed content' });
  assert.equal(response.statusCode, 409);
  for (let i = 0; i < 2; i++) await h.call('post', '/api/operations/requests/:id/sync-replies', { id: '1' });
  assert.equal(h.store.communications.length, 2);
  assert.equal(h.store.communications[1].direction, 'inbound');
  assert.equal(requestDto(h.store.requests[0]).status, 'Pending');
  assert.equal(requestDto(h.store.requests[0]).workflow.stage, 'Acknowledged');
});

test('uncertain sends remain durable and are never retried by replaying the same message ID', async t => {
  const request = { type: 'facility', requestorName: 'Test requester', requestorPhone: '555',
    requestorEmail: 'requester@example.invalid', locationType: 'field', eventType: 'Practice',
    date: '2026-11-05', startTime: '18:00', duration: 90 };
  const h = harness(t, { requests: [{ id: 1, request_type: 'facility', status: 'pending', payload: JSON.stringify(request) }] });
  let sends = 0;
  registerCommunicationRoutes(h.app, { ...h.context, mailbox: { configured: true, async send() {
    sends++;
    const error = new Error('Synthetic send outcome unknown'); error.deliveryUnknown = true; throw error;
  } } });
  const body = { id: randomUUID(), recipient: request.requestorEmail, subject: 'Receipt', message: 'Receipt.',
    action: 'acknowledge', expectedVersion: 0, approved: true };
  let response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, body);
  assert.equal(response.statusCode, 503);
  assert.equal(h.store.communications[0].status, 'unknown');
  assert.equal(requestDto(h.store.requests[0]).workflow, undefined);
  response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, body);
  assert.equal(response.body.status, 'unknown');
  assert.equal(response.body.duplicate, true);
  assert.equal(sends, 1);
});

test('provider acceptance survives concurrent workflow changes without falsely applying the old action', async t => {
  const request = { type: 'facility', requestorName: 'Test requester', requestorPhone: '555',
    requestorEmail: 'requester@example.invalid', locationType: 'field', eventType: 'Practice',
    date: '2026-11-05', startTime: '18:00', duration: 90 };
  const h = harness(t, { requests: [{ id: 1, request_type: 'facility', status: 'pending', payload: JSON.stringify(request) }] });
  registerCommunicationRoutes(h.app, { ...h.context, mailbox: { configured: true, async send() {
    h.store.requests[0].payload = JSON.stringify({ ...request, workflow: {
      version: 1, stage: 'Received', owner: 'Concurrent operator', history: [],
    } });
    return 'accepted';
  } } });
  const response = await h.call('post', '/api/operations/requests/:id/messages', { id: '1' }, {
    id: randomUUID(), recipient: request.requestorEmail, subject: 'Receipt', message: 'x'.repeat(16000),
    action: 'acknowledge', expectedVersion: 0, approved: true,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.workflowApplied, false);
  assert.equal(h.store.communications[0].status, 'accepted');
  assert.equal(requestDto(h.store.requests[0]).workflow.stage, 'Received');
  assert.equal(h.store.communications[0].message.length, 16000);
});
