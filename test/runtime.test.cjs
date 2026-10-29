const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('../server.js');
const secret = 'synthetic-runtime-test-secret-not-a-credential';

async function withApp(action, connect = async () => { throw new Error('Unexpected SQL connection'); }, env = {}) {
  const app = createApp({ env: { JWT_SECRET: secret, ...env }, connect });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await action(base); }
  finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await app.locals.close();
  }
}

test('boot, probes, retired endpoints and disabled providers never connect to SQL', async () => {
  await withApp(async base => {
    for (const [url, method, status] of [
      ['/api/health', 'GET', 200], ['/api/capabilities', 'GET', 200],
      ['/api/warmup', 'GET', 404], ['/api/llm/complete', 'POST', 410],
      ['/api/events/create-from-natural-language', 'POST', 410], ['/api/spond/config', 'GET', 503],
      ['/_spark/kv/private', 'GET', 410], ['/api/events', 'POST', 401],
      ['/api/events/1/transport-request', 'POST', 401],
      ['/api/requests', 'GET', 401], ['/api/diagnostic', 'GET', 401],
    ]) {
      const response = await fetch(base + url, { method });
      assert.equal(response.status, status, `${method} ${url}`);
    }
  });

});

test('legacy AI confirmation cannot write bookings even with a valid token and old provider settings', async () => {
  for (const nodeEnv of ['development', 'production']) {
    await withApp(async base => {
      const capabilities = await (await fetch(base + '/api/capabilities')).json();
      assert.equal(capabilities.ai, false);
      const token = jwt.sign({ id: 1, role: 'admin', username: 'test' }, secret);
      const response = await fetch(base + '/api/events/create-from-natural-language', {
        method: 'POST',
        headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, editedEvents: [{ title: 'Synthetic booking' }] }),
      });
      assert.equal(response.status, 410);
    }, undefined, { NODE_ENV: nodeEnv, AZURE_OPENAI_ENDPOINT: 'https://synthetic.invalid',
      AZURE_OPENAI_API_KEY: 'synthetic-only' });
  }
});

test('transport capability exposes no recipient and unconfigured drafts perform only session verification', async () => {
  await withApp(async base => {
    const body = await (await fetch(base + '/api/capabilities')).json();
    assert.equal(body.transport, false);
  });
  const contact = 'synthetic-transport@example.invalid';
  await withApp(async base => {
    const body = await (await fetch(base + '/api/capabilities')).json();
    assert.equal(body.transport, true);
    assert.ok(!JSON.stringify(body).includes(contact));
  }, undefined, { QMT_TRANSPORT_EMAIL: contact });
  let queries = 0;
  const pool = {
    connected: true, on() {}, async close() {},
    request() { return { input() { return this; }, async query(text) {
      queries++;
      assert.match(text, /SELECT role, is_active, username FROM users/);
      return { recordset: [{ role: 'mgmt', username: 'test', is_active: true }] };
    } }; },
  };
  await withApp(async base => {
    const token = jwt.sign({ id: 1, role: 'mgmt', username: 'test' }, secret);
    const response = await fetch(base + '/api/events/1/transport-request', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 503);
    assert.equal(queries, 1);
  }, async () => pool);
});

test('public DTOs exclude contacts, private notes and newly added database columns', async () => {
  const pool = {
    connected: true, on() {}, async close() {},
    request() { return { input() { return this; }, async query() { return { recordset: [
      { id: 1, name: 'Test', sport: 'Flag Football', head_coach_email: 'not-public', notes: 'private', future_secret: 'private' },
    ] }; } }; },
  };
  await withApp(async base => {
    const response = await fetch(base + '/api/teams');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, [{ id: 1, name: 'Test', sport: 'Flag Football' }]);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }, async () => pool);
});

test('current database role wins over an old administrator JWT', async () => {
  const pool = {
    connected: true, on() {}, async close() {},
    request() { return { input() { return this; }, async query() {
      return { recordset: [{ role: 'user', username: 'test', is_active: true }] };
    } }; },
  };
  await withApp(async base => {
    const token = jwt.sign({ id: 1, role: 'admin', username: 'test' }, secret);
    const response = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'another', password: 'synthetic-only', role: 'admin' }),
    });
    assert.equal(response.status, 403);
    const booking = await fetch(base + '/api/events', {
      method: 'POST', headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'Practice', start_time: '2026-11-03T18:00:00Z',
        end_time: '2026-11-03T19:00:00Z', field_ids: '1', allow_conflicts: true,
      }),
    });
    assert.equal(booking.status, 403);
  }, async () => pool);
});

test('site schedule settings round-trip, clear explicitly, survive old update payloads and remain out of public DTOs', async () => {
  const source = 'https://www.sportanlagen-app.net/Public/Spielplan?k=9&m=Synthetic&size=1&tag=0';
  let site = { id: 1, name: 'Synthetic Site', published_schedule_url: null, published_booking_name: null };
  let writes = 0;
  const pool = {
    connected: true, on() { }, async close() { },
    request() {
      const inputs = {};
      return {
        input(name, _type, value) { inputs[name] = value; return this; },
        async query(query) {
          if (query.includes('SELECT role, is_active, username FROM users')) {
            return { recordset: [{ role: 'mgmt', username: 'test', is_active: true }] };
          }
          if (query.includes('INSERT INTO sites')) {
            writes++;
            assert.match(query, /@published_schedule_url, @published_booking_name/);
            site = { ...site, published_schedule_url: inputs.published_schedule_url, published_booking_name: inputs.published_booking_name };
          }
          if (query.includes('UPDATE sites')) {
            writes++;
            assert.match(query, /CASE WHEN @published_schedule_url_present = 1 THEN @published_schedule_url ELSE published_schedule_url END/);
            assert.match(query, /CASE WHEN @published_booking_name_present = 1 THEN @published_booking_name ELSE published_booking_name END/);
            if (inputs.published_schedule_url_present) site.published_schedule_url = inputs.published_schedule_url;
            if (inputs.published_booking_name_present) site.published_booking_name = inputs.published_booking_name;
          }
          return { recordset: [{ ...site }] };
        },
      };
    },
  };
  await withApp(async base => {
    const token = jwt.sign({ id: 1, role: 'mgmt', username: 'test' }, secret);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const write = async (method, body) => fetch(`${base}/api/sites${method === 'POST' ? '' : '/1'}`, {
      method, headers, body: JSON.stringify({ name: site.name, ...body }),
    });
    const created = await write('POST', { publishedScheduleUrl: ` ${source} `, publishedBookingName: ' Synthetic Club ' });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).published_schedule_url, source);
    assert.equal(site.published_booking_name, 'Synthetic Club');
    const updated = await write('PUT', { isActive: false });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).published_schedule_url, source);
    assert.equal(site.published_booking_name, 'Synthetic Club');
    const publicSite = await (await fetch(`${base}/api/sites/1`)).json();
    assert.ok(!Object.hasOwn(publicSite, 'published_schedule_url'));
    assert.ok(!Object.hasOwn(publicSite, 'published_booking_name'));
    const cleared = await write('PUT', { publishedScheduleUrl: '', publishedBookingName: null });
    assert.equal(cleared.status, 200);
    assert.equal((await cleared.json()).published_schedule_url, null);
    assert.equal(site.published_booking_name, null);
    const before = writes;
    for (const bad of ['javascript:alert(1)', 'https://user:pass@example.com/', 5]) {
      assert.equal((await write('PUT', { publishedScheduleUrl: bad })).status, 400);
    }
    assert.equal(writes, before);
  }, async () => pool);
});

test('published schedule checks require fresh operations permission and validate identifiers before reading source settings', async () => {
  let role = 'user', active = true, reads = 0;
  let source = null;
  const pool = {
    connected: true, on() { }, async close() { },
    request() {
      return {
        input() { return this; },
        async query(query) {
          if (query.includes('SELECT role, is_active, username FROM users')) {
            return { recordset: [{ role, username: 'test', is_active: active }] };
          }
          assert.match(query, /SELECT published_schedule_url FROM sites WHERE id = @id/);
          reads++;
          return { recordset: [{ published_schedule_url: source }] };
        },
      };
    },
  };
  await withApp(async base => {
    const url = `${base}/api/sites/1/published-schedule?date=2026-10-29`;
    const token = jwt.sign({ id: 1, role: 'admin', username: 'test' }, secret);
    const headers = { Authorization: `Bearer ${token}` };
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers })).status, 403);
    assert.equal(reads, 0);
    role = 'mgmt';
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'not_configured');
    source = 'https://example.com/public-plan';
    const unsupported = await fetch(url, { headers });
    assert.equal((await unsupported.json()).status, 'unsupported');
    assert.equal(reads, 2);
    for (const path of ['/1/published-schedule?date=2026-02-31', '/2147483648/published-schedule?date=2026-10-29', '/1/published-schedule?date=x']) {
      assert.equal((await fetch(`${base}/api/sites${path}`, { headers })).status, 400);
    }
    assert.equal(reads, 2);
    active = false;
    assert.equal((await fetch(url, { headers })).status, 401);
  }, async () => pool);
});
test('invalid event ranges fail before SQL and oversized bodies are rejected', async () => {
  await withApp(async base => {
    assert.equal((await fetch(base + '/api/events?limit=501')).status, 400);
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x'.repeat(40000) }),
    });
    assert.equal(response.status, 413);
  });
});
