const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { requestSchema, requestDto } = require('../server/requests.cjs');
const { workflowActionSchema, applyWorkflowAction, reviewFacility } = require('../server/facility-workflow.cjs');

const filename = path.join(__dirname, '..', 'src', 'lib', 'facilityWorkflow.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { facilityStage, needsFacilityAttention, facilityLocations, facilityMessage, facilityMessageSubject, requestRejectionMessage, facilityRoutingDefaults } = loaded.exports;
const workbookFilename = path.join(__dirname, '..', 'src', 'lib', 'facilityWorkbook.ts');
const workbookModule = new Module(workbookFilename, module);
workbookModule._compile(ts.transpileModule(fs.readFileSync(workbookFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, workbookFilename);
const { meetingRoomRows, meetingRoomTsv } = workbookModule.exports;

const submission = {
  type: 'facility', requestorName: 'Synthetic requester', requestorPhone: '5550100',
  eventType: 'Practice', teamIds: ['1'], date: '2027-04-26', startTime: '08:00', duration: 540,
  description: 'Training camp through April 30; no overnight stay',
};
const currentUser = { username: 'operator', fullName: 'Alex Example' };
const row = (payload = submission, status = 'pending') => ({
  id: 1, request_type: payload.type, payload: JSON.stringify(payload), status,
  created_at: '2026-10-30T08:00:00.000Z',
});
const routing = {
  locationType: 'field', route: 'ZVIS', department: 'Synthetic allocation office',
  contactEmail: 'allocation@example.invalid', reference: 'TEST-1', followUpDate: '2026-11-02', permitNotes: '',
};
const workbookRouting = { ...routing, locationType: 'meeting_room', route: 'IGACR', department: 'IGACR workbook', contactEmail: '' };
const workbookDetails = {
  room: 'Synthetic meeting room', occasion: 'Synthetic team meeting', club: 'Synthetic club', participants: 12,
  responsibleName: 'Synthetic host', responsiblePhone: '5550101', responsibleEmail: 'host@example.invalid',
  comments: 'Projector requested', workbookUrl: 'https://igacr.sharepoint.com/sites/vorstand/synthetic-workbook.xlsx',
};
const advance = (request, action) => ({
  ...request, workflow: applyWorkflowAction(request,
    workflowActionSchema.parse({ expectedVersion: request.workflow?.version || 0, ...action }),
    'synthetic-operator', '2026-10-30T08:30:00.000Z'),
});
const acknowledge = request => advance(request, { action: 'acknowledge', channel: 'WhatsApp', message: 'Receipt acknowledged, not a booking confirmation.' });
const evaluate = request => advance(acknowledge(request), { action: 'evaluate' });
const waiting = () => advance(advance(evaluate(requestDto(row())), { action: 'configure', ...routing }),
  { action: 'send', channel: 'Email', message: 'Please review this request.' });
const reviewed = () => advance(waiting(), { action: 'response', message: 'Available on the requested date, subject to conditions.' });

test('legacy payloads remain readable and public submissions cannot inject workflow or decisions', () => {
  const legacy = requestDto(row());
  assert.equal(legacy.workflow, undefined);
  assert.equal(facilityStage(legacy), 'Received');
  assert.equal(needsFacilityAttention(legacy), true);
  const parsed = requestSchema.parse({ ...submission, requestorEmail: 'requester@example.invalid',
    locationType: 'meeting_room', status: 'Approved', workflow: { stage: 'Approved' } });
  assert.equal(parsed.workflow, undefined);
  assert.equal(parsed.status, undefined);
  assert.equal(parsed.locationType, 'meeting_room');
  assert.equal(requestSchema.safeParse({ ...submission, requestorEmail: 'not-an-email' }).success, false);
  const equipment = { type: 'equipment', requestorName: 'Synthetic fixture', requestorPhone: '555',
    teamIds: ['1'], date: '2027-04-26', equipmentDescription: 'Cones' };
  assert.equal(requestDto(row(equipment)).status, 'Pending');
  assert.throws(() => advance(requestDto(row(equipment)), { action: 'note', message: 'Not a facility' }),
    error => error.status === 400);
});

test('external evaluation records each communication and response without deciding or notifying automatically', () => {
  const request = reviewed();
  assert.equal(request.status, 'Pending');
  assert.equal(request.workflow.stage, 'Response received');
  assert.equal(request.workflow.version, 5);
  assert.equal(request.workflow.outcomeNotifiedAt, undefined);
  assert.deepEqual(request.workflow.history.map(entry => entry.action), ['acknowledge', 'evaluate', 'configure', 'send', 'response']);
  assert.equal(request.workflow.history[0].channel, 'WhatsApp');
  assert.equal(request.workflow.history[3].channel, 'Email');
  assert.ok(request.workflow.history.every(entry => entry.by === 'synthetic-operator' && entry.at === '2026-10-30T08:30:00.000Z'));
  const persisted = requestDto(row({ ...submission, workflow: request.workflow }));
  assert.deepEqual(persisted.workflow, JSON.parse(JSON.stringify(request.workflow)));
  assert.equal(persisted.locationType, 'field');
});

test('invalid, stale and out-of-order transitions cannot skip acknowledgment, evaluation or response', () => {
  const received = requestDto(row());
  for (const action of [
    { action: 'evaluate' },
    { action: 'send', channel: 'Email', message: 'Inquiry' },
    { action: 'response', message: 'Reply' },
    { action: 'notify', channel: 'Phone', message: 'Outcome' },
  ]) assert.throws(() => advance(received, action), error => error.status === 409);
  assert.throws(() => reviewFacility(received, 'Approved', 0, '', 'test'), error => error.status === 409);
  assert.throws(() => reviewFacility(received, 'Rejected', 0, '   ', 'test'), error => error.status === 400);
  const ready = reviewed();
  assert.throws(() => applyWorkflowAction(ready, { action: 'note', message: 'Stale write', expectedVersion: 0 }, 'test'),
    error => error.status === 409);
  assert.throws(() => reviewFacility(ready, 'Approved', 0, '', 'test'), error => error.status === 409);
  assert.equal(workflowActionSchema.safeParse({ action: 'acknowledge', expectedVersion: 0, channel: 'Email', message: ' ' }).success, false);
  assert.equal(workflowActionSchema.safeParse({ action: 'send', expectedVersion: 0, channel: 'Email', message: 'x'.repeat(5000) }).success, true);
  assert.equal(workflowActionSchema.safeParse({ action: 'configure', expectedVersion: 0, ...routing, followUpDate: '2026-02-31' }).success, false);
  const unassigned = evaluate(received);
  assert.throws(() => advance(unassigned, { action: 'send', channel: 'Email', message: 'Inquiry' }), error => error.status === 400);
  const incomplete = advance(unassigned, { action: 'configure', ...routing, department: '' });
  assert.throws(() => advance(incomplete, { action: 'send', channel: 'Email', message: 'Inquiry' }), error => error.status === 400);
});

test('internal reviews need an explicit route and rationale, rather than a fictitious external response', () => {
  const evaluating = evaluate(requestDto(row()));
  assert.throws(() => advance(evaluating, { action: 'internal', message: 'No external decision needed' }), error => error.status === 400);
  const configured = advance(evaluating, { action: 'configure', ...routing, locationType: 'meeting_room', route: 'Internal' });
  assert.throws(() => advance(configured, { action: 'send', channel: 'Email', message: 'Inquiry' }), error => error.status === 400);
  const ready = advance(configured, { action: 'internal', message: 'Club-managed room; internal allocation verified.' });
  const decision = reviewFacility(ready, 'Approved', ready.workflow.version, 'Room reserved.', 'synthetic-operator');
  assert.equal(decision.stage, 'Approved');
  assert.equal(decision.locationType, 'meeting_room');
});

test('follow-up changes preserve the waiting stage, but responsibility changes restart evaluation', () => {
  const pending = waiting();
  const followup = advance(pending, { action: 'configure', ...routing, followUpDate: '2026-11-05', reference: 'NEW-REF' });
  assert.equal(followup.workflow.stage, 'Awaiting response');
  const changed = advance(followup, { action: 'configure', ...routing, route: 'City of Zurich' });
  assert.equal(changed.workflow.stage, 'In evaluation');
  const rechecking = advance(reviewed(), { action: 'configure', ...routing, locationType: 'meeting_room' });
  assert.equal(rechecking.workflow.stage, 'In evaluation');
  assert.throws(() => reviewFacility(rechecking, 'Approved', rechecking.workflow.version, '', 'test'), error => error.status === 409);
});

test('decisions and outcome notification stay separate; closed requests cannot restart evaluation', () => {
  const request = reviewed();
  const workflow = reviewFacility(request, 'Approved', request.workflow.version, 'Allocated as reviewed.', 'test');
  const decided = { ...request, status: 'Approved', workflow };
  assert.equal(needsFacilityAttention(decided), true);
  const notified = advance(decided, { action: 'notify', channel: 'Email', message: 'Your request was approved.' });
  assert.equal(needsFacilityAttention(notified), false);
  assert.ok(notified.workflow.outcomeNotifiedAt);
  assert.throws(() => advance(notified, { action: 'evaluate' }), error => error.status === 409);
  assert.throws(() => advance(notified, { action: 'notify', channel: 'Email', message: 'Duplicate' }), error => error.status === 409);
  const legacyDecision = requestDto(row(submission, 'denied'));
  assert.equal(needsFacilityAttention(legacyDecision), false);
  const legacyNotified = advance(legacyDecision, { action: 'notify', channel: 'Phone', message: 'Historical decision explained.' });
  assert.equal(needsFacilityAttention(legacyNotified), false);
  assert.equal(legacyNotified.status, 'Rejected');
});

test('facility routing filters fields and meeting rooms independently of event type and sports-site flags', () => {
  const sites = [{ id: '1', name: 'Sports site', isActive: true, isSportsFacility: true },
    { id: '2', name: 'Office', isActive: true, isSportsFacility: false }, { id: '3', name: 'Closed', isActive: false }];
  const fields = [{ id: '1', name: 'Pitch', siteId: '1', isActive: true },
    { id: '2', name: 'Room', siteId: '2', isActive: true, locationType: 'meeting_room' },
    { id: '3', name: 'Closed room', siteId: '3', isActive: true, locationType: 'meeting_room' },
    { id: '4', name: 'Inactive room', siteId: '2', isActive: false, locationType: 'meeting_room' }];
  const request = requestDto(row());
  assert.deepEqual(facilityLocations(request, fields, sites), []);
  assert.deepEqual(facilityLocations({ ...request, locationType: 'field' }, fields, sites).map(item => item.id), ['1']);
  assert.deepEqual(facilityLocations({ ...request, locationType: 'meeting_room' }, fields, sites).map(item => item.id), ['2']);
});

test('editable drafts preserve request scope and clearly distinguish receipt, booking allocation and game permits', () => {
  const request = { ...requestDto(row()), eventType: 'Game', opponent: 'Synthetic visitors' };
  const ack = facilityMessage(request, 'acknowledge', [], [], [], currentUser);
  assert.ok(ack.includes('not a booking confirmation'));
  assert.ok(ack.includes('Training camp through April 30'));
  const inquiry = facilityMessage(request, 'send', [], [], [], currentUser);
  assert.ok(inquiry.includes('separate approvals'));
  assert.ok(inquiry.includes('Opponent: Synthetic visitors'));
  const outcome = facilityMessage({ ...request, status: 'Approved' }, 'notify', [], [], [], currentUser);
  assert.ok(outcome.includes('allocation must still be confirmed'));
  assert.ok(outcome.includes('separate game permits'));
  const rejected = facilityMessage({ ...request, status: 'Rejected', workflow: { decisionNote: 'Unavailable.' } }, 'notify', [], [], [], currentUser);
  assert.ok(rejected.includes('Unavailable.'));
  assert.ok(!rejected.includes('One booking has been created'));
});

test('facility drafts sign the current user, with Kenny for QMTadmin and a username fallback', () => {
  const request = requestDto(row());
  for (const [user, name] of [
    [{ username: 'QMTadmin', fullName: 'System Administrator' }, 'Kenny'],
    [{ username: 'qmtADMIN' }, 'Kenny'],
    [{ username: 'operator', fullName: ' Alex Example ' }, 'Alex Example'],
    [{ username: 'operator', fullName: '   ' }, 'operator'],
    [{ username: 'another-operator' }, 'another-operator'],
  ]) {
    for (const [action, status] of [
      ['acknowledge', 'Pending'], ['send', 'Pending'], ['notify', 'Approved'], ['notify', 'Rejected'],
    ]) {
      const message = facilityMessage({ ...request, status }, action, [], [], [], user);
      assert.ok(message.endsWith(`\n\nQuick - Mean - Tough\n${name}`), `${action}/${status} signed by ${user.username}`);
      assert.ok(!message.includes('Club operations'));
    }
  }
});

test('German drafts preserve request scope, free text, signature and booking/permit caveats', () => {
  const request = { ...requestDto(row()), eventType: 'Game', opponent: 'Synthetic visitors',
    recurrence: { until: '2027-05-10', weekdays: [1], excludedDates: ['2027-05-03'] },
    workflow: { ...routing, facilityEnvironment: 'outdoor', decisionNote: 'Original conditions, not translated.' } };
  const user = { username: 'QMTadmin' };
  for (const action of ['acknowledge', 'send', 'notify']) {
    const english = facilityMessage(request, action, [], [], [], user);
    assert.equal(english, facilityMessage(request, action, [], [], [], user, 'en'));
    const german = facilityMessage(request, action, [], [], [], user, 'de');
    assert.match(german, /Anfrage #1: Spiel/);
    assert.match(german, /Datum: 2027-04-26; Beginn: 08:00; Dauer: 540 Minuten/);
    assert.match(german, /Wöchentliche Serie bis 2027-05-10/);
    assert.match(german, /ausgenommene Daten: 2027-05-03/);
    assert.ok(german.includes(request.description));
    assert.ok(german.includes('Gegner: Synthetic visitors'));
    assert.ok(german.endsWith('\n\nQuick - Mean - Tough\nKenny'));
  }
  assert.match(facilityMessage(request, 'acknowledge', [], [], [], user, 'de'), /keine Buchungsbestätigung/);
  const inquiry = facilityMessage(request, 'send', [], [], [], user, 'de');
  assert.match(inquiry, /^Guten Tag Synthetic allocation office,/);
  assert.match(inquiry, /Eine Anlagenzuteilung bestätigt diese Bewilligungen nicht/);
  assert.match(inquiry, /Referenz: TEST-1/);
  const outcome = facilityMessage({ ...request, status: 'Approved', workflow: {
    ...request.workflow, bookingEventId: 7,
  } }, 'notify', [], [], [], user, 'de');
  assert.match(outcome, /Eine Buchung.*Weitere Daten oder zusätzliche Buchungen benötigen eine separate Bestätigung/);
  assert.match(outcome, /Zuteilung muss noch bestätigt werden/);
  assert.match(outcome, /keine bestätigte Ortszuteilung/);
  assert.ok(outcome.includes(request.workflow.decisionNote));
  assert.match(outcome, /Spielbewilligungen müssen weiterhin geprüft werden/);
  const rejected = facilityMessage({ ...request, status: 'Rejected' }, 'notify', [], [], [], user, 'de');
  assert.match(rejected, /kann nicht genehmigt werden/);
  assert.ok(!rejected.includes('Eine Buchung'));
  assert.match(facilityMessageSubject(request, 'de'), /Anfrage zur Anlagennutzung #1 - Spiel, 2027-04-26/);
});

test('German seasonal outcomes list only approved bookings and preserve the allocated location', () => {
  const request = { ...requestDto(row()), status: 'Approved', workflow: {
    approvedDates: ['2027-04-26'], excludedDates: ['2027-05-03'], approvedFieldId: 'pitch',
  } };
  const message = facilityMessage(request, 'notify', [], [{ id: 'pitch', name: 'Synthetic pitch', siteId: 'site' }],
    [{ id: 'site', name: 'Synthetic site' }], currentUser, 'de');
  assert.match(message, /Genehmigte Daten: 2027-04-26/);
  assert.match(message, /Nicht genehmigte Daten: 2027-05-03/);
  assert.match(message, /Nur die aufgeführten genehmigten Daten sind gebucht/);
  assert.match(message, /Ort: Synthetic site - Synthetic pitch/);
  assert.ok(!message.includes('keine bestätigte Ortszuteilung'));
});

test('rejection templates support English and German for facility, equipment and cancellation requests', () => {
  const user = { username: 'QMTadmin' };
  for (const [request, type, detail] of [
    [requestDto(row()), 'facility', '2027-04-26'],
    [{ requestorName: 'Synthetic requester', equipmentDescription: 'Original equipment description', date: '2027-04-26' },
      'equipment', 'Original equipment description'],
    [{ requestorName: 'Synthetic requester', eventTitle: 'Original event title', eventDate: '2027-04-26', eventTime: '19:30' },
      'cancellation', 'Original event title'],
  ]) {
    const english = requestRejectionMessage(request, type, user);
    assert.equal(english, requestRejectionMessage(request, type, user, 'en'));
    assert.ok(english.includes(`Your ${type} request has been reviewed`));
    const german = requestRejectionMessage(request, type, user, 'de');
    assert.match(german, /^Hallo Synthetic requester,/);
    assert.match(german, /kann derzeit leider nicht genehmigt werden/);
    assert.ok(german.includes(detail));
    assert.ok(german.endsWith('\n\nQuick - Mean - Tough\nKenny'));
  }
});

test('routing presets distinguish indoor and outdoor contacts and keep meeting rooms on the workbook route', () => {
  const outdoor = facilityRoutingDefaults('field', 'outdoor');
  const indoor = facilityRoutingDefaults('field', 'indoor');
  assert.equal(outdoor.contactEmail, 'bewilligungen@zvis.ch');
  assert.equal(indoor.contactEmail, outdoor.contactEmail);
  assert.equal(outdoor.department, 'Misenga Gossweiler');
  assert.equal(indoor.department, 'André da Silva');
  assert.equal(facilityRoutingDefaults('field').contactEmail, '');
  assert.equal(facilityRoutingDefaults('meeting_room', 'indoor').route, 'IGACR');
  const request = { ...requestDto(row()), workflow: { ...outdoor, facilityEnvironment: 'outdoor' } };
  assert.match(facilityMessage(request, 'send', [], [], [], currentUser), /^Hello Misenga Gossweiler,/);
});

test('workbook preparation and confirmation persist scope without granting approval or allowing duplicate entry', () => {
  const request = requestDto(row({ ...submission, duration: 90,
    recurrence: { until: '2027-05-10', weekdays: [1], excludedDates: ['2027-05-03'] } }));
  const configured = advance(evaluate(request), { action: 'configure', ...workbookRouting });
  assert.throws(() => advance(configured, { action: 'enter-workbook', firstRow: 40, confirmed: true }), error => error.status === 400);
  assert.throws(() => advance(configured, { action: 'send', channel: 'Email', message: 'Sent elsewhere.' }), error => error.status === 400);
  const prepared = advance(configured, { action: 'prepare-workbook', details: workbookDetails });
  assert.equal(prepared.status, 'Pending');
  assert.equal(prepared.workflow.stage, 'In evaluation');
  assert.equal(prepared.workflow.workbook.entry, undefined);
  assert.deepEqual(prepared.workflow.workbook.dates, ['2027-04-26', '2027-05-10']);
  assert.equal(prepared.workflow.workbook.preparedBy, 'synthetic-operator');
  assert.throws(() => advance({ ...prepared, date: '2027-05-03' }, { action: 'enter-workbook', firstRow: 40, confirmed: true }),
    error => error.status === 409);
  const rerouted = advance(prepared, { action: 'configure', ...workbookRouting, route: 'Other' });
  assert.equal(rerouted.workflow.workbook, undefined);
  assert.equal(requestDto(row({ ...submission, workflow: prepared.workflow })).workflow.workbook.details.room, workbookDetails.room);
  assert.throws(() => reviewFacility(prepared, 'Approved', prepared.workflow.version, '', 'test'), error => error.status === 409);
  assert.throws(() => applyWorkflowAction(prepared, { action: 'enter-workbook', firstRow: 40, confirmed: true, expectedVersion: 0 }, 'test'),
    error => error.status === 409);
  assert.throws(() => advance(prepared, { action: 'enter-workbook', firstRow: 1048576, confirmed: true }), error => error.status === 400);
  const entered = advance(prepared, { action: 'enter-workbook', firstRow: 40, confirmed: true });
  assert.equal(entered.status, 'Pending');
  assert.equal(entered.workflow.stage, 'Awaiting response');
  assert.deepEqual(entered.workflow.workbook.entry, { at: '2026-10-30T08:30:00.000Z', by: 'synthetic-operator', firstRow: 40, lastRow: 41 });
  assert.match(entered.workflow.history.at(-1).message, /Not independently verified; not an approval/);
  assert.throws(() => reviewFacility(entered, 'Approved', entered.workflow.version, '', 'test'), error => error.status === 409);
  assert.throws(() => advance(entered, { action: 'enter-workbook', firstRow: 42, confirmed: true }), error => error.status === 409);
  assert.throws(() => advance(entered, { action: 'configure', ...routing }), error => error.status === 409);
  const followup = advance(entered, { action: 'configure', ...workbookRouting, followUpDate: '2026-11-05' });
  assert.deepEqual(followup.workflow.workbook.entry, entered.workflow.workbook.entry);
  const response = advance(followup, { action: 'response', message: 'Synthetic editor confirmed availability.' });
  const reevaluated = advance(response, { action: 'evaluate' });
  assert.throws(() => advance(reevaluated, { action: 'prepare-workbook', details: workbookDetails }), error => error.status === 409);
  assert.throws(() => advance(reevaluated, { action: 'enter-workbook', firstRow: 42, confirmed: true }), error => error.status === 409);
  assert.equal(reviewFacility(response, 'Approved', response.workflow.version, 'Allocation reviewed.', 'test').stage, 'Approved');
});

test('workbook data validates required fields and target; Excel rows stay in F-N with safe text and local-calendar dates', () => {
  for (const details of [
    { ...workbookDetails, participants: 0 }, { ...workbookDetails, participants: 1.5 },
    { ...workbookDetails, responsibleName: ' ' }, { ...workbookDetails, responsibleEmail: '' },
    { ...workbookDetails, workbookUrl: 'javascript:alert(1)' },
    { ...workbookDetails, workbookUrl: 'not a valid workbook link' },
    { ...workbookDetails, workbookUrl: 'https://other.sharepoint.com/file.xlsx' },
    { ...workbookDetails, workbookUrl: 'https://user:password@igacr.sharepoint.com/file.xlsx' },
  ]) assert.equal(workflowActionSchema.safeParse({ action: 'prepare-workbook', expectedVersion: 0, details }).success, false);
  assert.equal(workflowActionSchema.safeParse({ action: 'enter-workbook', expectedVersion: 0, firstRow: 40, confirmed: false }).success, false);
  assert.equal(workflowActionSchema.safeParse({ action: 'enter-workbook', expectedVersion: 0, firstRow: 2, confirmed: true }).success, false);
  const configured = advance(evaluate(requestDto(row())), { action: 'configure', ...workbookRouting });
  const overnight = { ...configured, startTime: '23:00', duration: 60 };
  assert.throws(() => advance(overnight, { action: 'prepare-workbook', details: workbookDetails }), error => error.status === 400);
  const rows = meetingRoomRows({ ...configured, duration: 90 }, {
    ...workbookDetails, room: ' =HYPERLINK("synthetic")\nRoom', occasion: '+Formula',
    club: '@Formula', comments: '\t-Formula\r\nMore details',
  }, ['2027-04-26', '2027-05-02']);
  assert.equal(rows[0].length, 9);
  assert.equal(rows[0][0], '\'=HYPERLINK("synthetic") Room');
  assert.equal(rows[0][1], 'MO');
  assert.equal(rows[1][1], 'SO');
  assert.equal(rows[0][2], '26.04.2027');
  assert.equal(rows[0][3], '08:00 - 09:30');
  assert.equal(rows[0][4], "'+Formula");
  assert.equal(rows[0][5], "'@Formula");
  assert.equal(rows[0][6], '12');
  assert.equal(rows[0][7], 'Synthetic host, 5550101, host@example.invalid');
  assert.equal(rows[0][8], "'-Formula  More details");
  assert.equal(meetingRoomTsv(rows).split('\n').length, 2);
  assert.ok(meetingRoomTsv(rows).split('\n').every(row => row.split('\t').length === 9));
  const quotedRows = meetingRoomRows(configured, { ...workbookDetails, room: '"Synthetic room"', comments: 'Say "Hello".' }, ['2027-04-26']);
  assert.ok(meetingRoomTsv(quotedRows).startsWith('"""Synthetic room"""\tMO\t'));
  assert.ok(meetingRoomTsv(quotedRows).endsWith('"Say ""Hello""."'));
  assert.throws(() => meetingRoomRows(configured, workbookDetails, ['2027-02-30']), /date is invalid/);
  assert.throws(() => meetingRoomRows(configured, workbookDetails, []), /need requested dates/);
});

test('HTTP workflow updates persist, stale writes fail, and booking decisions remain atomic and facility-specific', async t => {
  const express = require('express');
  const sql = require('mssql');
  const { randomUUID } = require('node:crypto');
  const { registerRequestRoutes } = require('../server/requests.cjs');
  const store = { rows: [], events: [], communications: [], nextId: 1 };
  class Transaction {
    async begin() { this.snapshot = structuredClone(store); }
    on() {}
    async commit() {}
    async rollback() { Object.assign(store, this.snapshot); }
  }
  class Request {
    constructor() { this.values = {}; }
    input(key, _type, value) { this.values[key] = value; return this; }
    async query(query) {
      const value = this.values;
      const rows = records => ({ recordset: structuredClone(records) });
      if (query.includes('sp_getapplock')) return rows([]);
      if (query.includes('WHERE client_key = @key')) return rows(store.rows.filter(row => row.client_key === value.key));
      if (query.startsWith('INSERT INTO requests')) {
        const inserted = { id: store.nextId++, request_type: value.type, payload: value.payload,
          client_key: value.key, status: 'pending', created_at: '2026-10-30T08:00:00.000Z' };
        store.rows.push(inserted);
        return rows([{ id: inserted.id }]);
      }
      if (query.startsWith('SELECT TOP (500)')) return rows(store.rows.filter(row => row.id > value.after));
      if (query.startsWith('SELECT * FROM requests')) return rows(store.rows.filter(row => row.id === value.id));
      if (query.startsWith('SELECT TOP (1) id FROM request_communications')) {
        return rows(store.communications.filter(row => row.request_id === value.id && ['sending', 'unknown'].includes(row.status)).slice(0, 1));
      }
      if (query.startsWith('DELETE FROM request_communications')) {
        store.communications = store.communications.filter(row => row.request_id !== value.id);
        return rows([]);
      }
      if (query.startsWith('DELETE FROM requests')) {
        if (store.failDeleteId === value.id) throw new Error('Synthetic request deletion failure');
        store.rows = store.rows.filter(row => row.id !== value.id);
        return rows([]);
      }
      if (query.startsWith('UPDATE requests')) {
        const row = store.rows.find(row => row.id === value.id);
        row.payload = value.payload;
        if (value.status) Object.assign(row, { status: value.status, reviewed_by: value.reviewer, reviewed_at: '2026-10-30T09:00:00.000Z' });
        return rows([row]);
      }
      if (query.startsWith('SELECT location_type')) return rows([{ location_type: value.id === 2 ? 'meeting_room' : 'field' }]);
      if (query.startsWith('SELECT f.id, f.location_type FROM fields') || query.startsWith('SELECT id FROM teams')) return rows([{ id: value.id }]);
      if (query.includes('FROM OPENJSON')) return rows([]);
      if (query.includes('FROM external_allocations')) return rows([]);
      if (query.startsWith('INSERT INTO events')) {
        if (value.start_time.toISOString().slice(0, 10) === store.failEventDate) throw new Error('Synthetic late-occurrence failure');
        const event = { id: store.events.length + 1, ...value };
        store.events.push(event);
        return rows([event]);
      }
      if (query.startsWith('SELECT id FROM events')) return rows(store.events.filter(event => event.id === value.id));
      if (query.includes("UPDATE events SET status = 'Cancelled'")) {
        const event = store.events.find(event => event.id === value.id);
        if (event) event.status = 'Cancelled';
        return rows(event ? [event] : []);
      }
      throw new Error(`Unexpected SQL in request regression: ${query}`);
    }
  }
  const original = { Transaction: sql.Transaction, Request: sql.Request };
  sql.Transaction = Transaction;
  sql.Request = Request;
  t.after(() => Object.assign(sql, original));
  const app = express();
  app.use(express.json(), (req, _res, next) => { req.user = { username: 'synthetic-operator' }; next(); });
  registerRequestRoutes(app, { getPool: async () => ({ request: () => new Request() }), logger: { error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (url, body, expected = 200, key) => {
    const response = await fetch(base + url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
  const key = randomUUID();
  const created = await post('/api/requests', submission, 201, key);
  const url = `/api/requests/${created.id}`;
  await post(`${url}/workflow`, { action: 'notify', expectedVersion: 0, channel: 'Phone', message: 'Too early' }, 409);
  await post(`${url}/workflow`, { action: 'acknowledge', expectedVersion: 0, channel: 'Phone', message: 'Acknowledged.' });
  await post(`${url}/workflow`, { action: 'note', expectedVersion: 0, message: 'Stale note' }, 409);
  assert.equal((await post('/api/requests', submission, 201, key)).id, created.id);
  await post(`${url}/workflow`, { action: 'evaluate', expectedVersion: 1 });
  await post(`${url}/workflow`, { action: 'configure', ...routing, route: 'Internal', locationType: 'meeting_room', expectedVersion: 2 });
  await post(`${url}/workflow`, { action: 'internal', message: 'Club-managed room; no external allocation required.', expectedVersion: 3 });
  const listed = await (await fetch(base + '/api/requests')).json();
  assert.equal(listed[0].workflow.version, 4);
  assert.equal(listed[0].locationType, 'meeting_room');
  await post(`${url}/review`, { status: 'Approved', fieldId: '1', expectedVersion: 4 }, 400);
  assert.equal(store.events.length, 0);
  assert.equal(store.rows[0].status, 'pending');
  const approved = await post(`${url}/review`, { status: 'Approved', fieldId: '2', expectedVersion: 4, decisionNote: 'Room allocated.' });
  assert.equal(approved.request.workflow.bookingEventId, '1');
  assert.equal(approved.request.workflow.approvedFieldId, '2');
  assert.equal(approved.request.workflow.outcomeNotifiedAt, undefined);
  assert.equal(approved.event.field_id, 2);
  assert.equal(store.events.length, 1);
  await post(`${url}/review`, { status: 'Approved', fieldId: '2', expectedVersion: 5 }, 409);
  const notified = await post(`${url}/workflow`, { action: 'notify', expectedVersion: 5, channel: 'Email', message: 'Outcome sent manually.' });
  assert.ok(notified.workflow.outcomeNotifiedAt);
  assert.equal(store.events.length, 1);

  const rejected = await post('/api/requests', submission, 201, randomUUID());
  await post(`/api/requests/${rejected.id}/review`, { status: 'Rejected', expectedVersion: 0 }, 400);
  const decision = await post(`/api/requests/${rejected.id}/review`, { status: 'Rejected', expectedVersion: 0, decisionNote: 'Unavailable.' });
  assert.equal(decision.request.workflow.decisionNote, 'Unavailable.');
  assert.equal(decision.request.workflow.outcomeNotifiedAt, undefined);

  const equipment = await post('/api/requests', { type: 'equipment', requestorName: 'Synthetic fixture', requestorPhone: '555',
    date: submission.date, teamIds: ['1'], equipmentDescription: 'Cones' }, 201, randomUUID());
  await post(`/api/requests/${equipment.id}/workflow`, { action: 'note', expectedVersion: 0, message: 'Wrong workflow' }, 400);
  const equipmentDecision = await post(`/api/requests/${equipment.id}/review`, { status: 'Approved' });
  assert.equal(equipmentDecision.request.status, 'Approved');
  assert.equal(equipmentDecision.request.workflow, undefined);
  const cancellation = await post('/api/requests', { type: 'cancellation', requestorName: 'Synthetic fixture', requestorPhone: '555',
    eventId: '1', eventTitle: 'Synthetic meeting', eventDate: submission.date, eventTime: '08:00', justification: 'No longer needed' }, 201, randomUUID());
  const cancellationDecision = await post(`/api/requests/${cancellation.id}/review`, { status: 'Approved' });
  assert.equal(cancellationDecision.request.status, 'Approved');
  assert.equal(cancellationDecision.request.workflow, undefined);
  assert.equal(cancellationDecision.event.status, 'Cancelled');

  const seasonal = { ...submission, duration: 90, locationType: 'field',
    recurrence: { until: '2027-05-10', weekdays: [1], excludedDates: [] } };
  const prepareSeason = async () => {
    const created = await post('/api/requests', seasonal, 201, randomUUID());
    const url = `/api/requests/${created.id}`;
    await post(`${url}/workflow`, { action: 'acknowledge', expectedVersion: 0, channel: 'Phone', message: 'Receipt.' });
    await post(`${url}/workflow`, { action: 'evaluate', expectedVersion: 1 });
    await post(`${url}/workflow`, { action: 'configure', ...routing, route: 'Internal', expectedVersion: 2 });
    await post(`${url}/workflow`, { action: 'internal', expectedVersion: 3, message: 'Club-managed allocation verified.' });
    return { id: created.id, url };
  };
  const season = await prepareSeason();
  const review = { status: 'Approved', fieldId: '1', expectedVersion: 4, approvedDates: ['2027-04-26', '2027-05-10'] };
  await post(`${season.url}/review`, review, 400);
  await post(`${season.url}/review`, { ...review, approvedDates: ['2027-05-11'] }, 400);
  await post(`${season.url}/review`, { ...review, approvedDates: ['2027-04-26', '2027-04-26'] }, 400);
  const partial = await post(`${season.url}/review`, { ...review, decisionNote: 'May 3 is unavailable.' });
  assert.equal(partial.events.length, 2);
  assert.ok(partial.events[0].series_id && partial.events[0].series_id === partial.events[1].series_id);
  assert.deepEqual(partial.request.workflow.approvedDates, review.approvedDates);
  assert.deepEqual(partial.request.workflow.excludedDates, ['2027-05-03']);
  assert.deepEqual(partial.request.workflow.bookingEventIds, partial.events.map(event => String(event.id)));
  const failedSeason = await prepareSeason();
  const before = structuredClone(store.events);
  store.failEventDate = '2027-05-10';
  await post(`${failedSeason.url}/review`, { ...review, decisionNote: 'May 3 is unavailable.' }, 503);
  assert.deepEqual(store.events, before);
  assert.equal(store.rows.find(item => String(item.id) === failedSeason.id).status, 'pending');

  await t.test('workbook records survive HTTP reloads and confirmation never writes bookings', async () => {
    const beforeEvents = structuredClone(store.events);
    const created = await post('/api/requests', { ...submission, duration: 90, locationType: 'meeting_room',
      recurrence: { until: '2027-05-03', weekdays: [1], excludedDates: [] } }, 201, randomUUID());
    const url = `/api/requests/${created.id}/workflow`;
    await post(url, { action: 'acknowledge', expectedVersion: 0, channel: 'Phone', message: 'Receipt.' });
    await post(url, { action: 'evaluate', expectedVersion: 1 });
    await post(url, { action: 'configure', ...workbookRouting, expectedVersion: 2 });
    await post(url, { action: 'prepare-workbook', details: { ...workbookDetails, participants: 0 }, expectedVersion: 3 }, 400);
    const prepared = await post(url, { action: 'prepare-workbook', details: workbookDetails, expectedVersion: 3 });
    assert.equal(prepared.workflow.stage, 'In evaluation');
    assert.equal(prepared.workflow.workbook.entry, undefined);
    await post(url, { action: 'enter-workbook', firstRow: 40, confirmed: false, expectedVersion: 4 }, 400);
    await post(url, { action: 'enter-workbook', firstRow: 40, confirmed: true, expectedVersion: 3 }, 409);
    const entered = await post(url, { action: 'enter-workbook', firstRow: 40, confirmed: true, expectedVersion: 4 });
    assert.equal(entered.status, 'Pending');
    assert.equal(entered.workflow.stage, 'Awaiting response');
    await post(url, { action: 'enter-workbook', firstRow: 42, confirmed: true, expectedVersion: 5 }, 409);
    await post(`/api/requests/${created.id}/review`, { status: 'Approved', expectedVersion: 5 }, 409);
    const reloaded = (await (await fetch(base + '/api/requests')).json()).find(item => item.id === created.id);
    assert.deepEqual(reloaded.workflow.workbook, entered.workflow.workbook);
    assert.deepEqual(store.events, beforeEvents);
  });

  await t.test('request deletion validates revisions, removes only linked records and preserves bookings', async () => {
    const remove = async (id, body, expected = 200) => {
      const response = await fetch(`${base}/api/requests/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.equal(response.status, expected, JSON.stringify(result));
      return result;
    };
    await remove('1,2', { expectedStatus: 'Pending', expectedVersion: 0 }, 400);
    await remove('2147483648', { expectedStatus: 'Pending', expectedVersion: 0 }, 400);
    await remove(created.id, {}, 400);
    await remove('999999', { expectedStatus: 'Pending', expectedVersion: 0 }, 404);
    await remove(created.id, { expectedStatus: 'Pending', expectedVersion: 6 }, 409);
    await remove(created.id, { expectedStatus: 'Approved', expectedVersion: 5 }, 409);
    await remove(created.id, { expectedStatus: 'Approved' }, 409);
    const target = await post('/api/requests', submission, 201, randomUUID());
    const message = { id: 'synthetic-message', request_id: Number(target.id), status: 'sending' };
    const other = { id: 'unrelated-message', request_id: Number(rejected.id), status: 'received' };
    store.communications.push(message, other);
    await remove(target.id, { expectedStatus: 'Pending', expectedVersion: 0 }, 409);
    store.communications.find(item => item.id === message.id).status = 'unknown';
    await remove(target.id, { expectedStatus: 'Pending', expectedVersion: 0 }, 409);
    store.communications.find(item => item.id === message.id).status = 'accepted';
    store.failDeleteId = Number(target.id);
    await remove(target.id, { expectedStatus: 'Pending', expectedVersion: 0 }, 503);
    assert.ok(store.rows.some(item => String(item.id) === target.id));
    assert.ok(store.communications.some(item => item.request_id === Number(target.id)));
    delete store.failDeleteId;
    assert.deepEqual(await remove(target.id, { expectedStatus: 'Pending', expectedVersion: 0 }), { id: target.id });
    assert.ok(!store.rows.some(item => String(item.id) === target.id));
    assert.deepEqual(store.communications, [other]);
    await remove(target.id, { expectedStatus: 'Pending', expectedVersion: 0 }, 404);
    const events = structuredClone(store.events);
    for (const [id, body] of [
      [created.id, { expectedStatus: 'Approved', expectedVersion: 6 }],
      [rejected.id, { expectedStatus: 'Rejected', expectedVersion: 1 }],
      [equipment.id, { expectedStatus: 'Approved' }],
      [cancellation.id, { expectedStatus: 'Approved' }],
    ]) await remove(id, body);
    assert.deepEqual(store.events, events);
    const remaining = await (await fetch(base + '/api/requests')).json();
    assert.ok(remaining.every(item => ![created.id, rejected.id, equipment.id, cancellation.id, target.id].includes(item.id)));
    assert.ok(remaining.some(item => item.id === season.id));
  });
});
