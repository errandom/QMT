const { z } = require('zod');
const { validDate } = require('./published-schedules.cjs');

const dailySchema = z.object({
  time: z.array(z.string().refine(validDate)).min(1).max(16),
  temperature_2m_min: z.array(z.number().finite().min(-150).max(100).nullable()),
  temperature_2m_max: z.array(z.number().finite().min(-150).max(100).nullable()),
  weather_code: z.array(z.number().int().min(0).max(99).nullable()),
  precipitation_probability_max: z.array(z.number().min(0).max(100).nullable()),
}).refine(value => Object.values(value).every(values => values.length === value.time.length)
  && new Set(value.time).size === value.time.length, 'Incomplete daily forecast');

async function fetchForecast(url, fetchImpl) {
  const response = await fetchImpl(url, {
    redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' },
  });
  if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw new Error('Weather provider returned an unavailable response');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 262144) {
      throw new Error('Weather response exceeds the allowed size');
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createWeatherService({ getSites, timezone, fetchImpl = fetch, now = () => new Date() }) {
  let cached, pending;
  return {
    async forecast() {
      if (cached && now().getTime() < cached.expires) {
        if (cached.error) throw cached.error;
        return cached.value;
      }
      if (pending) return pending;
      pending = (async () => {
        try {
          const sites = await getSites();
          if (sites.length > 50) throw new Error('Too many forecast locations');
          const located = sites.filter(site => typeof site.latitude === 'number' && Number.isFinite(site.latitude)
            && Math.abs(site.latitude) <= 90 && typeof site.longitude === 'number' && Number.isFinite(site.longitude)
            && Math.abs(site.longitude) <= 180);
          const results = [];
          if (located.length) {
            const url = new URL('https://api.open-meteo.com/v1/forecast');
            url.searchParams.set('latitude', located.map(site => site.latitude).join(','));
            url.searchParams.set('longitude', located.map(site => site.longitude).join(','));
            url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max');
            url.searchParams.set('timezone', timezone);
            url.searchParams.set('temperature_unit', 'celsius');
            url.searchParams.set('forecast_days', '16');
            const response = await fetchForecast(url.href, fetchImpl);
            const forecasts = Array.isArray(response) ? response : [response];
            if (forecasts.length !== located.length) throw new Error('Weather locations did not match');
            for (let index = 0; index < located.length; index++) {
              const { daily } = z.object({ daily: dailySchema }).parse(forecasts[index]);
              const days = daily.time.flatMap((date, day) => {
                const minC = daily.temperature_2m_min[day], maxC = daily.temperature_2m_max[day];
                const code = daily.weather_code[day], rainPercent = daily.precipitation_probability_max[day];
                if (minC === null || maxC === null || code === null) return [];
                if (minC > maxC) throw new Error('Weather temperature range is invalid');
                return [{ date, minC, maxC, code, rainPercent }];
              });
              results.push({ siteId: String(located[index].id), days });
            }
          }
          const value = { source: 'Open-Meteo', timezone, fetchedAt: now().toISOString(), sites: results };
          cached = { value, expires: now().getTime() + 1800000 };
          return value;
        } catch (error) {
          cached = { error, expires: now().getTime() + 60000 };
          throw error;
        } finally { pending = undefined; }
      })();
      return pending;
    },
  };
}

function registerWeatherRoutes(app, { getPool, logger, timezone, enabled, fetchImpl }) {
  const service = createWeatherService({
    timezone, fetchImpl,
    async getSites() {
      const pool = await getPool();
      return (await pool.request().query('SELECT TOP (51) id, latitude, longitude FROM sites WHERE active = 1 ORDER BY id')).recordset;
    },
  });
  app.get('/api/weather', async (_req, res) => {
    if (!enabled) return res.status(503).json({ error: 'Weather forecasts are not enabled' });
    try { res.json(await service.forecast()); }
    catch (error) {
      logger.warn('Weather forecast unavailable', error);
      res.status(503).json({ error: 'Weather forecast unavailable; retry later' });
    }
  });
}

module.exports = { createWeatherService, registerWeatherRoutes };
