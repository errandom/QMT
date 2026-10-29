const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {
  siteScheduleSchema, clubDate, validDate, sourceUrl, parsePublishedSchedule,
  fetchPublicPage, createPublishedScheduleService,
} = require('../server/published-schedules.cjs');

const source = 'https://www.sportanlagen-app.net/Public/Spielplan?k=9&m=Gr%C3%BCnStadtZ%C3%BCrich&size=1&tag=0';
const date = '2026-10-29';
const entry = { startTime: '19:00', endTime: '20:30', team: 'Synthetic Club U19', guestTeam: '', field: 'R 01', area: 'Ganzer Platz', kind: 'Trainingsplan' };
const html = (rows = [entry], extraColumn = false) => `
  <strong>Belegungsplan, Witikon 29.10.2026 um 12:57</strong>
  <div role="grid"><table><thead><tr>${[
    'Von - Bis', ...(extraColumn ? ['Info'] : []), 'Mannschaft', 'Gastman.', 'Anlage', 'Fl&#xE4;che', 'Typ',
  ].map(name => `<th>${name}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${[
    `<div>${row.startTime} - ${row.endTime}</div>`, ...(extraColumn ? [row.information || ''] : []),
    `<div><strong>${row.team}</strong></div><div class="garderobe">Kabine: 02</div>`,
    `<strong>${row.guestTeam}</strong>`, row.field, row.area, row.kind,
  ].map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

function frontendComparison() {
  const filename = path.join(__dirname, '..', 'src', 'lib', 'publishedSchedule.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const context = { exports: {} };
  vm.runInNewContext(outputText, context, { filename });
  return context.exports;
}

test('optional site source settings support omission, clearing, normalization and reject unsafe URLs', () => {
  assert.deepEqual(siteScheduleSchema.parse({}), {});
  assert.equal(siteScheduleSchema.parse({ publishedScheduleUrl: ` ${source} ` }).publishedScheduleUrl, source);
  for (const empty of ['', ' ', null]) {
    assert.deepEqual(siteScheduleSchema.parse({ publishedScheduleUrl: empty, publishedBookingName: empty }), {
      publishedScheduleUrl: null, publishedBookingName: null,
    });
  }
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', '/relative', 'https://user:pass@example.com', 42, [], 'x'.repeat(2049)]) {
    assert.equal(siteScheduleSchema.safeParse({ publishedScheduleUrl: bad }).success, false);
  }
  assert.equal(siteScheduleSchema.parse({ publishedScheduleUrl: 'http://example.com/plan' }).publishedScheduleUrl, 'http://example.com/plan');
  assert.equal(siteScheduleSchema.parse({ publishedBookingName: '  Synthetic Club  ' }).publishedBookingName, 'Synthetic Club');
  assert.equal(siteScheduleSchema.safeParse({ publishedBookingName: 'x'.repeat(201) }).success, false);
});

test('adapter requests only the approved public endpoint and derives dates in the configured club timezone', () => {
  assert.equal(clubDate(new Date('2026-10-28T23:30:00Z'), 'Europe/Zurich'), date);
  assert.equal(validDate('2026-02-31'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate([date]), false);
  const next = new URL(sourceUrl(source, '2026-10-30', date));
  assert.equal(next.searchParams.get('tag'), '1');
  assert.deepEqual([...next.searchParams.keys()], ['k', 'm', 'size', 'tag']);
  for (const unsafe of [
    source.replace('www.sportanlagen-app.net', '127.0.0.1'),
    source.replace('www.sportanlagen-app.net', 'www.sportanlagen-app.net.evil.invalid'),
    source.replace('https:', 'http:'), source.replace('.net/', '.net:8443/'),
    source.replace('/Public/Spielplan', '/private'), `${source}&redirect=https://127.0.0.1`,
    source.replace('https://', 'https://user:pass@'),
  ]) assert.equal(sourceUrl(unsafe, date, date), null);
});

test('published plan parser uses column headings, decodes entities and excludes changing-room labels', () => {
  for (const extra of [false, true]) {
    const plan = parsePublishedSchedule(html([{ ...entry, team: 'Z&#xFC;rich &amp; Club' }], extra), date);
    assert.equal(plan.status, 'available');
    assert.equal(plan.publishedDate, date);
    assert.deepEqual(plan.bookings[0], { ...entry, team: 'Z\u00fcrich & Club' });
  }
  assert.deepEqual(parsePublishedSchedule(html([]), date).bookings, []);
  const withInfo = { ...entry, information: 'Provisorisch' };
  assert.deepEqual(parsePublishedSchedule(html([withInfo], true), date).bookings[0], withInfo);
  const icon = html([entry], true).replace('<td></td>', '<td><svg aria-label="Additional information"></svg></td>');
  assert.equal(parsePublishedSchedule(icon, date).bookings[0].information, 'Additional information');
});

test('missing dates, changed layouts and invalid times cannot become a matching plan', () => {
  assert.equal(parsePublishedSchedule(html(), '2026-10-30').status, 'date_unavailable');
  assert.equal(parsePublishedSchedule('<div>No data available.</div>', date).status, 'date_unavailable');
  for (const broken of [
    '<html>Unavailable</html>', html().replace('Mannschaft', 'Unknown'),
    html().replace('29.10.2026', '31.02.2026'),
    html([{ ...entry, startTime: '25:00' }]), html([{ ...entry, endTime: '19:00' }]),
    html([{ ...entry, field: '' }]), html([{ ...entry, team: '' }]),
    html().replace('</tr></tbody>', '<td>Unexpected</td></tr></tbody>'),
    html([entry], true).replace('<th>Info</th>', '<th>Status</th>'),
  ]) assert.throws(() => parsePublishedSchedule(broken, date));
});

test('source checks deduplicate concurrent requests, preserve source identity, cache briefly and refresh', async () => {
  let now = new Date('2026-10-29T12:00:00Z');
  let calls = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const service = createPublishedScheduleService({
    timezone: 'Europe/Zurich', now: () => now, logger: { warn() { assert.fail('Unexpected warning'); } },
    fetchPage: async () => { calls++; await wait; return html(); },
  });
  const one = service.check(source, date), two = service.check(source, date);
  assert.equal(calls, 1);
  release();
  const [a, b] = await Promise.all([one, two]);
  assert.deepEqual(a, b);
  assert.equal(a.status, 'available');
  assert.equal((await service.check(source, date)).checkedAt, a.checkedAt);
  assert.equal(calls, 1);
  const otherSource = source.replace('tag=0', 'tag=1');
  assert.equal((await service.check(otherSource, date)).configuredSourceUrl, otherSource);
  assert.equal(calls, 1);
  now = new Date(now.getTime() + 60001);
  assert.notEqual((await service.check(source, date)).checkedAt, a.checkedAt);
  assert.equal(calls, 2);
});

test('unconfigured, unsupported, out-of-range and busy checks never fetch or invent confirmations', async () => {
  let calls = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const service = createPublishedScheduleService({
    timezone: 'Europe/Zurich', now: () => new Date('2026-10-29T12:00:00Z'),
    logger: { warn() { assert.fail('Unexpected warning'); } },
    fetchPage: async () => { calls++; await wait; return html(); },
  });
  assert.equal((await service.check(null, date)).status, 'not_configured');
  assert.equal((await service.check('https://example.com/', date)).status, 'unsupported');
  assert.equal((await service.check(source, '2026-10-28')).status, 'date_unavailable');
  assert.equal((await service.check(source, '2026-12-01')).status, 'date_unavailable');
  assert.equal(calls, 0);
  const pending = [service.check(source, date), service.check(source.replace('k=9', 'k=10'), date)];
  assert.equal((await service.check(source.replace('k=9', 'k=11'), date)).status, 'unavailable');
  assert.equal(calls, 2);
  release();
  await Promise.all(pending);
});

test('source failures are explicitly unavailable, logged and backed off rather than empty successful plans', async () => {
  let calls = 0, warnings = 0;
  const service = createPublishedScheduleService({
    timezone: 'Europe/Zurich', now: () => new Date('2026-10-29T12:00:00Z'),
    logger: { warn() { warnings++; } },
    fetchPage: async () => { calls++; throw new Error('Synthetic upstream failure'); },
  });
  assert.equal((await service.check(source, date)).status, 'unavailable');
  await service.check(source, date);
  assert.equal(calls, 1);
  assert.equal(warnings, 1);
});

test('public fetch has a deadline, prohibits redirects and bounds the decoded response', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(options.headers, { Accept: 'text/html' });
    return new Response(html(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
  assert.equal(await fetchPublicPage(source), html());
  mock.mock.mockImplementation(async () => new Response('Not HTML', { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(fetchPublicPage(source), /unsupported response/);
  mock.mock.mockImplementation(async () => new Response('x'.repeat(524289), { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(fetchPublicPage(source), /response limit/);
  mock.mock.mockImplementation(async () => new Response('Redirect', { status: 302 }));
  await assert.rejects(fetchPublicPage(source), /unsupported response/);
});

test('comparison confirms every assigned pitch, exact identity and time without changing the event', () => {
  const { comparePublishedBooking, publishedSites } = frontendComparison();
  const event = { id: '1', date, startTime: '19:00', endTime: '20:30', teamIds: ['1'], fieldIds: ['1'], status: 'Planned' };
  const site = { id: '1', publishedScheduleUrl: source };
  const fields = [{ id: '1', siteId: '1', name: 'R01', locationType: 'field' }];
  const teams = [{ id: '1', name: entry.team }];
  const plan = { date, publishedDate: date, status: 'available', configuredSourceUrl: source, bookings: [entry] };
  const compare = (changes = {}, newPlan = plan, newSite = site, newFields = fields) =>
    comparePublishedBooking({ ...event, ...changes }, newSite, newFields, teams, newPlan);
  assert.equal(compare().status, 'matched');
  assert.equal(event.status, 'Planned');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, startTime: '19:30' }] }).status, 'deviation');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, field: 'R02' }] }).status, 'deviation');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, area: 'A' }] }).status, 'deviation');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, area: '' }] }).status, 'deviation');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, kind: 'Provisorisch' }] }).status, 'needs_review');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, information: 'Facility notice' }] }).status, 'needs_review');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, information: 'Abgesagt' }] }).status, 'deviation');
  assert.equal(compare({}, { ...plan, bookings: [entry, entry] }).status, 'ambiguous');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, kind: 'Abgesagt' }] }).status, 'deviation');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, team: 'Other Club', guestTeam: entry.team }] }).status, 'not_found');
  assert.equal(compare({}, { ...plan, bookings: [] }).status, 'not_found');
  assert.equal(compare({}, { ...plan, publishedDate: '2026-10-30' }).status, 'needs_review');
  assert.equal(compare({}, { ...plan, configuredSourceUrl: 'https://example.com' }).status, 'needs_review');
  assert.equal(compare({}, { ...plan, status: 'unavailable' }).status, 'needs_review');
  assert.equal(compare({ endDate: '2026-10-30' }).status, 'needs_review');
  assert.equal(compare({ teamIds: [] }).status, 'needs_review');
  assert.equal(compare({ gameLocation: 'away' }).status, 'needs_review');
  assert.equal(compare({ status: 'Cancelled' }).status, 'needs_review');
  assert.equal(compare({}, plan, { ...site, publishedBookingName: 'Other Name' }).status, 'not_found');
  assert.equal(compare({ teamIds: [] }, plan, { ...site, publishedBookingName: entry.team }).status, 'matched');
  assert.equal(compare({}, { ...plan, bookings: [{ ...entry, field: 'KR06', area: 'A' }] }, site,
    [{ ...fields[0], name: 'KR 06 A', fieldSize: 'Shared' }]).status, 'matched');
  assert.equal(compare({}, plan, site, [{ ...fields[0], fieldSize: 'Shared' }]).status, 'deviation');
  const second = { id: '2', siteId: '1', name: 'R02', locationType: 'field' };
  assert.notEqual(compare({ fieldIds: ['1', '2'] }, plan, site, [...fields, second]).status, 'matched');
  assert.equal(compare({ fieldIds: ['1', '2'] }, { ...plan, bookings: [entry, { ...entry, field: 'R02' }] }, site, [...fields, second]).status, 'matched');
  assert.equal(publishedSites(event, fields, [site]).length, 1);
  assert.equal(publishedSites({ ...event, gameLocation: 'away' }, fields, [site]).length, 0);
  assert.equal(publishedSites({ ...event, status: 'Completed' }, fields, [site]).length, 0);
  assert.equal(publishedSites(event, [{ ...fields[0], locationType: 'meeting_room' }], [site]).length, 0);
});
