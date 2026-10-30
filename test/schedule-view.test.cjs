const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadLibrary(name) {
  const filename = path.join(__dirname, '..', 'src', 'lib', name);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = id => id.startsWith('./') ? loadLibrary(`${id.slice(2)}.ts`) : original(id);
  loaded._compile(outputText, filename);
  return loaded.exports;
}
const utilities = loadLibrary('utils.ts');

function render(data, filters = {}, view = 'week') {
  const filename = path.join(__dirname, '..', 'src', 'components', 'ScheduleView.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = id => {
    if (id === 'react') return { ...React, useState: initial =>
      initial === 'program' ? [view, () => {}] : React.useState(initial) };
    if (id === '@/contexts/DataContext') return { useData: () => data };
    if (id === '@/lib/utils') return utilities;
    if (id === '@/lib/fieldSharing') return loadLibrary('fieldSharing.ts');
    if (id === '@/lib/scheduleProgram') return loadLibrary('scheduleProgram.ts');
    if (id === '@/lib/teamColors') return loadLibrary('teamColors.ts');
    if (id === './ScheduleView.css') return {};
    if (id === './SharedFieldNotice') return { default: () => null };
    if (id === '@phosphor-icons/react') return new Proxy({}, { get: () => () => null });
    if (id.startsWith('@/components/ui/')) {
      return new Proxy({}, { get: () => ({ children }) => React.createElement('div', null, children) });
    }
    return original(id);
  };
  loaded._compile(compiled.outputText, filename);
  return renderToStaticMarkup(React.createElement(loaded.exports.default, { sportFilter: 'All Sports', teamFilter: 'all', ...filters }));
}

test('weekly schedule shows actual occurrences, including morning/weekend games, without expanding recurrence twice', () => {
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const day = offset => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const event = (id, offset, title, startTime = '18:00', endTime = '19:00') => ({
    id, date: day(offset), title, startTime, endTime, eventType: 'Game', status: 'Confirmed',
    fieldIds: ['1'], teamIds: [], isRecurring: true, recurringDays: [1, 6],
  });
  const data = {
    events: [event('1', 0, 'Current week fixture'), event('2', 7, 'Next week must not appear'),
      event('3', 5, 'Saturday morning fixture', '08:00', '10:00')],
    teams: [], fields: [{ id: '1', siteId: '1', name: 'Test field' }], sites: [{ id: '1', name: 'Test site' }],
    eventWindow: { from: `${day(-7)}T00:00:00.000Z`, to: `${day(90)}T00:00:00.000Z` },
    refreshData: async () => {}, isLoading: false, error: null,
  };
  const html = render(data);
  assert.ok(html.includes('Current week fixture'));
  assert.ok(html.includes('Saturday morning fixture'));
  assert.ok(html.includes('Saturday') && html.includes('Sunday') && html.includes('08:00'));
  assert.ok(!html.includes('Next week must not appear'));
  assert.equal(html.match(/data-event-id="1"/g).length, 1);
  assert.ok(render({ ...data, events: [], isLoading: true }).includes('Loading schedule...'));
  assert.ok(render({ ...data, events: [], error: 'synthetic outage' }).includes('retry before relying on availability'));

  const multiday = render({ ...data, events: [
    { ...event('4', -1, 'Carry-in booking', '23:00', '01:00'), endDate: day(0) },
    { ...event('5', 4, 'Overnight booking', '22:00', '02:00'), endDate: day(5) },
    { ...event('6', 1, 'Three-day booking', '10:00', '12:00'), endDate: day(3) },
    { ...event('7', -1, 'Ended at week boundary', '22:00', '00:00'), endDate: day(0) },
  ] });
  assert.equal(multiday.match(/data-event-id="4"/g).length, 1);
  assert.equal(multiday.match(/data-event-id="5"/g).length, 2);
  assert.equal(multiday.match(/data-event-id="6"/g).length, 3);
  assert.ok(!multiday.includes('Ended at week boundary'));
  assert.ok(multiday.includes('00:00') && multiday.includes('24:00'));
  assert.ok(multiday.includes(`${day(5)} 02:00`));
});

test('weekly schedule includes only booked fields for the selected week and filters', () => {
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const day = offset => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const event = (id, offset, fieldIds, teamIds = ['youth'], changes = {}) => ({
    id, title: `Fixture ${id}`, date: day(offset), startTime: '18:00', endTime: '19:00',
    eventType: 'Practice', status: 'Confirmed', fieldIds, teamIds, ...changes,
  });
  const data = {
    events: [
      event('1', 0, ['main', 'second']),
      event('2', 7, ['next-week']),
      event('3', 1, ['senior'], ['seniors']),
      event('4', -1, ['carry-in'], ['youth'], { endDate: day(0), startTime: '23:00', endTime: '01:00' }),
      event('5', -1, ['ended'], ['youth'], { endDate: day(0), startTime: '23:00', endTime: '00:00' }),
      event('6', 2, [], ['youth'], { fieldId: 'legacy' }),
    ],
    teams: [
      { id: 'youth', sportType: 'Flag Football' },
      { id: 'seniors', sportType: 'Tackle Football' },
    ],
    fields: [
      ...['main', 'second', 'unused', 'next-week', 'carry-in', 'ended', 'legacy']
        .map(id => ({ id, name: `Location ${id}`, siteId: '1' })),
      { id: 'senior', name: 'Location senior', siteId: '2' },
      { id: 'empty', name: 'Location empty', siteId: '3' },
    ],
    sites: [{ id: '1', name: 'Youth site' }, { id: '2', name: 'Senior site' }, { id: '3', name: 'Empty site' }],
    eventWindow: { from: `${day(-7)}T00:00:00.000Z`, to: `${day(90)}T00:00:00.000Z` },
    refreshData: async () => {}, isLoading: false, error: null,
  };
  const html = render(data);
  for (const id of ['main', 'second', 'carry-in', 'legacy', 'senior']) assert.ok(html.includes(`Location ${id}`), id);
  for (const id of ['unused', 'next-week', 'ended', 'empty']) assert.ok(!html.includes(`Location ${id}`), id);
  assert.ok(!html.includes('Empty site'));

  for (const filters of [{ teamFilter: 'youth' }, { sportFilter: 'Flag Football' }]) {
    const filtered = render(data, filters);
    assert.ok(filtered.includes('Location main'));
    assert.ok(filtered.includes('Location second'));
    assert.ok(!filtered.includes('Location senior'));
    assert.ok(!filtered.includes('Senior site'));
  }
  const senior = render(data, { teamFilter: 'seniors' });
  assert.ok(senior.includes('Location senior'));
  assert.ok(!senior.includes('Youth site'));
  const empty = render(data, { teamFilter: 'unmatched' });
  assert.ok(empty.includes('No matching events in the selected week.'));
  assert.ok(!empty.includes('Location main'));
});

test('recurring program consolidates real dates by weekday, time, teams and fields without fabricating occurrences', () => {
  const { buildWeeklyProgram } = loadLibrary('scheduleProgram.ts');
  const weekDates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
  const window = { from: '2026-10-18T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z' };
  const event = (id, date, changes = {}) => ({
    id, date, title: 'Youth training', startTime: '18:00', endTime: '20:00',
    eventType: 'Practice', status: 'Confirmed', fieldIds: ['main', 'second'], teamIds: ['youth', 'junior'],
    isRecurring: true, recurringDays: [1, 3], ...changes,
  });
  const sharing = { fieldId: 'main', eventId: 'peer', title: 'Senior training', teamIds: ['seniors'],
    date: '2026-10-26', endDate: '2026-10-26', startTime: '19:00', endTime: '20:00' };
  const events = [
    event('1', '2026-10-19'),
    event('2', '2026-10-26', { fieldIds: ['second', 'main'], teamIds: ['junior', 'youth'], sharedFieldBookings: [sharing] }),
    event('3', '2026-10-28'),
    event('4', '2026-10-20', { isRecurring: false }),
    event('5', '2026-10-21', { status: 'Cancelled' }),
    event('6', '2026-10-22', { status: 'Completed' }),
    event('7', '2026-11-02'),
  ];
  const snapshot = JSON.stringify(events);
  const program = buildWeeklyProgram(events, weekDates, window);
  assert.equal(program.length, 2);
  assert.deepEqual(program.map(slot => slot.date), ['2026-10-26', '2026-10-28']);
  assert.deepEqual(program[0].programDates, ['2026-10-19', '2026-10-26']);
  assert.deepEqual(program[1].programDates, ['2026-10-28']);
  assert.deepEqual(program[0].sharedFieldBookings, [sharing]);
  assert.deepEqual(program[1].sharedFieldBookings, []);
  assert.equal(JSON.stringify(events), snapshot);
  assert.equal(buildWeeklyProgram([event('1', '2026-10-19')], weekDates, window).length, 1);
  const overnight = buildWeeklyProgram([event('8', '2026-10-20', {
    endDate: '2026-10-21', startTime: '23:00', endTime: '01:00',
  })], weekDates, window);
  assert.deepEqual(overnight.map(slot => [slot.date, slot.startTime, slot.endTime]), [
    ['2026-10-27', '23:00', '24:00'], ['2026-10-28', '00:00', '01:00'],
  ]);
  const legacy = buildWeeklyProgram([
    event('9', '2026-10-19', { fieldIds: [], fieldId: 'legacy-a' }),
    event('10', '2026-10-19', { fieldIds: [], fieldId: 'legacy-b' }),
  ], weekDates, window);
  assert.equal(legacy.length, 2);
  assert.deepEqual(legacy.map(slot => slot.fieldIds[0]).sort(), ['legacy-a', 'legacy-b']);
  const { withFieldSharing } = loadLibrary('fieldSharing.ts');
  const differentDates = buildWeeklyProgram(withFieldSharing([
    event('11', '2026-10-19'),
    event('12', '2026-10-26', { teamIds: ['seniors'], title: 'Senior training' }),
  ]), weekDates, window);
  assert.equal(differentDates.length, 2);
  assert.ok(differentDates.every(slot => slot.sharedFieldBookings.length === 0));
});

test('program view shows readable recurring slots, filtered booked fields, and date-specific sharing context', () => {
  const { withFieldSharing } = loadLibrary('fieldSharing.ts');
  const event = (id, date, changes = {}) => ({
    id, date, title: 'Youth training', startTime: '18:00', endTime: '20:00', eventType: 'Practice',
    status: 'Confirmed', fieldIds: ['main'], teamIds: ['youth'], isRecurring: true, ...changes,
  });
  const data = {
    events: withFieldSharing([
      event('1', '2026-10-19'), event('2', '2026-10-26'),
      event('3', '2026-10-26', { title: 'Senior training', teamIds: ['seniors'], startTime: '19:00' }),
      event('4', '2026-10-20', { title: 'One-off fixture', fieldIds: ['one-off'], isRecurring: false }),
    ]),
    teams: [{ id: 'youth', name: 'Youth', sportType: 'Flag Football' }, { id: 'seniors', name: 'Seniors', sportType: 'Tackle Football' }],
    fields: ['main', 'unused', 'one-off'].map(id => ({ id, siteId: '1', name: `Location ${id}` })),
    sites: [{ id: '1', name: 'Synthetic site' }],
    eventWindow: { from: '2026-10-18T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z' },
    refreshData: async () => {}, isLoading: false, error: null,
  };
  const html = render(data, {}, 'program');
  assert.ok(html.includes('18:00 - 20:00'));
  assert.ok(html.includes('Youth'));
  assert.ok(html.includes('Repeated dates are combined'));
  assert.ok(html.includes('Shared on some dates'));
  assert.ok(html.includes('2026-10-19 to 2026-10-26 (2 dates)'));
  assert.ok(!html.includes('Location unused'));
  assert.ok(!html.includes('Location one-off'));
  assert.ok(!html.includes('One-off fixture'));
  assert.ok(!html.includes('Week containing'));
  assert.equal(html.match(/class="schedule-booking"/g).length, 2);
  for (const filters of [{ teamFilter: 'youth' }, { sportFilter: 'Flag Football' }]) {
    const filtered = render(data, filters, 'program');
    assert.ok(filtered.includes('Shared on some dates'));
    assert.ok(!filtered.includes('Senior training'));
  }
  const noRecurring = render({ ...data, events: data.events.filter(event => !event.isRecurring) }, {}, 'program');
  assert.ok(noRecurring.includes('No matching recurring events in the loaded schedule.'));
});

test('shared time labels and export preserve end dates and carry-in bookings', () => {
  const event = {
    id: '1', title: 'Synthetic overnight', date: '2026-10-20', endDate: '2026-10-22',
    startTime: '23:00', endTime: '02:00', teamIds: [], fieldIds: [],
  };
  assert.equal(utilities.formatEventTimeRange(event), '23:00 - 2026-10-22 02:00');
  assert.equal(utilities.formatEventTimeRange({ ...event, endDate: event.date }), '23:00 - 02:00');
  const { filterEventsForExport, transformEventsForExport } = loadLibrary('exportUtils.ts');
  const filters = { startDate: '2026-10-22', endDate: '2026-10-22', teamIds: [], eventTypes: [] };
  assert.equal(filterEventsForExport([event], filters).length, 1);
  assert.equal(filterEventsForExport([{ ...event, endTime: '00:00' }], filters).length, 0);
  const [row] = transformEventsForExport([event], { events: [event], teams: [], fields: [], sites: [] });
  assert.match(row['End Date'], /22/);
  assert.equal(row['End Time'], '2:00 AM');
});

test('compact board preserves team identity across dates, filters, modes and multi-team ordering', () => {
  const monday = new Date();
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const day = offset => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const event = (id, offset, teamIds, changes = {}) => ({
    id, date: day(offset), title: `Practice ${id}`, startTime: '18:30', endTime: '20:00',
    eventType: 'Practice', status: 'Confirmed', fieldIds: ['main'], teamIds, isRecurring: true, ...changes,
  });
  const data = {
    events: [event('1', 0, ['11']), event('2', 3, ['11', '10']), event('3', 3, ['10'], { startTime: '17:00' }),
      event('4', 7, ['11']), event('5', 10, ['10', '11'])],
    teams: [{ id: '11', name: 'RoyalBlue' }, { id: '10', name: 'SteelBlue' }],
    fields: [{ id: 'main', siteId: 'site', name: 'Practice field' }], sites: [{ id: 'site', name: 'Training venue' }],
    eventWindow: { from: `${day(-7)}T00:00:00.000Z`, to: `${day(21)}T00:00:00.000Z` },
    refreshData: async () => {}, isLoading: false, error: null,
  };
  const chipStyles = html => [...html.matchAll(/data-team-id="([^"]+)" style="([^"]+)"/g)]
    .map(([, id, style]) => [id, style]);
  const reference = new Map(chipStyles(render(data)));
  assert.notEqual(reference.get('10'), reference.get('11'));
  for (const view of ['week', 'program']) {
    for (const teamFilter of ['all', '11']) {
      for (const events of [data.events, [...data.events].reverse().map(e => ({ ...e, teamIds: [...e.teamIds].reverse() }))]) {
        const html = render({ ...data, events }, { teamFilter }, view);
        for (const [id, style] of chipStyles(html)) assert.equal(style, reference.get(id), `${id}, ${view}, ${teamFilter}`);
        assert.ok(html.includes('18:30 - 20:00'));
        assert.ok(html.includes('<summary aria-label="'));
        assert.ok(html.includes('Training venue'));
        assert.ok(!html.includes('min-w-[1100px]'));
      }
    }
  }
  const html = render(data);
  assert.ok(html.indexOf('data-event-id="3"') < html.indexOf('data-event-id="2"'), 'bookings are chronological within a location');
  assert.equal((html.match(/<thead /g) || []).length, 1, 'one shared weekday header');
  const weight = dayName => Number(html.match(new RegExp(`<col data-day="${dayName}"[^>]+style="width:([\\d.]+)%`))[1]);
  assert.ok(weight('Thursday') > weight('Monday'), 'busier days receive more width');
  assert.match(html, /<col data-day="Saturday" data-active="false" style="width:4%"/);
  assert.ok(html.includes('No bookings shown: Tuesday, Wednesday, Friday, Saturday, Sunday.'));

  const weekend = render({ ...data, events: [...data.events,
    event('6', 5, [], { title: 'Weekend game', startTime: '08:00', endTime: '10:00', eventType: 'Game', isRecurring: false, status: 'Cancelled' })] });
  assert.match(weekend, /<col data-day="Saturday" data-active="true" style="width:(?!4%)[\d.]+%/);
  assert.match(weekend, /data-day="Saturday" data-has-events="true"/);
  assert.ok(weekend.includes('Weekend game') && weekend.includes('08:00 - 10:00'));
  assert.match(weekend, /data-event-id="6" data-status="Cancelled"/);
  assert.ok(!weekend.includes('No bookings shown: Tuesday, Wednesday, Friday, Saturday, Sunday.'));
});
