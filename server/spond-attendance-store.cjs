const sql = require('mssql');
const { z } = require('zod');
const { transaction, HttpError } = require('./bookings.cjs');
const { settingKey, attendanceSchema } = require('./spond-attendance-domain.cjs');

const connectionSchema = z.object({
  id: z.string().uuid(), encryptedToken: z.object({ iv: z.string(), value: z.string().max(20000), tag: z.string() }),
  nextRunAt: z.string().datetime(), runningUntil: z.string().datetime().nullable(), leaseId: z.string().uuid().nullable(),
  lastAttemptAt: z.string().datetime().nullable(), lastSuccessAt: z.string().datetime().nullable(),
  blocked: z.boolean(), error: z.string().max(255).nullable(), processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(), queued: z.number().int().nonnegative(),
});

function attendanceStore(getPool) {
  const request = source => source.request ? source.request() : new sql.Request(source);
  const store = {
    async locked(action) {
      return transaction(await getPool(), tx => action({ request: () => new sql.Request(tx) }));
    },
    async connection(source) {
      const rows = (await request(source || await getPool()).input('key', sql.NVarChar(255), settingKey)
        .query(`SELECT TOP (2) s.user_id, s.setting_value, u.role, u.is_active, SYSUTCDATETIME() AS db_now
          FROM dbo.user_settings s JOIN dbo.users u ON u.id = s.user_id WHERE s.setting_key = @key`)).recordset;
      if (rows.length > 1) throw new HttpError(409, 'Multiple attendance connections found; stop them before reconnecting');
      const row = rows[0];
      return row ? { ...connectionSchema.parse(JSON.parse(row.setting_value)), ownerId: row.user_id,
        authorized: row.role === 'admin' && Boolean(row.is_active), now: +new Date(row.db_now) } : null;
    },
    async saveConnection(source, connection) {
      const payload = JSON.stringify(connectionSchema.parse(connection));
      await request(source).input('key', sql.NVarChar(255), settingKey).input('owner', sql.Int, connection.ownerId)
        .input('value', sql.NVarChar(sql.MAX), payload).query(`MERGE dbo.user_settings AS target
          USING (SELECT @owner AS user_id, @key AS setting_key) AS source
          ON target.user_id = source.user_id AND target.setting_key = source.setting_key
          WHEN MATCHED THEN UPDATE SET setting_value = @value, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (user_id, setting_key, setting_value) VALUES (@owner, @key, @value);`);
    },
    async removeConnection(source) {
      await request(source).input('key', sql.NVarChar(255), settingKey)
        .query('DELETE FROM dbo.user_settings WHERE setting_key = @key');
    },
    async teams(source) {
      const rows = (await request(source || await getPool()).query(`SELECT TOP (201) id, active, spond_group_id,
        spond_parent_group_id, spond_mapping_reviewed_at FROM dbo.teams ORDER BY id`)).recordset;
      if (rows.length > 200) throw new HttpError(409, 'Attendance supports up to 200 teams');
      return rows;
    },
    async event(source, id) {
      const row = (await request(source || await getPool()).input('id', sql.Int, id).query(`SELECT e.*,
        o.payload AS attendance_payload, o.revision AS attendance_revision FROM dbo.events e
        LEFT JOIN dbo.event_operations o ON o.event_id = e.id WHERE e.id = @id`)).recordset[0];
      if (!row) throw new HttpError(404, 'Event no longer exists');
      return row;
    },
    async linkedEvents() {
      const rows = (await request(await getPool()).query(`SELECT TOP (201) e.*, o.payload AS attendance_payload,
        o.revision AS attendance_revision FROM dbo.events e JOIN dbo.event_operations o ON o.event_id = e.id
        WHERE JSON_QUERY(o.payload, '$.spondAttendance') IS NOT NULL AND e.status IN ('Planned', 'Confirmed')
        AND e.end_time > DATEADD(day, -1, SYSUTCDATETIME()) AND e.start_time < DATEADD(day, 31, SYSUTCDATETIME())
        ORDER BY COALESCE(JSON_VALUE(o.payload, '$.spondAttendance.lastAttemptAt'), ''), e.id`)).recordset;
      if (rows.length > 200) throw new HttpError(409, 'More than 200 linked events in the attendance window; narrow the configured scope');
      return rows;
    },
    metadata(event) {
      return event.attendance_payload ? JSON.parse(event.attendance_payload) : { owner: '', checklist: [] };
    },
    async saveAttendance(source, event, attendance) {
      const payload = JSON.stringify({ ...store.metadata(event), spondAttendance: attendanceSchema.parse(attendance) });
      await request(source).input('id', sql.Int, event.id).input('payload', sql.NVarChar(sql.MAX), payload)
        .input('revision', sql.Int, (event.attendance_revision || 0) + 1).query(event.attendance_revision
          ? `UPDATE dbo.event_operations SET payload = @payload, revision = @revision, updated_at = SYSUTCDATETIME() WHERE event_id = @id`
          : 'INSERT INTO dbo.event_operations (event_id, revision, payload) VALUES (@id, @revision, @payload)');
    },
    async removeAttendance(source, event) {
      const metadata = store.metadata(event);
      delete metadata.spondAttendance;
      await request(source).input('id', sql.Int, event.id).input('payload', sql.NVarChar(sql.MAX), JSON.stringify(metadata))
        .query('UPDATE dbo.event_operations SET payload = @payload, revision = revision + 1, updated_at = SYSUTCDATETIME() WHERE event_id = @id');
    },
  };
  return store;
}

module.exports = { attendanceStore };
