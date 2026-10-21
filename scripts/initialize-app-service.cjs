const { isIP } = require('node:net');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const sql = require('mssql');
const { connectionConfig, migrate } = require('./migrate.cjs');
const { applicationCredentials, operationalTables, provisionApplicationUser } = require('./provision-database-user.cjs');
const { administratorCredentials, bootstrapAdmin } = require('./bootstrap-admin.cjs');
const { checkDatabase } = require('./check-database.cjs');
const { readToken, boundedJson, tokenValid } = require('./budget-guard.cjs');

function configuration(env) {
  const serverId = env.QMT_SQL_SERVER_RESOURCE_ID;
  const match = typeof serverId === 'string' && serverId.match(
    /^\/subscriptions\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/resourceGroups\/(qmt-production|qmt-staging)\/providers\/Microsoft\.Sql\/servers\/(\1-[a-z0-9]{13})$/i,
  );
  if (!match || match[1] !== match[1].toLowerCase() || match[2] !== match[2].toLowerCase()) {
    throw new Error('A QMT-only resource group and its exact B1 foundation SQL server ID are required');
  }
  const ip = env.QMT_OPERATOR_IPV4;
  const first = Number(ip?.split('.')[0]);
  if (isIP(ip || '') !== 4 || first === 0 || first === 10 || first === 127 || first >= 224
    || ip.startsWith('169.254.') || ip.startsWith('192.168.')
    || (first === 172 && Number(ip.split('.')[1]) >= 16 && Number(ip.split('.')[1]) <= 31)
    || (first === 100 && Number(ip.split('.')[1]) >= 64 && Number(ip.split('.')[1]) <= 127)) {
    throw new Error('Provide one reviewed public operator IPv4 address, never a range, local address or Azure-wide rule');
  }
  const scope = serverId.slice(0, serverId.toLowerCase().indexOf('/providers/'));
  return {
    serverId, serverName: match[2], database: match[1], ip,
    siteId: `${scope}/providers/Microsoft.Web/sites/${match[2]}`,
    databaseId: `${serverId}/databases/${match[1]}`,
  };
}

async function initializeFreshDatabase(pool, env) {
  const appCredentials = applicationCredentials(env);
  const adminCredentials = administratorCredentials(env);
  await pool.request().query(operationalTables.map(table => `
    IF OBJECT_ID('dbo.${table}', 'U') IS NOT NULL
      EXEC sys.sp_executesql N'IF EXISTS (SELECT 1 FROM dbo.[${table}])
        THROW 51000, ''Fresh initialization requires empty operational tables; no records will be replaced'', 1;';
  `).join('\n'));
  await migrate(pool);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let rolledBack = false;
  tx.on('rollback', () => { rolledBack = true; });
  try {
    const scope = { request: () => new sql.Request(tx) };
    const counts = await scope.request().query(
      operationalTables.map(table => `SELECT COUNT_BIG(*) AS count FROM dbo.[${table}]`).join(';'),
    );
    if (counts.recordsets.length !== operationalTables.length
      || counts.recordsets.some(rows => rows.length !== 1 || Number(rows[0].count) !== 0)) {
      throw new Error('Fresh initialization requires empty operational tables; no records will be replaced');
    }
    await provisionApplicationUser(scope, appCredentials);
    await bootstrapAdmin(scope, adminCredentials);
    await tx.commit();
  } catch (error) {
    if (!rolledBack) await tx.rollback();
    throw error;
  }
}

async function connectOperatorPool(env, {
  signal = AbortSignal.timeout(330000), wait = delay, makePool = config => new sql.ConnectionPool(config),
} = {}) {
  for (let attempt = 0; attempt < 21; attempt++) {
    signal.throwIfAborted();
    let errorNumber;
    const config = connectionConfig(env);
    config.options.maxRetriesOnTransientErrors = 0;
    config.beforeConnect = connection => connection.on('errorMessage', info => { errorNumber = info.number; });
    const pool = makePool(config);
    try { await pool.connect(); return pool; }
    catch (error) {
      await pool.close();
      if (errorNumber !== 40615 || attempt === 20 || signal.aborted) throw error;
      console.warn(`QMT_SQL_FIREWALL_PROPAGATION_RETRY ${attempt + 1}/20`);
      await wait(15000, undefined, { signal });
    }
  }
}

async function initializeDatabase(env) {
  const pool = await connectOperatorPool(env);
  try {
    await initializeFreshDatabase(pool, env);
    await checkDatabase(pool);
  } finally { await pool.close(); }
}

async function runInitialization({
  env = process.env, execute = false, token, fetchFn = fetch, initialize = initializeDatabase, wait = delay,
} = {}) {
  const config = configuration(env);
  if (!execute) return {
    status: 'preview_only', serverId: config.serverId, database: config.database,
    requiresAppDisabled: true, networkChange: 'Temporary single-IPv4 rule; cleanup verified in finally',
  };
  if (env.QMT_DB_INITIALIZATION_APPROVED !== 'true' || !tokenValid(token)) {
    throw new Error('Explicit database-initialization approval and a protected ARM token are required');
  }
  if (env.SQL_SERVER !== `${config.serverName}.database.windows.net` || env.SQL_DATABASE !== config.database) {
    throw new Error('SQL connection settings do not match the approved QMT server and database');
  }
  connectionConfig(env);
  const appCredentials = applicationCredentials(env);
  const adminCredentials = administratorCredentials(env);
  if (adminCredentials.username !== 'QMTadmin' || adminCredentials.password === appCredentials.password
    || adminCredentials.password === env.SQL_PASSWORD) throw new Error('QMTadmin requires an independent credential');
  const executionSignal = AbortSignal.timeout(600000);
  const ruleName = `qmt-bootstrap-${randomBytes(12).toString('hex')}`;
  const ruleId = `${config.serverId}/firewallRules/${ruleName}`;
  const sameId = (a, b) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
  async function arm(id, { method = 'GET', body, missing = false, cleanup = false, web = false } = {}) {
    const response = await fetchFn(`https://management.azure.com${id}?api-version=${web ? '2024-04-01' : '2023-08-01'}`, {
      method, redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: cleanup ? AbortSignal.timeout(15000) : AbortSignal.any([executionSignal, AbortSignal.timeout(15000)]),
    });
    if (response.status === 404 && missing) { await response.body?.cancel(); return null; }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Azure operator ${method} failed with HTTP ${response.status}`); }
    if (method === 'DELETE') { await response.body?.cancel(); return; }
    return boundedJson(response);
  }
  const server = await arm(config.serverId);
  if (!sameId(server.id, config.serverId) || server.name !== config.serverName
    || server.location?.toLowerCase() !== 'switzerlandnorth' || server.tags?.solution !== 'QMT'
    || server.properties?.administratorLogin !== env.SQL_USER) throw new Error('SQL server identity/configuration mismatch');
  const site = await arm(config.siteId, { web: true });
  if (!sameId(site.id, config.siteId) || site.tags?.solution !== 'QMT'
    || site.properties?.enabled !== false || !['Stopped', 'Disabled'].includes(site.properties?.state)) {
    throw new Error('Bootstrap requires the exact QMT site to remain disabled in a non-running provider state');
  }
  const database = await arm(config.databaseId);
  if (!sameId(database.id, config.databaseId) || database.sku?.name !== 'Basic'
    || database.properties?.status !== 'Online') throw new Error('QMT Basic database is not verified online');
  const settings = await arm(`${config.siteId}/config/appsettings/list`, { method: 'POST', web: true });
  if (settings.properties?.SQL_SERVER !== env.SQL_SERVER || settings.properties?.SQL_DATABASE !== config.database
    || settings.properties?.SQL_USER !== appCredentials.username || settings.properties?.SQL_PASSWORD !== appCredentials.password
    || settings.properties?.QMT_AI_ENABLED !== 'false' || settings.properties?.QMT_SPOND_ENABLED !== 'false') {
    throw new Error('Protected app settings do not match the initialization credentials and disabled integrations');
  }
  if (await arm(ruleId, { missing: true })) throw new Error('Operator rule already exists; it will not be overwritten');
  let cleanupNeeded = false, operationError, cleanupError;
  try {
    cleanupNeeded = true;
    console.warn(`QMT_SQL_OPERATOR_RULE ${ruleId}`);
    const rule = await arm(ruleId, { method: 'PUT', body: {
      properties: { startIpAddress: config.ip, endIpAddress: config.ip },
    } });
    if (!sameId(rule.id, ruleId) || rule.properties?.startIpAddress !== config.ip || rule.properties?.endIpAddress !== config.ip) {
      throw new Error('Single-address operator access was not verified');
    }
    await initialize(env);
    executionSignal.throwIfAborted();
    const after = await arm(config.siteId, { web: true });
    if (!sameId(after.id, config.siteId) || after.properties?.enabled !== false || !['Stopped', 'Disabled'].includes(after.properties?.state)) {
      throw new Error('QMT prelaunch isolation changed during initialization');
    }
  } catch (error) { operationError = error; }
  finally {
    if (cleanupNeeded) {
      try {
        let removed = await arm(ruleId, { missing: true, cleanup: true }) === null;
        if (!removed) await arm(ruleId, { method: 'DELETE', cleanup: true });
        for (let attempt = 0; attempt < 5; attempt++) {
          if (removed) break;
          if (await arm(ruleId, { missing: true, cleanup: true }) === null) { removed = true; break; }
          if (attempt < 4) await wait(1000);
        }
        if (!removed) cleanupError = new Error('Rule deletion not verified');
      } catch (error) { cleanupError = error; }
    }
  }
  if (cleanupError) throw new AggregateError(operationError ? [operationError, cleanupError] : [cleanupError],
    `SQL_OPERATOR_CLEANUP_REQUIRED: independently remove and verify ${ruleId}; initialization is not accepted`);
  if (operationError) throw operationError;
  return { status: 'initialized', database: config.database, operatorRuleRemoved: true, appRemainsDisabled: true };
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--execute', '--token-stdin'].includes(arg)) || new Set(args).size !== args.length
    || args.includes('--execute') !== args.includes('--token-stdin')) throw new Error('Use no flags to preview, or --execute --token-stdin after authorization');
  const token = args.includes('--token-stdin') ? await readToken(process.stdin) : undefined;
  return runInitialization({ execute: args.includes('--execute'), token });
}
if (require.main === module) main().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error('QMT initialization failed:', error.code || error.message);
  process.exitCode = 1;
});
module.exports = { configuration, runInitialization, initializeDatabase, initializeFreshDatabase, connectOperatorPool, main };
