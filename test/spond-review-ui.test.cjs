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
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test('discovery suggestions require per-team and final human confirmation; previews never sync and edits invalidate review', async () => {
  const filename = path.join(__dirname, '..', 'src', 'components', 'OperationsOffice', 'SpondReviewPanel.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const groupId = 'A'.repeat(32);
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
            teams: [{ id: 1, name: 'U19', suggestedGroupId: groupId, reason: 'Unique match - not confirmed' }],
            groups: [{ id: groupId, name: 'U19', parentGroup: null, parentGroupId: null }],
          };
        }
        if (endpoint === '/spond/mappings/confirm') return { confirmedTeamIds: [1] };
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
  render();
  assert.equal(calls.length, 0);
  set('spond-review-email', 'synthetic@example.invalid');
  set('spond-review-password', 'synthetic-not-a-credential');
  get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(get(node => node.props?.id === 'spond-review-password').props.value, '');
  await flush();
  assert.equal(calls.length, 1, 'discovery must not save mappings');
  assert.equal(get(node => node.props?.id === 'spond-team-1').props.value, groupId);
  assert.equal(get(node => node.props?.name === 'review-team-1').props.checked, false);
  assert.equal(button('Confirm reviewed mappings').props.disabled, true);
  check('confirm-mappings', true);
  assert.equal(button('Confirm reviewed mappings').props.disabled, true, 'final checkbox alone is insufficient');
  check('review-team-1', true);
  assert.equal(get(node => node.props?.name === 'confirm-mappings').props.checked, false);
  check('confirm-mappings', true);
  assert.equal(button('Confirm reviewed mappings').props.disabled, false);
  await button('Confirm reviewed mappings').props.onClick();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.confirmed, true);
  assert.equal(calls[1].body.mappings.length, 1);
  set('spond-preview-from', '2026-11-04');
  set('spond-preview-to', '2026-11-05');
  get(node => node.type === 'form' && find(node, child => child.props?.id === 'spond-preview-team'))
    .props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(calls[2].endpoint, '/spond/reconciliation');
  assert.ok(get(node => node.type === 'p' && node.props.children === 'Coexisting - do not sync'));
  set('spond-team-1', '');
  assert.equal(get(node => node.props?.id === 'spond-preview-team'), undefined);
  assert.equal(get(node => node.props?.['aria-label'] === 'Event coexistence preview'), undefined);
  assert.equal(button('Confirm reviewed mappings').props.disabled, true);
  rejectDiscovery = true;
  set('spond-review-password', 'synthetic-not-a-credential');
  get(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(get(node => node.props?.role === 'alert').props.children, 'Synthetic discovery failure');
  assert.equal(get(node => node.props?.id === 'spond-review-password').props.value, '');
  assert.equal(get(node => node.props?.id === 'spond-team-1'), undefined);
});
