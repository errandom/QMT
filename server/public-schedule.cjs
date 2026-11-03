const sql = require('mssql');

const publicFields = {
  teams: ['id', 'name', 'sport', 'age_group', 'active'],
  sites: ['id', 'name', 'address', 'city', 'zip_code', 'latitude', 'longitude', 'is_sports_facility', 'amenities', 'active'],
  fields: ['id', 'name', 'site_id', 'location_type', 'field_type', 'surface_type', 'has_lights', 'capacity', 'active'],
  equipment: ['id', 'name', 'category', 'quantity', 'condition', 'location'],
  events: ['id', 'description', 'event_type', 'status', 'start_time', 'end_time', 'field_id', 'field_ids', 'team_id', 'team_ids', 'recurring_days', 'recurring_end_date', 'game_location', 'away_street', 'away_zip', 'away_city', 'allocation_json', 'external_allocations'],
};

function publicRow(collection, row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => publicFields[collection].includes(key)));
}

function weekRange(value, timezone, now = new Date()) {
  const date = value === undefined ? new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now) : value;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new TypeError('Use a valid week date in YYYY-MM-DD format');
  }
  const monday = new Date(`${date}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const next = new Date(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  if (monday.getUTCFullYear() < 1 || next.getUTCFullYear() > 9999) {
    throw new TypeError('Week is outside the supported calendar range');
  }
  const sunday = new Date(next);
  sunday.setUTCDate(sunday.getUTCDate() - 1);
  return { weekStart: monday.toISOString().slice(0, 10), weekEnd: sunday.toISOString().slice(0, 10), from: monday, to: next };
}

function registerPublicScheduleRoutes(app, { getPool, logger, timezone, clubName }) {
  app.get('/api/public/week', async (req, res) => {
    let range;
    try { range = weekRange(req.query.week, timezone); }
    catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      logger.error('Public weekly schedule calendar unavailable', error);
      return res.status(503).json({ error: 'Weekly schedule unavailable; retry later' });
    }
    try {
      const pool = await getPool();
      // SQL stores club wall-clock times with a Z suffix; match the booking editor's convention.
      const events = await pool.request().input('from', sql.DateTime2, range.from).input('to', sql.DateTime2, range.to)
        .query('SELECT TOP (1001) * FROM events WHERE start_time < @to AND end_time > @from ORDER BY start_time, id');
      if (events.recordset.length > 1000) {
        return res.status(503).json({ error: 'Too many bookings for the weekly widget; open the full schedule' });
      }
      const [teams, sites, fields] = await Promise.all(['teams', 'sites', 'fields'].map(table =>
        pool.request().query(`SELECT * FROM ${table} ORDER BY id`)));
      res.json({
        weekStart: range.weekStart, weekEnd: range.weekEnd, timezone, clubName,
        events: events.recordset.map(row => publicRow('events', row)),
        teams: teams.recordset.map(row => publicRow('teams', row)),
        sites: sites.recordset.map(row => publicRow('sites', row)),
        fields: fields.recordset.map(row => publicRow('fields', row)),
      });
    } catch (error) {
      logger.error('Public weekly schedule unavailable', error);
      res.status(503).json({ error: 'Weekly schedule unavailable; retry later' });
    }
  });
}

module.exports = { publicFields, publicRow, weekRange, registerPublicScheduleRoutes };
