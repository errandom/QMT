const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sql = require('mssql');
const { connectionConfig } = require('./migrate.cjs');
const { requestDto } = require('../server/requests.cjs');

async function checkDatabase(pool) {
    const migrations = await pool.request().query('SELECT name, checksum FROM dbo.qmt_migrations');
    const directory = path.join(__dirname, '..', 'migrations');
    for (const name of fs.readdirSync(directory).filter(name => /^\d+[-\w]*\.sql$/.test(name))) {
      const checksum = crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
      if (!migrations.recordset.some(row => row.name === name && row.checksum === checksum)) {
        throw new Error(`Missing or changed migration: ${name}`);
      }
    }
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.requests WHERE payload IS NULL OR ISJSON(payload) <> 1) AS legacy_requests,
        (SELECT COUNT(*) FROM dbo.events WHERE end_time <= start_time) AS invalid_events,
        (SELECT COUNT(*) FROM dbo.users WHERE role = 'admin' AND is_active = 1) AS administrators,
        (SELECT SUM(CAST(size AS bigint)) * 8192 FROM sys.database_files WHERE type = 0) AS data_bytes;
    `);
    const check = result.recordset[0];
    if (check.legacy_requests) throw new Error('Legacy requests require an explicit, reviewed payload migration or archival decision');
    if (check.invalid_events) throw new Error('Invalid historical event intervals require review');
    let after = 0, complete = false;
    for (let page = 0; page < 20; page++) {
      const batch = await pool.request().input('after', sql.Int, after)
        .query('SELECT TOP (500) id, payload, request_type, status FROM dbo.requests WHERE id > @after ORDER BY id');
      for (const row of batch.recordset) requestDto(row);
      if (batch.recordset.length < 500) { complete = true; break; }
      after = batch.recordset.at(-1).id;
    }
    if (!complete) throw new Error('Request history exceeds bounded pagination; review archival before release');
    if (!check.administrators) throw new Error('No active administrator; run the explicit bootstrap procedure');
    const dataBytes = typeof check.data_bytes === 'string' && /^\d+$/.test(check.data_bytes)
      ? Number(check.data_bytes) : check.data_bytes;
    if (!Number.isSafeInteger(dataBytes) || dataBytes < 0 || dataBytes > 1.5 * 1024 ** 3) {
      throw new Error('Database exceeds approved size/headroom or its size is invalid');
    }
    console.log('Migration checksums, request payload schemas/statuses, event intervals, administrator and database size checks passed.');
    console.log('This does not validate timestamp provenance, booking concurrency, restore, ingress or real load.');
}

async function main() {
  const pool = new sql.ConnectionPool(connectionConfig());
  try {
    await pool.connect();
    await checkDatabase(pool);
  } finally { await pool.close(); }
}
if (require.main === module) main().catch(error => { console.error('Database readiness failed:', error.code || error.message); process.exitCode = 1; });
module.exports = { checkDatabase };
