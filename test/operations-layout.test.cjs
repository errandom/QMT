const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function mountAlignment(sections) {
  const styles = new Map();
  const effects = [];
  const observers = [];
  const grid = {
    sections,
    querySelectorAll() { return this.sections; },
    style: { setProperty: (name, value) => styles.set(name, value) },
  };
  const filename = path.join(__dirname, '..', 'src', 'components', 'OperationsOffice', 'OperationsCards.tsx');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const context = {
    exports: {},
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.observed = [];
        this.disconnected = false;
        observers.push(this);
      }
      observe(element) { this.observed.push(element); }
      disconnect() { this.disconnected = true; }
    },
    require(id) {
      if (id === 'react') return {
        ...React,
        useState: initial => [initial, () => {}],
        useRef: () => ({ current: grid }),
        useLayoutEffect: effect => effects.push(effect),
      };
      if (id === '@/lib/constants') return { COLORS: {} };
      if (id === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
      if (id.startsWith('@/components/ui/') || id === '@phosphor-icons/react') {
        return new Proxy({}, { get: () => () => null });
      }
      return require(id);
    },
  };
  vm.runInNewContext(outputText, context, { filename });
  let cleanup;
  const render = (nextSections) => {
    cleanup?.();
    grid.sections = nextSections;
    context.exports.OperationsCardGrid({ children: [] });
    cleanup = effects.at(-1)();
  };
  render(sections);
  return {
    styles, observers, render,
    resize: () => observers.at(-1).callback(),
    unmount: () => cleanup(),
  };
}

const section = (name, height) => ({
  dataset: { operationsSection: name },
  height,
  getBoundingClientRect() { return { height: this.height }; },
});

test('operations sections equalize optional content and grow or shrink after resizing', () => {
  const shortTitle = section('title', 32);
  const longTitle = section('title', 60.25);
  const longAddress = section('address', 40);
  const longContact = section('contact', 32);
  const sections = [
    shortTitle, longTitle, section('badges', 22), section('badges', 0),
    section('address', 0), longAddress, section('locality', 20),
    section('contact', 16), longContact,
  ];
  const alignment = mountAlignment(sections);
  assert.deepEqual(alignment.observers[0].observed, sections);
  assert.equal(alignment.styles.get('--operations-title-height'), '61px');
  assert.equal(alignment.styles.get('--operations-badges-height'), '22px');
  assert.equal(alignment.styles.get('--operations-address-height'), '40px');
  assert.equal(alignment.styles.get('--operations-locality-height'), '20px');
  assert.equal(alignment.styles.get('--operations-contact-height'), '32px');

  longTitle.height = 96;
  longAddress.height = 80;
  alignment.resize();
  assert.equal(alignment.styles.get('--operations-title-height'), '96px');
  assert.equal(alignment.styles.get('--operations-address-height'), '80px');

  longTitle.height = 24;
  longAddress.height = 20;
  longContact.height = 16;
  alignment.resize();
  assert.equal(alignment.styles.get('--operations-title-height'), '32px');
  assert.equal(alignment.styles.get('--operations-address-height'), '20px');
  assert.equal(alignment.styles.get('--operations-contact-height'), '16px');
  alignment.unmount();
  assert.equal(alignment.observers[0].disconnected, true);
});

test('separate collections keep independent sizing, including empty and newly populated lists', () => {
  const first = mountAlignment([section('title', 120)]);
  const second = mountAlignment([]);
  assert.equal(second.styles.size, 0);
  second.render([section('title', 24), section('coach', 0)]);
  assert.equal(second.styles.get('--operations-title-height'), '24px');
  assert.equal(second.styles.get('--operations-coach-height'), '0px');
  assert.equal(first.styles.get('--operations-title-height'), '120px');
  first.unmount();
  second.unmount();
});

test('filtering or replacing cards releases old observations and discards their heights', () => {
  const oldSection = section('title', 100);
  const alignment = mountAlignment([oldSection, section('email', 80)]);
  const replacement = [section('title', 24), section('email', 0)];
  alignment.render(replacement);
  assert.equal(alignment.observers[0].disconnected, true);
  assert.deepEqual(alignment.observers[1].observed, replacement);
  assert.equal(alignment.styles.get('--operations-title-height'), '24px');
  assert.equal(alignment.styles.get('--operations-email-height'), '0px');
  oldSection.height = 200;
  alignment.resize();
  assert.equal(alignment.styles.get('--operations-title-height'), '24px');
  alignment.unmount();
  assert.equal(alignment.observers[1].disconnected, true);
});
