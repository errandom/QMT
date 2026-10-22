const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadApp({ from = '2026-10-15', through = '2027-01-20', isLoading = false } = {}) {
  const filename = path.join(__dirname, '..', 'src', 'App.tsx');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  const requests = [];
  const errors = [];
  let stateIndex = 0;
  loaded.require = id => {
    if (id === 'react') return {
      ...React, useEffect() {},
      useState: () => [[from, through, null, 'dashboard', false][stateIndex++], () => {}],
    };
    if (id === '@/contexts/DataContext') return { useData: () => ({
      eventWindow: { from: '2026-10-15T00:00:00.000Z', to: '2027-01-20T00:00:00.000Z' },
      isLoading, refreshData: range => requests.push(range),
    }) };
    if (id === '@/lib/auth') return {};
    if (id === 'sonner') return { toast: { error: message => errors.push(message) } };
    if (['@/components/ui/sonner', '@/components/Header', '@/components/Dashboard', '@phosphor-icons/react'].includes(id)) {
      return new Proxy({}, { get: () => () => null });
    }
    return original(id);
  };
  const uiFiles = {
    '@/components/ui/button': 'components/ui/button.tsx',
    '@/components/ui/input': 'components/ui/input.tsx',
    '@/components/ui/label': 'components/ui/label.tsx',
    '@/lib/constants': 'lib/constants.ts',
    '@/lib/utils': 'lib/utils.ts',
  };
  const appRequire = loaded.require;
  loaded.require = id => {
    if (!uiFiles[id]) return appRequire(id);
    const file = path.join(__dirname, '..', 'src', uiFiles[id]);
    const child = new Module(file, loaded);
    child.paths = loaded.paths;
    child.require = loaded.require;
    child._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, file);
    return child.exports;
  };
  loaded._compile(outputText, filename);
  const tree = loaded.exports.default();
  function find(node, type) {
    if (!React.isValidElement(node)) return;
    if (node.type === type) return node;
    for (const child of React.Children.toArray(node.props.children)) {
      const match = find(child, type);
      if (match) return match;
    }
  }
  return { html: renderToStaticMarkup(tree), form: find(tree, 'form'), requests, errors };
}

test('schedule window reuses the site card and form controls with accessible dates and disclosure', () => {
  const { html } = loadApp({ isLoading: true });
  assert.match(html, /<details class="[^"]*glass-card/);
  assert.match(html, /<summary[^>]*focus-visible:outline/);
  assert.match(html, /Loaded schedule window/);
  assert.match(html, /<time dateTime="2026-10-15"[^>]*>2026-10-15<\/time>/);
  assert.match(html, /<time dateTime="2027-01-20"[^>]*>2027-01-20<\/time>/);
  assert.match(html, /for="schedule-range-start"/);
  assert.match(html, /for="schedule-range-end"/);
  assert.equal((html.match(/data-slot="input"/g) || []).length, 2);
  assert.match(html, /<button[^>]*data-slot="button"[^>]*disabled=""[^>]*>Load selected range<\/button>/);
});

test('schedule date controls retain inclusive end-date conversion and range validation', () => {
  const valid = loadApp();
  let prevented = false;
  valid.form.props.onSubmit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(valid.requests, [{ from: '2026-10-15T00:00:00.000Z', to: '2027-01-21T00:00:00.000Z' }]);
  assert.deepEqual(valid.errors, []);
  for (const range of [{ from: 'invalid' }, { through: '2026-10-14' }, { through: '2027-10-16' }]) {
    const invalid = loadApp(range);
    invalid.form.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(invalid.requests, []);
    assert.deepEqual(invalid.errors, ['Select a valid date range of at most 366 days']);
  }
});
