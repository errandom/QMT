const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const root = path.join(__dirname, '..', 'src');
const request = {
  id: 7, type: 'facility', status: 'Pending', eventType: 'Practice', date: '2027-04-26',
  startTime: '19:30', duration: 90, requestorName: 'Synthetic requester', requestorPhone: '5550100',
  requestorEmail: 'requester@example.invalid', createdAt: '2026-11-05T12:00:00Z', description: 'Original details',
};
const user = { id: 1, username: 'QMTadmin', role: 'admin', isActive: true };
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [...React.Children.toArray(node.props?.children), ...React.Children.toArray(node.props?.actions)]) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
function mount(data = {}) {
  const modules = new Map(), stores = new Map(), calls = [];
  const browser = { location: { href: '' } };
  let state, cursor = 0, ids = 0, effects = [];
  const react = {
    ...React,
    useState(initial) {
      const store = state, index = cursor++;
      if (!(index in store)) store[index] = typeof initial === 'function' ? initial() : initial;
      return [store[index], value => { store[index] = typeof value === 'function' ? value(store[index]) : value; }];
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useId() { return react.useState(() => `language-${++ids}`)[0]; },
    useMemo: create => create(),
    useEffect(effect, deps) {
      const store = react.useState(() => ({ deps: null }))[0];
      if (!store.deps || deps.some((value, index) => value !== store.deps[index])) {
        store.deps = deps; effects.push(effect);
      }
    },
  };
  const values = {
    teams: [], fields: [], sites: [], events: [], facilityRequests: [], equipmentRequests: [], cancellationRequests: [],
    ...data,
  };
  const actual = new Set([
    '@/lib/facilityWorkflow', '@/hooks/useMessageDraft',
    './MessageLanguageSwitch', './CommunicationsPanel',
    './OperationsOffice/MessageLanguageSwitch', '@/lib/eventMessages', '@/lib/whatsappService', '@/lib/utils',
    './eventMessages', './facilityWorkflow', './utils', './fieldSharing',
  ]);
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const context = {
      exports: {}, Error, crypto: { randomUUID: () => 'synthetic-send-id' },
      requestAnimationFrame: callback => callback(),
      window: browser,
      navigator: {
        clipboard: { async writeText(text) { calls.push(['copy', text]); } },
        async share(value) { calls.push(['share', { ...value }]); },
      },
      require(id) {
        if (id === 'react') return react;
        if (id.endsWith('message-template-domain.mjs')) return require(path.resolve(path.dirname(filename), id));
        if (id === '@/lib/messageTemplates') return { messageTemplatesApi: {
          async save(template, subject, message, recipient) { calls.push(['saveTemplate', template.key, template.language, subject, message, recipient]); return { ...template, subject, message, recipient, revision: 1, customized: true }; },
          async reset(template) { calls.push(['resetTemplate', template.key, template.language]); return { ...template, ...require('../server/message-template-domain.mjs').templateDefinition(template.key, template.language), revision: template.revision + 1, customized: false }; },
          list: () => data.templatePromise || ({
          then(callback) {
            let failure;
            try { callback(data.templateLibrary || require('../server/message-template-domain.mjs').templateCatalog.map(item => ({ ...item, revision: 0, customized: false, updatedBy: null, updatedAt: null }))); }
            catch (error) { failure = error; }
            return { catch(onError) { if (failure) onError(failure); return { finally(callback) { callback(); } }; } };
          },
        }) } };
        if (id === '@/contexts/DataContext') return { useData: () => values };
        if (id === '@/hooks/useCapabilities') return { useCapabilities: () => ({ capabilities: { spond: false, transport: false } }) };
        if (id === '@/lib/api') return {
          api: new Proxy({}, { get: (_target, key) => (...args) => {
            calls.push([key, ...args]); return Promise.resolve({});
          } }),
          async apiRequest(...args) {
            calls.push(['apiRequest', ...args]);
            return { email: { to: 'transport@example.invalid', cc: ['coach@example.invalid'] } };
          },
        };
        if (id === '@/lib/operations') return {
          requestedDates: () => [], operationsApi: { messages: async () => ({ messages: [], configured: false }), send: async (...args) => calls.push(['send', ...args]) },
        };
        if (id === '@/lib/constants') return { COLORS: {} };
        if (id === 'sonner') return { toast: { success() {}, error() {} } };
        if (actual.has(id)) {
          const base = id.startsWith('@/') ? path.join(root, ...id.slice(2).split('/')) : path.resolve(path.dirname(filename), id);
          return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`);
        }
        if (id.startsWith('@/components/') || id.startsWith('./') || id === '@phosphor-icons/react') {
          return new Proxy({}, { get: (_target, key) => key });
        }
        return require(id);
      },
    };
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    vm.runInNewContext(outputText, context, { filename });
    modules.set(filename, context.exports);
    return context.exports;
  }
  const render = (component, props) => {
    if (!stores.has(component)) stores.set(component, []);
    state = stores.get(component); cursor = 0;
    const result = component(props);
    if (!effects.length) return result;
    const pending = effects; effects = [];
    pending.forEach(effect => effect());
    state = stores.get(component); cursor = 0;
    return component(props);
  };
  const language = (tree, value) => {
    const control = find(tree, node => node.type?.name === 'MessageLanguageSwitch');
    assert.ok(control, 'The draft must always offer a language switch');
    const radios = render(control.type, control.props);
    const radio = find(radios, node => node.type === 'input' && node.props.value === value);
    radio.props.onChange();
  };
  return { load: name => load(path.join(root, 'components', 'OperationsOffice', `${name}.tsx`)).default,
    loadLibrary: name => load(path.join(root, 'lib', `${name}.ts`)),
    render, language, calls, mailto: () => browser.location.href };
}

test('manual workflow drafts default to English, preserve edits in both languages and record the selected draft', async () => {
  const ui = mount();
  const Card = ui.load('FacilityRequestCard');
  const props = { request, currentUser: user, onApprove() {}, onReject() {} };
  let tree = ui.render(Card, props);
  find(tree, node => node.type === 'Button' && node.props.children === 'Open workflow').props.onClick();
  tree = ui.render(Card, props);
  const panel = find(tree, node => node.type?.name === 'FacilityWorkflowPanel');
  const panelTree = ui.render(panel.type, panel.props);
  const form = find(panelTree, node => node.type?.name === 'CommunicationForm');
  const records = [];
  const formProps = { ...form.props, onRecord: async (...args) => records.push(args) };
  const render = () => ui.render(form.type, formProps);
  const message = () => find(render(), node => node.type === 'Textarea');
  assert.match(message().props.value, /^Hi Synthetic requester,/);
  message().props.onChange({ target: { value: 'Edited English draft' } });
  ui.language(render(), 'de');
  assert.match(message().props.value, /keine Buchungsbestätigung/);
  assert.ok(message().props.value.endsWith('Quick - Mean - Tough\nKenny'));
  message().props.onChange({ target: { value: 'Bearbeiteter deutscher Entwurf' } });
  ui.language(render(), 'en');
  assert.equal(message().props.value, 'Edited English draft');
  ui.language(render(), 'de');
  assert.equal(message().props.value, 'Bearbeiteter deutscher Entwurf');
  assert.equal(message().props.lang, 'de');
  const link = find(render(), node => node.type === 'a' && node.props.href.startsWith('https://wa.me/'));
  assert.ok(decodeURIComponent(link.props.href).includes('Bearbeiteter deutscher Entwurf'));
  await find(render(), node => node.type === 'Button' && node.props.children === 'Copy draft').props.onClick();
  assert.deepEqual(ui.calls, [['copy', 'Bearbeiteter deutscher Entwurf']]);
  assert.equal(records.length, 0);
  find(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(records, [['WhatsApp', 'Bearbeiteter deutscher Entwurf']]);
});

test('the responsible-department editor exposes German and personalizes its email and copied draft', async () => {
  const ui = mount(), Card = ui.load('FacilityRequestCard');
  const inquiry = { ...request, workflow: {
    stage: 'In evaluation', version: 2, history: [], locationType: 'field', route: 'ZVIS',
    department: 'Synthetic allocation office', contactEmail: 'office@example.invalid',
    reference: 'TEST-1', followUpDate: '', permitNotes: '',
  } };
  const props = { request: inquiry, currentUser: user, onApprove() {}, onReject() {} };
  let tree = ui.render(Card, props);
  find(tree, node => node.type === 'Button' && node.props.children === 'Open workflow').props.onClick();
  tree = ui.render(Card, props);
  const panel = find(tree, node => node.type?.name === 'FacilityWorkflowPanel');
  const panelTree = ui.render(panel.type, panel.props);
  const form = find(panelTree, node => node.type?.name === 'CommunicationForm');
  assert.equal(form.props.action, 'send');
  const render = () => ui.render(form.type, form.props);
  assert.match(find(render(), node => node.type === 'Textarea').props.value, /Could you check/);
  ui.language(render(), 'de');
  const draft = find(render(), node => node.type === 'Textarea').props.value;
  assert.match(draft, /^Hoi zusammen,\n\nDarf ich euch bitten/);
  assert.match(draft, /Diese Nachricht wurde automatisch von QMT erstellt\./);
  assert.ok(draft.endsWith('Quick - Mean - Tough\nKenny'));
  const link = find(render(), node => node.type === 'a' && node.props.href.startsWith('mailto:'));
  const mailto = new URL(link.props.href);
  assert.equal(mailto.pathname, 'office@example.invalid');
  assert.match(mailto.searchParams.get('subject'), /Anfrage zur Anlagennutzung/);
  assert.equal(mailto.searchParams.get('body'), draft);
  await find(render(), node => node.type === 'Button' && node.props.children === 'Copy draft').props.onClick();
  assert.deepEqual(ui.calls, [['copy', draft]], 'Neither email opening nor copying records or sends the inquiry');
});

test('linked email language changes preserve subject/body drafts and require renewed send approval', () => {
  const ui = mount(), Panel = ui.load('CommunicationsPanel');
  const render = () => ui.render(Panel, { request, currentUser: user });
  const subject = () => find(render(), node => node.type === 'Input' && node.props.maxLength === 220);
  const message = () => find(render(), node => node.type === 'Textarea');
  const approval = () => find(render(), node => node.type === 'input' && node.props.type === 'checkbox');
  assert.match(message().props.value, /^Hi /);
  subject().props.onChange({ target: { value: 'Custom English subject' } });
  message().props.onChange({ target: { value: 'Custom English message' } });
  approval().props.onChange({ target: { checked: true } });
  assert.equal(approval().props.checked, true);
  ui.language(render(), 'de');
  assert.equal(approval().props.checked, false);
  assert.match(subject().props.value, /Anfrage zur Anlagennutzung/);
  assert.match(message().props.value, /^Hoi /);
  message().props.onChange({ target: { value: 'Deutsche Nachricht' } });
  ui.language(render(), 'en');
  assert.equal(subject().props.value, 'Custom English subject');
  assert.equal(message().props.value, 'Custom English message');
  ui.language(render(), 'de');
  assert.equal(message().props.value, 'Deutsche Nachricht');
  assert.equal(ui.calls.length, 0);
});

test('saved bilingual templates and shared signatures feed new drafts without sending anything', () => {
  const library = require('../server/message-template-domain.mjs').templateCatalog.map(item => ({
    ...item, revision: 0, customized: false,
    ...(item.key === 'facility.acknowledge' ? { subject: 'Receipt: {{requester_name}}', message: item.message.replace(/^Hi |^Hoi /, item.language === 'en' ? 'Greetings ' : 'Grüezi ') } : {}),
    ...(item.key === 'shared.signature' ? { message: 'Example club office\n{{sender_name}}' } : {}),
  }));
  const ui = mount({ templateLibrary: library }), Panel = ui.load('CommunicationsPanel');
  const render = () => ui.render(Panel, { request, currentUser: user });
  assert.equal(find(render(), node => node.type === 'Input' && node.props.maxLength === 220).props.value, 'Receipt: Synthetic requester');
  assert.match(find(render(), node => node.type === 'Textarea').props.value, /^Greetings Synthetic requester,/);
  ui.language(render(), 'de');
  const message = find(render(), node => node.type === 'Textarea').props.value;
  assert.match(message, /^Grüezi Synthetic requester,/);
  assert.ok(message.endsWith('Example club office\nKenny'));
  assert.match(message, /keine Buchungsbestätigung/);
  assert.equal(ui.calls.length, 0);
});

test('late template loading preserves edited drafts and failed loads block email sends', async () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  const ui = mount({ templatePromise: promise }), Panel = ui.load('CommunicationsPanel');
  const render = () => ui.render(Panel, { request, currentUser: user });
  find(render(), node => node.type === 'Textarea').props.onChange({ target: { value: 'An already edited draft' } });
  const library = require('../server/message-template-domain.mjs').templateCatalog.map(item => ({ ...item,
    ...(item.key === 'facility.acknowledge' ? { message: item.message.replace(/^Hi |^Hoi /, 'Custom greeting ') } : {}),
  }));
  resolve(library);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(render(), node => node.type === 'Textarea').props.value, 'An already edited draft');
  ui.language(render(), 'de');
  assert.match(find(render(), node => node.type === 'Textarea').props.value, /^Custom greeting/);
  let reject;
  const broken = new Promise((_resolve, fail) => { reject = fail; });
  const failed = mount({ templatePromise: broken }), FailedPanel = failed.load('CommunicationsPanel');
  const renderFailed = () => failed.render(FailedPanel, { request, currentUser: user });
  renderFailed(); reject(new Error('Synthetic template outage'));
  await new Promise(resolve => setImmediate(resolve));
  const button = find(renderFailed(), node => node.type === 'Button' && node.props.children === 'Approve and send email');
  assert.equal(button.props.disabled, true);
  const form = find(renderFailed(), node => node.type === 'form' && node.props.className === 'space-y-3');
  form.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failed.calls.length, 0);
});

test('Settings preloads existing wording, previews safely and saves or resets only after explicit actions', async () => {
  const ui = mount(), Settings = ui.load('MessageTemplateSettings');
  const render = () => ui.render(Settings, { currentUser: user });
  const textarea = () => find(render(), node => node.type === 'Textarea');
  assert.match(textarea().props.value, /^Hi \{\{requester_name\}\},/);
  assert.equal(ui.calls.length, 0);
  textarea().props.onChange({ target: { value: 'Missing generated blocks' } });
  find(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(ui.calls.length, 0);
  assert.match(find(render(), node => node.type === 'p' && node.props.role === 'alert').props.children, /Keep/);
  const defaultContent = require('../server/message-template-domain.mjs').templateDefinition('facility.acknowledge', 'en');
  const custom = defaultContent.message.replace('Hi ', 'Greetings ');
  textarea().props.onChange({ target: { value: custom } });
  find(render(), node => node.type === 'Button' && node.props.children === 'Preview with sample data').props.onClick();
  const preview = find(render(), node => node.type === 'section' && node.props['aria-label'] === 'Sample message preview');
  assert.match(find(preview, node => node.type === 'p' && node.props.className.includes('whitespace-pre-wrap')).props.children, /^Greetings Example requester,/);
  assert.equal(ui.calls.length, 0);
  find(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(ui.calls[0], ['saveTemplate', 'facility.acknowledge', 'en', defaultContent.subject, custom, '']);
  find(render(), node => node.type === 'Button' && node.props.children === 'Reset to original').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(ui.calls[1], ['resetTemplate', 'facility.acknowledge', 'en']);
  assert.equal(textarea().props.value, defaultContent.message);
});

test('oversized generated event subjects surface a recoverable error rather than crashing the draft dialog', () => {
  const ui = mount(), Dialog = ui.load('../EventUpdateShareDialog');
  const event = { id: '1', title: 'x'.repeat(221), eventType: 'Practice', status: 'Planned', date: '2027-04-26', startTime: '18:00', endTime: '19:00', fieldIds: [], teamIds: [] };
  const tree = ui.render(Dialog, { isOpen: true, onClose() {}, event, originalEvent: null, teams: [], fields: [], sites: [], updateType: 'create', currentUser: user });
  const status = find(tree, node => node.props?.error?.includes('Generated subject'));
  assert.ok(status, 'Invalid rendered content must expose a template error');
  assert.equal(find(tree, node => node.type === 'Input').props.value, '');
  assert.equal(ui.calls.length, 0);
});

test('request rejection drafts offer German, retain edits and reset to English when reopened', () => {
  const ui = mount({ equipmentRequests: [{
    id: 8, type: 'equipment', status: 'Pending', date: request.date, createdAt: request.createdAt,
    requestorName: request.requestorName, requestorPhone: request.requestorPhone,
    equipmentDescription: 'Original equipment details',
  }] });
  const Manager = ui.load('RequestsManager');
  const render = () => ui.render(Manager, { currentUser: user });
  const open = () => find(render(), node => node.type === 'Button' &&
    React.Children.toArray(node.props.children).some(child => typeof child === 'string' && child.trim() === 'Reject')).props.onClick();
  const message = () => find(render(), node => node.props?.id === 'rejection-message');
  open();
  assert.match(message().props.value, /^Hi /);
  ui.language(render(), 'de');
  assert.match(message().props.value, /Ausrüstungsanfrage/);
  message().props.onChange({ target: { value: 'Eigener Entwurf' } });
  ui.language(render(), 'en');
  assert.match(message().props.value, /^Hi /);
  ui.language(render(), 'de');
  assert.equal(message().props.value, 'Eigener Entwurf');
  open();
  assert.match(message().props.value, /^Hi /);
  ui.language(render(), 'de');
  assert.match(message().props.value, /Ausrüstungsanfrage/);
  assert.equal(ui.calls.length, 0);
});

test('follow-up email drafts are signed and bilingual without inferring an approval', () => {
  const ui = mount(), Panel = ui.load('CommunicationsPanel');
  const render = () => ui.render(Panel, { request: { ...request, workflow: { stage: 'Awaiting response', contactEmail: 'office@example.invalid' } },
    currentUser: { ...user, username: 'operator', fullName: 'Alex Example' } });
  const message = () => find(render(), node => node.type === 'Textarea').props.value;
  assert.match(message(), /following up/);
  assert.ok(message().endsWith('Quick - Mean - Tough\nAlex Example'));
  ui.language(render(), 'de');
  assert.match(message(), /aktuellen Stand/);
  assert.match(message(), /Original details/);
  assert.doesNotMatch(message(), /wurde genehmigt|has been approved/);
  assert.ok(message().endsWith('Quick - Mean - Tough\nAlex Example'));
});

const event = {
  id: '12', title: 'Synthetic training', eventType: 'Practice', status: 'Confirmed', date: '2026-11-06',
  startTime: '18:00', endTime: '20:00', fieldIds: ['1'], teamIds: ['a'], notes: 'Original notes', isRecurring: false,
  sharedFieldBookings: [{ fieldId: '1', eventId: '13', title: 'Other booking', teamIds: ['b'],
    date: '2026-11-06', endDate: '2026-11-06', startTime: '19:00', endTime: '20:00' }],
};
const eventProps = {
  isOpen: true, onClose() {}, event, originalEvent: null, updateType: 'share', currentUser: user,
  teams: [{ id: 'a', name: 'Youth', headCoach: { email: 'coach@example.invalid' } }, { id: 'b', name: 'Seniors' }],
  fields: [{ id: '1', name: 'Main field', siteId: '1' }],
  sites: [{ id: '1', name: 'Synthetic site', contactEmail: 'office@example.invalid' }],
};

test('event sharing and email use the exact edited language-specific draft and recorded recipients', async () => {
  const ui = mount(), Dialog = ui.load('../EventUpdateShareDialog');
  const render = () => ui.render(Dialog, eventProps);
  const message = () => find(render(), node => node.type === 'Textarea');
  const subject = () => find(render(), node => node.type === 'Input' && node.props.type !== 'email');
  assert.match(message().props.value, /Event details for your reference/);
  message().props.onChange({ target: { value: 'Edited English message' } });
  subject().props.onChange({ target: { value: 'Edited English subject' } });
  ui.language(render(), 'de');
  assert.match(message().props.value, /Gemeinsam genutztes Spielfeld.*nicht exklusiv/);
  assert.match(message().props.value, /gemeinsam mit Seniors/);
  assert.match(message().props.value, /Typ: Training/);
  assert.match(message().props.value, /Status: Bestätigt/);
  assert.match(message().props.value, /Notizen: Original notes/);
  assert.match(message().props.value, /Diese Nachricht wurde automatisch von QMT erstellt\./);
  assert.ok(message().props.value.endsWith('Quick - Mean - Tough\nKenny'));
  message().props.onChange({ target: { value: 'Bearbeitete Nachricht & Notizen\nQuick - Mean - Tough\nKenny' } });
  subject().props.onChange({ target: { value: 'Eigener Betreff & Details' } });
  ui.language(render(), 'en');
  assert.equal(message().props.value, 'Edited English message');
  assert.equal(subject().props.value, 'Edited English subject');
  ui.language(render(), 'de');
  const edited = message().props.value;
  assert.equal(message().props.lang, 'de');
  assert.equal(ui.calls.length, 0);
  await find(render(), node => node.type === 'Button' &&
    React.Children.toArray(node.props.children).includes('Share / WhatsApp')).props.onClick();
  assert.deepEqual(ui.calls, [['share', { text: edited, title: subject().props.value }]]);
  await find(render(), node => node.type === 'Button' &&
    React.Children.toArray(node.props.children).includes('Open email draft')).props.onClick();
  const mailto = new URL(ui.mailto());
  assert.equal(mailto.pathname, 'office@example.invalid,coach@example.invalid');
  assert.equal(mailto.searchParams.get('subject'), subject().props.value);
  assert.equal(mailto.searchParams.get('body'), edited);
  assert.equal(ui.calls.length, 1, 'Opening a normal email draft never calls a sending API');
});

test('custom template recipients feed email drafts, allow per-message edits and preserve transport CC', async () => {
  const templateLibrary = require('../server/message-template-domain.mjs').templateCatalog.map(item => ({ ...item,
    recipient: item.key === 'event.transport' || item.key === 'facility.acknowledge' ? 'custom@example.invalid' : '',
  }));
  const ui = mount({ templateLibrary }), Panel = ui.load('CommunicationsPanel');
  const render = () => ui.render(Panel, { request, currentUser: user });
  const recipient = () => find(render(), node => node.type === 'Input' && node.props.type === 'email');
  assert.equal(recipient().props.value, 'custom@example.invalid');
  const approval = () => find(render(), node => node.type === 'input' && node.props.type === 'checkbox');
  approval().props.onChange({ target: { checked: true } });
  recipient().props.onChange({ target: { value: 'reviewed@example.invalid' } });
  assert.equal(approval().props.checked, false);
  assert.equal(recipient().props.value, 'reviewed@example.invalid');
  const eventUi = mount({ templateLibrary }), Dialog = eventUi.load('../EventUpdateShareDialog');
  const renderEvent = () => eventUi.render(Dialog, { ...eventProps, updateType: 'transport' });
  assert.equal(find(renderEvent(), node => node.type === 'Input' && node.props.type === 'email').props.value, 'custom@example.invalid');
  await find(renderEvent(), node => node.type === 'Button' && React.Children.toArray(node.props.children).includes('Open email draft')).props.onClick();
  const mailto = new URL(eventUi.mailto());
  assert.equal(mailto.pathname, 'custom@example.invalid');
  assert.equal(mailto.searchParams.get('cc'), 'coach@example.invalid');
});

test('create, update, cancellation and transport templates retain localized details and the actual signer', async () => {
  for (const action of ['create', 'update', 'cancel', 'transport']) {
    const ui = mount(), Dialog = ui.load('../EventUpdateShareDialog');
    const props = { ...eventProps, updateType: action, currentUser: { ...user, username: 'operator', fullName: 'Alex Example' },
      event: { ...event, status: action === 'cancel' ? 'Cancelled' : 'Confirmed',
        ...(action === 'transport' ? { eventType: 'Game', gameLocation: 'away',
          awayStreet: 'Synthetic street', awayZip: '8000', awayCity: 'Synthetic city' } : {}) },
      originalEvent: { ...event, startTime: '17:00', status: 'Planned' } };
    const render = () => ui.render(Dialog, props);
    ui.language(render(), 'de');
    const draft = find(render(), node => node.type === 'Textarea').props.value;
    assert.ok(draft.endsWith('Quick - Mean - Tough\nAlex Example'));
    assert.match(draft, /Diese Nachricht wurde automatisch von QMT erstellt\./);
    assert.match(draft, /Geplante Dauer: 2 Stunden/);
    assert.match(draft, /Original notes/);
    assert.doesNotMatch(draft, /Club operations|Unknown|Before:|After:|CHANGES:|Shared field/);
    if (action === 'update') {
      assert.match(draft, /ÄNDERUNGEN/);
      assert.match(draft, /Vorher: 17:00 - 20:00/);
      assert.match(draft, /Nachher: 18:00 - 20:00/);
      assert.match(draft, /Vorher: Geplant/);
      assert.match(draft, /Nachher: Bestätigt/);
    } else if (action === 'cancel') {
      assert.match(draft, /ABGESAGT/);
      assert.match(draft, /Status: Abgesagt/);
    } else if (action === 'create') {
      assert.match(draft, /neue Veranstaltung/);
    } else {
      assert.match(draft, /^Hoi Transportteam,/);
      assert.match(draft, /Synthetic street, 8000, Synthetic city/);
      await find(render(), node => node.type === 'Button' &&
        React.Children.toArray(node.props.children).includes('Open email draft')).props.onClick();
      const mailto = new URL(ui.mailto());
      assert.equal(mailto.pathname, 'transport@example.invalid');
      assert.equal(mailto.searchParams.get('cc'), 'coach@example.invalid');
      assert.equal(mailto.searchParams.get('body'), draft);
      assert.deepEqual(JSON.parse(JSON.stringify(ui.calls)), [['apiRequest', '/events/12/transport-request', { method: 'POST' }]]);
    }
    assert.equal(find(render(), node => node.type === 'Button' &&
      React.Children.toArray(node.props.children).includes('Push to Spond')), undefined);
  }
});

test('event and weekly templates use friendly bilingual closings without implying automated delivery or review', () => {
  for (const language of ['en', 'de']) {
    const ui = mount();
    const { eventMessageDraft } = ui.loadLibrary('eventMessages');
    const { notifyWeeklySummary } = ui.loadLibrary('whatsappService');
    const note = language === 'de' ? 'Diese Nachricht wurde automatisch von QMT erstellt.'
      : 'This message was generated by QMT.';
    for (const action of ['create', 'update', 'cancel', 'share', 'transport']) {
      const { message } = eventMessageDraft(event, null, action, eventProps.teams, eventProps.fields, eventProps.sites, user, language);
      assert.ok(message.includes(note), `${action}/${language} identifies QMT generation`);
      assert.match(message, language === 'de' ? /^Hoi / : /^Hi /);
      assert.doesNotMatch(message, /automatically sent|automatisch versandt|human.reviewed|menschlich geprüft/);
    }
    notifyWeeklySummary([event], eventProps.teams, eventProps.fields, eventProps.sites, user, language, {});
    assert.equal(ui.calls.length, 1);
    const [action, shared] = ui.calls[0];
    assert.equal(action, 'share');
    assert.ok(shared.text.includes(note));
    assert.match(shared.text, language === 'de' ? /^Hoi zusammen,/ : /^Hi everyone,/);
    assert.match(shared.text, /Synthetic training/);
    assert.ok(shared.text.endsWith('Quick - Mean - Tough\nKenny'));
  }
});
