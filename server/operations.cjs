const sql = require('mssql');
const { z } = require('zod');
const { HttpError, ids, transaction, saveBooking } = require('./bookings.cjs');
const { requestDto } = require('./requests.cjs');
const { day, clock, zones, allocation, eventOperations, requestDates, interval, conflictsFor } = require('./operations-domain.cjs');

const iso = value => new Date(value).toISOString();
const bookingBody = event => ({ ...event, start_time: iso(event.start_time), end_time: iso(event.end_time),
  recurring_end_date: null, recurring_days: null, transport_requested: Boolean(event.transport_requested) });
const parse = (schema, value) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return parsed.data;
};

async function windowData(source, start, end) {
  const events = await source.request().input('start', sql.DateTime2, new Date(start))
    .input('end', sql.DateTime2, new Date(end))
    .query('SELECT TOP (5001) * FROM events WHERE start_time < @end AND end_time > @start ORDER BY start_time, id');
  const external = await source.request().input('start', sql.DateTime2, new Date(start))
    .input('end', sql.DateTime2, new Date(end))
    .query('SELECT TOP (5001) * FROM external_allocations WHERE active = 1 AND start_time < @end AND end_time > @start ORDER BY start_time, id');
  if (events.recordset.length > 5000 || external.recordset.length > 5000) throw new HttpError(409, 'Too many allocations; narrow the review window');
  return { events: events.recordset, external: external.recordset };
}
const txSource = tx => ({ request: () => new sql.Request(tx) });

function registerOperationsRoutes(app, { getPool, logger }) {
  const route = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      logger.error('Operations action failed', error);
      res.status(error instanceof HttpError ? error.status : 503)
        .json({ error: error instanceof HttpError ? error.message : 'Operations unavailable; retry later' });
    }
  };
  app.get('/api/operations', route(async (req, res) => {
    const now = new Date();
    const localDay = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(value);
    const from = req.query.from ? parse(day, req.query.from) : localDay(now);
    const to = req.query.to ? parse(day, req.query.to) : localDay(new Date(now.getTime() + 366 * 86400000));
    if (to <= from || Date.parse(to) - Date.parse(from) > 367 * 86400000) throw new HttpError(400, 'Select an operations window of at most one year');
    const pool = await getPool();
    const data = await windowData(pool, from, to);
    const rows = await pool.request().query('SELECT TOP (5001) event_id, revision, payload FROM event_operations');
    if (rows.recordset.length > 5000) throw new HttpError(409, 'Operations metadata limit reached; archive completed work');
    res.json({ ...data, from, to, metadata: rows.recordset.map(row => ({
      eventId: String(row.event_id), revision: row.revision, ...eventOperations.parse(JSON.parse(row.payload)),
    })) });
  }));

  app.post('/api/operations/requests/:id/preview', route(async (req, res) => {
    const id = ids([req.params.id])[0];
    const body = parse(z.object({ fieldId: z.string().regex(/^[1-9]\d*$/) }), req.body);
    const pool = await getPool();
    const found = await pool.request().input('id', sql.Int, id).query('SELECT * FROM requests WHERE id = @id');
    if (!found.recordset.length) throw new HttpError(404, 'Request not found');
    const request = requestDto(found.recordset[0]);
    if (request.type !== 'facility') throw new HttpError(400, 'Select a facility request');
    const dates = requestDates(request);
    const first = interval(dates[0], request.startTime, request.duration);
    const last = interval(dates.at(-1), request.startTime, request.duration);
    const data = await windowData(pool, new Date(Date.parse(first.start) - 3600000).toISOString(),
      new Date(Date.parse(last.end) + 3600000).toISOString());
    const fields = await pool.request().query('SELECT f.id, f.name, f.location_type FROM fields f JOIN sites s ON s.id = f.site_id WHERE f.active = 1 AND s.active = 1');
    const compatible = fields.recordset.filter(field => (field.location_type || 'field') === (request.workflow?.locationType || request.locationType));
    if (!compatible.some(field => String(field.id) === body.fieldId)) throw new HttpError(400, 'Select an active location matching this request');
    res.json(dates.map(date => {
      const { start, end } = interval(date, request.startTime, request.duration);
      const candidate = { start_time: start, end_time: end, field_ids: body.fieldId };
      return { date, conflicts: conflictsFor(candidate, data.events, data.external),
        alternatives: compatible.filter(field => String(field.id) !== body.fieldId &&
          !conflictsFor({ ...candidate, field_ids: String(field.id) }, data.events, data.external).length)
          .map(field => ({ id: String(field.id), name: field.name })),
        alternativeTimes: [30, 60, -30, -60].flatMap(minutes => {
          const shifted = { ...candidate, start_time: new Date(Date.parse(start) + minutes * 60000).toISOString(),
            end_time: new Date(Date.parse(end) + minutes * 60000).toISOString() };
          return shifted.start_time.slice(0, 10) === date && !conflictsFor(shifted, data.events, data.external).length
            ? [{ start: shifted.start_time, end: shifted.end_time }] : [];
        }),
      };
    }));
  }));

  app.put('/api/operations/events/:id', route(async (req, res) => {
    const id = ids([req.params.id])[0];
    const body = parse(eventOperations.extend({
      expectedRevision: z.number().int().min(0), allocations: z.array(allocation).max(60).optional(),
    }), req.body);
    const result = await transaction(await getPool(), async tx => {
      const event = (await new sql.Request(tx).input('id', sql.Int, id).query('SELECT * FROM events WHERE id = @id')).recordset[0];
      if (!event) throw new HttpError(404, 'Event not found');
      const prior = (await new sql.Request(tx).input('id', sql.Int, id).query('SELECT revision, payload FROM event_operations WHERE event_id = @id')).recordset[0];
      if ((prior?.revision || 0) !== body.expectedRevision) throw new HttpError(409, 'Event operations changed; reload before saving');
      if (body.allocations !== undefined) await saveBooking(tx, { ...bookingBody(event), allocations: body.allocations }, id);
      const revision = (prior?.revision || 0) + 1;
      const stored = prior ? JSON.parse(prior.payload) : {};
      const payload = JSON.stringify({ ...eventOperations.parse(body),
        ...(stored.spondAttendance ? { spondAttendance: stored.spondAttendance } : {}) });
      await new sql.Request(tx).input('id', sql.Int, id).input('revision', sql.Int, revision)
        .input('payload', sql.NVarChar(sql.MAX), payload).query(prior
          ? 'UPDATE event_operations SET revision = @revision, payload = @payload, updated_at = SYSUTCDATETIME() WHERE event_id = @id'
          : 'INSERT INTO event_operations (event_id, revision, payload) VALUES (@id, @revision, @payload)');
      return { eventId: String(id), revision, ...eventOperations.parse(JSON.parse(payload)) };
    });
    res.json(result);
  }));

  const externalSchema = z.object({
    fieldId: z.string().regex(/^[1-9]\d*$/), participant: z.string().trim().min(1).max(255),
    start: z.string().datetime(), end: z.string().datetime(), zones,
    active: z.boolean(), expectedRevision: z.number().int().min(0),
    allowConflicts: z.boolean().default(false),
  });
  app.put('/api/operations/external/:id', route(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    const body = parse(externalSchema, req.body);
    if (body.end <= body.start || Date.parse(body.end) - Date.parse(body.start) > 7 * 86400000) throw new HttpError(400, 'Use an allocation interval of at most seven days');
    await transaction(await getPool(), async tx => {
      const source = txSource(tx);
      const prior = (await source.request().input('id', sql.UniqueIdentifier, id).query('SELECT * FROM external_allocations WHERE id = @id')).recordset[0];
      if ((prior?.revision || 0) !== body.expectedRevision) throw new HttpError(409, 'External allocation changed; reload before saving');
      const field = (await source.request().input('id', sql.Int, Number(body.fieldId))
        .query('SELECT f.id, f.location_type FROM fields f JOIN sites s ON s.id = f.site_id WHERE f.id = @id AND f.active = 1 AND s.active = 1')).recordset[0];
      if (!field || ((field.location_type || 'field') === 'meeting_room' && body.zones.length)) throw new HttpError(400, 'Select an active compatible location');
      if (body.active) {
        const data = await windowData(source, body.start, body.end);
        const conflicts = conflictsFor({ field_ids: body.fieldId, start_time: body.start, end_time: body.end,
          allocations: [{ fieldId: body.fieldId, start: body.start, end: body.end, zones: body.zones }] },
        data.events, data.external.filter(item => String(item.id).toLowerCase() !== id.toLowerCase()));
        if (conflicts.length && !body.allowConflicts) throw new HttpError(409, `Allocation overlaps: ${conflicts.slice(0, 5).map(item => item.title).join(', ')}. Adjust zones or explicitly acknowledge shared use.`);
        if (conflicts.length) logger.warn('External allocation overlap accepted', { userId: req.user.id, allocationId: id });
      }
      await source.request().input('id', sql.UniqueIdentifier, id).input('field', sql.Int, Number(body.fieldId))
        .input('participant', sql.NVarChar(255), body.participant).input('start', sql.DateTime2, new Date(body.start))
        .input('end', sql.DateTime2, new Date(body.end)).input('zones', sql.NVarChar(100), JSON.stringify(body.zones))
        .input('active', sql.Bit, body.active).input('revision', sql.Int, body.expectedRevision + 1).query(prior
          ? `UPDATE external_allocations SET field_id = @field, participant = @participant, start_time = @start,
              end_time = @end, zones = @zones, active = @active, revision = @revision, updated_at = SYSUTCDATETIME() WHERE id = @id`
          : `INSERT INTO external_allocations (id, field_id, participant, start_time, end_time, zones, active, revision)
              VALUES (@id, @field, @participant, @start, @end, @zones, @active, @revision)`);
    });
    res.json({ id });
  }));

  app.get('/api/operations/series/:id', route(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    const rows = (await (await getPool()).request().input('id', sql.UniqueIdentifier, id)
      .query('SELECT TOP (368) * FROM events WHERE series_id = @id ORDER BY start_time, id')).recordset;
    if (rows.length > 367) throw new HttpError(409, 'Series exceeds the supported annual occurrence limit');
    res.json(rows);
  }));
  app.post('/api/operations/series/:id', route(async (req, res) => {
    const seriesId = parse(z.string().uuid(), req.params.id);
    const body = parse(z.object({
      anchorId: z.number().int().positive(), scope: z.enum(['this', 'future', 'all']), startTime: clock, endTime: clock,
      status: z.enum(['Planned', 'Confirmed', 'Cancelled']),
      expected: z.array(z.object({ id: z.number().int().positive(), updatedAt: z.string().datetime() })).min(1).max(367),
    }), req.body);
    if (body.endTime <= body.startTime) throw new HttpError(400, 'End time must follow start time on the same day');
    const result = await transaction(await getPool(), async tx => {
      const rows = (await new sql.Request(tx).input('series', sql.UniqueIdentifier, seriesId)
        .query('SELECT * FROM events WHERE series_id = @series ORDER BY start_time, id')).recordset;
      const anchor = rows.find(row => row.id === body.anchorId);
      if (!anchor) throw new HttpError(404, 'Series occurrence no longer exists');
      const targets = rows.filter(row => body.scope === 'all' || (body.scope === 'this' ? row.id === body.anchorId : row.start_time >= anchor.start_time));
      if (targets.length !== body.expected.length || targets.some(row =>
        !body.expected.some(item => item.id === row.id && item.updatedAt === iso(row.updated_at)))) {
        throw new HttpError(409, 'The series changed; reload and review the affected occurrences');
      }
      const candidates = targets.map(row => ({ ...bookingBody(row),
        start_time: `${iso(row.start_time).slice(0, 10)}T${body.startTime}:00.000Z`,
        end_time: `${iso(row.start_time).slice(0, 10)}T${body.endTime}:00.000Z`, status: body.status }));
      if (body.status !== 'Cancelled' && candidates.some((candidate, index) =>
        conflictsFor(candidate, candidates.slice(0, index)).length)) throw new HttpError(409, 'Updated occurrences overlap each other');
      const saved = [];
      for (let index = 0; index < targets.length; index++) saved.push(await saveBooking(tx, candidates[index], targets[index].id,
        { excludeIds: targets.map(row => row.id) }));
      logger.info('Series updated', { userId: req.user.id, seriesId, scope: body.scope, count: saved.length });
      return saved;
    });
    res.json(result);
  }));
}

module.exports = { registerOperationsRoutes, windowData };
