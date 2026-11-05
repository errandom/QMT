const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough, Writable } = require('node:stream');
const { createPrompter, verifySpond, main } = require('../scripts/verify-spond.cjs');

const groupId = 'A'.repeat(32), subgroupId = 'B'.repeat(32), eventId = 'C'.repeat(32);
function fixture(events) {
  const calls = [];
  const client = {
    async login(username, password) {
      assert.equal(username, 'synthetic@example.invalid');
      assert.equal(password, 'synthetic-password-not-a-credential');
      calls.push('login');
      return 'synthetic-token-not-a-credential';
    },
    async get(token, endpoint, params) {
      assert.equal(token, 'synthetic-token-not-a-credential');
      calls.push({ endpoint, params });
      return endpoint === 'groups' ? [{ id: groupId, name: 'Private group name',
        members: [{ email: 'private@example.invalid' }], subGroups: [{ id: subgroupId, name: 'Private subgroup name' }] }] : events;
    },
    async post() { assert.fail('Verification must never write provider events'); },
  };
  return { calls, client, options: { client, username: 'synthetic@example.invalid',
    password: 'synthetic-password-not-a-credential', from: '2026-11-04', to: '2026-11-05',
    timezone: 'Europe/Zurich', chooseGroup: async groups => {
      assert.ok(!JSON.stringify(groups).includes('private@'));
      return subgroupId;
    } } };
}

test('real-account verifier makes one bounded login/discovery/event read and outputs only a redacted summary', async () => {
  const f = fixture([{ id: eventId, heading: 'Private event heading',
    startTimestamp: '2026-11-04T17:00:00Z', endTimestamp: '2026-11-04T18:00:00Z' }]);
  const result = await verifySpond(f.options);
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[1].params.includeMembers, 'false');
  assert.equal(f.calls[2].params.groupId, groupId);
  assert.equal(f.calls[2].params.max, '501');
  assert.equal(result.eventSchemaVerified, true);
  assert.equal(result.eventsInWindow, 1);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.coverageVerified, false);
  assert.equal(result.subgroupRecipientsVerified, false);
  assert.equal(result.scope, 'entire-parent-group');
  for (const sensitive of [groupId, subgroupId, eventId, 'Private', 'synthetic-token', 'synthetic-password', 'private@']) {
    assert.ok(!JSON.stringify(result).includes(sensitive));
  }
});

test('empty samples do not claim event compatibility and bad samples, dates or group selection fail explicitly', async () => {
  const empty = fixture([]);
  assert.equal((await verifySpond(empty.options)).eventSchemaVerified, false);
  const bad = fixture({ unexpected: 'provider response' });
  await assert.rejects(verifySpond(bad.options));
  const invalid = fixture([]);
  await assert.rejects(verifySpond({ ...invalid.options, from: 'invalid' }));
  assert.equal(invalid.calls.length, 0);
  await assert.rejects(verifySpond({ ...invalid.options, chooseGroup: async () => eventId }));
  assert.equal(invalid.calls.length, 2);
});

test('CLI is inert by default and rejects argument credentials or noninteractive live input before login', async () => {
  const f = fixture([]);
  let output = '';
  const sink = { write(text) { output += text; } };
  await main([], { client: f.client, output: sink });
  assert.match(output, /No provider calls/);
  await assert.rejects(main(['--password=not-accepted'], { client: f.client, output: sink }), /never pass credentials/);
  await assert.rejects(main(['--live'], { input: { isTTY: false }, output: sink, client: f.client }), /interactive terminal/);
  assert.equal(f.calls.length, 0);
});

test('live CLI requests hidden input, closes prompts and flags an empty real-event sample as incomplete', async () => {
  const f = fixture([]);
  const answers = [f.options.from, f.options.to, f.options.username, f.options.password, '2'];
  let output = '', closed = false;
  const exitCode = process.exitCode;
  try {
    await main(['--live'], { client: f.client, output: { write(text) { output += text; } },
      prompt: () => ({
        async ask(message, options) {
          if (answers.length === 2) {
            assert.match(message, /password/);
            assert.equal(options.hidden, true);
          }
          return answers.shift();
        },
        async close() { closed = true; },
      }),
    });
    assert.equal(process.exitCode, 2);
    assert.equal(closed, true);
    assert.equal(f.calls.length, 3);
    assert.ok(!output.includes(f.options.password));
    const report = JSON.parse(output.slice(output.indexOf('{\n')));
    assert.equal(report.eventSchemaVerified, false);
    assert.match(report.warning, /remains unverified/);
  } finally { process.exitCode = exitCode; }
});

test('interactive password input is hidden, absent from prompt history and restores terminal mode', async () => {
  const input = new PassThrough();
  input.isTTY = true;
  let raw = false, output = '';
  input.setRawMode = enabled => { raw = enabled; };
  const sink = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); setImmediate(callback); } });
  sink.isTTY = true;
  sink.columns = 80;
  const prompt = createPrompter(input, sink);
  const secret = 'synthetic-hidden-input';
  try {
    const pending = prompt.ask('Password: ', { hidden: true });
    input.write(`${secret}\r`);
    assert.equal(await pending, secret);
    assert.ok(!output.includes(secret));
    const next = prompt.ask('Continue: ');
    input.write('\u001b[A\r');
    assert.equal(await next, '', 'the password must not be stored in readline history');
  } finally { await prompt.close(); input.destroy(); sink.destroy(); }
  assert.ok(!output.includes(secret), 'buffered output must not echo the password after unmuting');
  assert.equal(raw, false);
});
