const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const filename = path.join(__dirname, '..', 'src', 'lib', `${name}.ts`);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, id => id.startsWith('./') ? load(id.slice(2)) : require(id));
  modules.set(name, exports);
  return exports;
}
const { withFieldSharing, formatSharedFieldBookings } = load('fieldSharing');
const { transformEventsForExport, filterEventsForExport } = load('exportUtils');
const booking = (id, changes = {}) => ({
  id, title: `Practice ${id}`, eventType: 'Practice', status: 'Confirmed',
  date: '2026-11-03', startTime: '18:00', endTime: '19:30', fieldIds: ['1'], teamIds: [id],
  isRecurring: false, ...changes,
});
const fields = [{ id: '1', name: 'Main field', siteId: '1', fieldSize: 'Full' }, { id: '2', name: 'Second field', siteId: '1', fieldSize: 'Full' }];
const sites = [{ id: '1', name: 'Synthetic site' }];
const teams = [{ id: 'a', name: 'Youth' }, { id: 'b', name: 'Seniors' }];

test('both bookings show only the actual shared fields and overlapping interval, before team filters', () => {
  const original = [
    booking('a', { fieldIds: ['1', '2'] }),
    booking('b', { startTime: '19:00', endTime: '20:00' }),
  ];
  const snapshot = JSON.stringify(original);
  const result = withFieldSharing(original);
  assert.deepEqual(result[0].sharedFieldBookings, [{
    fieldId: '1', eventId: 'b', title: 'Practice b', teamIds: ['b'],
    date: '2026-11-03', endDate: '2026-11-03', startTime: '19:00', endTime: '19:30',
  }]);
  assert.equal(result[1].sharedFieldBookings[0].eventId, 'a');
  assert.equal(result.filter(event => event.teamIds.includes('a'))[0].sharedFieldBookings.length, 1);
  assert.equal(result[0].status, 'Confirmed');
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(fields[0].fieldSize, 'Full');
  assert.match(formatSharedFieldBookings(result[0].sharedFieldBookings, fields, sites, teams),
    /Synthetic site \/ Main field: 2026-11-03 19:00 - 19:30, shared with Seniors/);
});

test('adjacent times, different fields, different dates and inactive bookings are not shared', () => {
  for (const changes of [
    { startTime: '19:30', endTime: '20:30' }, { fieldIds: ['2'] },
    { date: '2026-11-04' }, { status: 'Cancelled' }, { status: 'Completed' },
    { fieldIds: [] },
  ]) {
    const result = withFieldSharing([booking('a'), booking('b', changes)]);
    assert.ok(result.every(event => event.sharedFieldBookings.length === 0), JSON.stringify(changes));
  }
});

test('sharing clears after cancellation, deletion, moving a booking or removing the field', () => {
  const shared = withFieldSharing([booking('a'), booking('b')]);
  for (const events of [
    [shared[0]], [shared[0], { ...shared[1], status: 'Cancelled' }],
    [shared[0], { ...shared[1], startTime: '20:00', endTime: '21:00' }],
    [shared[0], { ...shared[1], fieldIds: [] }],
  ]) assert.ok(withFieldSharing(events).every(event => event.sharedFieldBookings.length === 0));
});

test('multi-day overlaps use the real intersection and remain independent of local timezone', () => {
  const timezone = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Europe/Zurich', 'America/Los_Angeles']) {
      process.env.TZ = zone;
      const result = withFieldSharing([
        booking('a', { date: '2026-10-24', endDate: '2026-10-26', startTime: '23:00', endTime: '01:00' }),
        booking('b', { date: '2026-10-25', endDate: '2026-10-26', startTime: '22:30', endTime: '02:00' }),
      ]);
      assert.equal(result[0].sharedFieldBookings[0].date, '2026-10-25');
      assert.equal(result[0].sharedFieldBookings[0].endDate, '2026-10-26');
      assert.equal(result[0].sharedFieldBookings[0].startTime, '22:30');
      assert.equal(result[0].sharedFieldBookings[0].endTime, '01:00');
    }
  } finally { if (timezone === undefined) delete process.env.TZ; else process.env.TZ = timezone; }
});

test('materialized recurring occurrences are shared only on dates with actual overlap', () => {
  const result = withFieldSharing([
    booking('a'), booking('b'), booking('c', { date: '2026-11-10' }),
    booking('d', { date: '2026-11-17' }),
  ]);
  assert.deepEqual(result.map(event => event.sharedFieldBookings.length), [1, 1, 0, 0]);
});

test('three bookings and duplicate selected field IDs do not duplicate sharing entries', () => {
  const result = withFieldSharing([booking('a', { fieldIds: ['1', '1'] }), booking('b'), booking('c')]);
  assert.deepEqual(result.map(event => event.sharedFieldBookings.length), [2, 2, 2]);
});

test('CSV exports calculate sharing before filters, retaining other teams and actual overlap times', () => {
  const events = [booking('a'), booking('b', { startTime: '19:00', endTime: '20:00' })];
  const filtered = filterEventsForExport(events, { teamIds: ['a'], eventTypes: [], startDate: '', endDate: '' });
  const rows = transformEventsForExport(filtered, { events, fields, sites, teams });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Status, 'Confirmed');
  assert.match(rows[0]['Field Allocation'], /Shared.*not exclusively/);
  assert.match(rows[0]['Shared Field Details'], /19:00 - 19:30, shared with Seniors/);
});

test('manual share messages state shared use without implying a particular fraction of the field', async t => {
  const { shareEvent } = load('whatsappService');
  const event = withFieldSharing([booking('a'), booking('b')])[0];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const messages = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    share: async message => messages.push(message),
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  });
  assert.equal(await shareEvent(event, teams, fields, sites), true);
  assert.match(messages[0].text, /Shared field - full field not exclusively available/);
  assert.match(messages[0].text, /shared with Seniors/);
  assert.doesNotMatch(messages[0].text, /half|50%/);
});
