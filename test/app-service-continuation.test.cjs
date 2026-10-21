const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertContinuationChanges } = require('../scripts/review-app-service-continuation.cjs');
const scope = '/subscriptions/11111111-2222-3333-4444-555555555555/resourceGroups/qmt-production';
const acceptanceId = '11111111-2222-3333-4444-555555555555';
const id = suffix => `${scope}/providers/${suffix}`;
function fixture() {
  const tags = { solution: 'QMT', platform: 'errandom', acceptanceId };
  const resource = (suffix, properties) => ({ id: id(suffix), location: 'switzerlandnorth', tags, properties });
  const live = {
    group: { id: scope, location: 'switzerlandnorth', tags },
    plan: { ...resource('Microsoft.Web/serverfarms/qmt-production-plan', {
      reserved: true, freeOfferExpirationTime: '2026-11-20T12:00:00Z',
    }), sku: { name: 'B1', capacity: 1 } },
    subnet: resource('Microsoft.Network/virtualNetworks/qmt-production-network/subnets/app', {
      addressPrefix: '10.47.0.0/26', delegations: [{ properties: { serviceName: 'Microsoft.Web/serverFarms' } }],
      privateEndpointNetworkPolicies: 'Disabled',
      serviceEndpoints: [{ service: 'Microsoft.Sql', locations: ['switzerlandnorth'] }],
    }),
    network: resource('Microsoft.Network/virtualNetworks/qmt-production-network', {
      addressSpace: { addressPrefixes: ['10.47.0.0/24'] },
      privateEndpointVNetPolicies: 'Disabled',
      subnets: [{ id: id('Microsoft.Network/virtualNetworks/qmt-production-network/subnets/app') }],
    }),
    environment: resource('Microsoft.App/managedEnvironments/qmt-production-budget', {
      workloadProfiles: [{ workloadProfileType: 'Consumption' }],
      peerAuthentication: { mtls: { enabled: false } },
      peerTrafficConfiguration: { encryption: { enabled: false } },
      appLogsConfiguration: { destination: 'log-analytics', logAnalyticsConfiguration: { customerId: 'synthetic-workspace' } },
    }),
    workspace: resource('Microsoft.OperationalInsights/workspaces/qmt-production-logs', {
      customerId: 'synthetic-workspace', sku: { name: 'PerGB2018' },
      retentionInDays: 30, workspaceCapping: { dailyQuotaGb: 1 },
    }),
  };
  const server = id('Microsoft.Sql/servers/qmt-production-aaaaaaaaaaaaa');
  const site = id('Microsoft.Web/sites/qmt-production-aaaaaaaaaaaaa');
  const expectedIds = [scope, ...['environment', 'network', 'subnet', 'workspace', 'plan'].map(key => live[key].id),
    server, `${server}/connectionPolicies/default`, `${server}/databases/qmt-production`,
    `${server}/databases/qmt-production/backupLongTermRetentionPolicies/default`,
    `${server}/databases/qmt-production/backupShortTermRetentionPolicies/default`,
    `${server}/virtualNetworkRules/qmt-app-subnet`, site, `${site}/basicPublishingCredentialsPolicies/ftp`,
    `${site}/basicPublishingCredentialsPolicies/scm`, `${site}/config/logs`,
    `${site}/providers/Microsoft.Insights/diagnosticSettings/qmt-console`];
  const changes = expectedIds.map(resourceId => ({ resourceId, changeType: 'Create' }));
  const delta = (path, propertyChangeType, before, after) => ({ path, propertyChangeType, before, after });
  const modify = (key, deltas) => Object.assign(changes.find(change => change.resourceId === live[key].id),
    { changeType: 'Modify', delta: deltas, after: live[key] });
  modify('environment', [
    delta('properties.appLogsConfiguration.logAnalyticsConfiguration.customerId', 'Modify', 'synthetic-workspace',
      `[reference('${live.workspace.id}', '2023-09-01').customerId]`),
    delta('properties.peerAuthentication', 'Delete', { mtls: { enabled: false } }),
    delta('properties.peerTrafficConfiguration', 'Delete', { encryption: { enabled: false } }),
  ]);
  modify('network', [
    delta('properties.privateEndpointVNetPolicies', 'Delete', 'Disabled'),
    delta('properties.subnets[0].properties.serviceEndpoints[0].locations', 'NoEffect', undefined, ['switzerlandnorth']),
    delta('properties.subnets[0].type', 'NoEffect', undefined, 'Microsoft.Network/virtualNetworks/subnets'),
  ]);
  modify('subnet', [
    delta('properties.privateEndpointNetworkPolicies', 'Modify', 'Disabled', 'Enabled'),
    delta('properties.serviceEndpoints[0].locations', 'NoEffect', undefined, ['switzerlandnorth']),
  ]);
  modify('plan', [
    delta('properties.freeOfferExpirationTime', 'Delete', live.plan.properties.freeOfferExpirationTime),
    delta('sku.tier', 'NoEffect', undefined, 'Basic'),
  ]);
  return { changes, expectedIds, scope, acceptanceId, live };
}
test('continuation accepts only the exact independently checked provider-default reconciliation', () => {
  const input = fixture();
  input.live.plan.location = 'Switzerland North';
  input.live.environment.location = 'Switzerland North';
  assert.deepEqual(assertContinuationChanges(input),
    { status: 'reviewed_continuation', resources: 17, reviewedModifications: 4 });
});
test('continuation rejects extra, missing, duplicate, destructive and foreign resources', () => {
  for (const mutate of [
    input => input.changes.pop(),
    input => input.changes.push(input.changes[0]),
    input => { input.changes[0] = input.changes[1]; },
    input => { input.changes[0].changeType = 'Delete'; },
    input => { input.changes[0].resourceId = scope.replace('qmt-production', 'ARGOS'); },
    input => { input.expectedIds[0] = input.expectedIds[1]; },
    input => { input.scope = scope.replace('qmt-production', 'ARGOS'); },
  ]) {
    const input = fixture(); mutate(input);
    assert.throws(() => assertContinuationChanges(input));
  }
});
test('continuation refuses changed ownership, paid capacity, networking and monitoring', () => {
  for (const mutate of [
    live => { live.group.tags.acceptanceId = 'foreign'; },
    live => { live.plan.location = 'Switzerland West'; },
    live => { live.plan.sku.capacity = 2; },
    live => { live.plan.sku.name = 'P1v3'; },
    live => { live.plan.properties.reserved = false; },
    live => { live.environment.properties.workloadProfiles.push({ workloadProfileType: 'D4' }); },
    live => { live.workspace.properties.workspaceCapping.dailyQuotaGb = 10; },
    live => { live.workspace.properties.customerId = 'different'; },
    live => { live.network.properties.subnets.push({ id: 'other' }); },
    live => { live.subnet.properties.privateEndpoints = [{ id: 'other' }]; },
    live => { live.environment.properties.peerAuthentication.mtls.enabled = true; },
    live => { live.subnet.properties.privateEndpointNetworkPolicies = 'Enabled'; },
    live => { live.subnet.properties.serviceEndpoints[0].service = 'Microsoft.Storage'; },
    live => { live.subnet.properties.delegations[0].properties.serviceName = 'other'; },
    live => { live.plan.properties.freeOfferExpirationTime = 'unverified'; },
  ]) {
    const input = fixture(); mutate(input.live);
    assert.throws(() => assertContinuationChanges(input));
  }
});
test('continuation rejects any unreviewed delta, changed default, reference substitution or hidden child change', () => {
  for (const mutate of [
    deltas => deltas.push({ path: 'sku.capacity', propertyChangeType: 'Modify', before: 1, after: 2 }),
    deltas => { deltas[0].after = 'foreign-workspace'; },
    deltas => { deltas[1].before.mtls.enabled = true; },
    deltas => { deltas[0].children = [{ path: 'unknown' }]; },
    deltas => { deltas[1] = deltas[0]; },
  ]) {
    const input = fixture();
    mutate(input.changes.find(change => change.resourceId === input.live.environment.id).delta);
    assert.throws(() => assertContinuationChanges(input));
  }
});
