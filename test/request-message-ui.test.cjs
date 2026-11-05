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
  let state, cursor = 0, ids = 0;
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
    useEffect() {},
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
      exports: {}, crypto: { randomUUID: () => 'synthetic-send-id' },
      window: browser,
      navigator: {
        clipboard: { async writeText(text) { calls.push(['copy', text]); } },
        async share(value) { calls.push(['share', { ...value }]); },
      },
      require(id) {
        if (id === 'react') return react;
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
          requestedDates: () => [], operationsApi: { send: async (...args) => calls.push(['send', ...args]) },
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
  assert.match(find(render(), node => node.type === 'Textarea').props.value, /Please evaluate/);
  ui.language(render(), 'de');
  const draft = find(render(), node => node.type === 'Textarea').props.value;
  assert.match(draft, /Bitte prüfen Sie die folgende Anfrage/);
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
  assert.match(message().props.value, /^Hallo /);
  message().props.onChange({ target: { value: 'Deutsche Nachricht' } });
  ui.language(render(), 'en');
  assert.equal(subject().props.value, 'Custom English subject');
  assert.equal(message().props.value, 'Custom English message');
  ui.language(render(), 'de');
  assert.equal(message().props.value, 'Deutsche Nachricht');
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
  const subject = () => find(render(), node => node.type === 'Input');
  assert.match(message().props.value, /Event details for your reference/);
  message().props.onChange({ target: { value: 'Edited English message' } });
  subject().props.onChange({ target: { value: 'Edited English subject' } });
  ui.language(render(), 'de');
  assert.match(message().props.value, /Gemeinsam genutztes Spielfeld.*nicht exklusiv/);
  assert.match(message().props.value, /gemeinsam mit Seniors/);
  assert.match(message().props.value, /Typ: Training/);
  assert.match(message().props.value, /Status: Bestätigt/);
  assert.match(message().props.value, /Notizen: Original notes/);
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
      assert.match(draft, /Liebes Transportteam/);
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
