const sql = require('mssql');
const { ReviewError } = require('./spond-review-domain.cjs');

async function consumeReviewQuota(pool, userId, action) {
  if (!Number.isSafeInteger(userId) || userId < 1 || !['discovery', 'review'].includes(action)) {
    throw new Error('Invalid Spond quota subject or action');
  }
  const tx = pool.transaction();
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  let rolledBack = false;
  tx.on('rollback', () => { rolledBack = true; });
  try {
    // One short database lock serializes reservations across workers and restarts.
    const result = await tx.request().input('user', sql.Int, userId)
      .input('action', sql.VarChar(16), action)
      .input('daily', sql.Int, action === 'discovery' ? 30 : 120)
      .input('perAdmin', sql.Int, action === 'discovery' ? 3 : 10).query(`
        DECLARE @lock int;
        EXEC @lock = sys.sp_getapplock @Resource = 'qmt-spond-review-quota-v1',
          @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
        IF @lock < 0 THROW 51000, 'Spond quota lock unavailable', 1;
        DECLARE @now datetime2 = SYSUTCDATETIME();
        DECLARE @limits TABLE (subject_id int, maximum int, resets_at datetime2);
        INSERT INTO @limits VALUES
          (0, @daily, DATEADD(day, 1, CONVERT(datetime2, CONVERT(date, @now)))),
          (@user, @perAdmin, DATEADD(minute, 15, @now));
        IF EXISTS (
          SELECT 1 FROM dbo.spond_review_quotas q JOIN @limits l ON l.subject_id = q.subject_id
          WHERE q.action = @action AND q.resets_at > @now AND q.consumed >= l.maximum
        )
        BEGIN
          SELECT TOP (1) CAST(0 AS bit) AS allowed, DATEDIFF(second, @now, q.resets_at) + 1 AS retryAfter
          FROM dbo.spond_review_quotas q JOIN @limits l ON l.subject_id = q.subject_id
          WHERE q.action = @action AND q.resets_at > @now AND q.consumed >= l.maximum
          ORDER BY q.resets_at DESC;
          RETURN;
        END;
        UPDATE q SET consumed = CASE WHEN q.resets_at <= @now THEN 1 ELSE q.consumed + 1 END,
          resets_at = CASE WHEN q.resets_at <= @now THEN l.resets_at ELSE q.resets_at END
        FROM dbo.spond_review_quotas q JOIN @limits l ON l.subject_id = q.subject_id
        WHERE q.action = @action;
        INSERT INTO dbo.spond_review_quotas (action, subject_id, consumed, resets_at)
          SELECT @action, l.subject_id, 1, l.resets_at FROM @limits l
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.spond_review_quotas q WHERE q.action = @action AND q.subject_id = l.subject_id
          );
        SELECT CAST(1 AS bit) AS allowed, 0 AS retryAfter;
      `);
    const quota = result.recordset[0];
    if (!quota || typeof quota.allowed !== 'boolean'
        || !Number.isInteger(quota.retryAfter) || quota.retryAfter < 0) {
      throw new Error('Invalid durable Spond quota result');
    }
    if (!quota.allowed) {
      const error = new ReviewError('Spond review quota reached; retry after the current window', 429);
      error.retryAfter = Math.max(1, quota.retryAfter);
      throw error;
    }
    await tx.commit();
  } catch (error) {
    if (!rolledBack) {
      try { await tx.rollback(); }
      catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Spond quota reservation and rollback failed'); }
    }
    throw error;
  }
}

module.exports = { consumeReviewQuota };
