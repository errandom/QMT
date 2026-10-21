const { z } = require('zod');
const { validateEvent } = require('../server/limits.cjs');

const MODEL = 'openai/gpt-oss-20b';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 1024;
const MAX_REQUEST_BYTES = 8192;
const MAX_RESPONSE_BYTES = 65536;
const fixtures = Object.freeze([
  { name: 'explicit practice', input: 'Practice on 2026-11-03 from 18:00 to 19:30.',
    expected: { kind: 'booking', eventType: 'Practice', startTime: '2026-11-03T18:00:00', endTime: '2026-11-03T19:30:00' } },
  { name: 'explicit game', input: 'Game on 2026-11-07 from 14:00 to 16:00.',
    expected: { kind: 'booking', eventType: 'Game', startTime: '2026-11-07T14:00:00', endTime: '2026-11-07T16:00:00' } },
  { name: 'overnight meeting', input: 'Meeting from 2026-11-06 23:00 to 2026-11-07 01:00.',
    expected: { kind: 'booking', eventType: 'Meeting', startTime: '2026-11-06T23:00:00', endTime: '2026-11-07T01:00:00' } },
  { name: 'relative date', input: 'Practice tomorrow from 18:00 to 19:00.',
    expected: { kind: 'booking', eventType: 'Practice', startTime: '2026-10-22T18:00:00', endTime: '2026-10-22T19:00:00' } },
  { name: 'missing times', input: 'Practice on 2026-11-03.', expected: { kind: 'clarification' } },
  { name: 'unsupported recurrence', input: 'Practice every Tuesday from 18:00 to 20:00.', expected: { kind: 'clarification' } },
].map(fixture => Object.freeze({ ...fixture, expected: Object.freeze(fixture.expected) })));
const draftSchema = z.object({
  kind: z.enum(['booking', 'clarification']),
  eventType: z.enum(['Practice', 'Game', 'Meeting', 'Other']).nullable(),
  title: z.string().trim().min(1).max(120).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  message: z.string().trim().min(1).max(500).nullable(),
}).strict();
const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'eventType', 'title', 'startTime', 'endTime', 'message'],
  properties: {
    kind: { type: 'string', enum: ['booking', 'clarification'] },
    eventType: { anyOf: [{ type: 'string', enum: ['Practice', 'Game', 'Meeting', 'Other'] }, { type: 'null' }] },
    title: { type: ['string', 'null'] },
    startTime: { type: ['string', 'null'] },
    endTime: { type: ['string', 'null'] },
    message: { type: ['string', 'null'] },
  },
};

function validateDraft(value) {
  const draft = draftSchema.parse(value);
  if (draft.kind === 'clarification') {
    if (!draft.message || [draft.eventType, draft.title, draft.startTime, draft.endTime].some(value => value !== null)) {
      throw new Error('Clarification must contain a message and no invented booking details');
    }
  } else {
    if (!draft.eventType || !draft.title || draft.message !== null
        || !draft.startTime || !draft.endTime
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(draft.startTime)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(draft.endTime)) {
      throw new Error('Booking draft requires explicit local date/times, type and title');
    }
    validateEvent({ start_time: draft.startTime, end_time: draft.endTime });
  }
  return draft;
}

function requestBody(fixture) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: 'Extract one booking draft, never create a booking. Reference date is 2026-10-21 in Europe/Zurich. Return local wall-clock date/times without a timezone suffix. Use only explicit or unambiguous relative dates and explicit start AND end times. Never invent dates, times, teams or venues. Recurrence is unsupported. For missing/ambiguous details or recurrence return clarification, a message, and null for every booking field. Otherwise return booking with message null.' },
      { role: 'user', content: fixture.input },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'booking_draft', strict: true, schema: jsonSchema } },
    reasoning_effort: 'low',
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0,
    stream: false,
    n: 1,
  };
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BYTES) throw new Error('Benchmark request exceeds its byte limit');
  return serialized;
}

async function readJson(response) {
  if (!response.body) throw new Error('Provider returned an empty response');
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > MAX_RESPONSE_BYTES) throw new Error('Provider response exceeds its byte limit');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Provider returned invalid JSON'); }
}

async function runBenchmark({ env = process.env, fetchImpl = fetch, live = false } = {}) {
  if (!live) {
    return { mode: 'offline', model: MODEL, networkCalls: 0, fixtures: fixtures.map(({ name }) => name) };
  }
  if (env.QMT_AI_BENCHMARK_APPROVED !== 'true' || !env.GROQ_API_KEY?.trim()) {
    throw new Error('Live synthetic benchmark requires QMT_AI_BENCHMARK_APPROVED=true and GROQ_API_KEY; production AI stays disabled');
  }
  const results = [];
  for (const fixture of fixtures) {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: requestBody(fixture),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Provider HTTP ${response.status}; benchmark stopped without retry or fallback`);
    }
    const completion = await readJson(response);
    if (completion.model !== MODEL || completion.choices?.length !== 1
        || completion.choices[0].finish_reason !== 'stop') {
      throw new Error('Provider returned an unexpected model, choice count or incomplete draft');
    }
    let value;
    try { value = JSON.parse(completion.choices[0].message?.content); }
    catch { throw new Error('Provider did not return a JSON draft'); }
    const draft = validateDraft(value);
    const passed = Object.entries(fixture.expected).every(([key, value]) => draft[key] === value);
    let usage = null;
    if (completion.usage !== undefined && completion.usage !== null) {
      const { prompt_tokens: inputTokens, completion_tokens: outputTokens } = completion.usage;
      if (!Number.isSafeInteger(inputTokens) || inputTokens < 0
          || !Number.isSafeInteger(outputTokens) || outputTokens < 0 || outputTokens > MAX_OUTPUT_TOKENS) {
        throw new Error('Provider returned invalid token usage');
      }
      usage = { inputTokens, outputTokens };
    }
    results.push({ fixture: fixture.name, passed, usage });
  }
  return { mode: 'live_synthetic_only', model: MODEL, networkCalls: results.length,
    passed: results.every(result => result.passed), results };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== '--run')) {
    console.error('Usage: npm run ai:benchmark [-- --run]. No custom input or production data is accepted.');
    process.exitCode = 1;
  } else {
    runBenchmark({ live: args.includes('--run') }).then(result => {
      console.log(JSON.stringify(result, null, 2));
      if (result.passed === false) process.exitCode = 1;
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = { runBenchmark, validateDraft, fixtures, MODEL, MAX_OUTPUT_TOKENS, MAX_REQUEST_BYTES };
