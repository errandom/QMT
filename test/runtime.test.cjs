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
