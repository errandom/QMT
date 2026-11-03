const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('request deletion requires confirmation, waits for persistence and keeps failures retryable', async () => {
  const filename = path.join(__dirname, '..', 'src', 'components', 'OperationsOffice', 'RequestDeleteButton.tsx');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const request = { id: '7', status: 'Rejected', requestorName: 'Synthetic fixture', eventType: 'Practice', workflow: { version: 2 } };
  const collections = { facility: [request, { id: '8' }], equipment: [{ id: '9' }], cancellation: [{ id: '10' }] };
  const state = [];
  const calls = [];
  const notifications = [];
  let cursor = 0, resolve, reject;
  const update = name => value => { collections[name] = value(collections[name]); };
  const context = {
    exports: {}, Error,
    require(id) {
      if (id === 'react') return { ...React, useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = value; }];
      } };
      if (id === '@/contexts/DataContext') return { useData: () => ({
        setFacilityRequests: update('facility'), setEquipmentRequests: update('equipment'), setCancellationRequests: update('cancellation'),
      }) };
      if (id === '@/lib/api') return { api: { deleteRequest(...args) {
        calls.push(args);
        return new Promise((done, fail) => { resolve = done; reject = fail; });
      } } };
      if (id === 'sonner') return { toast: {
        success: message => notifications.push(['success', message]),
        error: message => notifications.push(['error', message]),
      } };
      if (id.startsWith('@/components/ui/') || id === '@phosphor-icons/react') {
        return new Proxy({}, { get: (_target, key) => key });
      }
      return require(id);
    },
  };
  vm.runInNewContext(outputText, context, { filename });
  const render = () => { cursor = 0; return context.exports.default({ request }); };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  };
  const confirm = tree => find(tree, node => node.type === 'Button' && node.props.variant === 'destructive');
  let tree = render();
  assert.equal(tree.props.open, false);
  tree.props.onOpenChange(true);
  tree = render();
  assert.equal(tree.props.open, true);
  assert.equal(calls.length, 0);
  tree.props.onOpenChange(false);
  assert.equal(render().props.open, false);
  assert.equal(calls.length, 0);

  render().props.onOpenChange(true);
  const failed = confirm(render()).props.onClick();
  tree = render();
  assert.equal(confirm(tree).props.disabled, true);
  tree.props.onOpenChange(false);
  assert.equal(render().props.open, true);
  assert.deepEqual(calls[0], ['7', 'Rejected', 2]);
  assert.equal(collections.facility.length, 2);
  reject(new Error('Synthetic database outage'));
  await failed;
  tree = render();
  assert.equal(tree.props.open, true);
  assert.equal(confirm(tree).props.disabled, false);
  assert.equal(find(tree, node => node.props?.role === 'alert').props.children, 'Synthetic database outage');
  assert.equal(collections.facility.length, 2);

  const success = confirm(tree).props.onClick();
  assert.equal(collections.facility.length, 2);
  resolve({ id: '7' });
  await success;
  assert.equal(render().props.open, false);
  assert.deepEqual(collections.facility, [{ id: '8' }]);
  assert.deepEqual(collections.equipment, [{ id: '9' }]);
  assert.deepEqual(collections.cancellation, [{ id: '10' }]);
  assert.equal(notifications[0][0], 'error');
  assert.equal(notifications[1][0], 'success');
});
