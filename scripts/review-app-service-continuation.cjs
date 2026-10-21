const { isDeepStrictEqual: equal } = require('node:util');

function assertContinuationChanges({ changes, expectedIds, scope, acceptanceId, live }) {
  if (!/^\/subscriptions\/[a-f0-9-]{36}\/resourceGroups\/qmt-production$/i.test(scope || '')
    || !/^[a-f0-9-]{36}$/i.test(acceptanceId || '') || !Array.isArray(changes)
    || !Array.isArray(expectedIds) || expectedIds.length !== 17 || changes.length !== 17) {
    throw new Error('Continuation requires the exact approved 17-resource manifest and owned production scope');
  }
  const expected = new Set(expectedIds.map(id => id.toLowerCase()));
  if (expected.size !== 17 || expectedIds.some(id => id.toLowerCase() !== scope.toLowerCase()
    && !id.toLowerCase().startsWith(`${scope.toLowerCase()}/providers/`))) {
    throw new Error('Continuation manifest contains duplicate or foreign resources');
  }
  for (const change of changes) {
    if (!expected.delete(change.resourceId?.toLowerCase())
      || !['Create', 'NoChange', 'Modify'].includes(change.changeType)) {
      throw new Error('Continuation has an unexpected resource or change type');
    }
  }
  const group = live?.group, plan = live?.plan, network = live?.network;
  const subnet = live?.subnet, environment = live?.environment, workspace = live?.workspace;
  const id = suffix => `${scope}/providers/${suffix}`;
  const ids = {
    plan: id('Microsoft.Web/serverfarms/qmt-production-plan'),
    network: id('Microsoft.Network/virtualNetworks/qmt-production-network'),
    subnet: id('Microsoft.Network/virtualNetworks/qmt-production-network/subnets/app'),
    environment: id('Microsoft.App/managedEnvironments/qmt-production-budget'),
    workspace: id('Microsoft.OperationalInsights/workspaces/qmt-production-logs'),
  };
  if (group?.id?.toLowerCase() !== scope.toLowerCase() || group.tags?.acceptanceId !== acceptanceId
    || [group, plan, network, environment, workspace].some(resource => resource?.location?.replaceAll(' ', '').toLowerCase() !== 'switzerlandnorth'
      || resource.tags?.solution !== 'QMT' || resource.tags?.platform !== 'errandom')
    || Object.entries(ids).some(([key, value]) => live[key]?.id?.toLowerCase() !== value.toLowerCase())) {
    throw new Error('Independent continuation resource ownership was not verified');
  }
  if (plan.sku?.name !== 'B1' || plan.sku?.capacity !== 1 || plan.properties?.reserved !== true
    || environment.properties?.workloadProfiles?.length !== 1
    || environment.properties.workloadProfiles[0].workloadProfileType !== 'Consumption'
    || workspace.properties?.sku?.name !== 'PerGB2018' || workspace.properties.retentionInDays !== 30
    || workspace.properties.workspaceCapping?.dailyQuotaGb !== 1
    || !equal(network.properties?.addressSpace?.addressPrefixes, ['10.47.0.0/24'])
    || network.properties?.subnets?.length !== 1
    || network.properties.subnets[0].id?.toLowerCase() !== ids.subnet.toLowerCase()
    || subnet.properties?.addressPrefix !== '10.47.0.0/26'
    || subnet.properties?.delegations?.length !== 1
    || subnet.properties.delegations[0].properties?.serviceName !== 'Microsoft.Web/serverFarms'
    || subnet.properties?.serviceEndpoints?.length !== 1
    || subnet.properties.serviceEndpoints[0].service !== 'Microsoft.Sql'
    || !equal(subnet.properties.serviceEndpoints[0].locations, ['switzerlandnorth'])
    || subnet.properties.privateEndpoints?.length
    || network.properties.privateEndpointVNetPolicies !== 'Disabled'
    || subnet.properties.privateEndpointNetworkPolicies !== 'Disabled'
    || environment.properties.peerAuthentication?.mtls?.enabled !== false
    || environment.properties.peerTrafficConfiguration?.encryption?.enabled !== false
    || environment.properties.appLogsConfiguration?.destination !== 'log-analytics'
    || !workspace.properties.customerId
    || environment.properties.appLogsConfiguration?.logAnalyticsConfiguration?.customerId !== workspace.properties.customerId) {
    throw new Error('Independent continuation hosting, networking or monitoring invariants changed');
  }
  const tuple = (path, propertyChangeType, before, after) => ({ path, propertyChangeType, before, after });
  const reference = `[reference('${ids.workspace}', '2023-09-01').customerId]`;
  const reviewed = new Map([
    [ids.environment.toLowerCase(), [
      tuple('properties.appLogsConfiguration.logAnalyticsConfiguration.customerId', 'Modify', workspace.properties.customerId, reference),
      tuple('properties.peerAuthentication', 'Delete', { mtls: { enabled: false } }, undefined),
      tuple('properties.peerTrafficConfiguration', 'Delete', { encryption: { enabled: false } }, undefined),
    ]],
    [ids.network.toLowerCase(), [
      tuple('properties.privateEndpointVNetPolicies', 'Delete', 'Disabled', undefined),
      tuple('properties.subnets[0].properties.serviceEndpoints[0].locations', 'NoEffect', undefined, ['switzerlandnorth']),
      tuple('properties.subnets[0].type', 'NoEffect', undefined, 'Microsoft.Network/virtualNetworks/subnets'),
    ]],
    [ids.subnet.toLowerCase(), [
      tuple('properties.privateEndpointNetworkPolicies', 'Modify', 'Disabled', 'Enabled'),
      tuple('properties.serviceEndpoints[0].locations', 'NoEffect', undefined, ['switzerlandnorth']),
    ]],
    [ids.plan.toLowerCase(), [
      tuple('properties.freeOfferExpirationTime', 'Delete', plan.properties.freeOfferExpirationTime, undefined),
      tuple('sku.tier', 'NoEffect', undefined, 'Basic'),
    ]],
  ]);
  let modifications = 0;
  for (const change of changes.filter(change => change.changeType === 'Modify')) {
    const allowed = reviewed.get(change.resourceId.toLowerCase());
    const deltas = change.delta;
    if (!allowed || !Array.isArray(deltas) || deltas.length !== allowed.length
      || new Set(deltas.map(delta => delta.path)).size !== deltas.length
      || deltas.some(delta => Object.keys(delta).some(key => !['path', 'propertyChangeType', 'before', 'after'].includes(key))
        || !allowed.some(item => equal(tuple(delta.path, delta.propertyChangeType, delta.before, delta.after), item)))) {
      throw new Error('Continuation modifies an unreviewed property; deployment remains blocked');
    }
    if (change.resourceId.toLowerCase() === ids.plan.toLowerCase()
      && (!Number.isFinite(Date.parse(plan.properties.freeOfferExpirationTime))
        || change.after?.sku?.name !== 'B1' || change.after.sku.capacity !== 1)) {
      throw new Error('Continuation plan size or provider-generated expiry is unverified');
    }
    modifications++;
  }
  return { status: 'reviewed_continuation', resources: changes.length, reviewedModifications: modifications };
}

module.exports = { assertContinuationChanges };
