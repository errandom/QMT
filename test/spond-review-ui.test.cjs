const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return React.Children.toArray(node.props?.children).map(text).join('');
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

function panelFixture() {
  const filename = path.join(__dirname, '..', 'src', 'components', 'OperationsOffice', 'SpondReviewPanel.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const groupId = 'A'.repeat(32);
  const parentGroupId = 'B'.repeat(32);
  const state = [], calls = [];
  let cursor = 0, rejectDiscovery = false;
  const context = {
    exports: {}, Error, AbortController, AbortSignal,
    require(id) {
      if (id === 'react') return {
        ...React,
        useState(initial) {
          const index = cursor++;
          if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
          return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
        },
        useRef(initial) {
          const index = cursor++;
          state[index] ??= { current: initial };
          return state[index];
        },
        useEffect() {},
      };
      if (id === '@/lib/api') return { async apiRequest(endpoint, options) {
        const body = JSON.parse(options.body);
        calls.push({ endpoint, body });
        if (endpoint === '/spond/discovery') {
          if (rejectDiscovery) throw new Error('Synthetic discovery failure');
          return {
            discoveryId: '00000000-0000-4000-8000-000000000001', expiresAt: '2026-11-04T18:00:00Z',
            teams: [
              { id: 1, name: 'U19', existingGroupId: null, suggestedGroupId: groupId, reason: 'Unique match - not confirmed' },
              { id: 2, name: 'Combined youth', existingGroupId: parentGroupId, suggestedGroupId: parentGroupId, reason: 'Existing mapping - review required' },
              { id: 3, name: 'Former squad', existingGroupId: 'C'.repeat(32), suggestedGroupId: null, reason: 'Existing mapping is not accessible - manual review required' },
            ],
            groups: [
              { id: groupId, name: 'U19', parentGroup: 'Club youth', parentGroupId },
              { id: parentGroupId, name: 'Club youth', parentGroup: null, parentGroupId: null },
            ],
          };
        }
        if (endpoint === '/spond/mappings/confirm') return { confirmedTeamIds: body.mappings.map(mapping => mapping.teamId) };
        if (endpoint === '/spond/reconciliation') return {
          warning: 'Read-only preview', timezone: 'Europe/Zurich', scope: 'Mapped group',
          rows: [{ classification: 'coexisting', reason: 'Do not duplicate', qmt: {
            id: 1, title: 'Training', start: '2026-11-04T18:00:00Z', end: '2026-11-04T19:00:00Z',
          }, spond: [] }],
        };
        assert.fail('Unexpected endpoint ' + endpoint);
      } };
      if (id.startsWith('@/components/ui/')) return new Proxy({}, { get: (_target, key) => key });
      return require(id);
    },
  };
  vm.runInNewContext(code, context, { filename });
  const render = () => { cursor = 0; return context.exports.default(); };
  const get = predicate => find(render(), predicate);
  const set = (id, value) => get(node => node.props?.id === id).props.onChange({ target: { value } });
  const check = (name, checked) => get(node => node.props?.name === name).props.onChange({ target: { checked } });
  const button = label => get(node => node.type === 'Button' && node.props.children === label);
  return { render, get, set, check, button, calls, groupId, parentGroupId,
    failDiscovery() { rejectDiscovery = true; } };
}

test('discovery suggestions require per-team and final human confirmation; previews never sync and edits invalidate review', async () => {
  const { render, get, set, check, button, calls, groupId, parentGroupId, failDiscovery } = panelFixture();
  render();
  assert.equal(calls.length, 0);
  set('spond-review-email', 'synthetic@example.invalid');
  set('spond-review-password', 'synthetic-not-a-credential');
  get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(get(node => node.props?.id === 'spond-review-password').props.value, '');
  await flush();
  assert.equal(calls.length, 1, 'discovery must not save mappings');
  assert.ok(get(node => node.type === 'h3' && text(node) === 'U19'), 'QMT team name must be visible outside the destination label');
  assert.equal(text(get(node => node.props?.htmlFor === 'spond-team-1')), 'Spond group or subgroup for U19');
  assert.equal(text(get(node => node.props?.id === 'spond-team-saved-1')), 'Saved Spond link: No link saved yet');
  assert.equal(text(get(node => node.props?.id === 'spond-team-saved-2')), 'Saved Spond link: Club youth (entire group)');
  assert.match(text(get(node => node.props?.id === 'spond-team-selection-2')), /Already saved; review and confirm/);
  assert.equal(text(get(node => node.props?.id === 'spond-team-saved-3')), 'Saved Spond link: Group unavailable in this discovery');
  assert.match(text(get(node => node.props?.id === 'spond-team-selection-1')), /QMT U19 -> Spond Club youth \/ U19 \(subgroup\).*Not saved/);
  assert.match(text(get(node => node.props?.id === 'spond-team-selection-3')), /No change.*not be saved or unlinked/);
  assert.equal(text(get(node => node.props?.['aria-label'] === 'Reviewed team links to save')),
    "Team links to save (0)No links reviewed yet. Choose a Spond group and check each team's review box.");
  assert.ok(get(node => node.type === 'p' && text(node).includes('Saving these links does not copy events or activate sync.')));
  const descriptions = get(node => node.props?.id === 'spond-team-1').props['aria-describedby'].split(' ');
  assert.ok(descriptions.every(id => get(node => node.props?.id === id)), 'mapping help must resolve to visible descriptions');
  assert.equal(get(node => node.props?.id === 'spond-team-1').props.value, groupId);
  assert.equal(get(node => node.props?.name === 'review-team-1').props.checked, false);
  assert.equal(button('Save reviewed team links').props.disabled, true);
  check('confirm-mappings', true);
  assert.equal(button('Save reviewed team links').props.disabled, true, 'final checkbox alone is insufficient');
  check('review-team-2', true);
  assert.match(text(get(node => node.props?.['aria-label'] === 'Reviewed team links to save')),
    /Spond Club youth \(entire group\) -> QMT Combined youth/);
  set('spond-team-2', '');
  assert.equal(get(node => node.props?.name === 'review-team-2').props.checked, false);
  assert.equal(get(node => node.props?.name === 'review-team-2').props.disabled, true);
  assert.match(text(get(node => node.props?.id === 'spond-team-saved-2')), /Club youth \(entire group\)/, 'leaving unchanged must not clear a saved link');
  assert.match(text(get(node => node.props?.['aria-label'] === 'Reviewed team links to save')), /Team links to save \(0\)/);
  check('review-team-1', true);
  assert.equal(get(node => node.props?.name === 'confirm-mappings').props.checked, false);
  assert.equal(text(get(node => node.props?.['aria-label'] === 'Reviewed team links to save')),
    'Team links to save (1)Spond Club youth / U19 (subgroup) -> QMT U19');
  check('confirm-mappings', true);
  assert.equal(button('Save reviewed team links').props.disabled, false);
  await button('Save reviewed team links').props.onClick();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.confirmed, true);
  assert.equal(calls[1].body.mappings.length, 1);
  assert.equal(calls[1].body.mappings[0].teamId, 1);
  assert.equal(calls[1].body.mappings[0].groupId, groupId);
  assert.equal(text(get(node => node.props?.id === 'spond-team-saved-1')), 'Saved Spond link: Club youth / U19 (subgroup)');
  assert.match(text(get(node => node.props?.id === 'spond-team-selection-1')), /Already saved; ready for read-only event preview below/);
  assert.equal(get(node => node.props?.name === 'review-team-1').props.checked, false);
  assert.equal(get(node => node.props?.name === 'confirm-mappings').props.checked, false);
  assert.equal(button('Save reviewed team links').props.disabled, true);
  set('spond-preview-from', '2026-11-04');
  set('spond-preview-to', '2026-11-05');
  get(node => node.type === 'form' && find(node, child => child.props?.id === 'spond-preview-team'))
    .props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(calls[2].endpoint, '/spond/reconciliation');
  assert.ok(get(node => node.type === 'p' && node.props.children === 'Coexisting - do not sync'));
  set('spond-team-1', parentGroupId);
  assert.match(text(get(node => node.props?.id === 'spond-team-selection-1')), /QMT U19 -> Spond Club youth \(entire group\).*Not saved/);
  assert.equal(text(get(node => node.props?.id === 'spond-team-saved-1')), 'Saved Spond link: Club youth / U19 (subgroup)');
  set('spond-team-1', '');
  assert.equal(get(node => node.props?.id === 'spond-preview-team'), undefined);
  assert.equal(get(node => node.props?.['aria-label'] === 'Event coexistence preview'), undefined);
  assert.equal(button('Save reviewed team links').props.disabled, true);
  failDiscovery();
  set('spond-review-password', 'synthetic-not-a-credential');
  get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(get(node => node.props?.role === 'alert').props.children, 'Synthetic discovery failure');
  assert.equal(get(node => node.props?.id === 'spond-review-password').props.value, '');
  assert.equal(get(node => node.props?.id === 'spond-team-1'), undefined);
});

for (const subgroup of [false, true]) {
  test(`one Spond ${subgroup ? 'subgroup' : 'entire group'} is explicitly reviewed for multiple QMT teams and saved only after final confirmation`, async () => {
    const { get, set, check, button, calls, groupId, parentGroupId } = panelFixture();
    set('spond-review-email', 'synthetic@example.invalid');
    set('spond-review-password', 'synthetic-not-a-credential');
    get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    await flush();
    const target = subgroup ? groupId : parentGroupId;
    assert.equal(get(node => node.props?.name === 'share-team-1').props.checked, false, 'suggestions are not shared-link confirmation');
    assert.equal(get(node => node.props?.id === 'spond-shared-teams').props.disabled, true);
    set('spond-shared-group', target);
    assert.equal(get(node => node.props?.id === 'spond-shared-teams').props.disabled, false);
    for (const id of [1, 2]) {
      check(`share-team-${id}`, true);
      assert.equal(get(node => node.props?.id === `spond-team-${id}`).props.value, target);
      assert.equal(get(node => node.props?.name === `review-team-${id}`).props.checked, true);
    }
    assert.equal(calls.length, 1, 'choosing the shared target and teams must not save');
    assert.equal(get(node => node.props?.name === 'share-team-3').props.checked, false);
    assert.equal(get(node => node.props?.id === 'spond-team-3').props.value, '', 'unselected teams keep their saved links');
    assert.equal(text(get(node => node.props?.id === 'spond-team-saved-2')), 'Saved Spond link: Club youth (entire group)');
    const groupLabel = subgroup ? 'Club youth / U19 (subgroup)' : 'Club youth (entire group)';
    assert.equal(text(get(node => node.props?.['aria-label'] === 'Reviewed team links to save')),
      `Team links to save (2)Spond ${groupLabel} -> QMT U19, Combined youth`);
    assert.equal(button('Save reviewed team links').props.disabled, true);
    check('confirm-mappings', true);
    assert.equal(button('Save reviewed team links').props.disabled, false);
    await button('Save reviewed team links').props.onClick();
    await flush();
    assert.deepEqual(calls[1].body.mappings, [{ teamId: 1, groupId: target }, { teamId: 2, groupId: target }]);
    for (const id of [1, 2]) {
      assert.equal(text(get(node => node.props?.id === `spond-team-saved-${id}`)), `Saved Spond link: ${groupLabel}`);
      assert.equal(get(node => node.props?.name === `share-team-${id}`).props.checked, false);
    }
    const previewSelect = get(node => node.props?.id === 'spond-preview-team');
    assert.deepEqual(React.Children.toArray(previewSelect.props.children).map(option => option.props.value), [1, 2]);
    set('spond-preview-from', '2026-11-04');
    set('spond-preview-to', '2026-11-05');
    for (const id of [1, 2]) {
      set('spond-preview-team', String(id));
      get(node => node.type === 'form' && find(node, child => child.props?.id === 'spond-preview-team'))
        .props.onSubmit({ preventDefault() {} });
      await flush();
      assert.equal(calls.at(-1).endpoint, '/spond/reconciliation');
      assert.equal(calls.at(-1).body.teamId, id);
    }
    assert.equal(calls.length, 4, 'shared mapping creates no event write or sync request');
    set('spond-review-password', 'synthetic-not-a-credential');
    get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    await flush();
    assert.equal(get(node => node.props?.id === 'spond-shared-group').props.value, '', 'new discovery clears the shared target');
    assert.equal(get(node => node.props?.name === 'share-team-1').props.checked, false);
    assert.equal(get(node => node.props?.id === 'spond-preview-team'), undefined);
  });
}

test('moving or deselecting a shared-group team invalidates final confirmation without changing other reviewed or saved links', async () => {
  const { get, set, check, button, calls, groupId, parentGroupId } = panelFixture();
  set('spond-review-email', 'synthetic@example.invalid');
  set('spond-review-password', 'synthetic-not-a-credential');
  get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await flush();
  set('spond-shared-group', groupId);
  check('share-team-1', true);
  check('share-team-2', true);
  check('confirm-mappings', true);
  set('spond-shared-group', parentGroupId);
  assert.equal(get(node => node.props?.name === 'confirm-mappings').props.checked, false);
  assert.equal(get(node => node.props?.name === 'share-team-1').props.checked, false);
  assert.match(text(get(node => node.props?.id === 'spond-shared-team-2')), /Reviewed for: Club youth \/ U19/);
  check('share-team-1', true);
  assert.equal(get(node => node.props?.id === 'spond-team-1').props.value, parentGroupId);
  assert.equal(get(node => node.props?.id === 'spond-team-2').props.value, groupId);
  assert.match(text(get(node => node.props?.['aria-label'] === 'Reviewed team links to save')),
    /Spond Club youth \/ U19 \(subgroup\) -> QMT Combined youth.*Spond Club youth \(entire group\) -> QMT U19/);
  check('confirm-mappings', true);
  check('share-team-1', false);
  assert.equal(get(node => node.props?.name === 'confirm-mappings').props.checked, false);
  assert.equal(get(node => node.props?.name === 'review-team-1').props.checked, false);
  assert.equal(get(node => node.props?.id === 'spond-team-1').props.value, '');
  assert.equal(get(node => node.props?.name === 'review-team-2').props.checked, true);
  assert.equal(text(get(node => node.props?.id === 'spond-team-saved-2')), 'Saved Spond link: Club youth (entire group)');
  assert.equal(button('Save reviewed team links').props.disabled, true);
  assert.equal(calls.length, 1);
});
