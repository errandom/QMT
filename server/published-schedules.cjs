const sql = require('mssql');
const { z } = require('zod');
const { parseDocument, DomUtils } = require('htmlparser2');

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

const siteScheduleSchema = z.object({
  publishedScheduleUrl: z.string().trim().max(2048)
    .refine(value => !value || isWebUrl(value), 'Published schedule source must be an absolute HTTP(S) URL without credentials')
    .nullable().optional().transform(value => value ? new URL(value).href : value === undefined ? undefined : null),
  publishedBookingName: z.string().trim().max(200).nullable().optional()
    .transform(value => value === undefined ? undefined : value || null),
});

function clubDate(now, timezone) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

function sourceUrl(source, date, today) {
  if (!isWebUrl(source) || !validDate(date) || !validDate(today)) return null;
  const saved = new URL(source);
  if (saved.protocol !== 'https:' || saved.hostname !== 'www.sportanlagen-app.net' || saved.port
      || saved.pathname !== '/Public/Spielplan'
      || !/^[1-9]\d{0,5}$/.test(saved.searchParams.get('k') || '')
      || !saved.searchParams.get('m')?.trim() || saved.searchParams.get('m').length > 100
      || [...saved.searchParams.keys()].some(key => !['k', 'm', 'size', 'tag'].includes(key))) return null;
  // Rebuild, rather than forwarding arbitrary query parameters or QMT booking details.
  const url = new URL('https://www.sportanlagen-app.net/Public/Spielplan');
  url.searchParams.set('k', saved.searchParams.get('k'));
  url.searchParams.set('m', saved.searchParams.get('m'));
  url.searchParams.set('size', '1');
  url.searchParams.set('tag', String((Date.parse(date) - Date.parse(today)) / 86400000));
  return url.href;
}

const text = node => DomUtils.textContent(node).replace(/\s+/g, ' ').trim();
const find = (root, name) => DomUtils.findAll(node => node.name === name, root.children || []);
const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parsePublishedSchedule(html, date) {
  const document = parseDocument(html);
  const headings = find(document, 'strong').map(text).filter(value => /^Belegungsplan,/.test(value));
  if (!headings.length && /No data available|Keine Daten vorhanden/i.test(DomUtils.textContent(document))) {
    return { status: 'date_unavailable', message: 'No dated plan is published for this day. This does not mean the booking is cancelled.', bookings: [] };
  }
  const heading = headings.length === 1 && headings[0].match(/(\d{2})\.(\d{2})\.(\d{4})\s+um\s+\d{2}:\d{2}/);
  if (!heading) throw new Error('Published schedule date or layout was not recognized');
  const publishedDate = `${heading[3]}-${heading[2]}-${heading[1]}`;
  if (!validDate(publishedDate)) throw new Error('Published schedule date is invalid');
  if (publishedDate !== date) {
    return { status: 'date_unavailable', publishedDate, message: 'The source returned a different date. Review the published plan manually.', bookings: [] };
  }
  const grids = DomUtils.findAll(node => node.attribs?.role === 'grid', document.children);
  if (grids.length !== 1) throw new Error('Published allocation table was not recognized');
  const columns = find(grids[0], 'th').map(node => normalize(text(node)));
  const required = ['vonbis', 'mannschaft', 'gastman', 'anlage', 'flache', 'typ'];
  if (required.some(column => columns.filter(value => value === column).length !== 1)
      || columns.some(column => !required.includes(column) && column !== 'info')
      || columns.filter(column => column === 'info').length > 1) {
    throw new Error('Published allocation columns have changed');
  }
  const rows = find(grids[0], 'tr').filter(node => node.parent?.name === 'tbody');
  if (rows.length > 1000) throw new Error('Published allocation table is too large');
  const bookings = rows.map(row => {
    const cells = (row.children || []).filter(node => node.name === 'td');
    if (cells.length !== columns.length) throw new Error('Published allocation row has unexpected columns');
    const cell = column => cells[columns.indexOf(column)];
    const time = text(cell('vonbis')).match(/^([012]\d:[0-5]\d)\s*[-\u2013]\s*([012]\d:[0-5]\d)$/);
    if (!time || time[1] >= time[2] || time[2] > '24:00' || time[1] >= '24:00') {
      throw new Error('Published allocation time is unsupported');
    }
    const team = text(find(cell('mannschaft'), 'strong')[0] || cell('mannschaft'));
    const guestTeam = text(find(cell('gastman'), 'strong')[0] || cell('gastman'));
    const field = text(cell('anlage'));
    const area = text(cell('flache'));
    const kind = text(cell('typ'));
    const info = columns.includes('info') ? cell('info') : null;
    const notices = info ? [
      text(info),
      ...DomUtils.findAll(node => Boolean(node.attribs?.title || node.attribs?.['aria-label']), info.children)
        .map(node => node.attribs.title || node.attribs['aria-label']),
    ].filter(Boolean) : [];
    const information = notices.join(' ').trim()
      || (info && DomUtils.findAll(node => ['svg', 'img', 'button', 'a'].includes(node.name), info.children).length
        ? 'Additional information is present in the published source; open it for details.' : '');
    if (!team || !field || [team, guestTeam, field, area, kind].some(value => value.length > 300)) {
      throw new Error('Published allocation identity is missing or too long');
    }
    if (information.length > 1000) throw new Error('Published allocation information is too long');
    return { startTime: time[1], endTime: time[2], team, guestTeam, field, area, kind, ...(information ? { information } : {}) };
  });
  return { status: 'available', publishedDate, bookings };
}

async function fetchPublicPage(url) {
  const response = await fetch(url, {
    redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { Accept: 'text/html' },
  });
  if (!response.ok || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw new Error('Published schedule returned an unavailable or unsupported response');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 524288) throw new Error('Published schedule exceeds the response limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function createPublishedScheduleService({ timezone, logger, fetchPage = fetchPublicPage, now = () => new Date() }) {
  const cache = new Map();
  const pending = new Map();
  return {
    async check(source, date) {
      const base = { date, configuredSourceUrl: source || null, sourceUrl: source || null, bookings: [] };
      if (!source) return { ...base, status: 'not_configured', message: 'No published schedule source is configured.' };
      const today = clubDate(now(), timezone);
      const url = sourceUrl(source, date, today);
      if (!url) return { ...base, status: 'unsupported', message: 'Automatic checks currently support sportanlagen-app.net public allocation plans only. Open this source to check manually.' };
      base.sourceUrl = url;
      const offset = (Date.parse(date) - Date.parse(today)) / 86400000;
      if (offset < 0 || offset > 30) return { ...base, status: 'date_unavailable', message: 'Automatic checks cover today and the next 30 days. Open the source to check other dates manually.' };
      const key = `${date}:${url}`;
      const cached = cache.get(key);
      if (cached && now().getTime() - Date.parse(cached.checkedAt) < 60000) return { ...cached, configuredSourceUrl: source };
      if (pending.has(key)) return { ...await pending.get(key), configuredSourceUrl: source };
      if (pending.size >= 2) return { ...base, status: 'unavailable', message: 'Schedule checks are busy; retry shortly.' };
      const checking = (async () => {
        let result;
        try {
          result = { ...base, ...parsePublishedSchedule(await fetchPage(url), date) };
        } catch (error) {
          logger.warn('Published schedule fetch or parsing failed', error);
          result = { ...base, status: 'unavailable', message: 'The published schedule could not be read reliably. Retry or open the source manually.' };
        }
        result.checkedAt = now().toISOString();
        if (cache.size >= 64) cache.delete(cache.keys().next().value);
        cache.set(key, result);
        return result;
      })();
      pending.set(key, checking);
      try { return await checking; }
      finally { pending.delete(key); }
    },
  };
}

function registerPublishedScheduleRoutes(app, { getPool, logger, timezone }) {
  const service = createPublishedScheduleService({ timezone, logger });
  app.get('/api/sites/:id/published-schedule', async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647 || !validDate(req.query.date)) {
      return res.status(400).json({ error: 'Use a valid site ID and date (YYYY-MM-DD)' });
    }
    try {
      const pool = await getPool();
      const result = await pool.request().input('id', sql.Int, Number(req.params.id))
        .query('SELECT published_schedule_url FROM sites WHERE id = @id');
      if (!result.recordset.length) return res.status(404).json({ error: 'Site not found' });
      res.json(await service.check(result.recordset[0].published_schedule_url, req.query.date));
    } catch (error) {
      logger.error('Published schedule check failed', error);
      res.status(503).json({ error: 'Published schedule check is unavailable' });
    }
  });
}

module.exports = {
  siteScheduleSchema, clubDate, validDate, sourceUrl, parsePublishedSchedule,
  fetchPublicPage, createPublishedScheduleService, registerPublishedScheduleRoutes,
};
