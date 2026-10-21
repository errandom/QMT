const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'prepare-app-service.ps1');
const template = fs.readFileSync(path.join(__dirname, '..', 'infra', 'app-service-acceptance.bicep'), 'utf8');
const subscription = '11111111-2222-3333-4444-555555555555';
const scope = `/subscriptions/${subscription}/resourceGroups/qmt-production`;
const image = `ghcr.io/errandom/qmt@sha256:${'a'.repeat(64)}`;

function foundationChanges() {
  const name = `qmt-production-${'a'.repeat(13)}`;
  const server = `/providers/Microsoft.Sql/servers/${name}`;
  const site = `/providers/Microsoft.Web/sites/${name}`;
  return [
    '', '/providers/Microsoft.App/managedEnvironments/qmt-production-budget',
    '/providers/Microsoft.Network/virtualNetworks/qmt-production-network',
    '/providers/Microsoft.Network/virtualNetworks/qmt-production-network/subnets/app',
    '/providers/Microsoft.OperationalInsights/workspaces/qmt-production-logs',
    server, `${server}/connectionPolicies/default`, `${server}/databases/qmt-production`,
    `${server}/databases/qmt-production/backupLongTermRetentionPolicies/default`,
    `${server}/databases/qmt-production/backupShortTermRetentionPolicies/default`,
    `${server}/virtualNetworkRules/qmt-app-subnet`,
    '/providers/Microsoft.Web/serverfarms/qmt-production-plan', site,
    `${site}/basicPublishingCredentialsPolicies/ftp`, `${site}/basicPublishingCredentialsPolicies/scm`,
    `${site}/config/logs`, `${site}/providers/Microsoft.Insights/diagnosticSettings/qmt-console`,
  ].map(suffix => ({
    resourceId: scope + suffix, changeType: 'Create',
    after: suffix.includes('/serverfarms/')
      ? { kind: 'linux', sku: { name: 'B1', capacity: 1 } }
      : suffix === site ? { properties: { enabled: false } }
        : suffix === `${server}/databases/qmt-production`
          ? { sku: { name: 'Basic' }, properties: { maxSizeBytes: 2147483648 } } : {},
  }));
}

function run({ changes = foundationChanges(), azure = true, fail = false, extra = '' } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmt-preflight-'));
  const output = path.join(directory, 'template.json');
  const body = `
    $global:commands = [System.Collections.Generic.List[string]]::new()
    function global:az {
      $global:commands.Add(($args -join ' '))
      $global:LASTEXITCODE = 0
      if ($args[0] -eq 'bicep') { return }
      if (${fail ? '$true' : '$false'}) { $global:LASTEXITCODE = 9; return }
      '${JSON.stringify({ status: 'Succeeded', changes })}'
    }
    try {
      & '${script.replaceAll("'", "''")}' -SubscriptionId '${subscription}' -Image '${image}' -OutputPath '${output.replaceAll("'", "''")}' ${azure ? '-AzureWhatIf' : ''} ${extra}
      if ($null -ne $Error[0]) { throw $Error[0] }
      $status = 0
    } catch {
      [Console]::Error.WriteLine($_.Exception.Message)
      $status = 1
    }
    [Console]::Out.WriteLine('QMT_COMMANDS=' + (ConvertTo-Json -InputObject @($global:commands.ToArray()) -Compress))
    exit $status
  `;
  try {
    const result = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', body], { encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    const marker = result.stdout.split(/\r?\n/).find(line => line.startsWith('QMT_COMMANDS='));
    return { ...result, commands: marker ? JSON.parse(marker.slice('QMT_COMMANDS='.length)) : [] };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('subscription foundation creates only its QMT group and disabled app module', () => {
  assert.match(template, /targetScope = 'subscription'/);
  assert.match(template, /@allowed\(\['qmt-production', 'qmt-staging'\]\)/);
  assert.match(template, /resource group 'Microsoft.Resources\/resourceGroups@2024-03-01'/);
  assert.match(template, /scope: group/);
  assert.match(template, /appEnabled: false/);
  assert.equal((template.match(/^resource /gm) || []).length, 1);
  assert.equal((template.match(/^module /gm) || []).length, 1);
  assert.doesNotMatch(template, /ARGOS|param appEnabled|output .*Password|output .*Secret/);
});

test('default preparation compiles locally without an Azure request', () => {
  const result = run({ azure: false });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.commands.length, 1);
  assert.match(result.commands[0], /^bicep build /);
});

test('explicit what-if uses exact subscription, provider validation and synthetic credentials without deployment', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.commands.length, 2);
  assert.match(result.commands[1], new RegExp(`^deployment sub what-if --subscription ${subscription} `));
  assert.match(result.commands[1], /--validation-level Provider /);
  assert.match(result.commands[1], /Qmt-Preview-Admin-Only/);
  assert.doesNotMatch(result.commands.join('\n'), /deployment sub create|group create|account set|--confirm-with-what-if/);
});

test('provider errors fail without attempting another operation', () => {
  const result = run({ fail: true });
  assert.equal(result.status, 1);
  assert.equal(result.commands.length, 2);
  assert.match(result.stderr, /Azure B1 what-if failed/);
});

test('fresh preflight rejects destructive, unresolved, empty and cross-venture change sets', () => {
  const cases = [[], [
    ...foundationChanges(), { resourceId: scope.replace('qmt-production', 'ARGOS'), changeType: 'Create' },
  ]];
  for (const type of ['Delete', 'Modify', 'Ignore', 'Deploy', 'NoChange']) {
    const changes = foundationChanges();
    changes[0].changeType = type;
    cases.push(changes);
  }
  for (const changes of cases) {
    const result = run({ changes });
    assert.equal(result.status, 1, JSON.stringify(changes));
    assert.equal(result.commands.length, 2);
  }
});

test('unrelated ignored resources do not become authorized writes', () => {
  const result = run({ changes: [
    ...foundationChanges(),
    { resourceId: scope.replace('qmt-production', 'ARGOS'), changeType: 'Ignore' },
  ] });
  assert.equal(result.status, 0, result.stderr);
});

test('preflight rejects missing resources, extra paid resources and changed SKU or app isolation', () => {
  const cases = [foundationChanges().slice(1), [
    ...foundationChanges(), { resourceId: `${scope}/providers/Microsoft.Storage/storageAccounts/extra`, changeType: 'Create' },
  ]];
  for (const [part, mutate] of [
    ['/serverfarms/', row => { row.after.sku.name = 'P1v3'; }],
    ['/serverfarms/', row => { row.after.sku.capacity = 2; }],
    ['/databases/qmt-production', row => { row.after.sku.name = 'S0'; }],
    [`/sites/qmt-production-${'a'.repeat(13)}`, row => { row.after.properties.enabled = true; }],
  ]) {
    const changes = foundationChanges();
    mutate(changes.find(row => row.resourceId.endsWith(part) || row.resourceId.includes(part) && part === '/serverfarms/'));
    cases.push(changes);
  }
  for (const changes of cases) {
    const result = run({ changes });
    assert.equal(result.status, 1);
  }
});

test('another resource group is rejected before compilation or Azure access', () => {
  const result = run({ extra: '-AppName ARGOS' });
  assert.equal(result.status, 1);
  assert.deepEqual(result.commands, []);
});
