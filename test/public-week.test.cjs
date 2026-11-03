const { test } = require('node:test');
const assert = require('node:assert/strict');
const { weekRange } = require('../server/public-schedule.cjs');
const { createApp } = require('../server.js');

test('club current week respects Zurich midnight, DST and year boundaries', () => {
  for (const [now, start, end] of [
    ['2026-11-01T22:59:00Z', '2026-10-26', '2026-11-01'],
    ['2026-11-01T23:01:00Z', '2026-11-02', '2026-11-08'],
    ['2026-03-29T22:01:00Z', '2026-03-30', '2026-04-05'],
    ['2027-01-01T00:00:00Z', '2026-12-28', '2027-01-03'],
  ]) {
    const range = weekRange(undefined, 'Europe/Zurich', new Date(now));
    assert.equal(range.weekStart, start);
    assert.equal(range.weekEnd, end);
    assert.equal(range.to - range.from, 7 * 86400000);
  }
  assert.equal(weekRange('2026-11-08', 'Europe/Zurich').weekStart, '2026-11-02');
  for (const value of ['2026-02-30', '2026-2-3', '', ['2026-11-02', '2026-11-03'], '0000-01-01', '9999-12-31']) {
    assert.throws(() => weekRange(value, 'Europe/Zurich'), /valid week|calendar range/);
  }
});

test('weekly endpoint bounds SQL, fails explicitly, strips private data even with bearer auth and isolates framing', async () => {
  const calls = [];
  let count = 1, failing = false;
  const pool = {
    connected: true, on() {}, async close() {},
    request() {
      const inputs = {};
      return {
        input(name, _type, value) { inputs[name] = value; return this; },
        async query(text) {
          calls.push({ text, inputs });
          if (failing) throw new Error('Synthetic public SQL outage');
          assert.ok(!text.includes('FROM users'));
          const row = { id: 1, name: 'Synthetic', description: 'Public practice',
            start_time: '2026-11-02T18:00:00Z', end_time: '2026-11-02T19:00:00Z',
            notes: 'private-note', contact_email: 'private-contact', future_secret: 'private-secret',
            head_coach_email: 'private-coach', spond_id: 'private-spond', attendance: 'private-attendance' };
          return { recordset: Array.from({ length: text.includes('FROM events') ? count : 1 }, () => row) };
        },
      };
    },
  };
  const app = createApp({ env: { JWT_SECRET: 'synthetic-public-week-secret-not-a-credential',
    QMT_EMBED_ORIGINS: 'https://club.example', QMT_CLUB_NAME: 'Synthetic club' }, connect: async () => pool });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const query of ['week=invalid', 'week=2026-02-30', 'week=2026-11-02&week=2026-11-03']) {
      assert.equal((await fetch(`${base}/api/public/week?${query}`)).status, 400);
    }
    assert.equal(calls.length, 0);
    for (const headers of [{}, { Authorization: 'Bearer synthetic-invalid-token' }]) {
      const response = await fetch(`${base}/api/public/week?week=2026-11-05`, { headers });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.weekStart, '2026-11-02');
      assert.equal(body.weekEnd, '2026-11-08');
      assert.equal(body.clubName, 'Synthetic club');
      assert.equal(body.events.length, 1);
      assert.equal(body.events[0].description, 'Public practice');
      assert.ok(!JSON.stringify(body).includes('private-'));
    }
    const bookingQueries = calls.filter(call => call.text.includes('FROM events'));
    assert.match(bookingQueries[0].text, /TOP \(1001\).*start_time < @to AND end_time > @from/);
    assert.equal(bookingQueries[0].inputs.from.toISOString(), '2026-11-02T00:00:00.000Z');
    assert.equal(bookingQueries[0].inputs.to.toISOString(), '2026-11-09T00:00:00.000Z');
    count = 1001;
    assert.equal((await fetch(`${base}/api/public/week`)).status, 503);
    failing = true;
    assert.equal((await fetch(`${base}/api/public/week`)).status, 503);
    for (const [url, policy] of [['/embed/week', "'self' https://club.example"], ['/', "'self'"]]) {
      const response = await fetch(base + url);
      assert.equal(response.headers.get('content-security-policy'), `frame-ancestors ${policy}`);
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    }
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await app.locals.close();
  }
});
