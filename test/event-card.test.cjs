const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, data = {}, weather = {}) {
  const filename = path.join(__dirname, '..', 'src', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = id => {
    if (id === '@/contexts/DataContext') return { useData: () => data };
    if (id === '@/hooks/useWeatherForecast') return { useWeatherForecast: () => weather };
    if (['./CancellationRequestDialog', './EventUpdateShareDialog', './SharedFieldNotice'].includes(id)) {
      return { default: () => null, SharedFieldBadge: () => null };
    }
    if (id === '@phosphor-icons/react') return new Proxy({}, { get: () => () => null });
    if (id.startsWith('@/components/ui/')) {
      return new Proxy({}, { get: () => ({ children }) => React.createElement('div', null, children) });
    }
    if (id.startsWith('@/lib/')) return load(`lib/${id.slice(6)}.ts`, data, weather);
    if (id.startsWith('./') || id.startsWith('../')) {
      const target = path.relative(path.join(__dirname, '..', 'src'), path.join(path.dirname(filename), id));
      return load(target + (relative.endsWith('.tsx') ? '.tsx' : '.ts'), data, weather);
    }
    return original(id);
  };
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}

const attendance = load('lib/attendance.ts');
const event = changes => ({
  id: '1', title: 'Youth training', date: '2099-11-09', startTime: '18:00', endTime: '20:00',
  eventType: 'Practice', status: 'Confirmed', teamIds: ['1'], fieldIds: ['1'], isRecurring: false,
  attendanceAccepted: 12, attendanceUnanswered: 4, attendanceDeclined: 2, ...changes,
});
const teams = [{ id: '1', name: 'Youth', sportType: 'Flag Football' }, { id: '2', name: 'Seniors', sportType: 'Tackle Football' }];
const sites = [{ id: '1', name: 'Home ground', amenities: {}, latitude: 47.4, longitude: 8.5 }];
const fields = [{ id: '1', name: 'Main', siteId: '1', fieldSize: 'Full' }];

test('attendance preserves genuine zero, rejects partial/invalid data and never splits combined counts between teams', () => {
  assert.deepEqual(attendance.eventAttendance(event()), { confirmed: 12, unanswered: 4, declined: 2 });
  assert.deepEqual(attendance.eventAttendance(event({ attendanceAccepted: 0 })), { confirmed: 0, unanswered: 4, declined: 2 });
  for (const value of [undefined, null, -1, 1.5, '12', NaN]) {
    assert.equal(attendance.eventAttendance(event({ attendanceAccepted: value })), undefined);
  }
  assert.equal(attendance.teamAttendance(event({ teamIds: ['1', '2'] }), '1'), undefined);
  assert.equal(attendance.teamAttendance(event(), '2'), undefined);
  const first = event();
  assert.deepEqual(attendance.teamAttendanceTotal([
    first, first, event({ id: '2', attendanceAccepted: undefined }),
    event({ id: '3', status: 'Cancelled' }), event({ id: '4', teamIds: ['1', '2'] }),
  ], '1'), { counts: { confirmed: 12, unanswered: 4, declined: 2 }, covered: 1, total: 3 });
  assert.equal(attendance.teamAttendanceTotal([event({ attendanceAccepted: undefined })], '1').counts, undefined);
  const shared = event({ spondId: 'provider-event' });
  const otherTeam = event({ id: '2', teamIds: ['2'], spondId: 'provider-event' });
  assert.equal(attendance.teamAttendance(shared, '1', [shared, otherTeam]), undefined);
  assert.equal(attendance.teamAttendanceTotal([shared], '1', [shared, otherTeam]).covered, 0,
    'hiding another team with filters must not make shared counts attributable');
  assert.deepEqual(attendance.teamAttendanceTotal([shared, { ...shared, id: '2' }], '1'),
    { counts: { confirmed: 12, unanswered: 4, declined: 2 }, covered: 1, total: 1 });
  assert.equal(attendance.teamAttendanceTotal([shared, { ...shared, id: '2', attendanceAccepted: 13 }], '1').covered, 0);
});

test('event cards show counts next to teams, overall totals and explicit unknown multi-team breakdowns', () => {
  const Component = load('components/EventCard.tsx').default;
  const render = changes => renderToStaticMarkup(React.createElement(Component, {
    event: event(changes), teams, fields, sites, currentUser: null,
  }));
  const single = render();
  assert.match(single, /Teams total/);
  assert.equal(single.match(/<strong>12<\/strong> confirmed/g).length, 2);
  assert.ok(single.indexOf('confirmed') < single.indexOf('unanswered'));
  assert.ok(single.indexOf('unanswered') < single.indexOf('declined'));
  const combined = render({ teamIds: ['1', '2'] });
  assert.equal(combined.match(/<strong>12<\/strong> confirmed/g).length, 1);
  assert.equal(combined.match(/<strong>--<\/strong> confirmed/g).length, 2);
  assert.match(combined, /per-team breakdown is not available/);
  assert.match(render({ attendanceUnanswered: undefined }), /\(unavailable\)/);
});

test('reviewed per-team snapshots support combined cards without double-counting shared or partially overlapping sources', () => {
  const first = event({ teamIds: ['1', '2'], attendanceSourceIds: ['A', 'B'],
    attendanceByTeam: { 1: { confirmed: 5, unanswered: 2, declined: 1 }, 2: { confirmed: 7, unanswered: 2, declined: 1 } } });
  assert.deepEqual(attendance.teamAttendance(first, '1'), { confirmed: 5, unanswered: 2, declined: 1 });
  assert.equal(attendance.teamAttendance({ ...first, attendanceError: 'Refresh failed' }, '1'), undefined);
  assert.deepEqual(attendance.teamAttendanceTotal([first, { ...first, id: '2' }], '1'),
    { counts: { confirmed: 5, unanswered: 2, declined: 1 }, covered: 1, total: 1 });
  const partial = { ...first, id: '3', attendanceSourceIds: ['B', 'C'] };
  assert.equal(attendance.teamAttendance(first, '1', [first, partial]), undefined);
  assert.equal(attendance.teamAttendanceTotal([first], '1', [first, partial]).covered, 0);
  const Component = load('components/EventCard.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Component, {
    event: first, teams, fields, sites, currentUser: null,
  }));
  assert.match(html, /<strong>5<\/strong> confirmed/);
  assert.match(html, /<strong>7<\/strong> confirmed/);
  assert.ok(!html.includes('per-team breakdown is not available'));
});

test('forecast badge shows event-day conditions, units and attribution without using home weather for away games', () => {
  const Component = load('components/EventForecast.tsx').default;
  const forecast = {
    source: 'Open-Meteo', timezone: 'Europe/Zurich', fetchedAt: '2099-11-09T12:00:00Z',
    sites: [{ siteId: '1', days: [{ date: '2099-11-09', minC: -2, maxC: 8, code: 61, rainPercent: 80 }] }],
  };
  const render = changes => renderToStaticMarkup(React.createElement(Component, {
    event: event(), site: sites[0], forecast, enabled: true, ...changes,
  }));
  const html = render();
  assert.match(html, /Rain \/ drizzle/);
  assert.match(html, /-2 to 8°C/);
  assert.match(html, /Precipitation 80%/);
  assert.match(html, /Open-Meteo/);
  assert.match(render({ event: event({ date: '2099-11-30' }) }), /Outside forecast range/);
  const away = render({ event: event({ gameLocation: 'away' }) });
  assert.match(away, /Away forecast unavailable/);
  assert.ok(!away.includes('Precipitation 80%'));
  assert.match(render({ forecast: undefined, enabled: false }), /Forecast not enabled/);
  assert.match(render({ forecast: undefined, error: 'Synthetic outage' }), /Forecast unavailable/);
});

test('front-page list keeps filtered event-card attendance without the team totals section', () => {
  const data = { events: [event(), event({ id: '2', attendanceAccepted: undefined }),
    event({ id: '3', teamIds: ['2'] })], teams, fields, sites, isLoading: false, error: null };
  const Component = load('components/EventList.tsx', data).default;
  const html = renderToStaticMarkup(React.createElement(Component, {
    sportFilter: 'All Sports', teamFilter: '1', currentUser: null,
  }));
  assert.ok(!html.includes('Team attendance totals'));
  assert.ok(!html.includes('events with team counts'));
  assert.match(html, /<strong>12<\/strong> confirmed/);
  assert.ok(!html.includes('Seniors'));
});

test('office statistics show window-scoped team totals and disclose missing coverage without cancelled events', () => {
  const first = event({ spondId: 'provider-event' });
  const data = { events: [first, { ...first, id: '2' },
    event({ id: '3', attendanceAccepted: undefined }),
    event({ id: '4', attendanceAccepted: 99, status: 'Cancelled' }),
    event({ id: '5', teamIds: ['2'], attendanceAccepted: 0 })],
    teams, eventWindow: { from: '2099-11-01T00:00:00Z', to: '2099-12-01T00:00:00Z' },
    isLoading: false, error: null };
  const Component = load('components/OperationsOffice/StatisticsManager.tsx', data).default;
  const html = renderToStaticMarkup(React.createElement(Component));
  assert.match(html, /Team attendance totals/);
  assert.match(html, /2099-11-01<!-- --> to <!-- -->2099-12-01|2099-11-01 to 2099-12-01/);
  assert.match(html, /1\/2 events with team counts/);
  assert.match(html, /Incomplete total/);
  assert.equal(html.match(/<strong>12<\/strong> confirmed/g).length, 1);
  assert.match(html, /<strong>0<\/strong> confirmed/);
  assert.ok(!html.includes('<strong>99</strong>'));
  assert.match(html, /Seniors/);
  assert.match(html, /not unique players/);
  assert.match(html, /not counted as zero/);
});

test('office statistics distinguish loading, failed refresh and an empty loaded window', () => {
  const base = { events: [event()], teams,
    eventWindow: { from: '2099-11-01', to: '2099-12-01' }, isLoading: false, error: null };
  const render = changes => {
    const Component = load('components/OperationsOffice/StatisticsManager.tsx', { ...base, ...changes }).default;
    return renderToStaticMarkup(React.createElement(Component));
  };
  assert.match(render({ events: [] }), /No team attendance statistics available/);
  const loading = render({ isLoading: true });
  assert.match(loading, /role="status">Loading attendance statistics/);
  assert.ok(!loading.includes('<strong>12</strong>'));
  const failed = render({ error: 'Synthetic refresh failure' });
  assert.match(failed, /role="alert">Attendance statistics are unavailable/);
  assert.ok(!failed.includes('<strong>12</strong>'));
});
