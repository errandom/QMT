const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { connectionConfig } = require('./migrate.cjs');

function administratorCredentials(env) {
  const username = env.QMT_ADMIN_USERNAME?.trim();
  const password = env.QMT_ADMIN_PASSWORD;
  if (!username || username.length > 255 || !password || password.length < 20 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Provide QMT_ADMIN_USERNAME and an independently generated QMT_ADMIN_PASSWORD (at least 20 characters, at most 72 UTF-8 bytes)');
  }
  return { username, password };
}

async function bootstrapAdmin(pool, { username, password }) {
  administratorCredentials({ QMT_ADMIN_USERNAME: username, QMT_ADMIN_PASSWORD: password });
  const hash = await bcrypt.hash(password, 12);
  await pool.request().input('username', sql.NVarChar(255), username).input('hash', sql.NVarChar(255), hash)
      .query(`
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
        DECLARE @result int;
        EXEC @result = sys.sp_getapplock @Resource = 'qmt-bootstrap-v1',
          @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
        IF @result < 0 THROW 51000, 'Bootstrap lock unavailable', 1;
        IF EXISTS (SELECT 1 FROM dbo.users WHERE role = 'admin' AND is_active = 1)
          THROW 51000, 'An active administrator already exists; use normal user management', 1;
        INSERT INTO dbo.users (username, password_hash, role, is_active) VALUES (@username, @hash, 'admin', 1);
        COMMIT;
      `);
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply' || process.env.QMT_BOOTSTRAP_APPROVED !== 'true') {
    throw new Error('Bootstrap requires --apply and QMT_BOOTSTRAP_APPROVED=true');
  }
  const credentials = administratorCredentials(process.env);
  const pool = new sql.ConnectionPool(connectionConfig());
  try {
    await pool.connect();
    await bootstrapAdmin(pool, credentials);
    console.log('Administrator created. Clear bootstrap environment variables and rotate any recovered legacy credentials.');
  } finally { await pool.close(); }
}
if (require.main === module) main().catch(error => { console.error('Bootstrap failed:', error.code || error.message); process.exitCode = 1; });
module.exports = { administratorCredentials, bootstrapAdmin };
