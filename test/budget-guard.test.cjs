const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { runGuard, configuration, budgetReached, readToken } = require('../scripts/budget-guard.cjs');

const scope = '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/qmt-unit';
const appId = `${scope}/providers/Microsoft.App/containerApps/qmt-production`;
const budgetId = `${scope}/providers/Microsoft.Consumption/budgets/qmt-monthly`;
const webAppId = `${scope}/providers/Microsoft.Web/sites/qmt-production-abcdefghijkl0`;
const token = 'synthetic-test-token-not-a-real-credential-0000';
const env = {
  QMT_APP_RESOURCE_ID: appId, QMT_BUDGET_RESOURCE_ID: budgetId,
  QMT_BUDGET_AMOUNT: '30', QMT_BUDGET_CURRENCY: 'CHF',
};
const now = new Date('2026-10-21T09:30:00Z');
const response = body => new Response(JSON.stringify(body));
const budget = amount => ({
  id: budgetId,
  properties: {
    amount: 30, category: 'Cost', timeGrain: 'Monthly',
    timePeriod: { startDate: '2026-10-01T00:00:00Z', endDate: '2027-10-01T00:00:00Z' },
    currentSpend: { amount, unit: 'CHF' },
    forecastSpend: { amount: 1000, unit: 'CHF' },
  },
});

function fixture({ spend = 30, active = true, holdActive = false, replicas = 0, failStop = false } = {}) {
  const rows = ['first', 'second'].map(suffix => ({
    name: `qmt-production--${suffix}`,
    id: `${appId}/revisions/qmt-production--${suffix}`,
    properties: { active },
  }));
  const calls = [];
  const fetchFn = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, ...options });
    assert.equal(url.origin, 'https://management.azure.com');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    if (url.pathname === budgetId) return response(budget(spend));
    if (url.pathname === `${appId}/revisions`) return response({ value: rows });
    for (const row of rows) {
      if (url.pathname === `${row.id}/deactivate`) {
        assert.equal(options.method, 'POST');
        if (failStop && row.name.endsWith('first')) return new Response('private Azure error', { status: 403 });
        if (!holdActive) row.properties.active = false;
        return new Response(null, { status: 200 });
      }
      if (url.pathname === `${row.id}/replicas`) return response({ value: Array(replicas).fill({ name: 'replica' }) });
    }
    assert.fail(`Unexpected request: ${url.pathname}`);
  };
  return { fetchFn, calls, rows, options: { env, token, now, fetchFn, wait: async () => {} } };
}

test('under-budget and forecast-only overspend never stop or even list revisions', async () => {
  const mock = fixture({ spend: 29.99 });
  assert.deepEqual(await runGuard({ ...mock.options, execute: true }), { status: 'within_budget' });
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url.searchParams.get('api-version'), '2024-08-01');
});

test('threshold equality dry-runs by default; execution verifies all revisions and replicas', async () => {
  const mock = fixture();
  assert.deepEqual(await runGuard(mock.options), { status: 'would_suspend', activeRevisions: 2 });
  assert.equal(mock.calls.filter(call => call.method === 'POST').length, 0);
  assert.deepEqual(await runGuard({ ...mock.options, execute: true }), { status: 'suspended', stoppedRevisions: 2 });
  assert.deepEqual(await runGuard({ ...mock.options, execute: true }), { status: 'already_suspended', stoppedRevisions: 0 });
  assert.equal(mock.calls.filter(call => call.method === 'POST').length, 2);
  assert.ok(mock.calls.filter(call => call.url.pathname.endsWith('/replicas')).length >= 4);
});

test('manual fallback is explicitly selected and never needs or edits the budget', async () => {
  const mock = fixture({ spend: 0 });
  const manualEnv = { QMT_APP_RESOURCE_ID: appId };
  assert.equal((await runGuard({ ...mock.options, env: manualEnv, manual: true, execute: true })).status, 'suspended');
  assert.equal(mock.calls.some(call => call.url.pathname.includes('Microsoft.Consumption')), false);
});

test('invalid target and budget scopes are rejected before authentication or transport', async () => {
  for (const [key, value] of [
    ['QMT_APP_RESOURCE_ID', appId.replace('qmt-production', 'another-venture')],
    ['QMT_APP_RESOURCE_ID', `${appId}/revisions/anything`],
    ['QMT_BUDGET_RESOURCE_ID', budgetId.slice(1)],
    ['QMT_BUDGET_RESOURCE_ID', budgetId.replace('qmt-unit', 'other-group')],
    ['QMT_BUDGET_RESOURCE_ID', `${budgetId}?redirect=https://example.test`],
    ['QMT_BUDGET_AMOUNT', ''], ['QMT_BUDGET_AMOUNT', '0'], ['QMT_BUDGET_AMOUNT', 'NaN'],
    ['QMT_BUDGET_CURRENCY', 'usd'],
  ]) {
    await assert.rejects(runGuard({
      env: { ...env, [key]: value }, token, fetchFn: async () => assert.fail('Must not fetch'),
    }));
  }
});

test('missing, narrowed, expired, mismatched and invalid spend data are never treated as zero or converted', () => {
  const config = configuration(env, false);
  const changes = [
    b => { b.id = budgetId.replace('qmt-unit', 'other'); },
    b => { b.properties.category = 'Usage'; },
    b => { b.properties.timeGrain = 'BillingMonth'; },
    b => { b.properties.amount = 300; },
    b => { b.properties.filter = { tags: { name: 'team', values: ['one'] } }; },
    b => { b.properties.timePeriod.endDate = '2026-10-20T00:00:00Z'; },
    b => { b.properties.timePeriod.startDate = '2026-11-01T00:00:00Z'; },
    b => { b.properties.timePeriod.startDate = '2026-10-02T00:00:00Z'; },
    b => { b.properties.timePeriod.startDate = null; },
    b => { b.properties.timePeriod.startDate = '2026-02-29T00:00:00Z'; },
    b => { delete b.properties.currentSpend; },
    b => { b.properties.currentSpend.unit = 'USD'; },
    b => { b.properties.currentSpend.amount = null; },
    b => { b.properties.currentSpend.amount = -1; },
    b => { b.properties.currentSpend.amount = '30'; },
    b => { b.properties.currentSpend.amount = Infinity; },
  ];
  for (const change of changes) {
    const body = budget(30);
    change(body);
    assert.throws(() => budgetReached(body, config, now));
  }
  assert.equal(budgetReached(budget(30.01), config, now), true);
  assert.equal(budgetReached(budget(0), config, now), false);
  const emptyFilter = budget(30);
  emptyFilter.properties.filter = { and: [], dimensions: null, tags: null };
  assert.equal(budgetReached(emptyFilter, config, now), true);
});

test('foreign, malformed or duplicate revisions abort before any write', async () => {
  for (const change of [
    rows => { rows[1].id = rows[1].id.replace('qmt-production', 'another-venture'); },
    rows => { rows[1].name = '../other'; },
    rows => { delete rows[1].properties.active; },
    rows => { rows[1] = rows[0]; },
  ]) {
    const mock = fixture();
    change(mock.rows);
    await assert.rejects(runGuard({ ...mock.options, execute: true }), /INVALID_REVISION_SCOPE/);
    assert.equal(mock.calls.some(call => call.method === 'POST'), false);
  }
});

test('pagination stays on the exact ARM collection and cannot leak credentials to another host or app', async () => {
  for (const nextLink of [
    'https://example.test/steal', `https://management.azure.com${appId.replace('qmt-production', 'other')}/revisions?api-version=2024-03-01`,
    `https://management.azure.com${appId}/revisions?api-version=2099-01-01`,
    `https://management.azure.com${appId}/revisions?api-version=2024-03-01`,
  ]) {
    const mock = fixture();
    let calls = 0;
    await assert.rejects(runGuard({
      ...mock.options, execute: true,
      fetchFn: async (url, options) => {
        calls++;
        if (new URL(url).pathname === `${appId}/revisions`) return response({ value: mock.rows, nextLink });
        return mock.fetchFn(url, options);
      },
    }), /UNSAFE_PAGINATION/);
    assert.equal(calls, 2);
    assert.equal(mock.calls.some(call => call.method === 'POST'), false);
  }
});

test('safe pagination includes active revisions on later pages before stopping', async () => {
  const mock = fixture();
  let listCount = 0;
  const fetchFn = async (url, options) => {
    if (new URL(url).pathname === `${appId}/revisions` && listCount++ < 2) {
      const second = new URL(url).searchParams.has('page');
      return response({
        value: [mock.rows[second ? 1 : 0]],
        ...(second ? {} : { nextLink: `https://management.azure.com${appId}/revisions?api-version=2024-03-01&page=2` }),
      });
    }
    return mock.fetchFn(url, options);
  };
  assert.equal((await runGuard({ ...mock.options, fetchFn, execute: true })).status, 'suspended');
  assert.equal(mock.calls.filter(call => call.method === 'POST').length, 2);
});

test('partial failure still attempts every validated revision and remains an explicit failure', async () => {
  const mock = fixture({ failStop: true });
  await assert.rejects(runGuard({ ...mock.options, execute: true }), /HTTP_403/);
  assert.equal(mock.calls.filter(call => call.method === 'POST').length, 2);
  assert.equal(mock.rows[1].properties.active, false);
  assert.equal(mock.rows[0].properties.active, true);
});

test('active revisions or lingering replicas cannot produce success-shaped suspension', async () => {
  for (const settings of [{ holdActive: true }, { replicas: 1 }]) {
    const mock = fixture(settings);
    await assert.rejects(runGuard({ ...mock.options, execute: true }), /SUSPENSION_NOT_VERIFIED/);
    assert.equal(mock.calls.filter(call => call.url.pathname === `${appId}/revisions`).length, 6);
  }
});

test('HTTP errors, rate limits, malformed/oversized responses and request failures do not retry or write', async () => {
  for (const [fetchFn, error] of [
    [async () => new Response('sensitive body', { status: 429 }), /HTTP_429/],
    [async () => new Response('not JSON'), /INVALID_RESPONSE_JSON/],
    [async () => new Response(`"${'x'.repeat(1024 * 1024)}"`), /RESPONSE_TOO_LARGE/],
    [async () => { throw new Error('sensitive transport detail'); }, /HTTP_REQUEST_FAILED/],
  ]) {
    let calls = 0;
    await assert.rejects(runGuard({
      env, now, token, execute: true,
      fetchFn: async (...args) => { calls++; return fetchFn(...args); },
    }), error);
    assert.equal(calls, 1);
  }
});

test('execution deadline also aborts a native streaming response body', async () => {
  const http = require('node:http');
  const server = http.createServer((_request, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(runGuard({
      env, token, now, signal: AbortSignal.timeout(100),
      fetchFn: (_url, options) => fetch(`http://127.0.0.1:${server.address().port}`, options),
    }), /abort|HTTP_REQUEST_FAILED/i);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('managed identity uses a local endpoint and rejects redirects/remote token services', async () => {
  const mock = fixture({ spend: 0 });
  const identityEnv = { ...env, IDENTITY_ENDPOINT: 'http://127.0.0.1:1234/msi/token', IDENTITY_HEADER: 'synthetic-header' };
  let tokenCalls = 0;
  const fetchFn = async (url, options) => {
    if (url.startsWith('http://127.0.0.1:')) {
      tokenCalls++;
      assert.equal(new URL(url).searchParams.get('resource'), 'https://management.azure.com');
      assert.equal(options.headers['X-IDENTITY-HEADER'], 'synthetic-header');
      assert.equal(options.redirect, 'error');
      return response({ access_token: token, token_type: 'Bearer' });
    }
    return mock.fetchFn(url, options);
  };
  assert.equal((await runGuard({ env: identityEnv, now, fetchFn })).status, 'within_budget');
  assert.equal(tokenCalls, 1);
  await assert.rejects(runGuard({
    env: { ...identityEnv, IDENTITY_ENDPOINT: 'https://example.test/steal' }, fetchFn,
  }), /INVALID_IDENTITY_ENDPOINT/);
  await assert.rejects(runGuard({ env, fetchFn }), /MANAGED_IDENTITY_UNAVAILABLE/);
});

test('protected token input is bounded and CLI errors contain no private values', async () => {
  assert.equal(await readToken(Readable.from([`${token}\r\n`])), token);
  await assert.rejects(readToken(Readable.from(['x'.repeat(16387)])), /TOKEN_INPUT_LIMIT/);
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'budget-guard.cjs'), '--unknown'], {
    encoding: 'utf8', env: { ...process.env, QMT_BUDGET_AMOUNT: 'private-value-do-not-log' },
  });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stderr), { event: 'qmt_budget_guard', status: 'failed', code: 'INVALID_ARGUMENTS' });
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes('private-value'), false);
});

function webFixture({ spend = 30, state = 'Running', holdRunning = false, failStop = false } = {}) {
  const site = {
    id: webAppId, name: webAppId.split('/').at(-1), type: 'Microsoft.Web/sites', properties: { state },
  };
  const calls = [];
  const fetchFn = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, ...options });
    assert.equal(url.origin, 'https://management.azure.com');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    if (url.pathname === budgetId) return response(budget(spend));
    assert.equal(url.searchParams.get('api-version'), '2024-04-01');
    if (url.pathname === webAppId) return response(site);
    if (url.pathname === `${webAppId}/stop`) {
      assert.equal(options.method, 'POST');
      if (failStop) return new Response('private detail', { status: 403 });
      if (!holdRunning) site.properties.state = 'Stopped';
      return new Response(null, { status: 202 });
    }
    assert.fail(`Unexpected request: ${url.pathname}`);
  };
  return {
    calls, site,
    options: { env: { ...env, QMT_APP_RESOURCE_ID: webAppId }, token, now, fetchFn, wait: async () => {} },
  };
}

test('App Service shares the pinned-budget threshold and never reads or stops a site below it', async () => {
  const mock = webFixture({ spend: 29.99 });
  assert.deepEqual(await runGuard({ ...mock.options, execute: true }), { status: 'within_budget' });
  assert.equal(mock.calls.length, 1);
  const invalid = { ...mock.options.env, QMT_BUDGET_RESOURCE_ID: budgetId.replace('qmt-unit', 'other') };
  await assert.rejects(runGuard({ ...mock.options, env: invalid, execute: true }), /INVALID_QMT_BUDGET_SCOPE/);
  assert.equal(mock.calls.length, 1);
});

test('App Service defaults to read-only and only reports suspension after exact-site stop verification', async () => {
  const mock = webFixture();
  const fixedCost = { hosting: 'appService', fixedPlanChargesContinue: true };
  assert.deepEqual(await runGuard(mock.options), { status: 'would_suspend', ...fixedCost });
  assert.equal(mock.calls.some(call => call.method === 'POST'), false);
  assert.deepEqual(await runGuard({ ...mock.options, execute: true }), { status: 'suspended', ...fixedCost });
  assert.deepEqual(await runGuard({ ...mock.options, execute: true }), { status: 'already_suspended', ...fixedCost });
  assert.equal(mock.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(mock.calls.some(call => /serverfarms|revisions|start|restart/i.test(call.url.pathname)), false);
});

test('App Service manual suspension needs no budget and still verifies the same site', async () => {
  const mock = webFixture({ spend: 0 });
  assert.equal((await runGuard({
    ...mock.options, env: { QMT_APP_RESOURCE_ID: webAppId }, manual: true, execute: true,
  })).status, 'suspended');
  assert.equal(mock.calls.some(call => call.url.pathname === budgetId), false);
});

test('App Service rejects foreign resources, slots, plans and malformed states before any stop', async () => {
  for (const invalidId of [
    `${webAppId}/slots/other`, webAppId.replace('/sites/', '/serverfarms/'),
    webAppId.replace('qmt-production-', 'other-'), `${webAppId}/stop`,
    `${appId}-abcdefghijkl0`, webAppId.replace('abcdefghijkl0', 'short'),
  ]) {
    assert.throws(() => configuration({ ...env, QMT_APP_RESOURCE_ID: invalidId }, false), /INVALID_QMT_APP_SCOPE/);
  }
  for (const change of [
    s => { s.id = webAppId.replace('qmt-unit', 'other'); },
    s => { s.name = 'other'; }, s => { s.name = 4; },
    s => { s.type = 'Microsoft.Web/serverfarms'; }, s => { s.type = 4; },
    s => { s.properties.state = 'Unknown'; }, s => { delete s.properties; },
  ]) {
    const mock = webFixture();
    change(mock.site);
    await assert.rejects(runGuard({ ...mock.options, execute: true }), /INVALID_SITE_STATE/);
    assert.equal(mock.calls.some(call => call.method === 'POST'), false);
  }
});

test('App Service failed or unconfirmed stops remain failures and never mutate a plan or retry a stop', async () => {
  for (const settings of [{ holdRunning: true }, { failStop: true }]) {
    const mock = webFixture(settings);
    await assert.rejects(runGuard({ ...mock.options, execute: true }),
      settings.failStop ? /HTTP_403/ : /SUSPENSION_NOT_VERIFIED/);
    assert.equal(mock.calls.filter(call => call.method === 'POST').length, 1);
  }
  const stopped = webFixture({ state: 'Stopped' });
  assert.equal((await runGuard({ ...stopped.options, execute: true })).status, 'already_suspended');
  assert.equal(stopped.calls.some(call => call.method === 'POST'), false);
});

test('job defaults are manual/read-only with bounded scheduling and no SQL or broad role permissions', () => {
  const template = fs.readFileSync(path.join(__dirname, '..', 'infra', 'budget-guard.bicep'), 'utf8');
  assert.match(template, /param scheduled bool = false/);
  assert.match(template, /param execute bool = false/);
  assert.match(template, /replicaTimeout: 120/);
  assert.match(template, /replicaRetryLimit: 0/);
  assert.match(template, /cronExpression: '0 \* \* \* \*'/);
  assert.match(template, /scope: app\b/);
  assert.match(template, /param hosting string = 'containerApps'/);
  assert.match(template, /scope: webApp\b/);
  assert.match(template, /'Microsoft.Web\/sites\/stop\/action'/);
  assert.match(template, /scope: budget\b/);
  assert.match(template, /lastHealthy < ago\(110m\)/);
  assert.match(template, /'failed', 'would_suspend'/);
  assert.doesNotMatch(template, /['"](?:[^'"]*\/(?:write|delete|activate\/action)|\*)['"]/);
  assert.doesNotMatch(template, /SQL_PASSWORD|JWT_SECRET/);
  const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /COPY --chown=node:node scripts\/budget-guard\.cjs/);
});
