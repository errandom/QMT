const { isIP } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');

const ARM = 'https://management.azure.com';
const APP_API = '2024-03-01';
const WEB_API = '2024-04-01';
const BUDGET_API = '2024-08-01';
const MAX_BYTES = 1024 * 1024;
const MAX_REVISIONS = 20;
const MAX_PAGES = 4;

class GuardError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function check(condition, code) {
  if (!condition) throw new GuardError(code);
}

function sameId(actual, expected) {
  return typeof actual === 'string'
    && `/${actual.replace(/^\//, '')}`.toLowerCase() === expected.toLowerCase();
}

function configuration(env, manual) {
  const appId = env.QMT_APP_RESOURCE_ID;
  const match = typeof appId === 'string' && appId.match(
    /^\/subscriptions\/([a-f0-9-]{36})\/resourceGroups\/([a-z0-9_.()-]{1,90})\/providers\/(Microsoft\.App\/containerApps|Microsoft\.Web\/sites)\/(qmt-production|qmt-staging)(-[a-z0-9]{13})?$/i,
  );
  check(match && (!match[5] || match[3].toLowerCase() === 'microsoft.web/sites'), 'INVALID_QMT_APP_SCOPE');
  const target = {
    appId, appName: `${match[4]}${match[5] || ''}`,
    hosting: match[3].toLowerCase() === 'microsoft.web/sites' ? 'appService' : 'containerApps',
  };
  const scope = appId.slice(0, appId.toLowerCase().indexOf('/providers/'));
  if (manual) return { ...target, scope };
  const budgetId = env.QMT_BUDGET_RESOURCE_ID;
  check(typeof budgetId === 'string' && budgetId.startsWith('/') && sameId(
    budgetId.slice(0, budgetId.lastIndexOf('/')),
    `${scope}/providers/Microsoft.Consumption/budgets`,
  ) && /^[a-z0-9_-]{1,63}$/i.test(budgetId.slice(budgetId.lastIndexOf('/') + 1)), 'INVALID_QMT_BUDGET_SCOPE');
  check(typeof env.QMT_BUDGET_AMOUNT === 'string'
    && /^\d+(\.\d{1,2})?$/.test(env.QMT_BUDGET_AMOUNT), 'INVALID_PINNED_AMOUNT');
  const amount = Number(env.QMT_BUDGET_AMOUNT);
  check(Number.isFinite(amount) && amount > 0, 'INVALID_PINNED_AMOUNT');
  check(/^[A-Z]{3}$/.test(env.QMT_BUDGET_CURRENCY || ''), 'INVALID_PINNED_CURRENCY');
  return { ...target, scope, budgetId, amount, currency: env.QMT_BUDGET_CURRENCY };
}

function budgetReached(budget, config, now) {
  const p = budget?.properties;
  check(sameId(budget?.id, config.budgetId), 'BUDGET_ID_MISMATCH');
  check(p?.category === 'Cost' && p.timeGrain === 'Monthly', 'UNSUPPORTED_BUDGET_PERIOD');
  check(p.amount === config.amount, 'BUDGET_AMOUNT_MISMATCH');
  check(p.filter == null || (typeof p.filter === 'object' && !Array.isArray(p.filter)
    && Object.entries(p.filter).every(([key, value]) => ['and', 'dimensions', 'tags'].includes(key)
      && (value == null || (key === 'and' && Array.isArray(value) && value.length === 0)))),
  'FILTERED_BUDGET_REJECTED');
  check(typeof p.timePeriod?.startDate === 'string' && typeof p.timePeriod?.endDate === 'string',
    'BUDGET_EXPIRED_OR_INVALID');
  const start = new Date(p.timePeriod?.startDate);
  const end = new Date(p.timePeriod?.endDate);
  check(Number.isFinite(start.valueOf()) && Number.isFinite(end.valueOf())
    && start < end && start <= now && now < end && start.getUTCDate() === 1
    && start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0
    && start.getUTCMilliseconds() === 0 && start.toISOString().slice(0, 10) === p.timePeriod.startDate.slice(0, 10),
  'BUDGET_EXPIRED_OR_INVALID');
  check(p.currentSpend?.unit === config.currency, 'BUDGET_CURRENCY_MISMATCH');
  check(typeof p.currentSpend.amount === 'number' && Number.isFinite(p.currentSpend.amount)
    && p.currentSpend.amount >= 0, 'BUDGET_SPEND_MISSING');
  return p.currentSpend.amount >= config.amount;
}

async function boundedJson(response) {
  check(response.body, 'EMPTY_RESPONSE');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    check(bytes <= MAX_BYTES, 'RESPONSE_TOO_LARGE');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GuardError('INVALID_RESPONSE_JSON'); }
}

function tokenValid(token) {
  return typeof token === 'string' && token.length >= 32 && token.length <= 16384
    && /^[a-z0-9._~-]+$/i.test(token);
}

async function identityToken(env, request) {
  check(env.IDENTITY_ENDPOINT && env.IDENTITY_HEADER, 'MANAGED_IDENTITY_UNAVAILABLE');
  let endpoint;
  try { endpoint = new URL(env.IDENTITY_ENDPOINT); }
  catch { throw new GuardError('INVALID_IDENTITY_ENDPOINT'); }
  const host = endpoint.hostname;
  const local = host === 'localhost' || host === '[::1]'
    || (isIP(host) === 4 && (host.startsWith('127.') || host.startsWith('169.254.')));
  check(local && endpoint.protocol === 'http:' && !endpoint.username && !endpoint.password
    && !endpoint.hash, 'INVALID_IDENTITY_ENDPOINT');
  endpoint.search = '';
  endpoint.searchParams.set('resource', ARM);
  endpoint.searchParams.set('api-version', '2019-08-01');
  const response = await request(endpoint.href, { headers: { 'X-IDENTITY-HEADER': env.IDENTITY_HEADER } });
  check(tokenValid(response.access_token) && response.token_type === 'Bearer', 'INVALID_IDENTITY_TOKEN');
  return response.access_token;
}

async function runGuard({
  env = process.env, execute = false, manual = false, token, fetchFn = fetch,
  now = new Date(), signal = AbortSignal.timeout(90000), wait = delay,
} = {}) {
  const config = configuration(env, manual);
  check(Number.isFinite(now.valueOf()), 'INVALID_CLOCK');
  async function request(url, { method = 'GET', headers = {}, empty = false } = {}) {
    let response;
    try {
      response = await fetchFn(url, {
        method, headers, redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
    } catch { throw new GuardError('HTTP_REQUEST_FAILED'); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new GuardError(`HTTP_${response.status}`);
    }
    if (empty) { await response.body?.cancel(); return; }
    return boundedJson(response);
  }
  if (token === undefined) token = await identityToken(env, request);
  check(tokenValid(token), 'INVALID_ACCESS_TOKEN');
  const headers = { Authorization: `Bearer ${token}` };
  const arm = (path, options) => request(`${ARM}${path}`, { ...options, headers });
  if (!manual) {
    const budget = await arm(`${config.budgetId}?api-version=${BUDGET_API}`);
    if (!budgetReached(budget, config, now)) return { status: 'within_budget' };
  }

  if (config.hosting === 'appService') {
    const sitePath = `${config.appId}?api-version=${WEB_API}`;
    const siteState = async () => {
      const site = await arm(sitePath);
      check(sameId(site?.id, config.appId) && typeof site?.name === 'string'
        && site.name.toLowerCase() === config.appName.toLowerCase()
        && typeof site?.type === 'string' && site.type.toLowerCase() === 'microsoft.web/sites'
        && ['Running', 'Stopped'].includes(site?.properties?.state), 'INVALID_SITE_STATE');
      return site.properties.state;
    };
    const state = await siteState();
    const result = { hosting: 'appService', fixedPlanChargesContinue: true };
    if (!execute) return { status: 'would_suspend', ...result };
    if (state === 'Stopped') return { status: 'already_suspended', ...result };
    await arm(`${config.appId}/stop?api-version=${WEB_API}`, { method: 'POST', empty: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await siteState() === 'Stopped') return { status: 'suspended', ...result };
      if (attempt < 4) await wait(2000, undefined, { signal });
    }
    throw new GuardError('SUSPENSION_NOT_VERIFIED');
  }

  async function list(path) {
    const values = [];
    let next = `${ARM}${path}?api-version=${APP_API}`;
    const seen = new Set();
    for (let page = 0; next && page < MAX_PAGES; page++) {
      let url;
      try { url = new URL(next); }
      catch { throw new GuardError('INVALID_PAGINATION_URL'); }
      check(url.origin === ARM && url.pathname.toLowerCase() === path.toLowerCase()
        && !url.username && !url.password && !url.hash
        && url.searchParams.get('api-version') === APP_API && !seen.has(url.href), 'UNSAFE_PAGINATION');
      seen.add(url.href);
      const body = await request(url.href, { headers });
      check(Array.isArray(body.value), 'INVALID_RESOURCE_LIST');
      values.push(...body.value);
      check(values.length <= MAX_REVISIONS, 'RESOURCE_LIST_LIMIT');
      check(body.nextLink == null || typeof body.nextLink === 'string', 'INVALID_PAGINATION_URL');
      next = body.nextLink;
    }
    check(!next, 'PAGINATION_LIMIT');
    return values;
  }

  async function revisions() {
    const rows = await list(`${config.appId}/revisions`);
    const names = new Set();
    for (const row of rows) {
      check(typeof row.name === 'string' && /^[a-z0-9-]{1,64}$/i.test(row.name)
        && row.name.toLowerCase().startsWith(`${config.appName.toLowerCase()}--`)
        && sameId(row.id, `${config.appId}/revisions/${row.name}`)
        && typeof row.properties?.active === 'boolean' && !names.has(row.name.toLowerCase()),
      'INVALID_REVISION_SCOPE');
      names.add(row.name.toLowerCase());
    }
    return rows;
  }

  const initial = await revisions();
  const active = initial.filter(row => row.properties.active);
  if (!execute) return { status: 'would_suspend', activeRevisions: active.length };
  let stopped = 0;
  let failure;
  for (const row of active) {
    try {
      await arm(`${config.appId}/revisions/${row.name}/deactivate?api-version=${APP_API}`,
        { method: 'POST', empty: true });
      stopped++;
    } catch (error) { failure = error; }
  }
  // Try every validated active revision even when another stop request fails.
  if (failure) throw failure;
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await revisions();
    let replicaCount = 0;
    for (const row of rows) {
      const replicas = await list(`${config.appId}/revisions/${row.name}/replicas`);
      replicaCount += replicas.length;
    }
    if (rows.every(row => !row.properties.active) && replicaCount === 0) {
      return { status: stopped ? 'suspended' : 'already_suspended', stoppedRevisions: stopped };
    }
    if (attempt < 4) await wait(2000, undefined, { signal });
  }
  throw new GuardError('SUSPENSION_NOT_VERIFIED');
}

async function readToken(input) {
  check(!input.isTTY, 'PIPE_A_PROTECTED_TOKEN');
  const chunks = [];
  let length = 0;
  const timer = setTimeout(() => input.destroy(new GuardError('TOKEN_INPUT_TIMEOUT')), 10000);
  try {
    for await (const chunk of input) {
      length += Buffer.byteLength(chunk);
      check(length <= 16386, 'TOKEN_INPUT_LIMIT');
      chunks.push(Buffer.from(chunk));
    }
  } finally { clearTimeout(timer); }
  const token = Buffer.concat(chunks).toString('utf8').trim();
  check(tokenValid(token), 'INVALID_ACCESS_TOKEN');
  return token;
}

async function main(args = process.argv.slice(2)) {
  check(args.every(arg => ['--execute', '--manual', '--token-stdin'].includes(arg))
    && args.length === new Set(args).size, 'INVALID_ARGUMENTS');
  const token = args.includes('--token-stdin') ? await readToken(process.stdin) : undefined;
  return runGuard({ execute: args.includes('--execute'), manual: args.includes('--manual'), token });
}

if (require.main === module) {
  main().then(result => {
    console.log(JSON.stringify({ event: 'qmt_budget_guard', ...result }));
  }).catch(error => {
    console.error(JSON.stringify({
      event: 'qmt_budget_guard', status: 'failed',
      code: error instanceof GuardError ? error.code : 'UNEXPECTED_FAILURE',
    }));
    process.exitCode = 1;
  });
}

module.exports = { runGuard, configuration, budgetReached, readToken, boundedJson, tokenValid, GuardError };
