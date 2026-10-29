const { test } = require('node:test');
const assert = require('node:assert/strict');
const sql = require('mssql');
const { saveBooking, BookingConflictError, registerBookingRoutes } = require('../server/bookings.cjs');

const body = {
  event_type: 'Practice', status: 'Planned', description: 'Youth practice',
  start_time: '2026-11-03T18:00:00Z', end_time: '2026-11-03T19:00:00Z',
  field_ids: '1', team_ids: '2',
};
const row = (id, day = '03') => ({
  id, description: 'Existing practice', event_type: 'Practice', status: 'Confirmed',
  start_time: new Date(`2026-11-${day}T18:30:00Z`), end_time: new Date(`2026-11-${day}T20:00:00Z`),
  requested_start: new Date(`2026-11-${day}T18:00:00Z`), requested_end: new Date(`2026-11-${day}T19:00:00Z`),
  fields: JSON.stringify([{ id: 1, name: 'Practice field', siteName: 'Synthetic site' }]),
  teams: JSON.stringify([{ id: 3, name: 'Other team' }]),
});

function database(t, { conflicts = [], unavailableField = false, failWrite = false } = {}) {
  const queries = [], writes = [];
  let committed = false, rolledBack = false, locked = false;
  t.mock.method(sql, 'Transaction', function () {
    return {
      async begin() {}, on() {},
      async commit() { committed = true; },
      async rollback() { rolledBack = true; },
    };
  });
  t.mock.method(sql, 'Request', function () {
    const inputs = {};
    return {
      input(name, _type, value) { inputs[name] = value; return this; },
      async query(query) {
        queries.push({ query, inputs });
        if (query.includes('sp_getapplock')) { locked = true; return { recordset: [] }; }
        if (query.includes('FROM OPENJSON(@intervals)')) return { recordset: conflicts };
        if (query.includes('FROM fields f JOIN sites')) return { recordset: unavailableField ? [] : [{ id: inputs.id }] };
        if (query.startsWith('SELECT id FROM')) return { recordset: [{ id: inputs.id }] };
        assert.match(query, /^(INSERT INTO events|UPDATE events)/);
        if (failWrite) throw new Error('Synthetic database write failure');
        const saved = { ...inputs, id: inputs.id || 100 + writes.length };
        writes.push(saved);
        return { recordset: [saved] };
      },
    };
  });
  return { queries, writes, committed: () => committed, rolledBack: () => rolledBack, locked: () => locked };
}

test('all recurrence conflicts include dates, teams and selected locations before any event write', async t => {
  const fixture = database(t, { conflicts: [row(7), row(8, '10')] });
  await assert.rejects(saveBooking({}, { ...body, recurring_days: '2', recurring_end_date: '2026-11-10' }), error => {
    assert.ok(error instanceof BookingConflictError);
    assert.equal(error.status, 409);
    assert.equal(error.conflicts.length, 2);
    assert.equal(error.hasMoreConflicts, false);
    assert.equal(error.conflicts[1].eventId, 8);
    assert.equal(error.conflicts[1].requestedStartTime.toISOString(), '2026-11-10T18:00:00.000Z');
    assert.equal(error.conflicts[0].fields[0].siteName, 'Synthetic site');
    assert.equal(error.conflicts[0].teams[0].name, 'Other team');
    return true;
  });
  assert.equal(fixture.writes.length, 0);
  const preflight = fixture.queries.find(item => item.query.includes('FROM OPENJSON(@intervals)'));
  assert.equal(JSON.parse(preflight.inputs.intervals).length, 2);
  assert.equal(JSON.parse(preflight.inputs.intervals)[0].start, '2026-11-03T18:00:00.000');
  assert.equal(preflight.inputs.fields, '1');
  assert.match(preflight.query, /e\.start_time < occurrence\.end_time AND e\.end_time > occurrence\.start_time/);
  assert.match(preflight.query, /Cancelled.*Completed/);
});

test('omitted and false overrides reject overlaps; only boolean true allows the complete series', async t => {
  const fixture = database(t, { conflicts: [row(7)] });
  for (const allow_conflicts of [undefined, false]) {
    await assert.rejects(saveBooking({}, { ...body, allow_conflicts }), error => error.status === 409);
  }
  for (const allow_conflicts of ['true', 1, null]) {
    await assert.rejects(saveBooking({}, { ...body, allow_conflicts }), error => error.status === 400);
  }
  assert.equal(fixture.writes.length, 0);
  const saved = await saveBooking({}, {
    ...body, allow_conflicts: true, recurring_days: '2', recurring_end_date: '2026-11-10',
  });
  assert.equal(saved.length, 2);
  assert.equal(fixture.writes.length, 2);
  assert.equal(fixture.writes[1].start_time.toISOString(), '2026-11-10T18:00:00.000Z');
  assert.ok(fixture.writes.every(event => !Object.hasOwn(event, 'allow_conflicts')));
});

test('updates exclude only their own original event and can explicitly allow other bookings', async t => {
  const fixture = database(t, { conflicts: [row(7)] });
  await assert.rejects(saveBooking({}, body, 9), error => error.status === 409);
  const preflight = fixture.queries.find(item => item.query.includes('FROM OPENJSON(@intervals)'));
  assert.equal(preflight.inputs.id, 9);
  assert.match(preflight.query, /@id IS NULL OR e\.id <> @id/);
  const saved = await saveBooking({}, { ...body, allow_conflicts: true }, 9);
  assert.equal(saved.id, 9);
  assert.equal(fixture.writes.length, 1);
});

test('overrides do not bypass field availability, confirmed-location rules or self-overlapping series validation', async t => {
  const fixture = database(t, { unavailableField: true });
  await assert.rejects(saveBooking({}, { ...body, allow_conflicts: true }), error => error.status === 400);
  await assert.rejects(saveBooking({}, { ...body, allow_conflicts: true, status: 'Confirmed', field_ids: null }),
    error => error.status === 400);
  assert.equal(fixture.writes.length, 0);
});

test('self-overlapping recurrence is rejected before writes, even when existing-booking overrides are allowed', async t => {
  const fixture = database(t);
  await assert.rejects(saveBooking({}, {
    ...body, end_time: '2026-11-05T19:00:00Z', allow_conflicts: true,
    recurring_days: '1,2,3,4,5,6,7', recurring_end_date: '2026-11-05',
  }), error => error.status === 409 && /overlap each other/.test(error.message));
  assert.equal(fixture.writes.length, 0);
});

test('large series conflict responses disclose truncation instead of implying a complete list', async t => {
  database(t, { conflicts: Array.from({ length: 201 }, (_, index) => row(index + 1)) });
  await assert.rejects(saveBooking({}, body), error => {
    assert.equal(error.conflicts.length, 200);
    assert.equal(error.hasMoreConflicts, true);
    return true;
  });
});

test('booking routes return structured conflicts, retain the transaction lock and log explicit successful overrides', async t => {
  const fixture = database(t, { conflicts: [row(7)] });
  const routes = [], logs = [];
  const app = Object.fromEntries(['post', 'put', 'delete'].map(method => [method, (url, handler) => routes.push({ method, url, handler })]));
  registerBookingRoutes(app, { getPool: async () => ({}), logger: { error() {}, warn: (...args) => logs.push(args) } });
  const handler = routes.find(route => route.method === 'post').handler;
  const response = {
    statusCode: 200, status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; }, end() {},
  };
  await handler({ body, params: {}, user: { id: 4 } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'BOOKING_CONFLICT');
  assert.equal(response.body.conflicts[0].eventId, 7);
  assert.equal(fixture.rolledBack(), true);
  assert.equal(fixture.writes.length, 0);
  await handler({ body: { ...body, allow_conflicts: true }, params: {}, user: { id: 4 } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(fixture.committed(), true);
  assert.equal(fixture.locked(), true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][1].userId, 4);
});

test('an override cannot turn a database write failure into a successful booking', async t => {
  const fixture = database(t, { failWrite: true });
  const routes = [];
  const app = Object.fromEntries(['post', 'put', 'delete'].map(method => [method, (_url, handler) => routes.push({ method, handler })]));
  registerBookingRoutes(app, { getPool: async () => ({}), logger: { error() {}, warn() { throw new Error('Unexpected successful override log'); } } });
  const response = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await routes.find(route => route.method === 'post').handler({
    body: { ...body, allow_conflicts: true }, params: {}, user: { id: 4 },
  }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(fixture.rolledBack(), true);
  assert.equal(fixture.committed(), false);
});
