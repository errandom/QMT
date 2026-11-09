const sql = require('mssql');
const { connectionConfig } = require('./migrate.cjs');
const { readConfig } = require('../server/config.cjs');

async function checkSpondReview(pool, { publishingEnabled = false } = {}) {
  await pool.request().query(`SELECT TOP (0) spond_group_id, spond_parent_group_id,
    spond_mapping_reviewed_by, spond_mapping_reviewed_at FROM dbo.teams;
    SELECT TOP (0) spond_id FROM dbo.events;
    SELECT TOP (0) action, subject_id, consumed, resets_at FROM dbo.spond_review_quotas;`);
  const permissions = await pool.request().query(`SELECT
    HAS_PERMS_BY_NAME('dbo.spond_review_quotas', 'OBJECT', 'SELECT') AS quota_read,
    HAS_PERMS_BY_NAME('dbo.spond_review_quotas', 'OBJECT', 'INSERT') AS quota_insert,
    HAS_PERMS_BY_NAME('dbo.spond_review_quotas', 'OBJECT', 'UPDATE') AS quota_update,
    HAS_PERMS_BY_NAME('dbo.teams', 'OBJECT', 'SELECT') AS team_read,
    HAS_PERMS_BY_NAME('dbo.teams', 'OBJECT', 'UPDATE') AS team_update,
    HAS_PERMS_BY_NAME('dbo.events', 'OBJECT', 'SELECT') AS event_read`);
  const row = permissions.recordset[0];
  if (!row || Object.values(row).length !== 6 || Object.values(row).some(value => value !== 1)) {
    throw new Error('Spond review requires runtime SELECT/INSERT/UPDATE on quotas, SELECT/UPDATE on teams and SELECT on events');
  }
  if (publishingEnabled) {
    await pool.request().query(`SELECT TOP (0) event_id, publication_id, group_id, parent_group_id,
      source_hash, approved_by, state, provider_id, created_at, updated_at FROM dbo.spond_publications`);
    const result = await pool.request().query(`SELECT
      HAS_PERMS_BY_NAME('dbo.spond_publications', 'OBJECT', 'SELECT') AS publication_read,
      HAS_PERMS_BY_NAME('dbo.spond_publications', 'OBJECT', 'INSERT') AS publication_insert,
      HAS_PERMS_BY_NAME('dbo.spond_publications', 'OBJECT', 'UPDATE') AS publication_update,
      HAS_PERMS_BY_NAME('dbo.events', 'OBJECT', 'UPDATE') AS event_update,
      HAS_PERMS_BY_NAME('dbo.fields', 'OBJECT', 'SELECT') AS field_read,
      HAS_PERMS_BY_NAME('dbo.sites', 'OBJECT', 'SELECT') AS site_read`);
    const permissions = result.recordset[0];
    if (!permissions || Object.values(permissions).length !== 6 || Object.values(permissions).some(value => value !== 1)) {
      throw new Error('Reviewed publication requires journal SELECT/INSERT/UPDATE, event UPDATE and venue SELECT permissions');
    }
  }
}

async function main(env = process.env) {
  const config = readConfig(env);
  if (!config.spondReviewEnabled) throw new Error('Check the intended review-enabled configuration before pilot activation');
  const pool = new sql.ConnectionPool(connectionConfig(env));
  try {
    await pool.connect();
    await checkSpondReview(pool, { publishingEnabled: config.spondPublishEnabled });
    console.log('Spond review configuration, schema and runtime permissions passed. No provider calls or data writes performed.');
    console.log('This does not verify provider approval, account compatibility, completeness or subgroup semantics.');
  } finally { await pool.close(); }
}

if (require.main === module) main().catch(error => {
  console.error('Spond review readiness failed:', error.code || error.message);
  process.exitCode = 1;
});
module.exports = { checkSpondReview, main };
