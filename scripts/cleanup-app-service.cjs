const bcrypt = require('bcryptjs');
const { configuration, runInitialization, connectOperatorPool } = require('./initialize-app-service.cjs');
const { operationalTables } = require('./provision-database-user.cjs');
const { boundedJson, tokenValid } = require('./budget-guard.cjs');
const { setTimeout: delay } = require('node:timers/promises');

function cleanupConfiguration(env, acceptanceId, initialized, notBefore) {
  const config = configuration(env);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(acceptanceId || '')
    || typeof initialized !== 'boolean' || !Number.isFinite(Date.parse(notBefore))
    || !Number.isFinite(Date.parse(env.QMT_ACCEPTANCE_STARTED_AT))
    || Date.parse(env.QMT_ACCEPTANCE_STARTED_AT) >= Date.parse(notBefore)) {
    throw new Error('An exact acceptance UUID, explicit initialization state, start receipt and cleanup deadline are required');
  }
  if (!/^ghcr\.io\/errandom\/qmt@sha256:[a-f0-9]{64}$/.test(env.QMT_EXPECTED_IMAGE || '')) {
    throw new Error('Cleanup requires the approved immutable QMT image');
  }
  return { ...config, scope: config.serverId.split('/providers/')[0], acceptanceId, initialized, notBefore };
}

async function assertDisposableDatabase(pool, initialized, password, verifyPassword = bcrypt.compare) {
  const tables = (await pool.request().query(
    'SELECT SCHEMA_NAME(schema_id) AS [schema], name FROM sys.tables WHERE is_ms_shipped = 0',
  )).recordset;
  if (!Array.isArray(tables)) throw new Error('Database table inventory is incomplete');
  if (tables.length === 0 && initialized === false) return;
  const expected = new Set([...operationalTables, 'qmt_migrations']);
  if (tables.length !== expected.size || tables.some(row => row.schema !== 'dbo' || !expected.delete(row.name))
    || expected.size) throw new Error('Unexpected or incomplete database schema; preserve it');
  const counts = (await pool.request().query(operationalTables
    .map(table => `SELECT COUNT_BIG(*) AS count FROM dbo.[${table}]`).join(';'))).recordsets;
  if (!Array.isArray(counts) || counts.length !== operationalTables.length
    || counts.some((rows, index) => rows.length !== 1
      || String(rows[0].count) !== (operationalTables[index] === 'users' && initialized ? '1' : '0'))) {
    throw new Error('Operational data exists or cannot be verified; preserve the entire acceptance stack');
  }
  if (initialized) {
    const users = (await pool.request().query(
      `SELECT id, username, password_hash, role, is_active, email, full_name,
        CASE WHEN created_at = updated_at THEN 1 ELSE 0 END AS pristine_timestamps FROM dbo.users`,
    )).recordset;
    if (users.length !== 1 || users[0].id !== 1 || users[0].username !== 'QMTadmin' || users[0].role !== 'admin'
      || users[0].email !== null || users[0].full_name !== null || users[0].pristine_timestamps !== 1
      || users[0].is_active !== true || !await verifyPassword(password, users[0].password_hash)) {
      throw new Error('The sole user is not the unchanged generated bootstrap administrator; preserve it');
    }
  }
}

function allowedResourceIds(config) {
  const app = config.database, name = config.serverName, scope = config.scope;
  return new Set([
    `Microsoft.App/managedEnvironments/${app}-budget`,
    `Microsoft.Network/virtualNetworks/${app}-network`,
    `Microsoft.Network/virtualNetworks/${app}-network/subnets/app`,
    `Microsoft.OperationalInsights/workspaces/${app}-logs`,
    `Microsoft.Sql/servers/${name}`,
    `Microsoft.Sql/servers/${name}/databases/master`,
    `Microsoft.Sql/servers/${name}/databases/${app}`,
    `Microsoft.Sql/servers/${name}/databases/${app}-acceptance-restore`,
    `Microsoft.Sql/servers/${name}/connectionPolicies/default`,
    `Microsoft.Sql/servers/${name}/virtualNetworkRules/qmt-app-subnet`,
    ...[app, `${app}-acceptance-restore`].flatMap(database => [
      `Microsoft.Sql/servers/${name}/databases/${database}/backupLongTermRetentionPolicies/default`,
      `Microsoft.Sql/servers/${name}/databases/${database}/backupShortTermRetentionPolicies/default`,
    ]),
    `Microsoft.Web/serverfarms/${app}-plan`,
    `Microsoft.Web/sites/${name}`,
    `Microsoft.Web/sites/${name}/basicPublishingCredentialsPolicies/ftp`,
    `Microsoft.Web/sites/${name}/basicPublishingCredentialsPolicies/scm`,
    `Microsoft.Web/sites/${name}/config/logs`,
    `Microsoft.Web/sites/${name}/providers/Microsoft.Insights/diagnosticSettings/qmt-console`,
    ...['foundation', 'database', 'guard-environment'].map(suffix => `Microsoft.Resources/deployments/${app}-${suffix}`),
  ].map(suffix => `${scope}/providers/${suffix}`.toLowerCase()));
}

async function runCleanup({
  env, acceptanceId, initialized, notBefore, execute = false, inspect = false, token,
  now = Date.now(), fetchFn = fetch, wait = delay, auditDatabase,
} = {}) {
  const config = cleanupConfiguration(env, acceptanceId, initialized, notBefore);
  if (!execute && !inspect) return { status: 'preview_only', scope: config.scope, requiresDisposableDataProof: true };
  if (execute && now < Date.parse(notBefore)) return { status: 'not_due', notBefore };
  if (!tokenValid(token) || (execute && env.QMT_ACCEPTANCE_CLEANUP_APPROVED !== 'true')) {
    throw new Error('Protected ARM authentication and explicit conditional cleanup approval are required');
  }
  async function arm(id, { method = 'GET', missing = false, api = '2023-08-01', query = '' } = {}) {
    const response = await fetchFn(`https://management.azure.com${id}?api-version=${api}${query}`, {
      method, redirect: 'error', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404 && missing) { await response.body?.cancel(); return null; }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Acceptance cleanup ${method} failed with HTTP ${response.status}; no eligibility inferred`);
    }
    if (method === 'DELETE') { await response.body?.cancel(); return null; }
    return boundedJson(response);
  }
  async function list(id, api = '2023-08-01', query = '') {
    const result = await arm(id, { api, query });
    if (!Array.isArray(result.value) || result.nextLink) throw new Error('Cleanup inventory is incomplete or paginated; preserve it');
    return result.value;
  }
  async function verifyOwnership(missing = false) {
    const group = await arm(config.scope, { api: '2021-04-01', missing });
    if (group === null && missing) return null;
    if (group.id?.toLowerCase() !== config.scope.toLowerCase() || group.location !== 'switzerlandnorth'
      || group.tags?.solution !== 'QMT' || group.tags?.platform !== 'errandom'
      || group.tags?.acceptanceId !== acceptanceId) throw new Error('Acceptance group ownership mismatch; preserve it');
    return group;
  }
  if (!await verifyOwnership(true)) return { status: 'already_absent', scope: config.scope };
  const allowed = allowedResourceIds(config);
  async function checkResources() {
    const resources = await list(`${config.scope}/resources`, '2021-04-01');
    if (!resources.length || resources.some(resource => !allowed.has(resource.id?.toLowerCase()))) {
      throw new Error('Unexpected resources in acceptance scope; preserve it');
    }
    if ((await list(`${config.scope}/providers/Microsoft.Authorization/locks`, '2016-09-01')).length) {
      throw new Error('Acceptance scope is locked; preserve it');
    }
    return resources;
  }
  async function deleteGroup() {
    await verifyOwnership();
    await checkResources();
    await arm(config.scope, { method: 'DELETE', api: '2021-04-01' });
    for (let attempt = 0; attempt < 60; attempt++) {
      if (!await arm(config.scope, { api: '2021-04-01', missing: true })) {
        return { status: 'deleted', scope: config.scope, operationalDataDeleted: false };
      }
      await wait(10000);
    }
    throw new Error('Acceptance deletion requested but not verified; independent follow-up required');
  }
  const resources = await checkResources();
  const retentionId = `${config.scope}/providers/Microsoft.Sql/locations/switzerlandnorth/longTermRetentionBackups`;
  const retainedBackups = await list(retentionId, '2023-08-01', '&databaseState=All');
  const liveServer = await arm(config.serverId, { missing: true });
  const liveSite = await arm(config.siteId, { missing: true, api: '2024-04-01' });
  if (!liveServer || !liveSite) {
    const partialIds = new Set([
      `Microsoft.App/managedEnvironments/${config.database}-budget`,
      `Microsoft.Network/virtualNetworks/${config.database}-network`,
      `Microsoft.Network/virtualNetworks/${config.database}-network/subnets/app`,
      `Microsoft.OperationalInsights/workspaces/${config.database}-logs`,
      `Microsoft.Web/serverfarms/${config.database}-plan`,
      `Microsoft.Resources/deployments/${config.database}-foundation`,
      `Microsoft.Resources/deployments/${config.database}-guard-environment`,
    ].map(id => `${config.scope}/providers/${id}`.toLowerCase()));
    if (initialized || liveServer || liveSite || retainedBackups.length
      || resources.some(resource => !partialIds.has(resource.id.toLowerCase()))) {
      throw new Error('Incomplete foundation may contain operational data or retained backups; preserve it');
    }
    const deploymentId = `${config.scope}/providers/Microsoft.Resources/deployments/${config.database}-foundation`;
    const deployment = await arm(deploymentId, { api: '2025-04-01' });
    const operations = await list(`${deploymentId}/operations`, '2025-04-01');
    if (deployment.properties?.provisioningState !== 'Failed'
      || !operations.some(operation => operation.properties?.provisioningState === 'Failed'
        && operation.properties?.targetResource?.id?.toLowerCase() === config.serverId.toLowerCase()
        && operation.properties?.statusMessage?.error?.code === 'PasswordNotComplex')) {
      throw new Error('No verified SQL-creation credential-policy failure; preserve the partial foundation');
    }
    if (!execute) return { status: 'eligible', scope: config.scope, databases: [], retainedBackups: 0, partialFoundation: true };
    if (await arm(config.serverId, { missing: true })
      || await arm(config.siteId, { missing: true, api: '2024-04-01' })) {
      throw new Error('Partial foundation changed during inspection; preserve it');
    }
    return { ...await deleteGroup(), partialFoundation: true };
  }
  const plan = await arm(`${config.scope}/providers/Microsoft.Web/serverfarms/${config.database}-plan`, { api: '2024-04-01' });
  const web = await arm(`${config.siteId}/config/web`, { api: '2024-04-01' });
  if (plan.sku?.name !== 'B1' || plan.sku?.capacity !== 1
    || web.properties?.linuxFxVersion !== `DOCKER|${env.QMT_EXPECTED_IMAGE}` || web.properties?.alwaysOn !== true) {
    throw new Error('Acceptance hosting configuration changed; preserve it');
  }
  const databases = await list(`${config.serverId}/databases`);
  const names = databases.filter(database => database.name !== 'master').map(database => database.name);
  if (!names.includes(config.database) || names.length > 2
    || names.some(name => ![config.database, `${config.database}-acceptance-restore`].includes(name))
    || databases.some(database => database.name !== 'master'
      && (database.sku?.name !== 'Basic' || database.properties?.status !== 'Online'))) {
    throw new Error('Unexpected or unavailable acceptance databases; preserve them');
  }
  if ((await list(`${config.serverId}/firewallRules`)).length) {
    throw new Error('Unexpected SQL operator/public firewall rule; preserve it and resolve access first');
  }
  const backups = [];
  for (const backup of retainedBackups) {
    const name = backup.properties?.databaseName;
    const prefix = `${config.scope}/providers/Microsoft.Sql/locations/switzerlandnorth/longTermRetentionServers/${config.serverName}/longTermRetentionDatabases/${name}/longTermRetentionBackups`;
    if (!names.includes(name) || !backup.id?.startsWith(`${prefix}/`) || backup.properties?.serverName !== config.serverName
      || !/^[a-z0-9;-]+$/i.test(backup.id.slice(prefix.length + 1))
      || backup.properties?.databaseName !== name || backup.properties?.isBackupImmutable !== false
      || !Number.isFinite(Date.parse(backup.properties?.serverCreateTime))
      || Date.parse(backup.properties.serverCreateTime) < Date.parse(env.QMT_ACCEPTANCE_STARTED_AT)
      || !Number.isFinite(Date.parse(backup.properties?.backupTime))
      || Date.parse(backup.properties.backupTime) < Date.parse(backup.properties.serverCreateTime)
      || Date.parse(backup.properties.backupTime) > now) {
      throw new Error('Unverified or immutable retained backup; preserve it');
    }
    backups.push(backup.id);
  }
  await runInitialization({
    env, token, execute: true, fetchFn, wait,
    initialize: async operatorEnv => {
      for (const name of names) {
        if (auditDatabase) await auditDatabase(name);
        else {
          const pool = await connectOperatorPool({ ...operatorEnv, SQL_DATABASE: name });
          try { await assertDisposableDatabase(pool, initialized, env.QMT_ADMIN_PASSWORD); }
          finally { await pool.close(); }
        }
      }
    },
  });
  await verifyOwnership();
  await checkResources();
  if ((await list(`${config.serverId}/firewallRules`)).length) throw new Error('SQL operator rule cleanup not verified');
  if (!execute) return { status: 'eligible', scope: config.scope, databases: names, retainedBackups: backups.length };
  for (const id of backups) await arm(id, { method: 'DELETE' });
  if ((await list(retentionId, '2023-08-01', '&databaseState=All')).length) {
    throw new Error('Retained-backup deletion not verified; group remains intact');
  }
  return deleteGroup();
}

module.exports = { cleanupConfiguration, assertDisposableDatabase, allowedResourceIds, runCleanup };
