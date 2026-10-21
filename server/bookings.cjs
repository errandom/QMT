const sql = require('mssql');
const { z } = require('zod');
const { validateEvent } = require('./limits.cjs');

const optionalText = max => z.string().max(max).nullable().optional();
const bookingSchema = z.object({
  event_type: z.enum(['Game', 'Practice', 'Meeting', 'Other']),
  status: z.enum(['Planned', 'Confirmed', 'Cancelled', 'Completed']).optional(),
  start_time: z.string(), end_time: z.string(),
  team_ids: z.union([z.string(), z.array(z.union([z.string(), z.number().int()]))]).nullable().optional(),
  field_ids: z.union([z.string(), z.array(z.union([z.string(), z.number().int()]))]).nullable().optional(),
  field_id: z.union([z.string(), z.number().int()]).nullable().optional(),
  description: optionalText(1000), notes: optionalText(2000), other_participants: optionalText(500),
  estimated_attendance: z.number().int().min(0).max(100000).nullable().optional(),
  game_location: z.enum(['home', 'away']).nullable().optional(),
  away_street: optionalText(255), away_zip: optionalText(20), away_city: optionalText(255),
  transport_requested: z.boolean().optional(),
  recurring_days: z.union([z.string(), z.array(z.number().int())]).nullable().optional(),
  recurring_end_date: optionalText(10),
});

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function ids(value) {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(',');
  if (values.length > 20 || values.some(id => !/^[1-9]\d*$/.test(String(id)) || Number(id) > 2147483647)) {
    throw new HttpError(400, 'Use at most 20 positive integer team/field IDs');
  }
  return [...new Set(values.map(Number))];
}

function bookingDates(body) {
  try { validateEvent(body); }
  catch (error) { throw new HttpError(400, error.message); }
  const start = new Date(body.start_time.endsWith('Z') ? body.start_time : `${body.start_time}Z`);
  const end = new Date(body.end_time.endsWith('Z') ? body.end_time : `${body.end_time}Z`);
  if (!body.recurring_end_date) return [{ start, end }];
  const days = ids(body.recurring_days);
  const last = new Date(`${String(body.recurring_end_date).slice(0, 10)}T23:59:59Z`);
  const result = [];
  for (const date = new Date(start); date <= last; date.setUTCDate(date.getUTCDate() + 1)) {
    if (days.includes(date.getUTCDay() || 7)) {
      result.push({ start: new Date(date), end: new Date(date.getTime() + end.getTime() - start.getTime()) });
    }
  }
  if (!result.length) throw new HttpError(400, 'Recurrence does not contain any selected weekdays');
  return result;
}

async function transaction(pool, action) {
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  let rolledBack = false;
  tx.on('rollback', () => { rolledBack = true; });
  try {
    // One club-wide transaction lock keeps every booking and request approval consistent.
    await new sql.Request(tx).query(`
      DECLARE @result int;
      EXEC @result = sys.sp_getapplock @Resource = 'qmt-bookings-v1',
        @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
      IF @result < 0 THROW 51000, 'Booking lock unavailable', 1;
    `);
    const result = await action(tx);
    await tx.commit();
    return result;
  } catch (error) {
    if (!rolledBack) {
      try { await tx.rollback(); }
      catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Booking transaction and rollback failed'); }
    }
    throw error;
  }
}

async function saveBooking(tx, body, id) {
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'Invalid booking details, field types or text lengths');
  body = parsed.data;
  const dates = bookingDates(body);
  const fields = ids(body.field_ids || body.field_id);
  const teams = ids(body.team_ids);
  if (body.status === 'Confirmed' && body.game_location !== 'away' && !fields.length) {
    throw new HttpError(400, 'Confirmed events require a field or meeting location');
  }
  if (!['Game', 'Practice', 'Meeting', 'Other'].includes(body.event_type)
      || !['Planned', 'Confirmed', 'Cancelled', 'Completed'].includes(body.status || 'Planned')) {
    throw new HttpError(400, 'Invalid event type or status');
  }
  if (id !== undefined) {
    const existing = await new sql.Request(tx).input('id', sql.Int, id)
      .query('SELECT id FROM events WHERE id = @id');
    if (!existing.recordset.length) throw new HttpError(404, 'Event not found');
  }
  for (const field of fields) {
    const active = await new sql.Request(tx).input('id', sql.Int, field)
      .query('SELECT f.id FROM fields f JOIN sites s ON s.id = f.site_id WHERE f.id = @id AND f.active = 1 AND s.active = 1');
    if (!active.recordset.length) throw new HttpError(400, 'A selected field is unavailable');
  }
  for (const team of teams) {
    const active = await new sql.Request(tx).input('id', sql.Int, team)
      .query('SELECT id FROM teams WHERE id = @id AND active = 1');
    if (!active.recordset.length) throw new HttpError(400, 'A selected team is unavailable');
  }
  const saved = [];
  for (const { start, end } of dates) {
    if (fields.length && !['Cancelled', 'Completed'].includes(body.status)) {
      const conflicts = await new sql.Request(tx)
        .input('from', sql.DateTime2, start).input('to', sql.DateTime2, end)
        .input('id', sql.Int, id !== undefined && !saved.length ? id : null).input('fields', sql.NVarChar(255), fields.join(','))
        .query(`
          SELECT TOP 1 e.id FROM events e
          WHERE (@id IS NULL OR e.id <> @id)
            AND ISNULL(e.status, 'Planned') NOT IN ('Cancelled', 'Completed', 'cancelled', 'completed')
            AND e.start_time < @to AND e.end_time > @from
            AND EXISTS (SELECT 1 FROM STRING_SPLIT(@fields, ',') f
              WHERE CHARINDEX(',' + f.value + ',',
                ',' + COALESCE(NULLIF(e.field_ids, ''), CONVERT(nvarchar(20), e.field_id), '') + ',') > 0)
        `);
      if (conflicts.recordset.length) throw new HttpError(409, 'The selected field is already booked during this interval');
    }
    const request = new sql.Request(tx);
    const values = {
      team_ids: [sql.NVarChar(255), teams.join(',') || null],
      field_id: [sql.Int, fields[0] || null],
      field_ids: [sql.NVarChar(255), fields.join(',') || null],
      event_type: [sql.NVarChar(50), body.event_type],
      start_time: [sql.DateTime2, start], end_time: [sql.DateTime2, end],
      description: [sql.NVarChar(1000), body.description || null],
      notes: [sql.NVarChar(2000), body.notes || null],
      status: [sql.NVarChar(50), body.status || 'Planned'],
      recurring_days: [sql.NVarChar(50), null], recurring_end_date: [sql.Date, null],
      other_participants: [sql.NVarChar(500), body.other_participants || null],
      estimated_attendance: [sql.Int, body.estimated_attendance ?? null],
      game_location: [sql.NVarChar(10), body.game_location || null],
      away_street: [sql.NVarChar(255), body.away_street || null],
      away_zip: [sql.NVarChar(20), body.away_zip || null],
      away_city: [sql.NVarChar(255), body.away_city || null],
      transport_requested: [sql.Bit, Boolean(body.transport_requested)],
    };
    for (const [key, [type, value]] of Object.entries(values)) request.input(key, type, value);
    const columns = Object.keys(values);
    const updating = id !== undefined && !saved.length;
    if (updating) request.input('id', sql.Int, id);
    const query = updating
      ? `UPDATE events SET ${columns.map(key => `${key} = @${key}`).join(', ')}, updated_at = SYSUTCDATETIME()
          OUTPUT INSERTED.* WHERE id = @id`
      : `INSERT INTO events (${columns.join(', ')}) OUTPUT INSERTED.*
          VALUES (${columns.map(key => `@${key}`).join(', ')})`;
    const result = await request.query(query);
    saved.push(result.recordset[0]);
  }
  return body.recurring_end_date ? saved : saved[0];
}

function registerBookingRoutes(app, { getPool, logger }) {
  for (const [method, route] of [['post', '/api/events'], ['put', '/api/events/:id'], ['delete', '/api/events/:id']]) {
    app[method](route, async (req, res) => {
      try {
        const id = req.params.id === undefined ? undefined : ids([req.params.id])[0];
        const result = await transaction(await getPool(), async tx => {
          if (method !== 'delete') return saveBooking(tx, req.body, id);
          const deleted = await new sql.Request(tx).input('id', sql.Int, id)
            .query('DELETE FROM events OUTPUT DELETED.id WHERE id = @id');
          if (!deleted.recordset.length) throw new HttpError(404, 'Event not found');
        });
        if (method === 'delete') return res.status(204).end();
        res.status(method === 'post' ? 201 : 200).json(result);
      } catch (error) {
        logger.error('Booking operation failed', error);
        res.status(error instanceof HttpError ? error.status : 503)
          .json({ error: error instanceof HttpError ? error.message : 'Booking operation unavailable; retry later' });
      }
    });
  }
}

module.exports = { HttpError, ids, bookingDates, bookingSchema, transaction, saveBooking, registerBookingRoutes };
