const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { wallClockInstant, publicationAudience, createPublicationService } = require('../server/spond-publication.cjs');
const { teamFingerprint, reviewRange } = require('../server/spond-review-domain.cjs');
const { readConfig } = require('../server/config.cjs');
const { checkSpondReview } = require('../scripts/check-spond-review.cjs');

const parent = 'A'.repeat(32), subgroup = 'B'.repeat(32), owner = 'C'.repeat(32), member = 'D'.repeat(32), remoteId = 'E'.repeat(32);
const clock = Date.parse('2026-11-09T12:00:00Z');
const clone = value => structuredClone(value);
function fixture() {
  const group = { id: subgroup, parentGroupId: parent, name: 'Youth', parentGroup: 'Club' };
  const data = {
    teams: [1, 2].map(id => ({ id, name: `Squad ${id}`, active: true, spond_group_id: subgroup, spond_parent_group_id: parent })),
    events: [{ id: 1, team_id: 1, team_ids: '1,2', field_id: 1, field_ids: '1',
      description: 'Youth training', event_type: 'Practice', status: 'Confirmed', spond_id: null,
      start_time: '2026-11-12T18:00:00Z', end_time: '2026-11-12T20:00:00Z', notes: 'Private coaching notes' }],
    fields: [{ id: 1, name: 'Field A', site_id: 1, site_name: 'Club ground', address: 'Example road', city: 'Zurich' }],
    publications: [],
  };
  const rawGroup = { id: parent, roles: [{ id: 'manager-role', permissions: ['events'] }],
    subGroups: [{ id: subgroup }], members: [
      { id: owner, profileId: owner, roles: ['manager-role'], respondent: false, subGroups: [] },
      { id: member, profileId: member, roles: [], respondent: true, subGroups: [subgroup] },
    ] };
  const session = { token: 'synthetic-only', expiresAt: clock + 15 * 60000,
    fingerprint: teamFingerprint(data.teams), confirmedTeamIds: new Set([1, 2]) };
  const providerCalls = [], posts = [], errors = [];
  let time = clock, failWrite = false, failCommit = false, failJournal = false, failGet = false, failReserve = false;
  let normal = [], scheduled = [], saved;
  const store = {
    async snapshot() { return clone(data); },
    async reserve(plan, eventId, publicationId, _reviewer, validate) {
      if (failReserve) throw new Error('Synthetic database failure');
      validate(clone(data));
      if (data.publications.some(record => record.event_id === eventId)) throw new Error('Duplicate reservation');
      data.publications.push({ event_id: eventId, publication_id: publicationId, state: 'reserved' });
    },
    async execute(_plan, eventId, publicationId, action) {
      const current = clone(data);
      current.publications = current.publications.filter(record => record.publication_id !== publicationId);
      const id = await action(current);
      if (failCommit) throw new Error('Synthetic commit failure');
      data.events.find(event => event.id === eventId).spond_id = id;
      Object.assign(data.publications.find(record => record.event_id === eventId), { state: 'published', provider_id: id });
      return id;
    },
    async markUncertain(eventId) {
      if (failJournal) throw new Error('Synthetic journal failure');
      data.publications.find(record => record.event_id === eventId).state = 'uncertain';
    },
  };
  const client = {
    async get(_token, endpoint, query) {
      providerCalls.push({ endpoint, query });
      if (failGet) throw new Error('Synthetic provider outage');
      if (endpoint === 'profile') return { id: owner };
      if (endpoint === `group/${parent}`) return clone(rawGroup);
      if (endpoint === 'sponds') return clone(query.scheduled ? scheduled : normal);
      if (endpoint === `sponds/${remoteId}`) return clone(saved);
      assert.fail('Unexpected provider GET ' + endpoint);
    },
    async post(_token, endpoint, payload) {
      assert.equal(endpoint, 'sponds');
      assert.equal(data.publications[0].state, 'reserved', 'durable reservation must precede the provider write');
      posts.push(clone(payload));
      saved = { id: remoteId, ...clone(payload) };
      if (failWrite) throw new Error('Synthetic timeout after provider accepted the write');
      return { id: remoteId };
    },
  };
  const service = createPublicationService({ store, client, timezone: 'Europe/Zurich', now: () => time,
    logger: { log() {}, error(...args) { errors.push(args); } } });
  const preview = (teamId = 1) => service.preview({ session, group, teamId, range: reviewRange('2026-11-12', '2026-11-13') });
  const publish = plan => service.publish({ session, planId: plan.planId, eventId: 1, reviewerId: 7 });
  return { data, rawGroup, group, session, providerCalls, posts, errors, service, preview, publish,
    setTime(value) { time = value; }, setRemote(value, scheduledValue = value) { normal = value; scheduled = scheduledValue; },
    failWrite() { failWrite = true; }, failCommit() { failCommit = true; },
    failJournal() { failJournal = true; }, failReserve() { failReserve = true; }, failGet() { failGet = true; } };
}
const existing = () => ({ id: remoteId, heading: 'Youth training', startTimestamp: '2026-11-12T17:00:00Z', endTimestamp: '2026-11-12T19:00:00Z' });

test('outbound club wall-clock conversion handles winter/summer and refuses DST gaps, ambiguity, invalid times and fractions', () => {
  assert.equal(wallClockInstant('2026-11-12T18:00:00Z', 'Europe/Zurich'), '2026-11-12T17:00:00.000Z');
  assert.equal(wallClockInstant(new Date('2027-07-12T18:00:00Z'), 'Europe/Zurich'), '2027-07-12T16:00:00.000Z');
  for (const value of ['2027-03-28T02:30:00Z', '2026-10-25T02:30:00Z', 'invalid', '2026-11-12T18:00:00.123Z']) {
    assert.throws(() => wallClockInstant(value, 'Europe/Zurich'));
  }
});

test('publication requires an active event-managing administrator and explicit valid respondent membership', () => {
  const { rawGroup, group } = fixture();
  assert.deepEqual(publicationAudience(rawGroup, { id: owner }, group), {
    owner, members: [member], group: { id: parent, subGroups: [subgroup] },
  });
  for (const mutate of [
    raw => { raw.members[0].pendingAdmin = true; },
    raw => { raw.roles[0].permissions = ['members']; },
    raw => { raw.members[1].respondent = undefined; },
    raw => { raw.members[1].subGroups = []; },
    raw => { raw.members.push(raw.members[1]); },
    raw => { raw.subGroups = []; },
  ]) {
    const raw = clone(rawGroup); mutate(raw);
    assert.throws(() => publicationAudience(raw, { id: owner }, group));
  }
});

test('one shared booking across 1:n mappings is previewed without writes and published exactly once with the approved audience', async () => {
  const f = fixture(), plan = await f.preview();
  assert.equal(f.posts.length, 0);
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].publishable, true);
  assert.equal(plan.audienceCount, 1);
  assert.ok(!JSON.stringify(plan).includes(member), 'member identifiers must not be sent to the browser');
  const result = await f.publish(plan);
  assert.equal(result.providerId, remoteId);
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].startTimestamp, '2026-11-12T17:00:00.000Z');
  assert.deepEqual(f.posts[0].recipients, { group: { id: parent, subGroups: [subgroup] }, groupMembers: [member] });
  assert.match(f.posts[0].description, /Squad 1, Squad 2/);
  assert.match(f.posts[0].description, /QMT publication: [a-f0-9-]{36}/);
  assert.ok(!f.posts[0].description.includes('Private coaching'));
  assert.equal(f.data.publications[0].state, 'published');
  await assert.rejects(f.publish(plan), /expired|changed|eligible/);
  f.setRemote([existing()]);
  const otherTeamPlan = await f.preview(2);
  assert.ok(otherTeamPlan.rows.every(row => !row.publishable));
  assert.equal(f.posts.length, 1);
  const listings = f.providerCalls.filter(call => call.endpoint === 'sponds');
  assert.ok(listings.every(call => call.query.groupId === parent && call.query.includeHidden === 'true'));
  assert.ok(listings.some(call => call.query.scheduled === 'true'));
});

test('coexisting normal or scheduled Spond events and ambiguous same-parent QMT bookings are never published', async () => {
  for (const scheduledOnly of [false, true]) {
    const f = fixture();
    f.setRemote(scheduledOnly ? [] : [existing()], [existing()]);
    const plan = await f.preview();
    assert.equal(plan.rows[0].classification, 'coexisting');
    await assert.rejects(f.publish(plan), /eligible/);
    assert.equal(f.posts.length, 0);
  }
  const f = fixture();
  f.data.events.push({ ...f.data.events[0], id: 2, team_id: 2, team_ids: '2' });
  const plan = await f.preview();
  assert.equal(plan.rows[0].classification, 'held');
  assert.match(plan.rows[0].reason, /Another QMT booking/);
});

test('divergent/unreviewed shared teams, past events, incomplete venues and prior uncertain reservations are held', async () => {
  for (const mutate of [
    f => { f.session.confirmedTeamIds.delete(2); },
    f => { f.data.teams[1].spond_group_id = parent; f.session.fingerprint = teamFingerprint(f.data.teams); },
    f => { f.data.events[0].game_location = 'away'; },
    f => { f.data.fields = []; },
    f => { f.setTime(Date.parse('2026-11-13T00:00:00Z')); f.session.expiresAt += 30 * 86400000; },
    f => { f.data.publications.push({ event_id: 1, publication_id: randomUUID(), state: 'uncertain' }); },
  ]) {
    const f = fixture(); mutate(f);
    const plan = await f.preview();
    assert.ok(plan.rows.every(row => !row.publishable));
    assert.equal(f.posts.length, 0);
  }
});

test('stale plans, changed bookings/membership/mappings and new provider coexistence fail closed', async () => {
  for (const mutate of [
    f => f.setTime(clock + 6 * 60000),
    f => { f.data.events[0].description = 'Changed training'; },
    f => { f.rawGroup.members[1].respondent = false; },
    f => { f.data.teams[0].name = 'Changed squad'; },
    f => f.setRemote([existing()]),
  ]) {
    const f = fixture(), plan = await f.preview(); mutate(f);
    await assert.rejects(f.publish(plan));
    assert.equal(f.posts.length, 0);
  }
});

test('timeout, failed SQL completion and failed uncertainty update retain a journal and never automatically repeat a provider write', async () => {
  for (const failure of ['failWrite', 'failCommit', 'failJournal']) {
    const f = fixture(), plan = await f.preview();
    if (failure === 'failJournal') f.failWrite();
    f[failure]();
    await assert.rejects(f.publish(plan), /do not publish this booking again/);
    assert.equal(f.posts.length, 1);
    assert.equal(f.data.events[0].spond_id, null);
    assert.ok(['reserved', 'uncertain'].includes(f.data.publications[0].state));
    await assert.rejects(f.publish(plan));
    const next = await f.preview();
    assert.equal(next.rows[0].classification, 'held');
    assert.equal(f.posts.length, 1);
    assert.ok(f.errors.length);
  }
});

test('database reservation failure and provider read outage cause no writes; truncated/conflicting provider lists are rejected', async () => {
  const f = fixture(), plan = await f.preview();
  f.failReserve();
  await assert.rejects(f.publish(plan));
  assert.equal(f.posts.length, 0);
  const outage = fixture(); outage.failGet();
  await assert.rejects(outage.preview());
  for (const remote of [
    Array.from({ length: 99 }, (_, index) => ({ ...existing(), id: index.toString(16).padStart(32, '0') })),
    [existing(), existing()],
  ]) {
    const full = fixture(); full.setRemote(remote);
    await assert.rejects(full.preview(), /truncated|duplicate/);
  }
  const changed = fixture();
  changed.setRemote([existing()], [{ ...existing(), heading: 'Changed concurrently' }]);
  await assert.rejects(changed.preview(), /changed/);
});

test('reviewed publication is separately gated and its read-only preflight requires schema and narrowly scoped permissions', async () => {
  const JWT_SECRET = 'synthetic-publication-config-secret-not-a-credential';
  assert.throws(() => readConfig({ JWT_SECRET, QMT_SPOND_PUBLISH_ENABLED: 'true' }), /requires/);
  assert.equal(readConfig({ JWT_SECRET, QMT_SPOND_PUBLISH_ENABLED: 'true', QMT_SPOND_REVIEW_ENABLED: 'true',
    QMT_SPOND_REVIEW_APPROVED: 'true' }).spondPublishEnabled, true);
  const pool = denied => ({ request: () => ({ async query(source) {
    return { recordset: source.includes('HAS_PERMS') ? [
      Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`permission_${index}`, denied && source.includes('publication_read') && index === 0 ? 0 : 1])),
    ] : [] };
  } }) });
  await checkSpondReview(pool(false), { publishingEnabled: true });
  await assert.rejects(checkSpondReview(pool(true), { publishingEnabled: true }), /journal/);
});
