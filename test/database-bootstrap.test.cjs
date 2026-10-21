const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { applicationCredentials, provisionApplicationUser, operationalTables } = require('../scripts/provision-database-user.cjs');
const { administratorCredentials, bootstrapAdmin } = require('../scripts/bootstrap-admin.cjs');
const { configuration, runInitialization, initializeFreshDatabase, connectOperatorPool } = require('../scripts/initialize-app-service.cjs');
const { checkDatabase } = require('../scripts/check-database.cjs');

const scope = '/subscriptions/11111111-2222-3333-4444-555555555555/resourceGroups/qmt-production';
const serverName = 'qmt-production-abcdefghijklm';
const serverId = `${scope}/providers/Microsoft.Sql/servers/${serverName}`;
const siteId = `${scope}/providers/Microsoft.Web/sites/${serverName}`;
const env = {
  QMT_SQL_SERVER_RESOURCE_ID: serverId, QMT_OPERATOR_IPV4: '8.8.8.8',
  QMT_DB_INITIALIZATION_APPROVED: 'true', SQL_SERVER: `${serverName}.database.windows.net`,
  SQL_DATABASE: 'qmt-production', SQL_USER: 'synthetic_operator',
  SQL_PASSWORD: 'Synthetic-operator-only-0001!',
  QMT_APP_SQL_USER: 'qmt_application', QMT_APP_SQL_PASSWORD: "Synthetic-app-only-0002!'",
  QMT_ADMIN_USERNAME: 'QMTadmin', QMT_ADMIN_PASSWORD: 'Synthetic-admin-only-0003!',
};
const token = 'synthetic-arm-token-not-a-credential-0001';
const json = value => Response.json(value);

function harness({ intercept } = {}) {
  const calls = [];
  let installed = false, initialized = 0;
  const fetchFn = async (url, options) => {
    const id = new URL(url).pathname;
    const call = { id, method: options.method, body: options.body, signal: options.signal };
    calls.push(call);
    const override = await intercept?.(call);
    if (override) return override;
    if (id === serverId) return json({
      id, name: serverName, location: 'switzerlandnorth', tags: { solution: 'QMT' },
      properties: { administratorLogin: env.SQL_USER },
    });
    if (id === siteId) return json({ id, tags: { solution: 'QMT' }, properties: { enabled: false, state: 'Stopped' } });
    if (id === `${serverId}/databases/qmt-production`) return json({ id, sku: { name: 'Basic' }, properties: { status: 'Online' } });
    if (id === `${siteId}/config/appsettings/list`) return json({ properties: {
      SQL_SERVER: env.SQL_SERVER, SQL_DATABASE: env.SQL_DATABASE, SQL_USER: env.QMT_APP_SQL_USER,
      SQL_PASSWORD: env.QMT_APP_SQL_PASSWORD, QMT_AI_ENABLED: 'false', QMT_SPOND_ENABLED: 'false',
    } });
    assert.match(id, new RegExp(`^${serverId}/firewallRules/qmt-bootstrap-[a-f0-9]{24}$`));
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.properties.startIpAddress, env.QMT_OPERATOR_IPV4);
      assert.equal(body.properties.endIpAddress, env.QMT_OPERATOR_IPV4);
      installed = true;
      return json({ id, ...body });
    }
    if (options.method === 'DELETE') { installed = false; return new Response(null, { status: 204 }); }
    return installed ? json({ id, properties: { startIpAddress: env.QMT_OPERATOR_IPV4, endIpAddress: env.QMT_OPERATOR_IPV4 } })
      : new Response(null, { status: 404 });
  };
  return {
    calls, fetchFn, initialize: async () => { initialized++; },
    get installed() { return installed; }, get initialized() { return initialized; },
  };
}

test('SQL credentials are independent, bounded and never interpolated into provisioning SQL', async () => {
  for (const patch of [
    { QMT_APP_SQL_USER: 'dbo' }, { QMT_APP_SQL_USER: 'qmt_bad];DROP USER dbo' },
    { QMT_APP_SQL_USER: env.SQL_USER }, { QMT_APP_SQL_PASSWORD: env.SQL_PASSWORD },
    { QMT_APP_SQL_PASSWORD: 'too-short' }, { QMT_APP_SQL_PASSWORD: 'x'.repeat(129) },
    { QMT_APP_SQL_PASSWORD: 'x'.repeat(21) + '\0' }, { QMT_APP_SQL_PASSWORD: 'x'.repeat(21) + '\u00e4' },
  ]) assert.throws(() => applicationCredentials({ ...env, ...patch }));
  const inputs = {}, pool = { request: () => ({
    input(name, type, value) { inputs[name] = value; return this; },
    async query(source) {
      assert.ok(source.includes('QUOTENAME(@username)') && source.includes('QUOTENAME(@password'));
      assert.ok(source.includes('BEGIN TRANSACTION') && source.includes('ROLLBACK') && source.includes('COMMIT'));
      assert.ok(source.includes('DATABASE_PRINCIPAL_ID(@username)'));
      assert.ok(!source.includes(env.QMT_APP_SQL_PASSWORD) && !source.includes(env.QMT_APP_SQL_USER));
      assert.ok(!source.includes('db_owner') && !source.includes('db_datareader') && !source.includes('qmt_migrations'));
      for (const table of operationalTables) assert.ok(source.includes(`ON OBJECT::[dbo].[${table}]`));
    },
  }) };
  await provisionApplicationUser(pool, applicationCredentials(env));
  assert.equal(inputs.username, env.QMT_APP_SQL_USER);
  assert.equal(inputs.password, env.QMT_APP_SQL_PASSWORD);
});

test('administrator helper hashes the protected password and importing it performs no bootstrap', async () => {
  assert.throws(() => administratorCredentials({ ...env, QMT_ADMIN_PASSWORD: 'short' }));
  const inputs = {};
  await bootstrapAdmin({ request: () => ({
    input(name, type, value) { inputs[name] = value; return this; },
    async query(source) { assert.ok(source.includes('An active administrator already exists')); },
  }) }, administratorCredentials(env));
  assert.equal(inputs.username, 'QMTadmin');
  assert.match(inputs.hash, /^\$2[aby]\$/);
  assert.notEqual(inputs.hash, env.QMT_ADMIN_PASSWORD);
});

test('nonempty operational data is rejected before migrations or principal writes', async () => {
  let queries = 0;
  await assert.rejects(initializeFreshDatabase({ request: () => ({
    async query(source) {
      queries++;
      assert.match(source, /IF EXISTS \(SELECT 1 FROM dbo\.\[users\]\)/);
      throw new Error('Fresh initialization requires empty operational tables');
    },
  }) }, env), /empty operational tables/);
  assert.equal(queries, 1);
});

test('operator readiness accepts exact BIGINT byte strings and rejects invalid or oversized storage', async () => {
  const directory = path.join(__dirname, '..', 'migrations');
  const migrations = fs.readdirSync(directory).filter(name => /^\d+[-\w]*\.sql$/.test(name)).map(name => ({
    name, checksum: crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/g, '\n')).digest('hex'),
  }));
  const pool = dataBytes => ({ request: () => ({
    input() { return this; },
    async query(source) {
      if (source.includes('SELECT name, checksum')) return { recordset: migrations };
      if (source.includes('legacy_requests')) return { recordset: [{
        legacy_requests: 0, invalid_events: 0, administrators: 1, data_bytes: dataBytes,
      }] };
      return { recordset: [] };
    },
  }) });
  await checkDatabase(pool('10485760'));
  await checkDatabase(pool(10485760));
  for (const value of [null, undefined, '-1', -1, 'NaN', '1e4', '9007199254740993', 1.1, '2147483648']) {
    await assert.rejects(checkDatabase(pool(value)), /size/);
  }
});

test('B1 initialization preview has no Azure or SQL side effects; CLI gates reject unknown flags', async () => {
  const h = harness();
  const result = await runInitialization({ env, ...h });
  assert.equal(result.status, 'preview_only');
  assert.equal(h.calls.length, 0);
  assert.equal(h.initialized, 0);
  const preview = spawnSync(process.execPath, ['scripts/provision-database-user.cjs'], {
    encoding: 'utf8', env: { ...process.env, SQL_SERVER: 'invalid.invalid' },
  });
  assert.equal(preview.status, 0);
  assert.match(preview.stdout, /No SQL connection/);
  const invalid = spawnSync(process.execPath, ['scripts/initialize-app-service.cjs', '--execute'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
});

test('operator scope and IP validation reject other ventures, CIDRs, broad, local and mismatched targets', async () => {
  for (const ip of ['0.0.0.0', '0.1.2.3', '127.0.0.1', '10.1.2.3', '169.254.1.1', '172.16.1.2', '192.168.1.1',
    '100.64.1.1', '224.0.0.1', '255.255.255.255', '8.8.8.0/24', '::1']) {
    assert.throws(() => configuration({ ...env, QMT_OPERATOR_IPV4: ip }));
  }
  for (const id of [
    serverId.replace('resourceGroups/qmt-production', 'resourceGroups/ARGOS'),
    serverId.replace(serverName, 'argos'), `${serverId}/databases/qmt-production`,
    serverId.replace(serverName, 'qmt-staging-abcdefghijklm'),
  ]) assert.throws(() => configuration({ ...env, QMT_SQL_SERVER_RESOURCE_ID: id }));
  for (const patch of [
    { QMT_DB_INITIALIZATION_APPROVED: 'false' }, { SQL_DATABASE: 'master' }, { SQL_SERVER: 'foreign.database.windows.net' },
    { QMT_ADMIN_USERNAME: 'another-admin' }, { QMT_ADMIN_PASSWORD: env.QMT_APP_SQL_PASSWORD },
    { QMT_ADMIN_PASSWORD: env.SQL_PASSWORD }, { QMT_APP_SQL_PASSWORD: env.SQL_PASSWORD },
  ]) {
    const h = harness();
    await assert.rejects(runInitialization({ env: { ...env, ...patch }, execute: true, token, ...h }));
    assert.equal(h.calls.length, 0);
  }
});

test('approved initialization creates only one single-IP rule, verifies cleanup and never starts the app', async () => {
  const h = harness();
  const result = await runInitialization({ env, execute: true, token, ...h });
  assert.equal(result.status, 'initialized');
  assert.equal(h.initialized, 1);
  assert.equal(h.installed, false);
  assert.equal(result.operatorRuleRemoved, true);
  const writes = h.calls.filter(call => call.method !== 'GET' && !call.id.endsWith('/config/appsettings/list'));
  assert.deepEqual(writes.map(call => call.method), ['PUT', 'DELETE']);
  assert.equal(writes[0].id, writes[1].id);
  assert.equal(h.calls.filter(call => call.id === siteId).length, 2);
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  assert.ok(!JSON.stringify(result).includes(env.QMT_APP_SQL_PASSWORD));
});

test('cloud identity, tier and prelaunch isolation are checked before creating operator access', async () => {
  for (const [id, body] of [
    [serverId, { id: serverId, name: 'foreign' }],
    [siteId, { id: siteId, tags: { solution: 'QMT' }, properties: { enabled: true, state: 'Running' } }],
    [`${serverId}/databases/qmt-production`, { id: `${serverId}/databases/qmt-production`, sku: { name: 'S0' }, properties: { status: 'Online' } }],
    [`${siteId}/config/appsettings/list`, { properties: {
      SQL_SERVER: env.SQL_SERVER, SQL_DATABASE: env.SQL_DATABASE,
      SQL_USER: env.QMT_APP_SQL_USER, SQL_PASSWORD: 'synthetic-wrong-credential',
      QMT_AI_ENABLED: 'false', QMT_SPOND_ENABLED: 'false',
    } }],
  ]) {
    const h = harness({ intercept: call => call.id === id ? json(body) : undefined });
    await assert.rejects(runInitialization({ env, execute: true, token, ...h }));
    assert.equal(h.calls.filter(call => call.method !== 'GET' && !call.id.endsWith('/config/appsettings/list')).length, 0);
    assert.equal(h.initialized, 0);
  }
});

test('an existing operator rule cannot be overwritten or deleted', async () => {
  const h = harness({ intercept: call => call.id.includes('/firewallRules/') ? json({ id: call.id }) : undefined });
  await assert.rejects(runInitialization({ env, execute: true, token, ...h }), /already exists/);
  assert.equal(h.calls.filter(call => call.method !== 'GET' && !call.id.endsWith('/config/appsettings/list')).length, 0);
});

test('SQL failure or an ambiguous PUT response still removes the exact temporary rule', async () => {
  const h = harness();
  await assert.rejects(runInitialization({
    env, execute: true, token, ...h, initialize: async () => { throw new Error('Synthetic SQL failure'); },
  }), /Synthetic SQL failure/);
  assert.equal(h.installed, false);
  assert.equal(h.calls.filter(call => call.method === 'DELETE').length, 1);
  let ambiguous = false;
  const failed = harness({ intercept: call => {
    if (call.method === 'PUT') { ambiguous = true; throw new Error('Synthetic transport failure'); }
    if (call.method === 'GET' && call.id.includes('/firewallRules/') && ambiguous) return new Response(null, { status: 404 });
  } });
  await assert.rejects(runInitialization({ env, execute: true, token, ...failed }), /Synthetic transport failure/);
  assert.equal(failed.initialized, 0);
  assert.equal(failed.calls.at(-1).method, 'GET');
});

test('cleanup failure stays a failure and preserves the primary failure for protected review', async () => {
  const h = harness({ intercept: call => call.method === 'DELETE' ? new Response(null, { status: 403 }) : undefined });
  const failure = new Error('Synthetic SQL failure');
  await assert.rejects(runInitialization({
    env, execute: true, token, ...h, initialize: async () => { throw failure; },
  }), error => error instanceof AggregateError && error.message.includes('SQL_OPERATOR_CLEANUP_REQUIRED')
    && error.message.includes(`${serverId}/firewallRules/qmt-bootstrap-`) && error.errors[0] === failure);
});

test('accepted DELETE is not accepted initialization until rule disappearance is verified', async () => {
  const h = harness({ intercept: call => call.method === 'DELETE' ? new Response(null, { status: 202 }) : undefined });
  await assert.rejects(runInitialization({ env, execute: true, token, ...h, wait: async () => {} }), /SQL_OPERATOR_CLEANUP_REQUIRED/);
});

test('only explicit firewall propagation errors retry connection establishment, never initialization or bad passwords', async () => {
  let attempts = 0, closed = 0, waits = 0;
  const connected = await connectOperatorPool(env, {
    wait: async milliseconds => { assert.equal(milliseconds, 15000); waits++; },
    makePool: config => {
      assert.equal(config.options.encrypt, true);
      assert.equal(config.options.trustServerCertificate, false);
      assert.equal(config.options.maxRetriesOnTransientErrors, 0);
      const connection = new EventEmitter();
      config.beforeConnect(connection);
      return {
        async connect() {
          attempts++;
          if (attempts < 3) { connection.emit('errorMessage', { number: 40615 }); throw new Error('Synthetic firewall cache'); }
        },
        async close() { closed++; },
      };
    },
  });
  assert.equal(attempts, 3);
  assert.equal(closed, 2);
  assert.equal(waits, 2);
  await connected.close();
  let rejected = 0;
  await assert.rejects(connectOperatorPool(env, {
    wait: async () => { assert.fail('Bad passwords must never retry'); },
    makePool: config => {
      const connection = new EventEmitter();
      config.beforeConnect(connection);
      return {
        async connect() { rejected++; connection.emit('errorMessage', { number: 18456 }); throw new Error('Synthetic bad password'); },
        async close() {},
      };
    },
  }), /Synthetic bad password/);
  assert.equal(rejected, 1);
});

test('firewall connection retries are bounded and an aborted operator never connects', async () => {
  let attempts = 0;
  await assert.rejects(connectOperatorPool(env, {
    wait: async () => {},
    makePool: config => {
      const connection = new EventEmitter();
      config.beforeConnect(connection);
      return {
        async connect() { attempts++; connection.emit('errorMessage', { number: 40615 }); throw new Error('Synthetic firewall cache'); },
        async close() {},
      };
    },
  }), /Synthetic firewall cache/);
  assert.equal(attempts, 21);
  await assert.rejects(connectOperatorPool(env, {
    signal: AbortSignal.abort(),
    makePool: () => assert.fail('An aborted operator must not open a SQL pool'),
  }));
});
