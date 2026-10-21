const { test } = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../scripts/test-sql.cjs');

function runner({ connectionFailures = 0, setupFailure, stopFailure = false, testStatus = 0 } = {}) {
  const calls = [], queries = [], pools = [];
  let waits = 0, connections = 0;
  class ConnectionPool {
    constructor(config) {
      assert.equal(config.server, '127.0.0.1');
      assert.equal(config.database, 'master');
      this.closed = false;
      pools.push(this);
    }
    async connect() {
      connections++;
      if (connections <= connectionFailures) throw Object.assign(new Error('SQL starting'), { code: 'ESOCKET' });
      return this;
    }
    async close() { this.closed = true; }
    request() {
      return { query: async source => {
        queries.push(source);
        if (setupFailure && source.startsWith('ALTER DATABASE')) throw setupFailure;
      } };
    }
  }
  const spawn = (command, args, options) => {
    calls.push({ command, args });
    if (command !== 'docker') {
      assert.deepEqual(args, ['--test', 'test/sql-integration.test.cjs']);
      assert.equal(options.env.SQL_SERVER, '127.0.0.1');
      assert.match(options.env.SQL_DATABASE, /^qmt_test_[a-f0-9]+$/);
      assert.match(options.env.SQL_LEGACY_DATABASE, /^qmt_test_[a-f0-9]+$/);
      assert.equal(options.env.QMT_TEST_DATABASE_APPROVED, 'true');
      return { status: testStatus };
    }
    if (args[0] === 'port') return { status: 0, stdout: '127.0.0.1:49152\n' };
    if (args[0] === 'stop' && stopFailure) return { status: 1, stderr: 'Synthetic daemon failure' };
    return { status: 0, stdout: 'synthetic-container' };
  };
  return {
    run: () => main({ spawn, Sql: { ConnectionPool }, wait: async () => { waits++; } }),
    calls, queries, pools, waits: () => waits,
  };
}

test('SQL runner imports without execution and performs setup once after readiness retries', async () => {
  const fixture = runner({ connectionFailures: 2 });
  await fixture.run();
  assert.equal(fixture.waits(), 2);
  assert.equal(fixture.queries.length, 4);
  assert.equal(fixture.queries.filter(source => source.startsWith('CREATE DATABASE')).length, 2);
  assert.ok(fixture.pools.every(pool => pool.closed));
  assert.equal(fixture.calls.filter(call => call.command !== 'docker').length, 1);
  const start = fixture.calls.find(call => call.command === 'docker' && call.args[0] === 'run');
  const stop = fixture.calls.find(call => call.command === 'docker' && call.args[0] === 'stop');
  assert.equal(stop.args[1], start.args[start.args.indexOf('--name') + 1]);
});

test('partial SQL setup fails immediately without retrying database creation and closes all pools', async () => {
  const failure = new Error('Synthetic containment failure');
  const fixture = runner({ setupFailure: failure });
  await assert.rejects(fixture.run(), error => error === failure);
  assert.equal(fixture.waits(), 0);
  assert.equal(fixture.queries.filter(source => source.startsWith('CREATE DATABASE')).length, 1);
  assert.ok(fixture.pools.every(pool => pool.closed));
  assert.equal(fixture.calls.filter(call => call.command !== 'docker').length, 0);
  assert.equal(fixture.calls.at(-1).args[0], 'stop');
});

test('SQL runner preserves the primary setup error when container cleanup also fails', async () => {
  const failure = new Error('Synthetic containment failure');
  const fixture = runner({ setupFailure: failure, stopFailure: true });
  await assert.rejects(fixture.run(), error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[0], failure);
    assert.match(error.errors[1].message, /Docker stop failed/);
    assert.match(error.errors[1].message, /qmt-sql-test-[a-f0-9]{12} requires independent cleanup/);
    assert.match(error.message, /containment failure.*cleanup also failed/);
    return true;
  });
});

test('failed integration process still stops only its own disposable container', async () => {
  const fixture = runner({ testStatus: 1 });
  await assert.rejects(fixture.run(), /SQL integration tests failed/);
  assert.equal(fixture.calls.at(-1).args[0], 'stop');
  assert.match(fixture.calls.at(-1).args[1], /^qmt-sql-test-[a-f0-9]{12}$/);
});

test('successful SQL tests are not accepted when container cleanup fails', async () => {
  const fixture = runner({ stopFailure: true });
  await assert.rejects(fixture.run(), /Docker stop failed/);
});

test('SQL readiness retry limit fails without running database setup or integration tests', async () => {
  const fixture = runner({ connectionFailures: 60 });
  await assert.rejects(fixture.run(), /Disposable SQL did not become ready: ESOCKET/);
  assert.equal(fixture.waits(), 59);
  assert.equal(fixture.queries.length, 0);
  assert.ok(fixture.pools.every(pool => pool.closed));
  assert.equal(fixture.calls.at(-1).args[0], 'stop');
});

test('missing Docker fails before container creation, SQL connections or test execution', async () => {
  const failure = Object.assign(new Error('spawnSync docker ENOENT'), { code: 'ENOENT' });
  const calls = [];
  await assert.rejects(main({ spawn: (command, args) => {
    calls.push({ command, args });
    return { error: failure };
  } }), error => error === failure);
  assert.deepEqual(calls, [{ command: 'docker', args: ['version', '--format', '{{.Server.Version}}'] }]);
});
