const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const root = path.join(__dirname, '..');
function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('workbook UI saves before copy, reports clipboard errors and requires actual entry confirmation', async () => {
  const workbookFilename = path.join(root, 'src', 'lib', 'facilityWorkbook.ts');
  const workbook = new Module(workbookFilename, module);
  workbook._compile(transpile(workbookFilename), workbookFilename);
  const filename = path.join(root, 'src', 'components', 'OperationsOffice', 'MeetingRoomWorkbookPanel.tsx');
  let request = { id: '7', status: 'Pending', eventType: 'Meeting', date: '2027-04-26', startTime: '19:30', duration: 90,
    workflow: { version: 3, stage: 'In evaluation', locationType: 'meeting_room', route: 'IGACR' } };
  const state = [], effects = [], calls = [], clipboard = [], notifications = [];
  let cursor = 0, effectCursor = 0, resolveSave, copyingFails = true;
  const context = {
    exports: {}, Error,
    navigator: { clipboard: { async writeText(text) {
      if (copyingFails) throw new Error('Synthetic clipboard denial');
      clipboard.push(text);
    } } },
    require(id) {
      if (id === 'react') return { ...React, useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      }, useEffect(effect, deps) {
        const index = effectCursor++;
        if (!effects[index] || deps.some((value, i) => effects[index][i] !== value)) {
          effects[index] = deps;
          effect();
        }
      } };
      if (id === '@/lib/api') return { api: { getMeetingRoomWorkbookTarget: async () =>
        ({ url: 'https://igacr.sharepoint.com/sites/vorstand/synthetic-workbook.xlsx' }) } };
      if (id === '@/lib/facilityWorkbook') return workbook.exports;
      if (id === 'sonner') return { toast: {
        success: value => notifications.push(['success', value]), error: value => notifications.push(['error', value]),
      } };
      if (id.startsWith('@/components/ui/')) return new Proxy({}, { get: (_target, key) => key });
      return require(id);
    },
  };
  vm.runInNewContext(transpile(filename), context, { filename });
  const render = (busy = false) => {
    cursor = effectCursor = 0;
    return context.exports.default({ request, busy, onAction(action) {
      calls.push(action);
      return new Promise(resolve => { resolveSave = resolve; });
    } });
  };
  const set = (name, value) => find(render(), node => node.props?.name === name).props.onChange({ target: { value } });
  const button = label => find(render(), node => node.type === 'Button' && node.props.children === label);
  render();
  await flush();
  assert.equal(calls.length, 0);
  assert.equal(find(render(), node => node.props?.name === 'workbookUrl').props.value,
    'https://igacr.sharepoint.com/sites/vorstand/synthetic-workbook.xlsx');
  for (const [key, value] of Object.entries({
    room: 'Synthetic room', occasion: 'Synthetic meeting', club: 'Synthetic club', participants: '12',
    responsibleName: 'Synthetic host', responsiblePhone: '5550101', responsibleEmail: 'host@example.invalid',
  })) set(key, value);
  const prepare = find(render(), node => node.type === 'form');
  prepare.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'prepare-workbook');
  assert.equal(calls[0].details.participants, 12);
  assert.equal(clipboard.length, 0);
  assert.equal(find(render(true), node => node.type === 'fieldset').props.disabled, true);
  request = { ...request, workflow: { ...request.workflow, version: 4, workbook: {
    details: calls[0].details, dates: ['2027-04-26', '2027-05-03'], preparedAt: '2026-11-03T20:00:00Z', preparedBy: 'synthetic-operator',
  } } };
  resolveSave(request);
  await flush();
  assert.equal(request.workflow.workbook.entry, undefined);
  assert.equal(find(render(), node => node.type === 'a').props.href, request.workflow.workbook.details.workbookUrl);
  await button('Copy Excel rows').props.onClick();
  assert.match(find(render(), node => node.props?.role === 'alert').props.children, /Synthetic clipboard denial/);
  assert.equal(calls.length, 1);
  assert.equal(clipboard.length, 0);
  copyingFails = false;
  await button('Copy Excel rows').props.onClick();
  assert.equal(clipboard.length, 1);
  assert.equal(clipboard[0].split('\n').length, 2);
  assert.equal(clipboard[0].split('\n')[0].split('\t').length, 9);
  assert.match(clipboard[0], /19:30 - 21:00/);
  assert.equal(calls.length, 1);
  assert.equal(request.workflow.workbook.entry, undefined);
  set('room', 'Unsaved replacement');
  assert.equal(button('Copy Excel rows').props.disabled, true);
  set('room', 'Synthetic room');
  set('firstRow', '40');
  let confirmation = find(render(), node => node.props?.name === 'confirmed');
  const entryForm = find(render(), node => node.type === 'form' && node.props.className === 'space-y-3 border-t pt-3');
  entryForm.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  confirmation.props.onChange({ target: { checked: true } });
  find(render(), node => node.type === 'form' && node.props.className === 'space-y-3 border-t pt-3')
    .props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].action, 'enter-workbook');
  assert.equal(calls[1].firstRow, 40);
  assert.equal(calls[1].confirmed, true);
  resolveSave(undefined);
  await flush();
  assert.equal(request.workflow.workbook.entry, undefined);
  find(render(), node => node.type === 'form' && node.props.className === 'space-y-3 border-t pt-3')
    .props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].action, 'enter-workbook');
  request = { ...request, workflow: { ...request.workflow, version: 5, stage: 'Awaiting response',
    workbook: { ...request.workflow.workbook, entry: { firstRow: 40, lastRow: 41, at: '2026-11-03T20:01:00Z', by: 'synthetic-operator' } } } };
  resolveSave(request);
  await flush();
  assert.equal(request.status, 'Pending');
  assert.equal(button('Copy Excel rows').props.disabled, true);
  assert.equal(find(render(), node => node.props?.name === 'confirmed'), undefined);
  assert.ok(notifications.some(item => item[0] === 'error'));
  assert.ok(notifications.some(item => item[0] === 'success'));
});
