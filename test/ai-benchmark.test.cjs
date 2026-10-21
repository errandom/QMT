const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runBenchmark, validateDraft, fixtures, MODEL, MAX_OUTPUT_TOKENS, MAX_REQUEST_BYTES } = require('../scripts/benchmark-ai.cjs');
const env = { QMT_AI_BENCHMARK_APPROVED: 'true', GROQ_API_KEY: 'synthetic-test-only' };
const clarification = { kind: 'clarification', eventType: null, title: null, startTime: null, endTime: null, message: 'Specify missing details in the booking editor.' };
const booking = { kind: 'booking', eventType: 'Practice', title: 'Practice', startTime: '2026-11-03T18:00:00', endTime: '2026-11-03T19:30:00', message: null };

function completion(draft, overrides = {}) {
  return Response.json({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(draft) } }], ...overrides });
}

test('AI benchmark is offline by default even when credentials are present', async () => {
  const result = await runBenchmark({ env, fetchImpl: () => { throw new Error('Unexpected network'); } });
  assert.equal(result.networkCalls, 0);
  assert.equal(result.mode, 'offline');
  for (const values of [{}, { GROQ_API_KEY: env.GROQ_API_KEY }, { QMT_AI_BENCHMARK_APPROVED: 'true' }]) {
    await assert.rejects(runBenchmark({ live: true, env: values, fetchImpl: () => { throw new Error('Unexpected network'); } }), /requires/);
  }
});

test('synthetic evaluation is fixed-size, single-call, bounded and has no tool or club context', async () => {
  let calls = 0;
  const result = await runBenchmark({ live: true, env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(Buffer.byteLength(options.body) <= MAX_REQUEST_BYTES);
    const body = JSON.parse(options.body);
    assert.equal(body.model, MODEL);
    assert.equal(body.max_completion_tokens, MAX_OUTPUT_TOKENS);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.stream, false);
    assert.equal(body.n, 1);
    assert.equal(body.tools, undefined);
    assert.equal(body.messages[1].content, fixtures[calls].input);
    const expected = fixtures[calls++].expected;
    return completion(expected.kind === 'clarification' ? clarification : { ...booking, ...expected },
      calls === 1 ? { usage: { prompt_tokens: 300, completion_tokens: 80 } } : {});
  } });
  assert.equal(calls, 6);
  assert.equal(result.passed, true);
  assert.deepEqual(result.results[0].usage, { inputTokens: 300, outputTokens: 80 });
  assert.equal(result.results[1].usage, null);
});

test('quota/provider failure stops immediately without retry, fallback or error-body logging', async () => {
  let calls = 0;
  await assert.rejects(runBenchmark({ live: true, env, fetchImpl: async () => {
    calls++;
    return new Response('private-provider-detail', { status: 429 });
  } }), error => /HTTP 429/.test(error.message) && !error.message.includes('private-provider-detail'));
  assert.equal(calls, 1);
});

test('malformed, oversized, truncated or substituted-model responses fail explicitly', async () => {
  for (const response of [
    new Response('not json'),
    new Response('x'.repeat(65537)),
    completion(booking, { model: 'unexpected-paid-fallback' }),
    completion(booking, { choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    completion(booking, { usage: { prompt_tokens: 300, completion_tokens: 1025 } }),
    completion({ ...booking, startTime: '2026-02-31T18:00:00' }),
  ]) {
    let calls = 0;
    await assert.rejects(runBenchmark({ live: true, env, fetchImpl: async () => { calls++; return response; } }));
    assert.equal(calls, 1);
  }
});

test('draft validation rejects invented, invalid or write-capable output', () => {
  assert.deepEqual(validateDraft(booking), booking);
  assert.deepEqual(validateDraft(clarification), clarification);
  for (const draft of [
    { ...booking, eventType: 'unknown' }, { ...booking, teamIds: [1] },
    { ...booking, startTime: '2026-11-03T18:00:00Z' },
    { ...booking, endTime: booking.startTime },
    { ...booking, title: 'x'.repeat(121) },
    { ...booking, title: ' ' },
    { ...clarification, startTime: booking.startTime },
    { ...clarification, message: null },
  ]) assert.throws(() => validateDraft(draft));
});

test('schema-valid output can still fail semantic fixture expectations', async () => {
  const result = await runBenchmark({ live: true, env, fetchImpl: async () => completion(clarification) });
  assert.equal(result.passed, false);
  assert.equal(result.networkCalls, 6);
});

test('transport timeout fails without retry or fallback', async () => {
  let calls = 0;
  await assert.rejects(runBenchmark({ live: true, env, fetchImpl: async () => {
    calls++;
    throw new DOMException('Synthetic timeout', 'TimeoutError');
  } }), { name: 'TimeoutError' });
  assert.equal(calls, 1);
});
