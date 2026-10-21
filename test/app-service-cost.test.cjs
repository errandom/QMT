const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { evaluate, compareAppService } = require('../scripts/cost-check.cjs');
const model = require('../infra/cost-model.json');
const hosting = require('../infra/app-service-cost-model.json');
const now = new Date('2026-10-21T09:30:00Z');

test('B1 comparison preserves all ancillary/stress costs, with a full fixed month and no per-request plan fee', () => {
  const original = structuredClone(model);
  const baseline = evaluate(model, now);
  const result = compareAppService(model, hosting, now);
  assert.deepEqual(model, original);
  assert.equal(result.releaseAllowed, false);
  assert.equal(result.proposalOnly, true);
  assert.equal(result.hostingOnly744HoursChf, 12.276);
  for (const [key, costs] of Object.entries(result.scenarioCosts)) {
    assert.equal(costs.computeUsd, 744 * 0.0198 * (key === 'additionalPlanStress' ? 2 : 1));
    assert.equal(costs.requestsUsd, 0);
    const base = baseline.scenarioCosts[key === 'additionalPlanStress' ? 'revisionOverlapStress' : key];
    for (const component of Object.keys(base).filter(k => !['computeUsd', 'requestsUsd'].includes(k))) {
      assert.equal(costs[component], base[component]);
    }
    assert.equal(result.totals[`${key}KnownUsd`], Object.values(costs).reduce((sum, value) => sum + value, 0));
  }
  assert.ok(Math.abs(result.totals.expectedKnownUsd - 23.57183) < 0.000001);
  assert.ok(Math.abs(result.fullMonthResidualKnownUsd - 22.57158) < 0.000001);
  assert.ok(result.totals.additionalPlanStressKnownUsd > result.totals.sustainedKnownUsd);
  assert.ok(result.fullMonthResidualKnownUsd > result.scenarioCosts.expected.computeUsd);
  assert.ok(result.fullMonthResidualKnownUsd < result.totals.expectedKnownUsd);
});

test('B1 rejects wrong tiers/regions, invalid prices and stale quotes without changing the ACA model or approval path', () => {
  for (const change of [
    { sku: 'P1v3' }, { operatingSystem: 'Windows' }, { region: 'westeurope' },
    { instances: 2 }, { hourlyUsd: 0 }, { hourlyChf: NaN },
  ]) {
    assert.throws(() => compareAppService(model, { ...hosting, ...change }, now), /single-worker Swiss Linux B1/);
  }
  const stale = compareAppService(model, { ...hosting, asOf: '2026-08-01' }, now);
  assert.ok(stale.problems.some(p => p.includes('refreshed')));
  assert.throws(() => compareAppService(model, { ...hosting, hourlyUsd: Number.MAX_VALUE }, now), /overflowing/);
  const approved = structuredClone(model);
  Object.keys(approved.approval).forEach(key => { approved.approval[key] = true; });
  Object.assign(approved.approval, { approvedBy: 'synthetic-owner', approvedAt: now.toISOString(), budgetMonthlyUsd: 1000 });
  assert.equal(evaluate(approved, now).releaseAllowed, true);
  assert.equal(compareAppService(approved, hosting, now).releaseAllowed, false);
  const missing = structuredClone(model);
  delete missing.ancillaryMonthlyUsd.budgetAutomation;
  delete missing.ancillaryMonthlyUsd.logsAndMetrics;
  assert.ok(compareAppService(missing, hosting, now).sharedModelProblems.some(p => p.includes('Unpriced')));
  assert.ok(Number.isFinite(compareAppService(missing, hosting, now).fullMonthResidualKnownUsd));
});

test('B1 CLI comparison never permits release, and an unknown hosting argument cannot silently select ACA', () => {
  const script = path.join(__dirname, '..', 'scripts', 'cost-check.cjs');
  const result = spawnSync(process.execPath, [script, '--app-service', '--release'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).releaseAllowed, false);
  assert.equal(JSON.parse(result.stdout).hosting, 'appServiceLinuxB1');
  const invalid = spawnSync(process.execPath, [script, '--app-services'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /Use only/);
});
