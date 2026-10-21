const sql = require('mssql');
const { connectionConfig } = require('./migrate.cjs');

const operationalTables = Object.freeze([
  'users', 'teams', 'sites', 'fields', 'events', 'equipment', 'requests', 'user_settings',
]);

function applicationCredentials(env) {
  const username = env.QMT_APP_SQL_USER;
  const password = env.QMT_APP_SQL_PASSWORD;
  if (!/^qmt_[a-z][a-z0-9_]{1,47}$/.test(username || '')
    || typeof password !== 'string' || !/^[\x21-\x7e]{20,128}$/.test(password)
    || username.toLowerCase() === env.SQL_USER?.toLowerCase() || password === env.SQL_PASSWORD) {
    throw new Error('Provide an independent qmt_-prefixed application SQL user and a random 20-128 character printable ASCII password');
  }
  return { username, password };
}

async function provisionApplicationUser(pool, { username, password }) {
  applicationCredentials({ QMT_APP_SQL_USER: username, QMT_APP_SQL_PASSWORD: password });
  await pool.request().input('username', sql.NVarChar(128), username)
    .input('password', sql.NVarChar(128), password).query(`
      SET XACT_ABORT ON;
      BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @result int;
        EXEC @result = sys.sp_getapplock @Resource = 'qmt-app-principal-v1',
          @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
        IF @result < 0 THROW 51000, 'Application principal lock unavailable', 1;
        IF DATABASE_PRINCIPAL_ID(@username) IS NOT NULL
          THROW 51000, 'Application principal already exists; no credentials or permissions changed', 1;
        ${operationalTables.map(table => `IF OBJECT_ID('dbo.${table}', 'U') IS NULL
          THROW 51000, 'Apply QMT migrations before creating the application principal', 1;`).join('\n')}
        DECLARE @statement nvarchar(max) = CAST(N'CREATE USER ' AS nvarchar(max))
          + QUOTENAME(@username) + N' WITH PASSWORD = ' + QUOTENAME(@password, '''')
          + N', DEFAULT_SCHEMA = [dbo];';
        EXEC sys.sp_executesql @statement;
        ${operationalTables.map(table => `
          SET @statement = N'GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[dbo].[${table}] TO '
            + QUOTENAME(@username) + N';';
          EXEC sys.sp_executesql @statement;`).join('\n')}
        COMMIT;
      END TRY
      BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        THROW;
      END CATCH;
    `);
}

async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) throw new Error('Invalid arguments');
  if (!args.includes('--apply')) {
    console.log('No SQL connection or changes. After approval, supply independent QMT_APP_SQL_USER/QMT_APP_SQL_PASSWORD and run with --apply and QMT_SQL_PRINCIPAL_APPROVED=true.');
    return;
  }
  if (env.QMT_SQL_PRINCIPAL_APPROVED !== 'true') throw new Error('Explicit SQL principal approval is required');
  const credentials = applicationCredentials(env);
  const pool = new sql.ConnectionPool(connectionConfig(env));
  try {
    await pool.connect();
    await provisionApplicationUser(pool, credentials);
    console.log('Application principal created with DML on the eight operational tables only. No migration-table, schema, database-role or server grants.');
  } finally { await pool.close(); }
}

if (require.main === module) main().catch(error => {
  console.error('Application SQL principal provisioning failed:', error.code || error.message);
  process.exitCode = 1;
});
module.exports = { applicationCredentials, provisionApplicationUser, operationalTables, main };
