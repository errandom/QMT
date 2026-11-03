const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpondClient, SpondError } = require('../server/spond-client.cjs');
const json = value => new Response(JSON.stringify(value));

test('Spond transport preserves login, member queries and explicit single event publication', async () => {
  const calls = [];
  const client = createSpondClient({ fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return json(url.endsWith('/login') ? { loginToken: 'synthetic-token' } : []);
  } });
  const token = await client.login(' synthetic@example.invalid ', 'synthetic-password');
  assert.equal(token, 'synthetic-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'synthetic@example.invalid', password: 'synthetic-password' });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await client.get(token, 'groups', { extra: 'a&b' });
  assert.equal(calls[1].url.searchParams.get('includeMembers'), 'true');
  assert.equal(calls[1].url.searchParams.get('extra'), 'a&b');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer synthetic-token');
  assert.equal(calls[1].options.redirect, 'error');
  await client.get(token, 'sponds?groupId=synthetic&includeHidden=false');
  assert.equal(calls[2].url.searchParams.get('groupId'), 'synthetic');
  await client.post(token, 'sponds', { heading: 'Synthetic fixture' });
  assert.equal(calls[3].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[3].options.body), { heading: 'Synthetic fixture' });
});

test('Spond errors never disclose raw provider bodies, credentials, network errors or partial login tokens', async () => {
  for (const response of [
    () => new Response('private-provider-detail', { status: 401 }),
    () => new Response('private-provider-detail', { status: 429 }),
    () => new Response('private-provider-detail', { status: 500 }),
    () => json({ loginToken: null, private: 'private-provider-detail' }),
    () => new Response('private-provider-detail'),
  ]) {
    let calls = 0;
    const client = createSpondClient({ fetchImpl: async () => { calls++; return response(); } });
    await assert.rejects(client.login('synthetic@example.invalid', 'private-password'), error => {
      assert.ok(error instanceof SpondError);
      assert.ok(!JSON.stringify(error).includes('private-'));
      assert.ok(!error.message.includes('private-'));
      return true;
    });
    assert.equal(calls, 1);
  }
  const client = createSpondClient({ fetchImpl: async () => { throw new Error('private-network-secret'); } });
  await assert.rejects(client.get('synthetic-token', 'groups'), /Spond connection failed/);
  for (const endpoint of ['https://example.invalid/steal', '//example.invalid/steal', '../outside', 'groups#fragment']) {
    await assert.rejects(client.get('synthetic-token', endpoint), /Invalid Spond endpoint/);
  }
  await assert.rejects(client.login('', 'private-password'), /required/);
});

test('Spond calls have bounded duration, response bytes and concurrency without automatic POST retries', async () => {
  let calls = 0;
  const hanging = createSpondClient({ timeoutMs: 20, maxConcurrent: 1, fetchImpl: (_url, options) => {
    calls++;
    options.signal.addEventListener('abort', () => {}, { once: true });
    return new Promise(() => {});
  } });
  const first = hanging.post('synthetic-token', 'sponds', {});
  await assert.rejects(hanging.get('synthetic-token', 'groups'), error => error.code === 'BUSY');
  await assert.rejects(first, error => error.code === 'TIMEOUT');
  assert.equal(calls, 1);
  await assert.rejects(hanging.get('synthetic-token', 'groups'), error => error.code === 'TIMEOUT');
  assert.equal(calls, 2, 'capacity must be released after timeout');
  const large = createSpondClient({ maxBytes: 10, fetchImpl: async () => json({ large: 'x'.repeat(100) }) });
  await assert.rejects(large.get('synthetic-token', 'groups'), error => error.code === 'RESPONSE_LIMIT');
  const stalledBody = createSpondClient({ timeoutMs: 20, fetchImpl: async () =>
    new Response(new ReadableStream({ start() {} })) });
  await assert.rejects(stalledBody.get('synthetic-token', 'groups'), error => error.code === 'TIMEOUT');
});
