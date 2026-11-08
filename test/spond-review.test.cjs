const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createApp } = require('../server.js');
const { registerSpondReviewRoutes } = require('../server/spond-review.cjs');
const { consumeReviewQuota } = require('../server/spond-review-quota.cjs');
const { checkSpondReview } = require('../scripts/check-spond-review.cjs');
const { flattenGroups, suggestMappings, reviewRange, reconcileEvents } = require('../server/spond-review-domain.cjs');

const groupId = 'A'.repeat(32), subgroupId = 'B'.repeat(32), eventId = 'C'.repeat(32);
const otherId = 'D'.repeat(32);
const secret = 'synthetic-spond-review-test-secret-not-a-credential';
const groups = [{ id: groupId, name: 'Synthetic club', members: [{ email: 'private@example.invalid' }],
  subGroups: [{ id: subgroupId, name: 'U19' }] }];
const range = { ...reviewRange('2026-11-04', '2026-11-05'), timezone: 'Europe/Zurich' };
const local = (extra = {}) => ({ id: 1, description: 'Training', event_type: 'Practice', status: 'Confirmed',
  start_time: '2026-11-04T18:00:00Z', end_time: '2026-11-04T19:00:00Z', ...extra });
const remote = (extra = {}) => ({ id: eventId, heading: 'Training', cancelled: false,
  startTimestamp: '2026-11-04T17:00:00Z', endTimestamp: '2026-11-04T18:00:00Z', ...extra });

test('discovery flattens subgroups, preserves existing mappings and never confirms suggestions or exposes members', () => {
  const found = flattenGroups(groups);
  assert.equal(found[1].parentGroupId, groupId);
  assert.ok(!JSON.stringify(found).includes('private@'));
  const suggestions = suggestMappings([
    { id: 1, name: 'U19' },
    { id: 2, name: 'Unrelated', spond_group_id: subgroupId.toLowerCase() },
    { id: 3, name: 'U19', spond_group_id: otherId },
  ], found);
  assert.equal(suggestions[0].suggestedGroupId, subgroupId);
  assert.match(suggestions[0].reason, /not confirmed/);
  assert.equal(suggestions[1].suggestedGroupId, subgroupId);
  assert.equal(suggestions[2].suggestedGroupId, null, 'do not silently replace an inaccessible existing link');
  const ambiguous = suggestMappings([{ id: 1, name: 'U19' }], [...found, { id: otherId, name: 'U19' }])[0];
  assert.equal(ambiguous.suggestedGroupId, null);
  assert.match(ambiguous.reason, /Ambiguous/);
  for (const invalid of [{}, [{ id: groupId, name: 'x', subGroups: {} }], [...groups, ...groups]]) {
    assert.throws(() => flattenGroups(invalid));
  }
});

test('coexisting user-created events and already-linked events are held without creating or updating either side', () => {
  const preview = reconcileEvents([local()], [remote()], range);
  assert.equal(preview.rows[0].classification, 'coexisting');
  assert.equal(preview.writesEnabled, false);
  assert.equal(preview.coverageVerified, false);
  assert.equal(preview.rows[0].spond[0].start, '2026-11-04T18:00:00.000Z');
  assert.equal(reconcileEvents([local({ spond_id: eventId })], [remote()], range).rows[0].classification, 'linked');
  assert.equal(reconcileEvents([local({ spond_id: eventId.toLowerCase() })], [remote()], range).rows[0].classification, 'linked');
});

test('active provider events may omit cancellation while explicit cancellation remains held', () => {
  const active = remote();
  delete active.cancelled;
  assert.equal(reconcileEvents([local()], [active], range).rows[0].classification, 'coexisting');
  assert.equal(reconcileEvents([], [active], range).rows[0].classification, 'spond-only');
  assert.equal(reconcileEvents([], [remote({ cancelled: true })], range).rows[0].classification, 'held');
});

test('event-format errors identify the rejected field without exposing provider content', () => {
  const privateValue = 'private-provider-content';
  for (const [extra, field] of [
    [{ endTimestamp: '2026-11-04T17:00:00Z' }, 'endTimestamp'],
    [{ heading: { value: privateValue } }, 'heading'],
    ...[null, privateValue, 0, [], {}].map(cancelled => [{ cancelled }, 'cancelled']),
  ]) {
    assert.throws(() => reconcileEvents([], [remote(extra)], range), error => {
      assert.equal(error.status, 502);
      assert.ok(error.message.includes(field));
      assert.ok(!error.message.includes(privateValue));
      assert.ok(!error.message.includes(eventId));
      return true;
    });
  }
});

test('overlapping, renamed, shifted, cancelled, multiply matched and missing-linked events require review', () => {
  for (const [qmt, spond] of [
    [[local()], [remote({ heading: 'Renamed' })]],
    [[local()], [remote({ startTimestamp: '2026-11-04T17:30:00Z', endTimestamp: '2026-11-04T18:30:00Z' })]],
    [[local()], [remote({ cancelled: true })]],
    [[local()], [remote(), remote({ id: otherId })]],
    [[local(), local({ id: 2 })], [remote()]],
    [[local({ spond_id: eventId })], []],
    [[local({ spond_id: otherId })], [remote()]],
  ]) {
    const result = reconcileEvents(qmt, spond, range);
    assert.ok(result.rows.filter(row => row.qmt).every(row => row.classification === 'review'));
  }
});

test('Spond-only events never become facility bookings; only confirmed unmatched QMT events are candidates', () => {
  const result = reconcileEvents([
    local(), local({ id: 2, status: 'Planned' }), local({ id: 3, status: 'Cancelled' }),
  ], [remote({ heading: 'Separate user-created meeting',
    startTimestamp: '2026-11-04T08:00:00+01:00', endTimestamp: '2026-11-04T09:00:00+01:00' })], range);
  assert.deepEqual(result.rows.map(row => row.classification), ['qmt-only', 'held', 'held', 'spond-only']);
  assert.equal(result.rows.at(-1).qmt, null);
  assert.match(result.rows.at(-1).reason, /do not create a QMT/);
});

test('provider instants are converted once to club wall-clock time in summer, winter and DST fallback', () => {
  for (const [date, start, end] of [
    ['2026-07-04', '2026-07-04T16:00:00Z', '2026-07-04T17:00:00Z'],
    ['2026-11-04', '2026-11-04T18:00:00+01:00', '2026-11-04T19:00:00+01:00'],
    ['2026-10-25', '2026-10-25T18:00:00+01:00', '2026-10-25T19:00:00+01:00'],
  ]) {
    const localEvent = local({ start_time: `${date}T18:00:00Z`, end_time: `${date}T19:00:00Z` });
    const result = reconcileEvents([localEvent], [remote({ startTimestamp: start, endTimestamp: end })], {
      ...reviewRange(date, new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)), timezone: 'Europe/Zurich',
    });
    assert.equal(result.rows[0].classification, 'coexisting');
  }
});

test('bad dates, invalid/oversized provider responses and duplicate identifiers fail closed', () => {
  for (const dates of [['2026-02-30', '2026-03-03'], ['2026-11-04', '2026-11-04'], ['2026-11-04', '2026-12-06']]) {
    assert.throws(() => reviewRange(...dates));
  }
  for (const invalid of [{ events: [] }, [remote(), remote()], [remote({ startTimestamp: '2026-11-04T18:00:00' })],
    [remote({ endTimestamp: 'bad' })], [remote({ cancelled: null })], Array(501).fill(remote())]) {
    assert.throws(() => reconcileEvents([local()], invalid, range));
  }
});

test('highly overlapping previews bound returned candidate lists without treating omitted matches as Spond-only', () => {
  const many = Array.from({ length: 20 }, (_, index) => remote({ id: (index + 1).toString(16).padStart(32, '0') }));
  const result = reconcileEvents([local()], many, range);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].classification, 'review');
  assert.equal(result.rows[0].spond.length, 10);
  assert.match(result.rows[0].reason, /10 of 20/);
});

async function serve(app, action) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

function fixture() {
  let time = Date.parse('2026-11-04T15:00:00Z');
  let teams = [{ id: 1, name: 'U19', active: true, spond_group_id: null, spond_parent_group_id: null,
    spond_mapping_reviewed_at: null, spond_mapping_reviewed_by: null, updated_at: 'before' }];
  const calls = [], queries = [], logs = [], eventReads = [];
  let rollback = 0, committed = 0, snapshots;
  const quotaReservations = [];
  let quotaError, quotaDenied = false;
  const request = () => {
    const inputs = {};
    return { input(name, _type, value) { inputs[name] = value; return this; }, async query(query) {
      queries.push(query);
      if (query.includes('qmt-spond-review-quota-v1')) {
        quotaReservations.push(inputs);
        if (quotaError) throw quotaError;
        return { recordset: [{ allowed: !quotaDenied, retryAfter: quotaDenied ? 900 : 0 }] };
      }
      if (query.includes('FROM dbo.events')) {
        eventReads.push(inputs);
        return { recordset: [local()] };
      }
      if (query.startsWith('UPDATE dbo.teams')) {
        Object.assign(teams.find(team => team.id === inputs.team), { spond_group_id: inputs.group,
          spond_parent_group_id: inputs.parent, spond_mapping_reviewed_by: inputs.reviewer,
          spond_mapping_reviewed_at: 'reviewed', updated_at: 'after' });
        return { rowsAffected: [1] };
      }
      assert.match(query, /FROM dbo.teams/);
      return { recordset: structuredClone(teams) };
    } };
  };
  const pool = { request, transaction() {
    let quota = false;
    return {
      request() {
        const req = request();
        const query = req.query.bind(req);
        req.query = text => { quota = text.includes('qmt-spond-review-quota-v1'); return query(text); };
        return req;
      },
      on() {},
      async begin() { snapshots = structuredClone(teams); },
      async commit() { if (!quota) committed++; },
      async rollback() { if (!quota) { rollback++; teams = snapshots; } },
    };
  } };
  const client = {
    async login(email, password) {
      calls.push({ operation: 'login' });
      assert.equal(email, 'synthetic@example.invalid');
      assert.equal(password, 'synthetic-not-a-credential');
      return 'synthetic-token';
    },
    async get(token, endpoint, params) {
      assert.equal(token, 'synthetic-token');
      calls.push({ operation: 'get', endpoint, params });
      return endpoint === 'groups' ? groups : [remote()];
    },
    async post() { assert.fail('Provider event writes must never occur'); },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: Number(req.headers['x-test-user'] || 1), role: req.headers['x-test-role'] || 'admin', username: 'synthetic-admin' };
    next();
  });
  registerSpondReviewRoutes(app, { getPool: async () => pool, client, timezone: 'Europe/Zurich', now: () => time,
    logger: { error(...args) { logs.push(args); }, log(...args) { logs.push(args); } } });
  return { app, pool, calls, queries, logs, quotaReservations, eventReads,
    failQuota(error) { quotaError = error; }, denyQuota() { quotaDenied = true; },
    get teams() { return teams; }, advance() { time += 16 * 60000; },
    transactions: () => ({ rollback, committed }) };
}
const send = (base, route, body, headers = {}) => fetch(base + '/api/spond/' + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const discover = async base => {
  const response = await send(base, 'discovery', { username: 'synthetic@example.invalid', password: 'synthetic-not-a-credential' });
  assert.equal(response.status, 200);
  return response.json();
};

test('admin discovery, explicit atomic mapping confirmation and conservative preview perform no event writes', async () => {
  const f = fixture();
  await serve(f.app, async base => {
    const discovery = await discover(base);
    assert.equal(f.queries.filter(query => query.startsWith('UPDATE')).length, 0);
    assert.equal(f.calls[1].params.includeMembers, 'false');
    assert.ok(!JSON.stringify(discovery).includes('synthetic-token'));
    assert.ok(!JSON.stringify(discovery).includes('private@'));
    const previewInput = { discoveryId: discovery.discoveryId, teamId: 1, from: '2026-11-04', to: '2026-11-05' };
    assert.equal((await send(base, 'reconciliation', previewInput)).status, 409);
    const input = { discoveryId: discovery.discoveryId, mappings: [{ teamId: 1, groupId: subgroupId }] };
    assert.equal((await send(base, 'mappings/confirm', input)).status, 400);
    assert.equal((await send(base, 'mappings/confirm', { ...input, confirmed: true })).status, 200);
    assert.equal(f.teams[0].spond_parent_group_id, groupId);
    assert.equal(f.teams[0].spond_mapping_reviewed_by, 'synthetic-admin');
    assert.deepEqual(f.transactions(), { rollback: 0, committed: 1 });
    const response = await send(base, 'reconciliation', previewInput);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.rows[0].classification, 'coexisting');
    assert.equal(result.writesEnabled, false);
    assert.match(result.scope, /Entire parent group/);
    assert.equal(f.calls.at(-1).params.groupId, groupId);
    assert.equal(f.calls.at(-1).params.includeHidden, 'true');
    assert.ok(f.queries.filter(query => query.startsWith('UPDATE')).every(query => query.startsWith('UPDATE dbo.teams')));
    assert.ok(!JSON.stringify(f.logs).includes('synthetic-not-a-credential'));
  });
});

for (const target of [groupId, subgroupId]) {
  test(`a shared ${target === groupId ? 'parent group' : 'subgroup'} persists for multiple QMT teams with independent read-only previews`, async () => {
    const f = fixture();
    f.teams.push({ ...f.teams[0], id: 2, name: 'U16' });
    f.teams.push({ ...f.teams[0], id: 3, name: 'Unselected', spond_group_id: otherId });
    const untouched = structuredClone(f.teams[2]);
    await serve(f.app, async base => {
      const discovery = await discover(base);
      const response = await send(base, 'mappings/confirm', {
        discoveryId: discovery.discoveryId, confirmed: true,
        mappings: [{ teamId: 1, groupId: target }, { teamId: 2, groupId: target }],
      });
      assert.equal(response.status, 200);
      const saved = await response.json();
      assert.deepEqual(saved.confirmedTeamIds, [1, 2]);
      assert.equal(saved.writesEnabled, false);
      for (const team of f.teams.slice(0, 2)) {
        assert.equal(team.spond_group_id, target);
        assert.equal(team.spond_parent_group_id, target === subgroupId ? groupId : null);
        assert.equal(team.spond_mapping_reviewed_by, 'synthetic-admin');
      }
      assert.deepEqual(f.teams[2], untouched, 'unselected teams must not be remapped or unlinked');
      assert.deepEqual(f.transactions(), { rollback: 0, committed: 1 });
      for (const teamId of [1, 2]) {
        const preview = await send(base, 'reconciliation', {
          discoveryId: discovery.discoveryId, teamId, from: '2026-11-04', to: '2026-11-05',
        });
        assert.equal(preview.status, 200);
        const result = await preview.json();
        assert.equal(result.teamId, teamId);
        assert.equal(result.writesEnabled, false);
        assert.equal(result.rows[0].classification, 'coexisting');
        assert.equal(f.calls.at(-1).params.groupId, groupId);
      }
      assert.deepEqual(f.eventReads.map(inputs => inputs.team), [1, 2]);
      assert.ok(f.queries.filter(query => query.startsWith('UPDATE')).every(query => query.startsWith('UPDATE dbo.teams')));
      const rediscovered = await discover(base);
      assert.ok(rediscovered.teams.slice(0, 2).every(team => team.existingGroupId === target && team.suggestedGroupId === target));
    });
  });
}

test('confirmation rejects stale, duplicate, inaccessible and cross-admin mappings and rolls back atomically', async () => {
  const f = fixture();
  await serve(f.app, async base => {
    const discovery = await discover(base);
    const input = { discoveryId: discovery.discoveryId, confirmed: true, mappings: [{ teamId: 1, groupId: subgroupId }] };
    assert.equal((await send(base, 'mappings/confirm', input, { 'x-test-user': '2' })).status, 409);
    assert.equal((await send(base, 'mappings/confirm', { ...input, mappings: [...input.mappings, ...input.mappings] })).status, 400);
    assert.equal((await send(base, 'mappings/confirm', { ...input, mappings: [{ teamId: 1, groupId: otherId }] })).status, 400);
    assert.equal(f.teams[0].spond_group_id, null);
    f.teams[0].name = 'Changed after discovery';
    assert.equal((await send(base, 'mappings/confirm', input)).status, 409);
    assert.equal(f.transactions().committed, 0);
    assert.equal(f.transactions().rollback, 2);
    f.advance();
    assert.equal((await send(base, 'mappings/confirm', input)).status, 409);
  });
});

test('a later invalid mapping rolls back earlier reviewed teams and changed mappings invalidate previews before provider reads', async () => {
  const f = fixture();
  f.teams.push({ ...f.teams[0], id: 2, name: 'U16' });
  await serve(f.app, async base => {
    const discovery = await discover(base);
    const input = { discoveryId: discovery.discoveryId, confirmed: true,
      mappings: [{ teamId: 1, groupId: subgroupId }, { teamId: 2, groupId: otherId }] };
    assert.equal((await send(base, 'mappings/confirm', input)).status, 400);
    assert.ok(f.teams.every(team => team.spond_group_id === null));
    assert.equal(f.transactions().rollback, 1);
    assert.equal((await send(base, 'mappings/confirm', { ...input, mappings: [input.mappings[0]] })).status, 200);
    const count = f.calls.length;
    f.teams[0].spond_group_id = groupId;
    assert.equal((await send(base, 'reconciliation', {
      discoveryId: discovery.discoveryId, teamId: 1, from: '2026-11-04', to: '2026-11-05',
    })).status, 409);
    assert.equal(f.calls.length, count);
  });
});

test('review endpoints reject management users, restrict discovery retries and block every legacy mutation', async () => {
  const f = fixture();
  await serve(f.app, async base => {
    assert.equal((await send(base, 'discovery', {}, { 'x-test-role': 'mgmt' })).status, 403);
    for (const route of ['configure', 'sync', 'sync/events', 'sync-with-settings', 'sync/attendance', 'import-teams', 'link/team', 'sync-settings']) {
      assert.equal((await send(base, route, {})).status, 409, route);
    }
    assert.equal(f.calls.length, 0);
    await discover(base);
    await discover(base);
    await discover(base);
    assert.equal((await send(base, 'discovery', { username: 'synthetic@example.invalid', password: 'synthetic-not-a-credential' })).status, 429);
    assert.equal(f.calls.filter(call => call.operation === 'login').length, 3);
  });
});

test('canonical runtime keeps production disabled and separates review capability from event sync', async () => {
  assert.throws(() => createApp({ env: { JWT_SECRET: secret, NODE_ENV: 'production', QMT_SPOND_ENABLED: 'true' } }), /disabled for production/);
  let role = 'mgmt', sqlCalls = 0;
  const pool = { connected: true, on() {}, async close() {}, request() {
    return { input() { return this; }, async query(text) {
      sqlCalls++;
      assert.match(text, /SELECT role, is_active, username FROM users/);
      return { recordset: [{ role, username: 'synthetic', is_active: true }] };
    } };
  } };
  const app = createApp({ env: { JWT_SECRET: secret, NODE_ENV: 'production',
    QMT_SPOND_REVIEW_ENABLED: 'true', QMT_SPOND_REVIEW_APPROVED: 'true' }, connect: async () => pool });
  try {
    await serve(app, async base => {
      const caps = await (await fetch(base + '/api/capabilities')).json();
      assert.equal(caps.spond, false);
      assert.equal(caps.spondReview, true);
      assert.equal((await fetch(base + '/api/spond/status')).status, 401);
      const headers = { Authorization: `Bearer ${jwt.sign({ id: 1, role: 'admin' }, secret)}` };
      assert.equal((await fetch(base + '/api/spond/status', { headers })).status, 403);
      role = 'admin';
      assert.equal((await fetch(base + '/api/spond/status', { headers })).status, 200);
      assert.equal((await fetch(base + '/api/spond/sync', { method: 'POST', headers })).status, 409);
      assert.equal(sqlCalls, 3);
    });
  } finally { await app.locals.close(); }
});

test('durable quota reservations precede provider calls and fail closed on exhaustion or SQL failure', async () => {
  for (const exhausted of [true, false]) {
    const f = fixture();
    if (exhausted) f.denyQuota();
    else f.failQuota(new Error('Synthetic database failure'));
    await serve(f.app, async base => {
      const response = await send(base, 'discovery', {
        username: 'synthetic@example.invalid', password: 'synthetic-not-a-credential',
      });
      assert.equal(response.status, exhausted ? 429 : 503);
      if (exhausted) assert.equal(response.headers.get('retry-after'), '900');
      assert.equal(f.calls.length, 0);
      assert.equal(f.quotaReservations[0].action, 'discovery');
      assert.equal(f.quotaReservations[0].daily, 30);
      assert.equal(f.quotaReservations[0].perAdmin, 3);
    });
  }
  const f = fixture();
  await serve(f.app, async base => {
    const discovery = await discover(base);
    f.denyQuota();
    const input = { discoveryId: discovery.discoveryId, confirmed: true, mappings: [{ teamId: 1, groupId: subgroupId }] };
    assert.equal((await send(base, 'mappings/confirm', input)).status, 429);
    assert.equal((await send(base, 'mappings/confirm', input)).status, 429, 'quota failures must release the session busy flag');
    assert.equal(f.teams[0].spond_group_id, null);
    assert.equal(f.quotaReservations.at(-1).action, 'review');
    assert.equal(f.quotaReservations.at(-1).daily, 120);
    assert.equal(f.quotaReservations.at(-1).perAdmin, 10);
  });
  const preview = fixture();
  await serve(preview.app, async base => {
    const discovery = await discover(base);
    assert.equal((await send(base, 'mappings/confirm', {
      discoveryId: discovery.discoveryId, confirmed: true, mappings: [{ teamId: 1, groupId: subgroupId }],
    })).status, 200);
    const calls = preview.calls.length;
    preview.denyQuota();
    assert.equal((await send(base, 'reconciliation', {
      discoveryId: discovery.discoveryId, teamId: 1, from: '2026-11-04', to: '2026-11-05',
    })).status, 429);
    assert.equal(preview.calls.length, calls, 'exhausted preview quota must not read provider events');
  });
});

test('quota commits only valid reservations and rolls back denied or malformed results', async () => {
  for (const [result, fail] of [
    [{ allowed: true, retryAfter: 0 }, false],
    [{ allowed: false, retryAfter: 10 }, true],
    [{ allowed: 1, retryAfter: 0 }, true],
    [undefined, true],
  ]) {
    let commits = 0, rollbacks = 0;
    const pool = { transaction: () => ({
      async begin() {}, on() {},
      request: () => ({ input() { return this; }, async query() { return { recordset: [result] }; } }),
      async commit() { commits++; }, async rollback() { rollbacks++; },
    }) };
    if (fail) await assert.rejects(consumeReviewQuota(pool, 1, 'discovery'));
    else await consumeReviewQuota(pool, 1, 'discovery');
    assert.equal(commits, fail ? 0 : 1);
    assert.equal(rollbacks, fail ? 1 : 0);
  }
});

test('read-only review readiness rejects missing schema and incomplete runtime permissions', async () => {
  const allowed = { quota_read: 1, quota_insert: 1, quota_update: 1, team_read: 1, team_update: 1, event_read: 1 };
  const pool = (row, missingSchema = false) => ({ request: () => ({ async query(text) {
    assert.ok(!/\b(?:INSERT INTO|UPDATE dbo|DELETE FROM)\b/.test(text));
    if (missingSchema) throw new Error('Synthetic missing migration');
    return { recordset: text.includes('HAS_PERMS_BY_NAME') ? [row] : [] };
  } }) });
  await checkSpondReview(pool(allowed));
  await assert.rejects(checkSpondReview(pool(allowed, true)), /missing migration/);
  await assert.rejects(checkSpondReview(pool({ ...allowed, quota_insert: 0 })), /runtime/);
  await assert.rejects(checkSpondReview(pool(undefined)), /runtime/);
});
