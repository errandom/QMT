const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('browser API contracts', async t => {
  const storage = new Map();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
  } });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.ts'), 'utf8')
    .replaceAll('import.meta.env', '({})');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  const { api, apiRequest, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  await t.test('public weekly transport never reads or clears storage and sends no credentials', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() {
      throw new Error('Storage is blocked in this third-party frame');
    } });
    const week = { weekStart: '2026-11-02', weekEnd: '2026-11-08', timezone: 'Europe/Zurich', clubName: 'Synthetic',
      events: [{ id: 1, start_time: '2026-11-02T23:00:00Z', end_time: '2026-11-03T01:00:00Z', team_ids: '1,2' }],
      teams: [{ id: 1, name: 'Synthetic team' }], sites: [], fields: [] };
    let body = week, status = 200;
    const controller = new AbortController();
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, '/api/public/week?week=2026-11-05');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.has('Authorization'), false);
      assert.ok(options.signal instanceof AbortSignal);
      return json(body, status);
    });
    try {
      const result = await api.getPublicWeek('2026-11-05', controller.signal);
      assert.equal(result.events[0].date, '2026-11-02');
      assert.equal(result.events[0].endDate, '2026-11-03');
      assert.equal(result.events[0].startTime, '23:00');
      assert.deepEqual(result.events[0].teamIds, ['1', '2']);
      for (const malformed of [{ ...week, weekStart: 'bad' }, { ...week, teams: [null] },
        { ...week, events: [{ id: 1, start_time: 'bad', end_time: 'bad' }] }, { ...week, fields: undefined }]) {
        body = malformed;
        await assert.rejects(api.getPublicWeek('2026-11-05'), /Invalid public weekly schedule/);
      }
      body = { error: 'Synthetic denied public route' }; status = 401;
      await assert.rejects(api.getPublicWeek('2026-11-05'), /Synthetic denied public route/);
    } finally {
      mock.mock.restore();
      Object.defineProperty(globalThis, 'localStorage', descriptor);
    }
  });
  await t.test('booking conflicts preserve typed detail and overrides are sent only when explicitly requested', async () => {
    const conflict = {
      eventId: 7, title: 'Existing practice', eventType: 'Practice', status: 'Confirmed',
      startTime: '2026-11-03T18:30:00Z', endTime: '2026-11-03T20:00:00Z',
      requestedStartTime: '2026-11-03T18:00:00Z', requestedEndTime: '2026-11-03T19:00:00Z',
      fields: [{ id: 1, name: 'Practice field', siteName: 'Synthetic site' }],
      teams: [{ id: 3, name: 'Other team' }],
    };
    const calls = [];
    let malformed = false;
    const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);
      if (body.allow_conflicts === true) return json({
        id: 9, start_time: conflict.requestedStartTime, end_time: conflict.requestedEndTime,
      });
      return json({ error: 'Location overlap', code: 'BOOKING_CONFLICT',
        conflicts: [malformed ? { eventId: 7 } : conflict], hasMoreConflicts: false }, 409);
    });
    try {
      await assert.rejects(api.createEvent({ description: 'Draft' }), error => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.deepEqual(error.bookingConflict, { conflicts: [conflict], hasMoreConflicts: false });
        return true;
      });
      assert.equal(calls[0].allow_conflicts, undefined);
      const saved = await api.updateEvent(9, { description: 'Draft', allow_conflicts: true });
      assert.equal(saved.id, '9');
      assert.equal(calls[1].allow_conflicts, true);
      malformed = true;
      await assert.rejects(api.createEvent({}), error => {
        assert.equal(error.bookingConflict, undefined);
        return true;
      });
    } finally { mock.mock.restore(); }
  });
  await t.test('site schedule URLs and booking names survive API reads, writes and explicit clearing', async () => {
    const source = 'https://example.com/public-plan';
    const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
      if (options.method === 'POST' || options.method === 'PUT') {
        const body = JSON.parse(options.body);
        return json({ id: 1, published_schedule_url: body.publishedScheduleUrl, published_booking_name: body.publishedBookingName });
      }
      return json([{ id: 1, published_schedule_url: source, published_booking_name: 'Synthetic Club' }]);
    });
    try {
      const [site] = await api.getSites();
      assert.equal(site.publishedScheduleUrl, source);
      assert.equal(site.publishedBookingName, 'Synthetic Club');
      const created = await api.createSite({ publishedScheduleUrl: source, publishedBookingName: 'Synthetic Club' });
      assert.equal(created.publishedScheduleUrl, source);
      assert.equal(created.publishedBookingName, 'Synthetic Club');
      const cleared = await api.updateSite(1, { publishedScheduleUrl: null, publishedBookingName: null });
      assert.equal(cleared.publishedScheduleUrl, '');
      assert.equal(cleared.publishedBookingName, '');
    } finally { mock.mock.restore(); }
  });
  await t.test('cursor pagination keeps a fixed time window and fetches every page', async () => {
    const calls = [];
    const event = id => ({ id, start_time: '2026-10-20T18:00:00Z', end_time: '2026-10-20T19:00:00Z' });
    const mock = t.mock.method(globalThis, 'fetch', async url => {
      calls.push(new URL(url, 'http://localhost'));
      return json(calls.length === 1 ? Array.from({ length: 500 }, (_, i) => event(i + 1)) : [event(501)]);
    });
    try {
      const events = await api.getEvents();
      assert.equal(events.length, 501);
      assert.equal(calls[1].searchParams.get('after'), '500');
      assert.equal(calls[0].searchParams.get('from'), calls[1].searchParams.get('from'));
      assert.equal(calls[0].searchParams.get('to'), calls[1].searchParams.get('to'));
    } finally { mock.mock.restore(); }
  });
  await t.test('explicit export window is forwarded and failures never become empty schedules', async () => {
    const range = { from: '2027-01-01T00:00:00Z', to: '2027-02-01T00:00:00Z' };
    const mock = t.mock.method(globalThis, 'fetch', async url => {
      const query = new URL(url, 'http://localhost').searchParams;
      assert.equal(query.get('from'), range.from);
      assert.equal(query.get('to'), range.to);
      return json({ error: 'synthetic database outage' }, 503);
    });
    try { await assert.rejects(api.getEvents(range), /synthetic database outage/); }
    finally { mock.mock.restore(); }
  });
  await t.test('capability calls can suppress bearer auth; ordinary calls use it', async () => {
    storage.set('auth_token', 'synthetic-token');
    const calls = [];
    const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => { calls.push(options); return json({}); });
    try {
      await apiRequest('/capabilities', { headers: { Authorization: '' } });
      await apiRequest('/health');
      assert.equal(calls[0].headers.get('Authorization'), '');
      assert.equal(calls[1].headers.get('Authorization'), 'Bearer synthetic-token');
      assert.ok(calls[1].signal instanceof AbortSignal);
    } finally { mock.mock.restore(); }
  });
  await t.test('request retries send the same idempotency key', async () => {
    const calls = [];
    const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => { calls.push(options); return json({ id: '1' }); });
    try {
      const key = 'bfa3338c-9970-4576-89c3-33a18258ad12';
      await api.createRequest('equipment', { equipmentDescription: 'Synthetic fixture' }, key);
      await api.createRequest('equipment', { equipmentDescription: 'Synthetic fixture' }, key);
      assert.equal(calls[0].headers.get('Idempotency-Key'), key);
      assert.equal(calls[1].headers.get('Idempotency-Key'), key);
    } finally { mock.mock.restore(); }
  });
  await t.test('request deletion sends authenticated current-state checks and surfaces conflicts', async () => {
    storage.set('auth_token', 'synthetic-operations-token');
    const calls = [];
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? json({ id: '7' }) : json({ error: 'Request has changed; refresh before deleting' }, 409);
    });
    try {
      assert.deepEqual(await api.deleteRequest('7', 'Rejected', 2), { id: '7' });
      assert.equal(calls[0].url, '/api/requests/7');
      assert.equal(calls[0].options.method, 'DELETE');
      assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer synthetic-operations-token');
      assert.deepEqual(JSON.parse(calls[0].options.body), { expectedStatus: 'Rejected', expectedVersion: 2 });
      await assert.rejects(api.deleteRequest('8', 'Pending'), /Request has changed/);
      assert.deepEqual(JSON.parse(calls[1].options.body), { expectedStatus: 'Pending' });
    } finally { mock.mock.restore(); }
  });
  await t.test('workbook target and preparation use authenticated transport and preserve action revisions and saved scope', async () => {
    storage.set('auth_token', 'synthetic-operations-token');
    const calls = [];
    const target = 'https://igacr.sharepoint.com/sites/vorstand/synthetic-workbook.xlsx';
    const details = {
      room: 'Synthetic room', occasion: 'Synthetic meeting', club: 'Synthetic club', participants: 12,
      responsibleName: 'Synthetic host', responsiblePhone: '5550101', responsibleEmail: 'host@example.invalid',
      comments: '', workbookUrl: target,
    };
    const saved = { id: '7', workflow: { version: 4, workbook: { details, dates: ['2027-04-26'] } } };
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? json({ url: target }) : calls.length === 2 ? json(saved) :
        json({ error: 'Synthetic workbook target unavailable' }, 503);
    });
    try {
      assert.deepEqual(await api.getMeetingRoomWorkbookTarget(), { url: target });
      assert.equal(calls[0].url, '/api/requests/workbook-target');
      assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer synthetic-operations-token');
      assert.deepEqual(await api.updateFacilityWorkflow('7', { action: 'prepare-workbook', details }, 3), saved);
      assert.equal(calls[1].url, '/api/requests/7/workflow');
      assert.deepEqual(JSON.parse(calls[1].options.body), { action: 'prepare-workbook', details, expectedVersion: 3 });
      await assert.rejects(api.getMeetingRoomWorkbookTarget(), /Synthetic workbook target unavailable/);
    } finally { mock.mock.restore(); }
  });
  await t.test('event end dates survive API transformation', async () => {
    const mock = t.mock.method(globalThis, 'fetch', async () => json([{
      id: 1, start_time: '2026-10-20T23:00:00Z', end_time: '2026-10-22T02:00:00Z',
    }]));
    try {
      const [event] = await api.getEvents();
      assert.equal(event.date, '2026-10-20');
      assert.equal(event.endDate, '2026-10-22');
      assert.equal(event.startTime, '23:00');
      assert.equal(event.endTime, '02:00');
    } finally { mock.mock.restore(); }
  });
  await t.test('transport drafts use canonical bearer auth and reject non-OK responses', async () => {
    storage.set('auth_token', 'synthetic-transport-token');
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, '/api/events/7/transport-request');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.get('Authorization'), 'Bearer synthetic-transport-token');
      return json({ error: 'synthetic draft unavailable' }, 503);
    });
    try { await assert.rejects(apiRequest('/events/7/transport-request', { method: 'POST' }), /synthetic draft unavailable/); }
    finally { mock.mock.restore(); }
  });
});
