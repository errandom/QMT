const fs = require('node:fs');
const path = require('node:path');

function evaluate(model, now = new Date()) {
  const problems = [];
  const number = (value, label, min = 0) => {
    if (!Number.isFinite(value) || value < min) throw new Error(`Invalid cost input: ${label}`);
    return value;
  };
  if (model.currency !== 'USD' || model.region !== 'switzerlandnorth' || model.freeGrantsApplied !== false) {
    throw new Error('Cost model must use Swiss-region USD prices without assuming shared free grants');
  }
  const age = now - new Date(model.asOf);
  if (!Number.isFinite(age) || age < 0 || age > 31 * 86400000) problems.push('Retail prices must be refreshed (maximum age 31 days)');
  const hours = number(model.hoursPerMonth, 'month hours', 1);
  const cpu = number(model.cpu, 'CPU', 0.25);
  const memory = number(model.memoryGiB, 'memory', 0.5);
  if (hours !== 744 || cpu !== 0.25 || memory !== 0.5 || model.minReplicas !== 1
      || model.replicas !== 1 || model.revisionOverlapReplicas !== 2) {
    throw new Error('Model must match the always-on production template, a 31-day month and revision overlap');
  }
  const perHour = 3600 * (cpu * number(model.prices.activeVcpuSecond, 'CPU price', Number.MIN_VALUE)
    + memory * number(model.prices.activeGiBSecond, 'memory price', Number.MIN_VALUE));
  const sqlDay = number(model.prices.sqlBasicDay, 'SQL price', Number.MIN_VALUE);
  const database = hours / 24 * sqlDay;
  const requestPrice = number(model.prices.millionRequests, 'request price', Number.MIN_VALUE);
  const logPrice = number(model.prices.logIngestionGB, 'log ingestion price', Number.MIN_VALUE);
  const egressPrice = number(model.prices.outboundGB, 'egress price', Number.MIN_VALUE);
  const dnsPrice = number(model.prices.millionDnsQueries, 'DNS query price', Number.MIN_VALUE);
  const backup = number(model.backupRecovery.ltrStoredGB, 'LTR stored GB')
    * number(model.prices.ltrBackupGBMonth, 'LTR storage price', Number.MIN_VALUE)
    + number(model.backupRecovery.restoreDatabaseHours, 'restore database hours') / 24 * sqlDay;
  const ancillary = {};
  const required = ['registry', 'logsAndMetrics', 'networkAndEgress', 'backupAndRecovery',
    'sharedEnvironmentFeatures', 'dnsAndCertificates', 'budgetAutomation'];
  for (const key of required) {
    const value = model.ancillaryMonthlyUsd?.[key];
    if (value === null || value === undefined) {
      problems.push(`Unpriced ancillary component: ${key}`);
      ancillary[key] = 0;
    } else ancillary[key] = number(value, key);
  }
  const guard = model.budgetGuard;
  const guardQuoteAge = now - new Date(guard?.quotesAsOf);
  if (!Number.isFinite(guardQuoteAge) || guardQuoteAge < 0 || guardQuoteAge > 31 * 86400000) {
    problems.push('Budget guard retail prices must be refreshed (maximum age 31 days)');
  }
  if (guard?.executionsPerMonth !== hours || guard.executionSeconds !== 120) {
    throw new Error('Budget guard model must match the hourly 120-second Consumption job');
  }
  const guardCost = guard.executionsPerMonth * guard.executionSeconds / 3600 * perHour
    + number(guard.logGB, 'budget guard logs') * logPrice
    + number(guard.logAlertMonthlyUsd, 'budget guard alert price', Number.MIN_VALUE)
    + number(guard.emailNotifications, 'budget guard notification count', 1)
      * number(guard.emailPriceUsd, 'budget guard email price', Number.MIN_VALUE);
  number(guardCost, 'budget guard total');
  if (model.ancillaryMonthlyUsd?.budgetAutomation != null
      && Math.abs(ancillary.budgetAutomation - guardCost) > 0.000001) {
    throw new Error('Budget automation allowance does not match its itemized job, logs, alert and notifications');
  }
  const estimate = (usage, replicas) => {
    const active = number(usage.activeHours, 'active hours');
    if (active !== hours) throw new Error('Always-on scenarios must price every hour of the modeled month at the active rate');
    return {
      computeUsd: active * perHour * replicas,
      databaseUsd: database,
      requestsUsd: number(usage.requests, 'requests') / 1000000 * requestPrice,
      registryUsd: ancillary.registry,
      logsAndMetricsUsd: ancillary.logsAndMetrics + number(usage.logGBPerReplica, 'log GB per replica') * replicas * logPrice,
      networkAndEgressUsd: ancillary.networkAndEgress + number(usage.egressGB, 'egress GB') * egressPrice,
      backupAndRecoveryUsd: ancillary.backupAndRecovery + backup,
      sharedEnvironmentFeaturesUsd: ancillary.sharedEnvironmentFeatures,
      dnsAndCertificatesUsd: ancillary.dnsAndCertificates + number(usage.dnsQueries, 'DNS queries') / 1000000 * dnsPrice,
      budgetAutomationUsd: ancillary.budgetAutomation,
    };
  };
  const scenarioCosts = {
    expected: estimate(model.expected, 1),
    routine: estimate(model.routine, 1),
    sustained: estimate(model.sustained, 1),
    revisionOverlapStress: estimate(model.sustained, 2),
  };
  const total = costs => number(Object.values(costs).reduce((sum, value) => sum + value, 0), 'scenario total');
  const totals = {
    expectedKnownUsd: total(scenarioCosts.expected),
    routineKnownUsd: total(scenarioCosts.routine),
    sustainedKnownUsd: total(scenarioCosts.sustained),
    revisionOverlapStressKnownUsd: total(scenarioCosts.revisionOverlapStress),
  };
  const approval = model.approval || {};
  const approvedAt = Date.parse(approval.approvedAt);
  if (typeof approval.approvedBy !== 'string' || !approval.approvedBy.trim()
      || !Number.isFinite(approvedAt) || approvedAt > now || now - approvedAt > 31 * 86400000) {
    problems.push('Recent, dated owner approval is missing (maximum age 31 days)');
  }
  if (!Number.isFinite(approval.budgetMonthlyUsd) || approval.budgetMonthlyUsd <= 0) problems.push('Approved monthly budget is missing');
  else if (Math.max(...Object.values(totals)) > approval.budgetMonthlyUsd) problems.push('A modeled scenario exceeds approved monthly budget');
  for (const key of ['sqlIntegrationValidated', 'restoreValidated', 'pauseResumeValidated', 'proxyValidated',
    'trafficAssumptionsAccepted', 'imageValidated', 'legacyDataReviewed', 'costAlertsValidated',
    'budgetSuspensionValidated', 'budgetScopeValidated', 'sharedEnvironmentReviewed']) {
    if (approval[key] !== true) problems.push(`Release evidence missing: ${key}`);
  }
  return { totals, scenarioCosts, problems, releaseAllowed: problems.length === 0 };
}

function compareAppService(model, hosting, now = new Date()) {
  if (hosting?.sku !== 'B1' || hosting.operatingSystem !== 'Linux'
      || hosting.region !== 'switzerlandnorth' || hosting.instances !== 1
      || !Number.isFinite(hosting.hourlyUsd) || hosting.hourlyUsd <= 0
      || !Number.isFinite(hosting.hourlyChf) || hosting.hourlyChf <= 0) {
    throw new Error('App Service comparison requires a priced single-worker Swiss Linux B1 quote');
  }
  const baseline = evaluate(model, now);
  const problems = ['B1 is an unselected comparison; Container Apps approvals do not authorize B1 acceptance or release'];
  const age = now - new Date(hosting.asOf);
  if (!Number.isFinite(age) || age < 0 || age > 31 * 86400000) {
    problems.push('B1 retail prices must be refreshed (maximum age 31 days)');
  }
  const compute = model.hoursPerMonth * hosting.hourlyUsd;
  const scenarioCosts = Object.fromEntries(Object.entries(baseline.scenarioCosts).map(([key, costs]) => {
    const extraPlan = key === 'revisionOverlapStress';
    return [extraPlan ? 'additionalPlanStress' : key, {
      ...costs, computeUsd: compute * (extraPlan ? 2 : 1), requestsUsd: 0,
    }];
  }));
  const totals = Object.fromEntries(Object.entries(scenarioCosts).map(([key, costs]) => [
    `${key}KnownUsd`, Object.values(costs).reduce((sum, value) => sum + value, 0),
  ]));
  const expected = scenarioCosts.expected;
  const fullMonthResidualKnownUsd = compute + expected.databaseUsd + expected.registryUsd
    + (model.ancillaryMonthlyUsd.logsAndMetrics ?? 0) + (model.ancillaryMonthlyUsd.networkAndEgress ?? 0)
    + expected.backupAndRecoveryUsd + expected.sharedEnvironmentFeaturesUsd
    + (model.ancillaryMonthlyUsd.dnsAndCertificates ?? 0) + expected.budgetAutomationUsd;
  const hostingOnly744HoursChf = model.hoursPerMonth * hosting.hourlyChf;
  if (![...Object.values(totals), fullMonthResidualKnownUsd, hostingOnly744HoursChf].every(Number.isFinite)) {
    throw new Error('App Service comparison contains an invalid or overflowing subtotal');
  }
  return {
    hosting: 'appServiceLinuxB1', proposalOnly: true, releaseAllowed: false,
    totals, scenarioCosts, fullMonthResidualKnownUsd,
    hostingOnly744HoursChf,
    problems, sharedModelProblems: baseline.problems,
    assumptions: [
      'Shared usage/prices/ancillary allowances come from the Container Apps proposal and are not measured B1 evidence.',
      'Price all 744 B1 hours even if the site is stopped; no per-request App Service compute fee or free grant.',
      'Additional-plan stress prices two full-month B1 plans and per-plan logs sharing one database, not deployment slots.',
      'Residual subtotal retains the complete fixed month and recovery/automation allowances; variable traffic/log costs can continue.',
      'CHF figure is hosting only, not a converted full estimate. Taxes, complete charge scope and live acceptance remain unresolved.',
    ],
  };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--release', '--app-service'].includes(arg)) || new Set(args).size !== args.length) {
      throw new Error('Use only --release and/or --app-service');
    }
    const model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'infra', 'cost-model.json'), 'utf8'));
    const result = args.includes('--app-service')
      ? compareAppService(model, JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'infra', 'app-service-cost-model.json'), 'utf8')))
      : evaluate(model);
    console.log(JSON.stringify({ ...result, notice: 'Estimates are not a billing cap; taxes, FX, unknown ancillary costs and unbounded traffic are not guaranteed.' }, null, 2));
    if (args.includes('--release') && !result.releaseAllowed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { evaluate, compareAppService };
