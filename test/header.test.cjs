const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderHeader(currentUser = null) {
  const filename = path.join(__dirname, '..', 'src', 'components', 'Header.tsx');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = id => {
    if (id === '@/hooks/useCapabilities') return { useCapabilities: () => ({ capabilities: { clubName: 'Test club' } }) };
    if (id === './LoginDialog') return { default: () => null };
    if (id === '@/lib/auth') return { hasAccess: () => true };
    if (id === '@/lib/constants') return {
      COLORS: { NAVY: '#001f3f', WHITE: '#fff', ACCENT: '#c00' },
      SIZES: { ICON_SIZE: 24, ICON_SIZE_SMALL: 20 },
    };
    if (id === '@phosphor-icons/react') return new Proxy({}, { get: () => () => null });
    if (id === '@/components/ui/button') return {
      Button: ({ children, className, onClick }) => React.createElement('button', { className, onClick }, children),
    };
    return original(id);
  };
  loaded._compile(outputText, filename);
  return renderToStaticMarkup(React.createElement(loaded.exports.default, {
    currentUser, currentView: 'dashboard', onLogin() {}, onLogout() {}, onNavigate() {},
  }));
}

test('header uses one subtle errandom product attribution beside its title for visitors and staff', () => {
  for (const currentUser of [null, { id: 1, username: 'Test admin', role: 'admin' }]) {
    const html = renderHeader(currentUser);
    assert.match(html, /<h1[^>]*>QMT \| Operations<\/h1><a href="https:\/\/www\.errandom\.com\/QMT\/"[^>]*>an errandom product<\/a>/);
    assert.equal((html.match(/an errandom product/g) || []).length, 1);
    assert.doesNotMatch(html, /About QMT on errandom/);
    assert.match(html, /flex flex-wrap items-baseline/);
    assert.match(html, /focus-visible:outline-white/);
    assert.match(html, /Test club/);
    assert.match(html, currentUser ? /Test admin/ : />Login</);
  }
});
