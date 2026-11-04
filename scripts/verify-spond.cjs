const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');
const { finished } = require('node:stream/promises');
const { createSpondClient, SpondError } = require('../server/spond-client.cjs');
const { ReviewError, flattenGroups, reviewRange, providerEventQuery, reconcileEvents } = require('../server/spond-review-domain.cjs');

function createPrompter(input, output) {
  if (!input.isTTY || !output.isTTY) {
    throw new ReviewError('Live verification requires an interactive terminal; do not pipe credentials or pass them as arguments');
  }
  let muted = false;
  const sink = new Writable({ write(chunk, encoding, callback) {
    if (muted) callback();
    else output.write(chunk, encoding, callback);
  } });
  Object.defineProperty(sink, 'columns', { get: () => output.columns });
  const rl = createInterface({ input, output: sink, terminal: true, historySize: 0 });
  const cancel = new AbortController();
  rl.on('SIGINT', () => cancel.abort());
  rl.on('close', () => cancel.abort());
  return {
    async ask(message, { hidden = false } = {}) {
      if (hidden) { output.write(message); muted = true; }
      try { return await rl.question(hidden ? '' : message, { signal: cancel.signal }); }
      finally {
        // Drain masked readline output before allowing any later output to echo.
        if (hidden) await new Promise((resolve, reject) => sink.write('', error => error ? reject(error) : resolve()));
        muted = false;
        if (hidden) output.write('\n');
      }
    },
    async close() { rl.close(); sink.end(); await finished(sink); },
  };
}

async function verifySpond({ client, username, password, from, to, timezone, chooseGroup }) {
  const range = reviewRange(from, to);
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { throw new ReviewError('Choose a valid club timezone before verification'); }
  const token = await client.login(username, password);
  const groups = flattenGroups(await client.get(token, 'groups', { includeMembers: 'false' }));
  if (!groups.length) throw new ReviewError('No accessible groups were discovered; event compatibility remains unverified', 409);
  const id = await chooseGroup(groups);
  const group = groups.find(group => group.id === id);
  if (!group) throw new ReviewError('Choose one of the discovered groups; event verification was not performed');
  const remote = await client.get(token, 'sponds', providerEventQuery(group, range));
  const preview = reconcileEvents([], remote, { ...range, timezone });
  return {
    checkedAt: new Date().toISOString(), mode: 'read-only-account-verification',
    loginVerified: true, groupDiscoveryVerified: true,
    groupCount: groups.filter(group => !group.parentGroupId).length,
    subgroupCount: groups.filter(group => group.parentGroupId).length,
    eventSchemaVerified: remote.length > 0, eventsReturned: remote.length,
    eventsInWindow: preview.rows.length, from, to, timezone,
    scope: group.parentGroupId ? 'entire-parent-group' : 'mapped-group',
    writesEnabled: false, coverageVerified: false, subgroupRecipientsVerified: false,
    warning: remote.length ? preview.warning : 'No events returned; event-schema compatibility remains unverified.',
  };
}

async function main(args = process.argv.slice(2), {
  input = process.stdin, output = process.stdout, client = createSpondClient(),
  prompt = createPrompter, timezone = process.env.QMT_TIMEZONE || 'Europe/Zurich',
} = {}) {
  if (args.length === 0) {
    output.write('No provider calls. Run npm run spond:verify -- --live in your own terminal for one read-only account verification.\n');
    return;
  }
  if (args.length !== 1 || args[0] !== '--live') throw new ReviewError('Only --live is accepted; never pass credentials as arguments');
  const prompter = prompt(input, output);
  try {
    const from = (await prompter.ask('First club date (YYYY-MM-DD): ')).trim();
    const to = (await prompter.ask('Exclusive end date (YYYY-MM-DD; up to 31 days): ')).trim();
    reviewRange(from, to);
    const username = (await prompter.ask('Spond email: ')).trim();
    let password = await prompter.ask('Spond password (hidden; not saved): ', { hidden: true });
    const result = await verifySpond({ client, username, password, from, to, timezone,
      chooseGroup: async groups => {
        password = '';
        const safe = value => value.replace(/\p{C}/gu, '');
        groups.forEach((group, index) => output.write(
          `${index + 1}. ${safe(group.parentGroup ? `${group.parentGroup} / ${group.name}` : group.name)}\n`,
        ));
        const selection = (await prompter.ask('Group number to inspect (no mappings will be saved): ')).trim();
        return /^[1-9]\d*$/.test(selection) ? groups[Number(selection) - 1]?.id : undefined;
      },
    });
    password = '';
    output.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.eventSchemaVerified) process.exitCode = 2;
  } finally { await prompter.close(); }
}

if (require.main === module) main().catch(error => {
  const message = error instanceof SpondError || error instanceof ReviewError ? error.message
    : error.name === 'AbortError' ? 'Verification cancelled' : 'Verification failed; no mappings or events were changed';
  console.error(message);
  process.exitCode = 1;
});
module.exports = { createPrompter, verifySpond, main };
