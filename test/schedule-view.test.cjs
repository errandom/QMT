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
  loaded._compile(outputText, filename);
  return loaded.exports;
}
const utilities = loadLibrary('utils.ts');

function render(data) {
  const filename = path.join(__dirname, '..', 'src', 'components', 'ScheduleView.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = id => {
    if (id === '@/contexts/DataContext') return { useData: () => data };
    if (id === '@/lib/utils') return utilities;
    if (id === '@phosphor-icons/react') return { CalendarBlank: () => null };
    if (id.startsWith('@/components/ui/')) {
      return new Proxy({}, { get: () => ({ children }) => React.createElement('div', null, children) });
    }
    return original(id);
  };
  loaded._compile(compiled.outputText, filename);
  return renderToStaticMarkup(React.createElement(loaded.exports.default, { sportFilter: 'All Sports', teamFilter: 'all' }));
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
  assert.equal(html.match(/Current week fixture/g).length, 2);
  assert.ok(render({ ...data, events: [], isLoading: true }).includes('Loading schedule...'));
  assert.ok(render({ ...data, events: [], error: 'synthetic outage' }).includes('retry before relying on availability'));

  const multiday = render({ ...data, events: [
    { ...event('4', -1, 'Carry-in booking', '23:00', '01:00'), endDate: day(0) },
    { ...event('5', 4, 'Overnight booking', '22:00', '02:00'), endDate: day(5) },
    { ...event('6', 1, 'Three-day booking', '10:00', '12:00'), endDate: day(3) },
    { ...event('7', -1, 'Ended at week boundary', '22:00', '00:00'), endDate: day(0) },
  ] });
  assert.equal(multiday.match(/Carry-in booking/g).length, 2);
  assert.equal(multiday.match(/Overnight booking/g).length, 4);
  assert.equal(multiday.match(/Three-day booking/g).length, 6);
  assert.ok(!multiday.includes('Ended at week boundary'));
  assert.ok(multiday.includes('00:00') && multiday.includes('24:00'));
  assert.ok(multiday.includes(`${day(5)} 02:00`));
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
  const [row] = transformEventsForExport([event], { teams: [], fields: [], sites: [] });
  assert.match(row['End Date'], /22/);
  assert.equal(row['End Time'], '2:00 AM');
});
