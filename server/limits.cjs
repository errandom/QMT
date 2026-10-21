function createLimiter({ limit, windowMs = 60000, maxKeys = 2000, key = req => req.ip, now = Date.now }) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [id, bucket] of buckets) {
      if (bucket.expires <= time) buckets.delete(id);
    }
    const id = key(req);
    let bucket = buckets.get(id);
    if (!bucket) {
      if (buckets.size >= maxKeys) {
        res.set('Retry-After', '60');
        return res.status(429).json({ error: 'Request capacity reached; retry later' });
      }
      bucket = { count: 0, expires: time + windowMs };
      buckets.set(id, bucket);
    }
    if (++bucket.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.expires - time) / 1000))));
      return res.status(429).json({ error: 'Too many requests; retry later' });
    }
    next();
  };
}

function eventRange(query, now = new Date()) {
  const from = query.from === undefined
    ? new Date(now.getTime() - 7 * 86400000) : new Date(query.from);
  const to = query.to === undefined
    ? new Date(now.getTime() + 90 * 86400000) : new Date(query.to);
  const limit = query.limit === undefined ? 100 : Number(query.limit);
  const after = query.after === undefined ? 0 : Number(query.after);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())
      || to <= from || to - from > 366 * 86400000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 500
      || !Number.isSafeInteger(after) || after < 0 || after > 2147483647) {
    throw new Error('Use a valid from/to interval of at most 366 days, limit 1-500, and a nonnegative integer cursor');
  }
  return { from, to, limit, after };
}

function validateEvent(body) {
  const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z?$/;
  for (const value of [body?.start_time, body?.end_time]) {
    if (typeof value !== 'string' || !timestamp.test(value)
        || !Number.isFinite(Date.parse(value.slice(0, 10)))
        || new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)) {
      throw new Error('Use valid ISO calendar date/times without an offset, or a Z suffix');
    }
  }
  const start = new Date(body.start_time.endsWith('Z') ? body.start_time : `${body.start_time}Z`);
  const end = new Date(body.end_time.endsWith('Z') ? body.end_time : `${body.end_time}Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
      || end <= start || end - start > 7 * 86400000) {
    throw new Error('An event requires a valid start/end interval no longer than seven days');
  }
  if (body.recurring_end_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.recurring_end_date)
        || !Number.isFinite(Date.parse(body.recurring_end_date))
        || new Date(body.recurring_end_date).toISOString().slice(0, 10) !== body.recurring_end_date) {
      throw new Error('Use a valid recurrence end date');
    }
    const until = new Date(body.recurring_end_date);
    const startDay = new Date(start.toISOString().slice(0, 10));
    if (!Number.isFinite(until.getTime()) || until < startDay || until - startDay > 366 * 86400000) {
      throw new Error('Recurrence must end within 366 days of its start');
    }
    const days = Array.isArray(body.recurring_days) ? body.recurring_days
      : String(body.recurring_days || '').split(',').map(Number);
    if (!days.length || days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) {
      throw new Error('Recurrence requires weekdays between 1 and 7');
    }
  }
}

module.exports = { createLimiter, eventRange, validateEvent };
