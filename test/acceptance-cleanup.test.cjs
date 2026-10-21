const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertDisposableDatabase, runCleanup, cleanupConfiguration } = require('../scripts/cleanup-app-service.cjs');
const { operationalTables } = require('../scripts/provision-database-user.cjs');
const scope = '/subscriptions/11111111-2222-3333-4444-555555555555/resourceGroups/qmt-production';
const name = 'qmt-production-abcdefghijklm';
const serverId = `${scope}/providers/Microsoft.Sql/servers/${name}`;
const siteId = `${scope}/providers/Microsoft.Web/sites/${name}`;
const acceptanceId = '11111111-2222-3333-4444-555555555555';
const env = {
  QMT_SQL_SERVER_RESOURCE_ID: serverId, QMT_OPERATOR_IPV4: '8.8.8.8',
  QMT_DB_INITIALIZATION_APPROVED: 'true', QMT_ACCEPTANCE_CLEANUP_APPROVED: 'true',
  SQL_SERVER: `${name}.database.windows.net`, SQL_DATABASE: 'qmt-production',
  SQL_USER: 'synthetic_operator', SQL_PASSWORD: 'Synthetic-operator-0001!',
  QMT_APP_SQL_USER: 'qmt_application', QMT_APP_SQL_PASSWORD: 'Synthetic-application-0002!',
  QMT_ADMIN_USERNAME: 'QMTadmin', QMT_ADMIN_PASSWORD: 'Synthetic-admin-0003!',
  QMT_ACCEPTANCE_STARTED_AT: '2026-10-20T00:00:00Z',
  QMT_EXPECTED_IMAGE: `ghcr.io/errandom/qmt@sha256:${'a'.repeat(64)}`,
};
const options = { env, acceptanceId, initialized: true, notBefore: '2026-10-21T00:00:00Z',
  token: 'synthetic-arm-not-a-credential-0001', now: Date.parse('2026-10-22T00:00:00Z') };
function database({ tables, userCount = 1, count = 0, user = {} } = {}) {
  return { request: () => ({
    async query(source) {
      if (source.includes('sys.tables')) return { recordset: tables || [...operationalTables, 'qmt_migrations'].map(name => ({ schema: 'dbo', name })) };
      if (source.includes('COUNT_BIG')) return { recordsets: operationalTables.map(table => [{ count: table === 'users' ? userCount : count }]) };
      return { recordset: [{ id: 1, username: 'QMTadmin', role: 'admin', is_active: true,
        email: null, full_name: null, pristine_timestamps: 1, password_hash: 'synthetic-hash', ...user }] };
    },
  }) };
}
function harness({ intercept, auditError } = {}) {
  const calls = [], audits = [];
  let deleted = false, rule;
  async function fetchFn(url, init) {
    const id = new URL(url).pathname, method = init.method;
    calls.push({ id, method });
    const override = await intercept?.({ id, method });
    if (override) return override;
    const json = data => Response.json(data);
    if (id === scope) {
      if (method === 'DELETE') { deleted = true; return new Response(null, { status: 202 }); }
      return deleted ? new Response(null, { status: 404 }) : json({
        id, location: 'switzerlandnorth', tags: { solution: 'QMT', platform: 'errandom', acceptanceId },
      });
    }
    if (id.endsWith('/resources')) return json({ value: [{ id: serverId }, { id: siteId }] });
    if (id.endsWith('/locks') || id.endsWith('/longTermRetentionBackups')) return json({ value: [] });
    if (id.endsWith('/firewallRules')) return json({ value: rule ? [rule] : [] });
    if (id.includes('/firewallRules/qmt-bootstrap-')) {
      if (method === 'PUT') { rule = { id, properties: JSON.parse(init.body).properties }; return json(rule); }
      if (method === 'DELETE') { rule = undefined; return new Response(null, { status: 204 }); }
      return rule ? json(rule) : new Response(null, { status: 404 });
    }
    if (id.endsWith('/databases')) return json({ value: [{ name: env.SQL_DATABASE, sku: { name: 'Basic' }, properties: { status: 'Online' } }] });
    if (id.endsWith('/serverfarms/qmt-production-plan')) return json({ sku: { name: 'B1', capacity: 1 } });
    if (id.endsWith('/config/web')) return json({ properties: { linuxFxVersion: `DOCKER|${env.QMT_EXPECTED_IMAGE}`, alwaysOn: true } });
    if (id === serverId) return json({ id, name, location: 'switzerlandnorth', tags: { solution: 'QMT' }, properties: { administratorLogin: env.SQL_USER } });
    if (id === siteId) return json({ id, tags: { solution: 'QMT' }, properties: { enabled: false, state: 'Stopped' } });
    if (id.endsWith('/databases/qmt-production')) return json({ id, sku: { name: 'Basic' }, properties: { status: 'Online' } });
    if (id.endsWith('/config/appsettings/list')) return json({ properties: {
      SQL_SERVER: env.SQL_SERVER, SQL_DATABASE: env.SQL_DATABASE, SQL_USER: env.QMT_APP_SQL_USER,
      SQL_PASSWORD: env.QMT_APP_SQL_PASSWORD, QMT_AI_ENABLED: 'false', QMT_SPOND_ENABLED: 'false',
    } });
    throw new Error(`Unexpected test request ${id}`);
  }
  return { calls, audits, fetchFn, wait: async () => {}, auditDatabase: async database => {
    audits.push(database);
    if (auditError) throw new Error(auditError);
  } };
}
test('cleanup defaults to offline preview and an armed future deadline makes no request', async () => {
  const h = harness();
  assert.equal((await runCleanup({ ...options, ...h })).status, 'preview_only');
  assert.equal((await runCleanup({ ...options, ...h, execute: true, now: 0 })).status, 'not_due');
  assert.equal(h.calls.length, 0);
});
test('cleanup rejects ambiguous state, mutable image, foreign scope and unapproved deletion', async () => {
  for (const patch of [{ initialized: undefined }, { acceptanceId: 'unowned' }, { notBefore: 'invalid' }]) {
    assert.throws(() => cleanupConfiguration(env, patch.acceptanceId ?? acceptanceId,
      Object.hasOwn(patch, 'initialized') ? patch.initialized : true, patch.notBefore ?? options.notBefore));
  }
  for (const patch of [{ QMT_EXPECTED_IMAGE: 'ghcr.io/errandom/qmt:latest' },
    { QMT_SQL_SERVER_RESOURCE_ID: serverId.replace('resourceGroups/qmt-production', 'resourceGroups/ARGOS') }]) {
    await assert.rejects(runCleanup({ ...options, env: { ...env, ...patch } }));
  }
  const h = harness();
  await assert.rejects(runCleanup({ ...options, ...h, execute: true, env: { ...env, QMT_ACCEPTANCE_CLEANUP_APPROVED: 'false' } }), /approval/);
  assert.equal(h.calls.length, 0);
});
test('one unchanged generated administrator is disposable, but operational data and changed users are preserved', async () => {
  await assertDisposableDatabase(database(), true, env.QMT_ADMIN_PASSWORD, async () => true);
  await assertDisposableDatabase(database({ tables: [] }), false, env.QMT_ADMIN_PASSWORD);
  for (const fixture of [{ count: 1 }, { userCount: 2 }, { user: { username: 'staff' } },
    { user: { email: 'synthetic@example.invalid' } }, { user: { full_name: 'Changed administrator' } },
    { user: { id: 2 } }, { user: { pristine_timestamps: 0 } },
    { user: { is_active: false } }, { tables: [{ schema: 'dbo', name: 'unknown' }] }]) {
    await assert.rejects(assertDisposableDatabase(database(fixture), true, env.QMT_ADMIN_PASSWORD, async () => true));
  }
  await assert.rejects(assertDisposableDatabase(database(), true, env.QMT_ADMIN_PASSWORD, async () => false));
  await assert.rejects(assertDisposableDatabase(database(), false, env.QMT_ADMIN_PASSWORD));
});
test('inspection proves ownership/data and removes its exact SQL rule without deleting resources', async () => {
  const h = harness();
  assert.equal((await runCleanup({ ...options, ...h, inspect: true })).status, 'eligible');
  assert.deepEqual(h.audits, ['qmt-production']);
  assert.ok(h.calls.some(call => call.method === 'PUT' && call.id.includes('/firewallRules/qmt-bootstrap-')));
  assert.ok(h.calls.some(call => call.method === 'DELETE' && call.id.includes('/firewallRules/qmt-bootstrap-')));
  assert.ok(!h.calls.some(call => call.id === scope && call.method === 'DELETE'));
});
test('actual cleanup deletes only the proven group and verifies its absence', async () => {
  const h = harness();
  assert.equal((await runCleanup({ ...options, ...h, execute: true })).status, 'deleted');
  assert.deepEqual(h.calls.filter(call => call.method === 'DELETE' && !call.id.includes('/firewallRules/')),
    [{ id: scope, method: 'DELETE' }]);
});
test('unknown owner/resources, incomplete inventory and existing SQL firewall access prevent deletion', async () => {
  for (const [suffix, response] of [
    [scope, { id: scope, location: 'switzerlandnorth', tags: { solution: 'QMT', platform: 'errandom', acceptanceId: 'foreign' } }],
    ['/resources', { value: [{ id: `${scope}/providers/Microsoft.Storage/storageAccounts/foreign` }] }],
    ['/resources', { value: [{ id: serverId }], nextLink: 'https://management.azure.com/next' }],
    ['/firewallRules', { value: [{ id: 'foreign-rule' }] }],
  ]) {
    const h = harness({ intercept: ({ id }) => id.endsWith(suffix) ? Response.json(response) : undefined });
    await assert.rejects(runCleanup({ ...options, ...h, execute: true }));
    assert.ok(!h.calls.some(call => call.method === 'DELETE'));
  }
});
test('operational audit failure still cleans its exact rule and preserves the group', async () => {
  const h = harness({ auditError: 'operational records present' });
  await assert.rejects(runCleanup({ ...options, ...h, execute: true }), /operational records/);
  assert.ok(h.calls.some(call => call.method === 'DELETE' && call.id.includes('/firewallRules/')));
  assert.ok(!h.calls.some(call => call.id === scope && call.method === 'DELETE'));
});
test('retained immutable/foreign backups and provider failures fail closed', async () => {
  for (const response of [Response.json({ value: [{ id: 'foreign-backup' }] }), new Response(null, { status: 403 })]) {
    const h = harness({ intercept: ({ id }) => id.endsWith('/longTermRetentionBackups') ? response.clone() : undefined });
    await assert.rejects(runCleanup({ ...options, ...h, execute: true }));
    assert.ok(!h.calls.some(call => call.method === 'DELETE'));
  }
});
test('only mutable backups belonging to servers created during this acceptance can be removed', async () => {
  const prefix = `${scope}/providers/Microsoft.Sql/locations/switzerlandnorth/longTermRetentionServers/${name}/longTermRetentionDatabases/qmt-production/longTermRetentionBackups`;
  const collection = `${scope}/providers/Microsoft.Sql/locations/switzerlandnorth/longTermRetentionBackups`;
  const backup = { id: `${prefix}/11111111-2222-3333-4444-555555555555;131637960820000000;Hot`,
    properties: { serverName: name, databaseName: 'qmt-production', isBackupImmutable: false,
      serverCreateTime: '2026-10-20T01:00:00Z', backupTime: '2026-10-20T02:00:00Z' } };
  for (const patch of [{ serverCreateTime: '2026-10-19T00:00:00Z' }, { backupTime: 'invalid' },
    { backupTime: '2026-10-23T00:00:00Z' }, { isBackupImmutable: true }]) {
    const h = harness({ intercept: ({ id }) => id === collection
      ? Response.json({ value: [{ ...backup, properties: { ...backup.properties, ...patch } }] }) : undefined });
    await assert.rejects(runCleanup({ ...options, ...h, execute: true }), /backup/);
    assert.ok(!h.calls.some(call => call.method === 'DELETE'));
  }
  let deleted = false;
  const h = harness({ intercept: ({ id, method }) => {
    if (id === collection) return Response.json({ value: deleted ? [] : [backup] });
    if (id === backup.id && method === 'DELETE') { deleted = true; return new Response(null, { status: 204 }); }
  } });
  assert.equal((await runCleanup({ ...options, ...h, execute: true })).status, 'deleted');
  assert.equal(deleted, true);
});
test('a failed credential-policy foundation is disposable only with no server, app or retained backups', async () => {
  const deploymentId = `${scope}/providers/Microsoft.Resources/deployments/qmt-production-foundation`;
  function partial(patch = {}) {
    return harness({ intercept: ({ id }) => {
      if (id === serverId || id === siteId) return new Response(null, { status: 404 });
      if (id.endsWith('/resources')) return Response.json({ value: [{ id: `${scope}/providers/Microsoft.Web/serverfarms/qmt-production-plan` }] });
      if (id === deploymentId) return Response.json({ properties: { provisioningState: patch.state || 'Failed' } });
      if (id === `${deploymentId}/operations`) return Response.json({ value: [{
        properties: { provisioningState: 'Failed', targetResource: { id: serverId },
          statusMessage: { error: { code: patch.code || 'PasswordNotComplex' } } },
      }] });
      if (id.endsWith('/longTermRetentionBackups') && patch.backup) return Response.json({ value: [{ id: 'unknown' }] });
    } });
  }
  const h = partial();
  const result = await runCleanup({ ...options, ...h, initialized: false, execute: true });
  assert.equal(result.status, 'deleted');
  assert.equal(result.partialFoundation, true);
  assert.equal(h.audits.length, 0);
  for (const patch of [{ state: 'Running' }, { code: 'Unverified' }, { backup: true }]) {
    const fixture = partial(patch);
    await assert.rejects(runCleanup({ ...options, ...fixture, initialized: false, execute: true }));
    assert.ok(!fixture.calls.some(call => call.method === 'DELETE'));
  }
  const initialized = partial();
  await assert.rejects(runCleanup({ ...options, ...initialized, execute: true }), /Incomplete foundation/);
});
