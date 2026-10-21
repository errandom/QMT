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
  const { api, apiRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
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
