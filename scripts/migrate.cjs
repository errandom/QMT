const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sql = require('mssql');
require('dotenv').config({ quiet: true });

function connectionConfig(env = process.env) {
  for (const key of ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD']) {
    if (!env[key]) throw new Error(`Missing ${key}`);
  }
  return {
    server: env.SQL_SERVER, database: env.SQL_DATABASE, user: env.SQL_USER, password: env.SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 10000, requestTimeout: 30000, pool: { min: 0, max: 1 },
  };
}

async function migrate(pool) {
  const directory = path.join(__dirname, '..', 'migrations');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let rolledBack = false;
  tx.on('rollback', () => { rolledBack = true; });
  try {
    await new sql.Request(tx).query(`
      DECLARE @result int;
      EXEC @result = sys.sp_getapplock @Resource = 'qmt-migrations-v1',
        @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
      IF @result < 0 THROW 51000, 'Migration lock unavailable', 1;
      IF OBJECT_ID('dbo.qmt_migrations', 'U') IS NULL
      CREATE TABLE dbo.qmt_migrations (
        name nvarchar(255) PRIMARY KEY, checksum char(64) NOT NULL,
        applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    `);
    for (const name of fs.readdirSync(directory).filter(name => /^\d+[-\w]*\.sql$/.test(name)).sort()) {
      const source = fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/g, '\n');
      const checksum = crypto.createHash('sha256').update(source).digest('hex');
      const prior = await new sql.Request(tx).input('name', sql.NVarChar(255), name)
        .query('SELECT checksum FROM dbo.qmt_migrations WHERE name = @name');
      if (prior.recordset.length) {
        if (prior.recordset[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      for (const batch of source.split(/^\s*GO\s*$/im).filter(batch => batch.trim())) {
        await new sql.Request(tx).query(batch);
      }
      await new sql.Request(tx).input('name', sql.NVarChar(255), name).input('checksum', sql.Char(64), checksum)
        .query('INSERT INTO dbo.qmt_migrations (name, checksum) VALUES (@name, @checksum)');
      console.log(`Applied ${name}`);
    }
    await tx.commit();
  } catch (error) {
    if (!rolledBack) await tx.rollback();
    throw error;
  }
}

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log('No changes made. After backup/restore approval, set QMT_MIGRATION_APPROVED=true and run npm run migrate -- --apply.');
    return;
  }
  if (process.env.QMT_MIGRATION_APPROVED !== 'true') throw new Error('Explicit migration approval is required');
  const pool = new sql.ConnectionPool(connectionConfig());
  try { await pool.connect(); await migrate(pool); }
  finally { await pool.close(); }
}
if (require.main === module) main().catch(error => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; });
module.exports = { connectionConfig, migrate };
