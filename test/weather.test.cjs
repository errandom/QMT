const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWeatherService } = require('../server/weather.cjs');
const { createApp } = require('../server.js');

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const daily = () => ({
  time: ['2026-11-09', '2026-11-10'], temperature_2m_min: [0, -2], temperature_2m_max: [8, 6],
  weather_code: [3, 61], precipitation_probability_max: [null, 80],
});

test('forecasts batch known coordinates, deduplicate concurrent requests and expire without returning stale data', async () => {
  let time = Date.parse('2026-11-09T12:00:00Z'), calls = 0, reads = 0, fail = false;
  const service = createWeatherService({
    timezone: 'Europe/Zurich', now: () => new Date(time),
    async getSites() {
      reads++;
      return [{ id: 1, latitude: 47.4, longitude: 8.5 }, { id: 2, latitude: null, longitude: null },
        { id: 3, latitude: 0, longitude: 0 }];
    },
    async fetchImpl(value, options) {
      calls++;
      const url = new URL(value);
      assert.equal(url.origin, 'https://api.open-meteo.com');
      assert.equal(url.searchParams.get('latitude'), '47.4,0');
      assert.equal(url.searchParams.get('longitude'), '8.5,0');
      assert.equal(url.searchParams.get('forecast_days'), '16');
      assert.equal(url.searchParams.get('timezone'), 'Europe/Zurich');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, undefined);
      assert.ok(options.signal instanceof AbortSignal);
      return fail ? json({}, 503) : json([{ daily: daily() }, { daily: daily() }]);
    },
  });
  const [first, second] = await Promise.all([service.forecast(), service.forecast()]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.sites.map(site => site.siteId), ['1', '3']);
  assert.deepEqual(first.sites[0].days[0], { date: '2026-11-09', minC: 0, maxC: 8, code: 3, rainPercent: null });
  await service.forecast();
  assert.equal(calls, 1);
  assert.equal(reads, 1);
  time += 1800001;
  fail = true;
  await assert.rejects(service.forecast(), /unavailable/);
  await assert.rejects(service.forecast(), /unavailable/);
  assert.equal(calls, 2, 'provider failures have a short cooldown, not a stale-success fallback');
  time += 60001;
  fail = false;
  assert.equal((await service.forecast()).sites.length, 2);
  assert.equal(calls, 3);
});

test('weather rejects malformed, mismatched and oversized provider responses and skips null days', async () => {
  let body = { daily: { ...daily(), temperature_2m_min: [null, -2] } };
  const options = {
    timezone: 'Europe/Zurich', getSites: async () => [{ id: 1, latitude: 47.4, longitude: 8.5 }],
    fetchImpl: async () => json(body),
  };
  assert.equal((await createWeatherService(options).forecast()).sites[0].days.length, 1);
  for (const invalid of [
    { daily: { ...daily(), weather_code: [3] } },
    { daily: { ...daily(), time: ['2026-02-31', '2026-11-10'] } },
    { daily: { ...daily(), temperature_2m_max: [-1, 6] } },
    { daily: { ...daily(), precipitation_probability_max: [101, 80] } },
    [{ daily: daily() }, { daily: daily() }],
    { padding: 'x'.repeat(262145) },
  ]) {
    body = invalid;
    await assert.rejects(createWeatherService(options).forecast());
  }
  const empty = createWeatherService({ ...options, getSites: async () => [{ id: 1, latitude: null, longitude: null }],
    fetchImpl: () => assert.fail('No external call without known coordinates') });
  assert.deepEqual((await empty.forecast()).sites, []);
});

test('enabled public weather route exposes only forecast data and never changes Spond capability or SQL data', async () => {
  let reads = 0;
  const pool = {
    connected: true, on() {}, async close() {},
    request() { return { async query(statement) {
      assert.match(statement, /^SELECT TOP \(51\) id, latitude, longitude FROM sites WHERE active = 1 ORDER BY id$/);
      reads++;
      return { recordset: [{ id: 1, latitude: 47.4, longitude: 8.5 }] };
    } }; },
  };
  const app = createApp({
    env: { JWT_SECRET: 'synthetic-weather-test-secret-not-a-credential', QMT_WEATHER_ENABLED: 'true' },
    connect: async () => pool, weatherFetch: async () => json({ daily: daily() }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const capabilities = await (await fetch(base + '/api/capabilities')).json();
    assert.equal(capabilities.weather, true);
    assert.equal(capabilities.spond, false);
    const response = await fetch(base + '/api/weather');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sites[0].siteId, '1');
    assert.equal(body.source, 'Open-Meteo');
    assert.equal(JSON.stringify(body).includes('latitude'), false);
    assert.equal((await fetch(base + '/api/weather')).status, 200);
    assert.equal(reads, 1);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await app.locals.close();
  }
});
