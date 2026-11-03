const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const root = path.join(__dirname, '..');
const transpile = filename => ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function library(name) {
  const filename = path.join(root, 'src', 'lib', `${name}.ts`);
  const loaded = new Module(filename, module);
  loaded._compile(transpile(filename), filename);
  return loaded.exports;
}
const { widgetDays, widgetBookings, widgetUrl } = library('weeklyWidget');
const event = (id, changes = {}) => ({ id, title: `Fixture ${id}`, date: '2026-11-02', endDate: '2026-11-02',
  startTime: '18:00', endTime: '19:00', eventType: 'Practice', status: 'Confirmed', teamIds: ['1'], fieldIds: ['1'],
  isRecurring: false, ...changes });
const week = { weekStart: '2026-11-02', weekEnd: '2026-11-08', timezone: 'Europe/Zurich', clubName: 'Synthetic club',
  events: [event('1'), event('2', { title: 'Other team practice', teamIds: ['2'] }),
    event('3', { title: 'Unassigned cancelled fixture', status: 'Cancelled', fieldIds: [] })],
  teams: [{ id: '1', name: 'First team' }, { id: '2', name: 'Second team' }],
  sites: [{ id: '1', name: 'Synthetic site' }], fields: [{ id: '1', name: 'Synthetic field', siteId: '1' }] };

test('widget segments actual bookings across days and excludes empty midnight segments', () => {
  assert.deepEqual(widgetDays('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.throws(() => widgetDays('2026-02-30'), /Invalid widget week/);
  const bookings = [event('carry', { date: '2026-11-01', startTime: '23:00', endTime: '01:00' }),
    event('midnight', { date: '2026-11-01', startTime: '23:00', endTime: '00:00' }),
    event('overnight', { startTime: '22:00', endDate: '2026-11-03', endTime: '02:00' }),
    event('unassigned', { fieldIds: [], status: 'Cancelled' })];
  const monday = widgetBookings(bookings, '2026-11-02', 'all');
  assert.deepEqual(monday.map(item => [item.event.id, item.start, item.end]), [
    ['carry', '00:00', '01:00'], ['unassigned', '18:00', '19:00'], ['overnight', '22:00', '24:00'],
  ]);
  assert.deepEqual(widgetBookings(bookings, '2026-11-03', '1').map(item => [item.start, item.end]), [['00:00', '02:00']]);
  assert.equal(widgetBookings(bookings, '2026-11-02', '2').length, 0);
  const shared = event('multi', { endDate: '2026-11-03', sharedFieldBookings: [
    { date: '2026-11-03', endDate: '2026-11-03', startTime: '18:00', endTime: '18:30' },
  ] });
  assert.equal(widgetBookings([shared], '2026-11-02', 'all')[0].event.sharedFieldBookings.length, 0);
  assert.equal(widgetBookings([shared], '2026-11-03', 'all')[0].event.sharedFieldBookings.length, 1);
  assert.equal(widgetUrl('https://qmt.example', '', 'all'), 'https://qmt.example/embed/week');
  const url = new URL(widgetUrl('https://qmt.example', '2026-11-02', '1&2'));
  assert.equal(url.searchParams.get('team'), '1&2');
  assert.equal(url.searchParams.get('week'), '2026-11-02');
});

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  return React.Children.toArray(node.props?.children).map(text).join(' ');
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function harness(search = '') {
  const state = [], effects = [], calls = [], copied = [];
  let cursor = 0, effectCursor = 0, clipboardDenied = true;
  const context = {
    exports: {}, URL, URLSearchParams, AbortController, Error, Date,
    window: { location: { origin: 'https://qmt.example', search } }, document: {},
    navigator: { clipboard: { async writeText(value) {
      if (clipboardDenied) throw new Error('Synthetic clipboard denial');
      copied.push(value);
    } } },
    require(id) {
      if (id === 'react') return { ...React, useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      }, useEffect(effect, deps) {
        const index = effectCursor++;
        if (!effects[index] || deps.some((value, i) => effects[index].deps[i] !== value)) {
          effects[index]?.cleanup();
          effects[index] = { deps, cleanup: effect() };
        }
      } };
      if (id === '@/lib/api') return { api: { getPublicWeek(week, signal) {
        return new Promise((resolve, reject) => calls.push({ week, signal, resolve, reject }));
      } } };
      if (id.startsWith('@/lib/')) return library(id.slice('@/lib/'.length));
      return require(id);
    },
  };
  const filename = path.join(root, 'src', 'components', 'WeeklyWidget.tsx');
  vm.runInNewContext(transpile(filename), context, { filename });
  return { calls, copied, allowClipboard() { clipboardDenied = false; }, render() {
    cursor = effectCursor = 0;
    return context.exports.default();
  } };
}

test('widget renders fieldless and cancelled fixtures, keeps sharing across filters, and exposes copy fallback', async () => {
  const h = harness('?team=1');
  assert.match(text(h.render()), /Loading/);
  h.calls[0].resolve(week);
  await flush();
  let tree = h.render();
  assert.equal(h.calls.length, 1, 'current-week response must not cause a second fetch');
  assert.match(text(tree), /Unassigned cancelled fixture/);
  assert.match(text(tree), /Cancelled/);
  assert.match(text(tree), /Location not assigned/);
  assert.match(text(tree), /shared with Second team/);
  assert.ok(!find(tree, node => node.props?.className === 'schedule-title' && node.props.children === 'Other team practice'));
  const code = find(tree, node => node.type === 'textarea');
  assert.match(code.props.value, /\/embed\/week\?team=1/);
  assert.ok(!code.props.value.includes('week='));
  find(tree, node => node.type === 'button' && node.props.children === 'Copy embed code').props.onClick();
  await flush();
  assert.match(text(h.render()), /Synthetic clipboard denial.*Select and copy/);
  h.allowClipboard();
  find(h.render(), node => node.type === 'button' && node.props.children === 'Copy embed code').props.onClick();
  await flush();
  assert.equal(h.copied.length, 1);
  assert.match(text(h.render()), /Embed code copied/);
  find(h.render(), node => node.type === 'select').props.onChange({ target: { value: 'unknown' } });
  tree = h.render();
  assert.match(text(tree), /This team is not available/);
  assert.ok(!find(tree, node => node.props?.className === 'widget-days'));
});

test('widget aborts obsolete requests, ignores late results and recovers from failed refreshes', async () => {
  const h = harness();
  let tree = h.render();
  find(tree, node => node.type === 'input' && node.props.type === 'date')
    .props.onChange({ target: { value: '2026-11-09' } });
  h.render();
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.calls[1].week, '2026-11-09');
  h.calls[0].resolve(week);
  await flush();
  assert.match(text(h.render()), /Loading/);
  h.calls[1].reject(new Error('Synthetic schedule outage'));
  await flush();
  assert.match(text(h.render()), /Synthetic schedule outage/);
  find(h.render(), node => node.type === 'button' && node.props.children === 'Retry').props.onClick();
  h.render();
  h.calls[2].resolve({ ...week, weekStart: '2026-11-09', weekEnd: '2026-11-15', events: [] });
  await flush();
  tree = h.render();
  assert.match(text(tree), /2026-11-09\s+to\s+2026-11-15/);
  assert.match(text(tree), /No bookings/);
  assert.ok(!text(tree).includes('Synthetic schedule outage'));
  find(tree, node => node.type === 'button' && node.props.children === 'Next week').props.onClick();
  h.render();
  assert.equal(h.calls[3].week, '2026-11-16');
  find(h.render(), node => node.type === 'button' && node.props.children === 'This week').props.onClick();
  h.render();
  assert.equal(h.calls[3].signal.aborted, true);
  assert.equal(h.calls[4].week, undefined);
});
