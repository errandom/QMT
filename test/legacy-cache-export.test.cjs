const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-legacy-cache.js'), 'utf8');
const keys = [
  'app_events', 'app_teams', 'app_sites', 'app_fields', 'app_equipment',
  'app_facility_requests', 'app_equipment_requests', 'app_cancellation_requests',
];

function browser({ values = {}, origin = 'https://qmt.azurewebsites.net', consent = true, storageError, clickError, createError, body = true } = {}) {
  const state = { reads: [], blobs: [], downloads: [], messages: [], prompts: [], removed: 0, timers: [], revoked: [] };
  const rejectWrite = () => { throw new Error('Browser storage writes are forbidden'); };
  const context = {
    window: {
      location: { origin },
      localStorage: {
        getItem(key) {
          state.reads.push(key);
          assert.ok(keys.includes(key), 'Only operational keys may be read');
          if (storageError) throw storageError;
          return Object.hasOwn(values, key) ? values[key] : null;
        },
        setItem: rejectWrite, removeItem: rejectWrite, clear: rejectWrite,
      },
      confirm(message) { state.prompts.push(message); return consent; },
    },
    document: {
      body: body ? { append() {} } : null,
      createElement(tag) {
        assert.equal(tag, 'a');
        if (createError) throw createError;
        return {
          click() {
            if (clickError) throw clickError;
            state.downloads.push({ href: this.href, filename: this.download });
          },
          remove() { state.removed += 1; },
        };
      },
    },
    console: { info(message) { state.messages.push(message); } },
    Blob,
    URL: {
      createObjectURL(blob) { state.blobs.push(blob); return 'blob:synthetic-qmt-snapshot'; },
      revokeObjectURL(url) { state.revoked.push(url); },
    },
    setTimeout(callback, delay) { state.timers.push({ callback, delay }); },
    fetch() { throw new Error('Network calls are forbidden'); },
    XMLHttpRequest() { throw new Error('Network calls are forbidden'); },
  };
  state.run = () => vm.runInNewContext(source, context, { timeout: 1_000 });
  return state;
}

test('legacy cache export preserves raw operational records and excludes authentication', async () => {
  const raw = ' [ {"id":"synthetic-event","date":"2026-10-20"} ] ';
  const state = browser({ values: {
    app_events: raw, app_facility_requests: '[{"id":"synthetic-request"}]',
    auth_token: 'synthetic-excluded-token', auth_user: '{"name":"synthetic-excluded-user"}',
  } });
  state.run();
  assert.deepEqual(state.reads, keys);
  assert.equal(state.downloads.length, 1);
  assert.match(state.downloads[0].filename, /^qmt-legacy-cache-.*\.json$/);
  assert.equal(state.blobs[0].type, 'application/json');
  const text = await state.blobs[0].text();
  const snapshot = JSON.parse(text);
  assert.equal(snapshot.entries.app_events.raw, raw);
  assert.equal(snapshot.entries.app_events.recordCount, 1);
  assert.equal(snapshot.entries.app_teams.raw, null);
  assert.equal(snapshot.entries.app_teams.state, 'missing');
  assert.equal(snapshot.presentKeyCount, 2);
  assert.equal(snapshot.arrayRecordCount, 2);
  assert.equal(snapshot.verifiedRecovery, false);
  assert.equal(snapshot.origin, 'https://qmt.azurewebsites.net');
  assert.ok(Number.isFinite(Date.parse(snapshot.capturedAt)));
  assert.deepEqual(Object.keys(snapshot.entries), keys);
  assert.doesNotMatch(text, /synthetic-excluded/);
  assert.doesNotMatch(state.messages.join('\n'), /synthetic-event|synthetic-request/);
  assert.equal(state.removed, 1);
  assert.equal(state.timers[0].delay, 30_000);
  state.timers[0].callback();
  assert.deepEqual(state.revoked, ['blob:synthetic-qmt-snapshot']);
});

test('missing, malformed, non-array and empty values are distinguished without losing raw evidence', async () => {
  const state = browser({ values: {
    app_events: '{synthetic-malformed',
    app_teams: '{"synthetic":"not an array"}',
    app_sites: '[]',
    app_fields: '',
    app_equipment: 'null',
  } });
  state.run();
  const snapshot = JSON.parse(await state.blobs[0].text());
  assert.equal(snapshot.entries.app_events.raw, '{synthetic-malformed');
  assert.equal(snapshot.entries.app_events.state, 'invalid_json');
  assert.equal(snapshot.entries.app_teams.state, 'non_array_json');
  assert.equal(snapshot.entries.app_sites.state, 'array');
  assert.equal(snapshot.entries.app_sites.recordCount, 0);
  assert.equal(snapshot.entries.app_fields.raw, '');
  assert.equal(snapshot.entries.app_fields.state, 'invalid_json');
  assert.equal(snapshot.entries.app_equipment.raw, 'null');
  assert.equal(snapshot.entries.app_equipment.state, 'non_array_json');
  assert.equal(snapshot.entries.app_cancellation_requests.state, 'missing');
  assert.equal(snapshot.arrayRecordCount, 0);
  assert.equal(snapshot.verifiedRecovery, false);
  assert.match(state.prompts[0], /NOT a verified backup/);
  assert.doesNotMatch(state.messages.join('\n'), /synthetic-malformed|not an array/);
});

test('wrong origins and missing legacy documents fail before accessing storage', () => {
  for (const options of [
    { origin: 'https://qmt.errandom.com' },
    { origin: 'https://qmt.azurewebsites.net.example.invalid' },
    { origin: 'http://qmt.azurewebsites.net' },
    { body: false },
  ]) {
    const state = browser(options);
    assert.throws(state.run, /original QMT/);
    assert.equal(state.reads.length, 0);
    assert.equal(state.blobs.length, 0);
  }
});

test('no cached keys is an explicit error, never an empty successful recovery', () => {
  const state = browser();
  assert.throws(state.run, /No legacy QMT cache keys/);
  assert.deepEqual(state.reads, keys);
  assert.equal(state.prompts.length, 0);
  assert.equal(state.blobs.length, 0);
});

test('storage access failures propagate without exporting a partial snapshot', () => {
  const state = browser({ storageError: new Error('Synthetic storage denied') });
  assert.throws(state.run, /Synthetic storage denied/);
  assert.equal(state.blobs.length, 0);
  assert.equal(state.downloads.length, 0);
});

test('declining the local download creates no blob or file', () => {
  const state = browser({ values: { app_events: '[]' }, consent: false });
  state.run();
  assert.equal(state.prompts.length, 1);
  assert.equal(state.blobs.length, 0);
  assert.equal(state.downloads.length, 0);
  assert.match(state.messages[0], /cancelled/);
});

test('download failures are explicit and still clean up the temporary link and URL', () => {
  const state = browser({ values: { app_events: '[]' }, clickError: new Error('Synthetic download denied') });
  assert.throws(state.run, /Synthetic download denied/);
  assert.equal(state.downloads.length, 0);
  assert.equal(state.messages.length, 0);
  assert.equal(state.removed, 1);
  state.timers[0].callback();
  assert.deepEqual(state.revoked, ['blob:synthetic-qmt-snapshot']);
});

test('DOM preparation failures do not allocate an unreleased object URL', () => {
  const state = browser({ values: { app_events: '[]' }, createError: new Error('Synthetic DOM unavailable') });
  assert.throws(state.run, /Synthetic DOM unavailable/);
  assert.equal(state.blobs.length, 0);
  assert.equal(state.downloads.length, 0);
});

test('private recovery filenames are excluded from version control and Docker build context', () => {
  const root = path.join(__dirname, '..');
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^qmt-legacy-cache-\*\.json$/m);
  assert.match(fs.readFileSync(path.join(root, '.dockerignore'), 'utf8'), /^\*\*\/qmt-legacy-cache-\*\.json$/m);
});
