const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const sql = require('mssql');

async function main({ spawn = spawnSync, Sql = sql, wait = delay } = {}) {
  const name = `qmt-sql-test-${randomBytes(6).toString('hex')}`;
  const database = `qmt_test_${randomBytes(6).toString('hex')}`;
  const legacyDatabase = `qmt_test_${randomBytes(6).toString('hex')}`;
  const password = `aA1!${randomBytes(20).toString('hex')}`;
  const docker = (...args) => {
    const result = spawn('docker', args, { encoding: 'utf8', env: { ...process.env, MSSQL_SA_PASSWORD: password } });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  docker('version', '--format', '{{.Server.Version}}');
  let started = false, operationError, cleanupError;
  try {
    docker('run', '--detach', '--rm', '--name', name, '--publish', '127.0.0.1::1433',
      '--env', 'ACCEPT_EULA=Y', '--env', 'MSSQL_PID=Developer', '--env', 'MSSQL_SA_PASSWORD',
      'mcr.microsoft.com/mssql/server:2022-latest');
    started = true;
    const port = Number(docker('port', name, '1433/tcp').split(':').pop());
    if (!Number.isInteger(port)) throw new Error('Cannot determine test SQL port');
    const config = {
      server: '127.0.0.1', port, database: 'master', user: 'sa', password,
      options: { encrypt: true, trustServerCertificate: true },
      connectionTimeout: 3000, requestTimeout: 30000, pool: { min: 0, max: 1 },
    };
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const pool = new Sql.ConnectionPool(config);
      try {
        await pool.connect();
        ready = true;
        break;
      } catch (error) {
        if (attempt === 59) throw new Error(`Disposable SQL did not become ready: ${error.code || error.name}`);
        await wait(1000);
      } finally { await pool.close(); }
    }
    if (!ready) throw new Error('Disposable SQL is unavailable');
    const setup = new Sql.ConnectionPool(config);
    try {
      await setup.connect();
      await setup.request().query("EXEC sys.sp_configure 'contained database authentication', 1; RECONFIGURE;");
      await setup.request().query(`CREATE DATABASE [${database}]`);
      await setup.request().query(`ALTER DATABASE [${database}] SET CONTAINMENT = PARTIAL`);
      await setup.request().query(`CREATE DATABASE [${legacyDatabase}]`);
    } finally { await setup.close(); }
    const result = spawn(process.execPath, ['--test', 'test/sql-integration.test.cjs'], {
      stdio: 'inherit',
      env: { ...process.env, QMT_TEST_DATABASE_APPROVED: 'true', SQL_SERVER: '127.0.0.1',
        SQL_PORT: String(port), SQL_DATABASE: database, SQL_LEGACY_DATABASE: legacyDatabase, SQL_USER: 'sa', SQL_PASSWORD: password },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('SQL integration tests failed');
  } catch (error) { operationError = error; }
  finally {
    if (started) {
      try { docker('stop', name); }
      catch (error) {
        cleanupError = new Error(`Disposable SQL container ${name} requires independent cleanup: ${error.message}`, { cause: error });
      }
    }
  }
  if (operationError && cleanupError) {
    throw new AggregateError([operationError, cleanupError],
      `SQL validation failed: ${operationError.message}; disposable container cleanup also failed: ${cleanupError.message}`);
  }
  if (operationError) throw operationError;
  if (cleanupError) throw cleanupError;
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
