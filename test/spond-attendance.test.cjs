const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAttendanceService } = require('../server/spond-attendance.cjs');
const { SpondError } = require('../server/spond-client.cjs');
const { attendanceRow, responseSets, consolidate, tokenVault, reservedSetting } = require('../server/spond-attendance-domain.cjs');

const group = 'A'.repeat(32), secondGroup = 'B'.repeat(32), providerId = 'C'.repeat(32);
const member = number => number.toString(16).padStart(32, '0').toUpperCase();
const secret = 'synthetic-attendance-secret-not-a-credential';
const remote = (changes = {}) => ({ id: providerId, recipients: { group: { id: group } },
  startTimestamp: '2026-11-11T17:00:00Z', endTimestamp: '2026-11-11T18:00:00Z',
  responses: { acceptedIds: [member(1)], unansweredIds: [member(2)], declinedIds: [] }, ...changes });
const event = (changes = {}) => ({ id: 1, status: 'Confirmed', team_id: 1, team_ids: '1',
  start_time: '2026-11-11T18:00:00Z', end_time: '2026-11-11T19:00:00Z', ...changes });

function fixture() {
  let time = Date.parse('2026-11-10T18:00:00Z'), connection = null, queue = Promise.resolve();
  let provider = remote(), onGet, failure;
  const rows = [event()], reads = [], logs = [];
  const teams = [{ id: 1, active: true, spond_group_id: group, spond_parent_group_id: null,
    spond_mapping_reviewed_at: '2026-11-10T17:00:00Z' }];
  const store = {
    locked(action) {
      const current = queue.then(() => action({}));
      queue = current.catch(() => {});
      return current;
    },
    async connection() { return connection && { ...structuredClone(connection), authorized: teams[0].ownerActive !== false, now: time }; },
    async saveConnection(_source, value) { connection = structuredClone(value); },
    async removeConnection() { connection = null; },
    async teams() { return structuredClone(teams); },
    async event(_source, id) { return structuredClone(rows.find(row => row.id === id)); },
    async linkedEvents() {
      return structuredClone(rows.filter(row => row.status === 'Confirmed' && row.attendance_payload)
        .sort((a, b) => (store.metadata(a).spondAttendance.lastAttemptAt || '').localeCompare(store.metadata(b).spondAttendance.lastAttemptAt || '')));
    },
    metadata(row) { return row.attendance_payload ? JSON.parse(row.attendance_payload) : { owner: '', checklist: [] }; },
    async saveAttendance(_source, row, attendance) {
      const current = rows.find(item => item.id === row.id);
      current.attendance_payload = JSON.stringify({ ...store.metadata(row), spondAttendance: attendance });
      current.attendance_revision = (current.attendance_revision || 0) + 1;
    },
    async removeAttendance(_source, row) {
      const metadata = store.metadata(row); delete metadata.spondAttendance;
      rows.find(item => item.id === row.id).attendance_payload = JSON.stringify(metadata);
    },
  };
  const client = {
    async get(token, endpoint) {
      assert.equal(token, 'synthetic-provider-token');
      reads.push(endpoint);
      if (onGet) await onGet();
      if (failure) throw failure;
      return typeof provider === 'function' ? provider(endpoint) : structuredClone(provider);
    },
    async post() { assert.fail('Attendance must never write to Spond'); },
    async login() { assert.fail('Attendance must not store or reuse passwords'); },
  };
  const service = options => createAttendanceService({ enabled: true, getPool: assert.fail, secret, timezone: 'Europe/Zurich',
    logger: { error(...args) { logs.push(args); } }, store, client, now: () => time, ...options });
  const main = service();
  const link = async (id = 1, teamId = 1, groupId = group, remoteId = providerId) => main.link({
    eventId: id, teamId, providerId: remoteId, group: { id: groupId, parentGroupId: null }, expected: rows.find(row => row.id === id),
    reviewerId: 1, token: 'synthetic-provider-token',
  });
  return { main, service, store, rows, teams, reads, logs, link,
    advance() { time += 16 * 60000; }, get connection() { return connection; },
    provider(value) { provider = value; }, fail(error) { failure = error; }, onGet(action) { onGet = action; } };
}

test('attendance response validation preserves actual zero and rejects incomplete, contradictory and oversized responses', () => {
  assert.deepEqual([...responseSets(remote()).confirmed], [member(1)]);
  assert.equal(responseSets(remote({ responses: { acceptedIds: [], unansweredIds: [], declinedIds: [] } })).confirmed.size, 0);
  for (const responses of [
    {}, { acceptedIds: [], unansweredIds: [] }, { acceptedIds: null, unansweredIds: [], declinedIds: [] },
    { acceptedIds: [member(1), member(1)], unansweredIds: [], declinedIds: [] },
    { acceptedIds: [member(1)], unansweredIds: [member(1)], declinedIds: [] },
    { acceptedIds: Array(10001).fill(member(1)), unansweredIds: [], declinedIds: [] },
  ]) assert.throws(() => responseSets(remote({ responses })));
});

test('combined attendance counts shared response IDs once and withholds ambiguous per-team attribution', () => {
  const responses = responseSets(remote());
  const first = { source: { teamIds: ['1'], exclusiveTeam: true }, exactAudience: true, responses };
  assert.deepEqual(consolidate([first, first]), { counts: { confirmed: 1, unanswered: 1, declined: 0 },
    perTeam: { 1: { confirmed: 1, unanswered: 1, declined: 0 } } });
  assert.deepEqual(consolidate([first, { ...first, source: { teamIds: ['2'], exclusiveTeam: true } }]).perTeam, {});
  assert.deepEqual(consolidate([{ ...first, source: { teamIds: ['1', '2'], exclusiveTeam: false } }]).perTeam, {});
  assert.deepEqual(consolidate([{ ...first, exactAudience: false }]).perTeam, {});
  assert.throws(() => consolidate([first, { ...first, responses: {
    confirmed: new Set(), unanswered: new Set(), declined: new Set([member(1)]),
  } }]), /Conflicting/);
});

test('provider token is authenticated-encrypted, scoped to attendance and never exposed through status', async () => {
  const vault = tokenVault(secret), sealed = vault.seal('synthetic-provider-token');
  assert.ok(!JSON.stringify(sealed).includes('synthetic-provider-token'));
  assert.equal(vault.open(sealed), 'synthetic-provider-token');
  assert.throws(() => tokenVault(secret + '-rotated').open(sealed));
  assert.throws(() => vault.open({ ...sealed, tag: Buffer.alloc(16).toString('base64') }));
  for (const key of ['__qmt_spond_attendance_v1', '__QMT_spond_attendance_v1 ', '__qmt_other']) assert.equal(reservedSetting(key), true);
  const f = fixture();
  await f.main.connect(1, 'synthetic-provider-token');
  assert.ok(!JSON.stringify(await f.main.status()).includes('encryptedToken'));
  assert.ok(!JSON.stringify(f.connection).includes('synthetic-provider-token'));
});

test('reviewed links survive worker restart, refresh only when due, and preserve Office metadata', async () => {
  const f = fixture();
  f.rows[0].attendance_payload = JSON.stringify({ owner: 'Facility manager', checklist: [{ title: 'Synthetic existing checklist' }] });
  await f.link();
  await f.main.connect(1, 'synthetic-provider-token');
  await f.main.close();
  const worker = f.service();
  await worker.tick();
  const row = attendanceRow(f.rows[0]);
  assert.equal(row.attendance_accepted, 1);
  assert.deepEqual(row.attendance_by_team, { 1: { confirmed: 1, unanswered: 1, declined: 0 } });
  assert.equal(row.start_time, '2026-11-11T18:00:00Z');
  assert.equal(f.store.metadata(f.rows[0]).owner, 'Facility manager');
  assert.equal(f.store.metadata(f.rows[0]).checklist.length, 1);
  const reads = f.reads.length;
  await worker.tick();
  assert.equal(f.reads.length, reads);
  assert.equal((await worker.status()).processed, 1);
  await worker.close();
});

test('shared mappings consolidate at event level; separate team sources require complete coverage before totals appear', async () => {
  const f = fixture();
  f.teams.push({ ...f.teams[0], id: 2 });
  f.rows[0].team_ids = '1,2';
  await f.link();
  await f.main.connect(1, 'synthetic-provider-token');
  await f.main.tick();
  assert.equal(attendanceRow(f.rows[0]).attendance_accepted, 1);
  assert.deepEqual(attendanceRow(f.rows[0]).attendance_by_team, {});
  const g = fixture();
  g.teams.push({ ...g.teams[0], id: 2, spond_group_id: secondGroup });
  g.rows[0].team_ids = '1,2';
  await g.link();
  await g.main.connect(1, 'synthetic-provider-token');
  await g.main.tick();
  assert.equal(attendanceRow(g.rows[0]).attendance_accepted, undefined);
  assert.match(attendanceRow(g.rows[0]).attendance_error, /every participating team/);
  g.provider(endpoint => endpoint.endsWith(providerId) ? remote() : remote({
    id: 'D'.repeat(32), recipients: { group: { id: secondGroup } },
    responses: { acceptedIds: [member(3)], unansweredIds: [], declinedIds: [member(4)] },
  }));
  await g.link(1, 2, secondGroup, 'D'.repeat(32));
  g.advance();
  await g.main.tick();
  assert.equal(attendanceRow(g.rows[0]).attendance_accepted, 2);
  assert.deepEqual(attendanceRow(g.rows[0]).attendance_by_team, {
    1: { confirmed: 1, unanswered: 1, declined: 0 }, 2: { confirmed: 1, unanswered: 0, declined: 1 },
  });
});

test('malformed provider data keeps the last successful snapshot and successful zero replaces it', async () => {
  const f = fixture();
  await f.link(); await f.main.connect(1, 'synthetic-provider-token'); await f.main.tick();
  const previous = attendanceRow(f.rows[0]).attendance_last_sync;
  f.advance();
  f.provider(remote({ responses: {} }));
  await f.main.tick();
  assert.equal(attendanceRow(f.rows[0]).attendance_accepted, 1);
  assert.equal(attendanceRow(f.rows[0]).attendance_last_sync, previous);
  assert.match(attendanceRow(f.rows[0]).attendance_error, /missing or incomplete/);
  f.advance(); f.provider(remote({ responses: { acceptedIds: [], unansweredIds: [], declinedIds: [] } }));
  await f.main.tick();
  assert.equal(attendanceRow(f.rows[0]).attendance_accepted, 0);
  assert.equal(attendanceRow(f.rows[0]).attendance_error, undefined);
});

test('mapping, event audience, cancellation and booking-time changes cannot silently refresh old links', async () => {
  for (const mutate of [
    f => { f.teams[0].spond_group_id = secondGroup; },
    f => f.provider(remote({ cancelled: true })),
    f => f.provider(remote({ recipients: { group: { id: secondGroup } } })),
    f => { f.rows[0].start_time = '2026-11-11T18:30:00Z'; },
  ]) {
    const f = fixture();
    await f.link(); await f.main.connect(1, 'synthetic-provider-token'); await f.main.tick();
    f.advance(); mutate(f); await f.main.tick();
    assert.ok(attendanceRow(f.rows[0]).attendance_error);
    assert.equal(f.store.metadata(f.rows[0]).spondAttendance.snapshot.counts.confirmed, 1);
  }
});

test('authorization revocation pauses reads, an inactive admin cannot run them, and key rotation requires reconnection', async () => {
  const f = fixture();
  await f.link(); await f.main.connect(1, 'synthetic-provider-token');
  f.fail(new SpondError('Synthetic authorization failure', 'AUTH', 401));
  await f.main.tick();
  assert.equal((await f.main.status()).blocked, true);
  const reads = f.reads.length;
  f.advance(); await f.main.tick();
  assert.equal(f.reads.length, reads);
  const g = fixture();
  await g.link(); await g.main.connect(1, 'synthetic-provider-token');
  g.teams[0].ownerActive = false;
  const before = g.reads.length; await g.main.tick();
  assert.equal(g.reads.length, before);
  assert.equal((await g.main.status()).authorized, false);
  const h = fixture();
  await h.main.connect(1, 'synthetic-provider-token');
  const rotated = h.service({ secret: secret + '-rotated' });
  await rotated.tick();
  assert.equal((await rotated.status()).blocked, true);
});

test('concurrent workers claim one durable lease and an in-flight disconnect prevents subsequent snapshot writes', async () => {
  const f = fixture();
  await f.link(); await f.main.connect(1, 'synthetic-provider-token');
  const before = f.reads.length, second = f.service();
  await Promise.all([f.main.tick(), second.tick(), f.main.tick()]);
  assert.equal(f.reads.length, before + 1);
  f.advance();
  const revision = f.rows[0].attendance_revision;
  f.onGet(() => f.main.disconnect());
  await f.main.tick();
  assert.equal(f.rows[0].attendance_revision, revision);
  assert.equal((await f.main.status()).connected, false);
});

test('Office edits made during provider reads are preserved and duplicate provider events are fetched once per cycle', async () => {
  const f = fixture();
  await f.link();
  f.rows.push({ ...structuredClone(f.rows[0]), id: 2 });
  await f.main.connect(1, 'synthetic-provider-token');
  f.onGet(async () => {
    const metadata = f.store.metadata(f.rows[0]);
    f.rows[0].attendance_payload = JSON.stringify({ ...metadata, owner: 'Changed during refresh', checklist: [{ title: 'Kept' }] });
    f.rows[0].attendance_revision++;
  });
  const before = f.reads.length;
  await f.main.tick();
  assert.equal(f.reads.length, before + 1);
  assert.equal(f.store.metadata(f.rows[0]).owner, 'Changed during refresh');
  assert.equal(f.store.metadata(f.rows[0]).checklist[0].title, 'Kept');
  assert.equal((await f.main.status()).processed, 2);
});

test('refresh budget is durable across workers and older unattempted events are processed first next time', async () => {
  const f = fixture();
  await f.link();
  const template = structuredClone(f.rows[0]);
  for (let index = 0; index < 51; index++) {
    const row = { ...structuredClone(template), id: index + 1 };
    const metadata = f.store.metadata(row);
    metadata.spondAttendance.sources[0].id = member(100 + index);
    row.attendance_payload = JSON.stringify(metadata);
    f.rows[index] = row;
  }
  f.provider(endpoint => remote({ id: endpoint.split('/').at(-1) }));
  await f.main.connect(1, 'synthetic-provider-token');
  const before = f.reads.length;
  await f.main.tick();
  assert.equal(f.reads.length - before, 50);
  assert.equal((await f.main.status()).processed, 50);
  assert.equal((await f.main.status()).queued, 1);
  assert.equal(attendanceRow(f.rows[50]).attendance_accepted, undefined);
  f.advance();
  await f.service().tick();
  assert.equal(attendanceRow(f.rows[50]).attendance_accepted, 1);
});

test('duplicate failed sources are not retried within the same cycle', async () => {
  const f = fixture();
  await f.link();
  f.rows.push({ ...structuredClone(f.rows[0]), id: 2 });
  f.fail(new Error('Synthetic provider outage'));
  await f.main.connect(1, 'synthetic-provider-token');
  const before = f.reads.length;
  await f.main.tick();
  assert.equal(f.reads.length - before, 1);
  assert.equal((await f.main.status()).failed, 2);
});

test('a provider failure with a concurrent link removal counts the failed event only once', async () => {
  const f = fixture();
  await f.link();
  await f.main.connect(1, 'synthetic-provider-token');
  f.onGet(() => f.main.unlink(1));
  f.fail(new Error('Synthetic provider outage'));
  await f.main.tick();
  const status = await f.main.status();
  assert.equal(status.failed, 1);
  assert.equal(status.processed, 0);
  assert.equal(status.queued, 0);
  assert.equal(f.store.metadata(f.rows[0]).spondAttendance, undefined);
});
