const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { readConfig } = require('../server/config.cjs');
const { eventRange, validateEvent, createLimiter } = require('../server/limits.cjs');
const { createLazyPool } = require('../server/pool.cjs');
const { bookingDates, bookingSchema, ids } = require('../server/bookings.cjs');
const { requestSchema, requestDto } = require('../server/requests.cjs');
const { evaluate } = require('../scripts/cost-check.cjs');
const costModel = require('../infra/cost-model.json');
const env = { JWT_SECRET: 'synthetic-unit-test-secret-not-a-credential' };

test('configuration fails closed and providers are off by default', () => {
  assert.throws(() => readConfig({}), /JWT_SECRET/);
  assert.equal(readConfig(env).aiEnabled, false);
  assert.equal(readConfig(env).poolMax, 5);
  assert.throws(() => readConfig({ ...env, QMT_AI_ENABLED: 'yes' }), /true or false/);
  assert.throws(() => readConfig({ ...env, QMT_AI_ENABLED: 'true' }), /Legacy AI is retired/);
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production', QMT_AI_ENABLED: 'true' }), /durable quotas/);
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production', QMT_SPOND_ENABLED: 'true' }), /durable quotas/);
  assert.throws(() => readConfig({ ...env, SQL_POOL_MAX: '50' }), /SQL_POOL_MAX/);
  assert.equal(readConfig(env).transportEmail, '');
  assert.throws(() => readConfig({ ...env, QMT_TRANSPORT_EMAIL: 'a@example.test,b@example.test' }), /single valid email/);
});

test('event scans and recurrence are bounded and include same-day recurrence', () => {
  const range = eventRange({}, new Date('2026-10-20T12:00:00Z'));
  assert.equal(range.limit, 100);
  for (const query of [{ limit: '501' }, { after: '-1' }, { from: 'bad' }, { from: '2026-01-01', to: '2028-01-01' }]) {
    assert.throws(() => eventRange(query));
  }
  const event = { start_time: '2026-10-20T18:00:00Z', end_time: '2026-10-20T19:00:00Z' };
  assert.doesNotThrow(() => validateEvent({ ...event, recurring_end_date: '2026-10-20', recurring_days: [2] }));
  assert.equal(bookingDates({ ...event, recurring_end_date: '2026-10-27', recurring_days: '2' }).length, 2);
  assert.throws(() => bookingDates({ ...event, recurring_end_date: '2026-10-20', recurring_days: '1' }));
  assert.throws(() => validateEvent({ ...event, recurring_end_date: '2029-01-01' }));
  assert.throws(() => validateEvent({ ...event, end_time: event.start_time }));
  assert.throws(() => validateEvent({ ...event, start_time: '2026-02-31T18:00:00Z' }));
  assert.throws(() => validateEvent({ ...event, recurring_end_date: '2027-02-31', recurring_days: [2] }));
  assert.equal(bookingSchema.safeParse({ ...event, event_type: 'Practice', description: 'x'.repeat(1001) }).success, false);
  assert.equal(bookingSchema.safeParse({ ...event, event_type: 'Practice', transport_requested: 'false' }).success, false);
  assert.throws(() => ids('1);DROP TABLE events'));
  assert.deepEqual(ids('1,2,1'), [1, 2]);
});

test('rate limiter limits and expires buckets without timers', () => {
  let time = 1000;
  const limit = createLimiter({ limit: 2, maxKeys: 1, windowMs: 1000, now: () => time });
  let accepted = 0;
  const res = { set() {}, status(status) { this.code = status; return this; }, json() {} };
  const request = ip => limit({ ip }, res, () => accepted++);
  request('one'); request('one'); request('one'); request('two');
  assert.equal(accepted, 2);
  assert.equal(res.code, 429);
  time += 1000;
  request('two');
  assert.equal(accepted, 3);
});

test('lazy pool deduplicates connections and closes stale pools', async () => {
  let connected = 0, closed = 0;
  const connect = async () => {
    connected++;
    return Object.assign(new EventEmitter(), { connected: true, close: async () => { closed++; } });
  };
  const db = createLazyPool(connect);
  const [a, b] = await Promise.all([db.getPool(), db.getPool()]);
  assert.equal(connected, 1);
  assert.equal(a, b);
  a.connected = false;
  await db.getPool();
  assert.equal(connected, 2);
  assert.equal(closed, 1);
  await db.close();
  assert.equal(closed, 2);
  await assert.rejects(db.getPool(), /closed/);
});

test('failed connections share rejection and do not trigger retry storms', async () => {
  let attempts = 0;
  const db = createLazyPool(async () => { attempts++; throw new Error('synthetic failure'); });
  const results = await Promise.allSettled([db.getPool(), db.getPool()]);
  assert.ok(results.every(result => result.status === 'rejected'));
  await assert.rejects(db.getPool(), /temporarily unavailable/);
  assert.equal(attempts, 1);
  await db.close();
});

test('all request variants validate and client review fields are stripped', () => {
  const common = { requestorName: 'Test', requestorPhone: '555-0100' };
  const request = requestSchema.parse({
    ...common, type: 'equipment', teamIds: ['1'], date: '2026-10-20',
    equipmentDescription: 'Cones', status: 'Approved', reviewedBy: 'intruder',
  });
  assert.equal(request.status, undefined);
  assert.equal(request.reviewedBy, undefined);
  assert.equal(requestSchema.safeParse({ ...request, date: '2026-02-31' }).success, false);
  assert.equal(requestSchema.safeParse({ ...request, teamIds: [] }).success, false);
  assert.equal(requestSchema.safeParse({ ...request, teamIds: ['2147483648'] }).success, false);
  const row = { id: 1, request_type: 'equipment', status: 'pending', payload: JSON.stringify(request) };
  assert.equal(requestDto(row).type, 'equipment');
  for (const invalid of [
    { ...row, payload: 'invalid JSON' }, { ...row, payload: '{}' },
    { ...row, request_type: 'facility' }, { ...row, status: 'completed' },
  ]) assert.throws(() => requestDto(invalid), error => error.status === 409);
});

test('cost model does not assume grants and blocks unapproved releases', () => {
  const result = evaluate(costModel, new Date('2026-10-21'));
  assert.equal(result.releaseAllowed, false);
  assert.ok(result.totals.sustainedKnownUsd > 20);
  assert.equal(result.problems.some(problem => problem.startsWith('Unpriced ancillary component:')), false);
  assert.ok(result.problems.includes('Release evidence missing: budgetSuspensionValidated'));
  const model = structuredClone(costModel);
  Object.assign(model.approval, { budgetMonthlyUsd: 1000, approvedBy: 'synthetic-test', approvedAt: '2026-10-20',
    sqlIntegrationValidated: true, restoreValidated: true, pauseResumeValidated: true, proxyValidated: true,
    trafficAssumptionsAccepted: true, imageValidated: true, legacyDataReviewed: true, costAlertsValidated: true,
    budgetSuspensionValidated: true, budgetScopeValidated: true, sharedEnvironmentReviewed: true });
  assert.equal(evaluate(model, new Date('2026-10-21')).releaseAllowed, true);
  model.approval.budgetMonthlyUsd = 20;
  assert.equal(evaluate(model, new Date('2026-10-21')).releaseAllowed, false);
  model.approval.approvedAt = 'invalid';
  assert.ok(evaluate(model, new Date('2026-10-21')).problems.some(problem => problem.includes('owner approval')));
  model.prices.activeVcpuSecond = 0;
  assert.throws(() => evaluate(model), /CPU price/);
});

test('cost scenarios itemize traffic, policy-based zero bases, backups and revision overlap', () => {
  const { totals, scenarioCosts } = evaluate(costModel, new Date('2026-10-21'));
  assert.equal(totals.expectedKnownUsd.toFixed(2), '28.93');
  assert.equal(totals.routineKnownUsd.toFixed(2), '31.39');
  assert.equal(totals.sustainedKnownUsd.toFixed(2), '222.77');
  assert.equal(totals.revisionOverlapStressKnownUsd.toFixed(2), '259.31');
  const { expected, sustained, revisionOverlapStress: overlap } = scenarioCosts;
  assert.equal(expected.registryUsd, 0);
  assert.equal(expected.sharedEnvironmentFeaturesUsd, 0);
  assert.equal(expected.budgetAutomationUsd, 1.34538);
  assert.equal(expected.logsAndMetricsUsd, 0.25 * 3.289);
  assert.equal(expected.networkAndEgressUsd, 2 * 0.087);
  assert.equal(expected.backupAndRecoveryUsd, 10 * 0.03278 + 0.1771);
  assert.equal(expected.dnsAndCertificatesUsd, 0.5 + 10000 / 1000000 * 0.4);
  assert.equal(overlap.computeUsd, 2 * sustained.computeUsd);
  assert.equal(overlap.logsAndMetricsUsd, 2 * sustained.logsAndMetricsUsd);
  for (const key of ['databaseUsd', 'requestsUsd', 'networkAndEgressUsd', 'backupAndRecoveryUsd', 'dnsAndCertificatesUsd']) {
    assert.equal(overlap[key], sustained[key]);
  }
});

test('missing ancillary components and invalid variable costs never permit release', () => {
  const now = new Date('2026-10-21');
  for (const key of Object.keys(costModel.ancillaryMonthlyUsd)) {
    const model = structuredClone(costModel);
    model.ancillaryMonthlyUsd[key] = null;
    const result = evaluate(model, now);
    assert.equal(result.releaseAllowed, false);
    assert.ok(result.problems.includes(`Unpriced ancillary component: ${key}`));
  }
  for (const key of ['logIngestionGB', 'outboundGB', 'millionDnsQueries', 'ltrBackupGBMonth']) {
    for (const value of [undefined, 0, -1, Infinity]) {
      const model = structuredClone(costModel);
      model.prices[key] = value;
      assert.throws(() => evaluate(model, now), /Invalid cost input/);
    }
  }
  for (const scenario of ['expected', 'routine', 'sustained']) {
    for (const key of ['logGBPerReplica', 'egressGB', 'dnsQueries']) {
      for (const value of [undefined, -1, NaN, Infinity]) {
        const model = structuredClone(costModel);
        model[scenario][key] = value;
        assert.throws(() => evaluate(model, now), /Invalid cost input/);
      }
    }
  }
  for (const key of ['ltrStoredGB', 'restoreDatabaseHours']) {
    const model = structuredClone(costModel);
    model.backupRecovery[key] = undefined;
    assert.throws(() => evaluate(model, now), /Invalid cost input/);
  }
  const overflow = structuredClone(costModel);
  overflow.expected.egressGB = Number.MAX_VALUE;
  overflow.prices.outboundGB = 2;
  assert.throws(() => evaluate(overflow, now), /scenario total/);
});

test('budget must cover every modeled scenario, not only the nominal stress scenario', () => {
  const model = structuredClone(costModel);
  Object.assign(model.approval, { budgetMonthlyUsd: 1000, approvedBy: 'synthetic-test', approvedAt: '2026-10-20',
    sqlIntegrationValidated: true, restoreValidated: true, pauseResumeValidated: true, proxyValidated: true,
    trafficAssumptionsAccepted: true, imageValidated: true, legacyDataReviewed: true, costAlertsValidated: true,
    budgetSuspensionValidated: true, budgetScopeValidated: true, sharedEnvironmentReviewed: true });
  model.expected.egressGB = 20000;
  const result = evaluate(model, new Date('2026-10-21'));
  assert.ok(result.totals.revisionOverlapStressKnownUsd < model.approval.budgetMonthlyUsd);
  assert.ok(result.totals.expectedKnownUsd > model.approval.budgetMonthlyUsd);
  assert.equal(result.releaseAllowed, false);
  assert.ok(result.problems.includes('A modeled scenario exceeds approved monthly budget'));
});

test('always-on model and deployment never assume idle sleeping or a shorter month', () => {
  const template = fs.readFileSync(path.join(__dirname, '..', 'infra', 'main.bicep'), 'utf8');
  assert.match(template, /minReplicas:\s*1\b/);
  assert.match(template, /maxReplicas:\s*1\b/);
  for (const scenario of ['expected', 'routine', 'sustained']) {
    const model = structuredClone(costModel);
    model[scenario].activeHours = 40;
    assert.throws(() => evaluate(model), /Always-on scenarios/);
  }
  for (const [key, value] of [['minReplicas', 0], ['hoursPerMonth', 730]]) {
    const model = structuredClone(costModel);
    model[key] = value;
    assert.throws(() => evaluate(model), /always-on production template/);
  }
});

test('priced automation does not count as tested budget suspension', () => {
  const model = structuredClone(costModel);
  const result = evaluate(model);
  assert.equal(result.problems.includes('Unpriced ancillary component: budgetAutomation'), false);
  assert.ok(result.problems.includes('Release evidence missing: budgetSuspensionValidated'));
  assert.ok(result.problems.includes('Release evidence missing: budgetScopeValidated'));
  assert.equal(result.releaseAllowed, false);
});

test('automation allowance must price its exact schedule, full runtime, logs, alert and paid email', () => {
  for (const [key, value] of [['executionsPerMonth', 31], ['executionSeconds', 10],
    ['emailPriceUsd', 0], ['logAlertMonthlyUsd', 0], ['logGB', -1]]) {
    const model = structuredClone(costModel);
    model.budgetGuard[key] = value;
    assert.throws(() => evaluate(model));
  }
  const model = structuredClone(costModel);
  model.ancillaryMonthlyUsd.budgetAutomation = 0.25;
  assert.throws(() => evaluate(model), /itemized job/);
  for (const quoteDate of ['2026-08-01', '2099-01-01', 'invalid', null]) {
    const stale = structuredClone(costModel);
    stale.budgetGuard.quotesAsOf = quoteDate;
    const result = evaluate(stale, new Date('2026-10-21T12:00:00Z'));
    assert.ok(result.problems.includes('Budget guard retail prices must be refreshed (maximum age 31 days)'));
    assert.equal(result.releaseAllowed, false);
  }
});
