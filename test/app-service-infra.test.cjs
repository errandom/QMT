const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '..', 'infra', 'app-service.bicep'), 'utf8');

test('B1 alternative is a single Linux worker, always-on after explicit acceptance enablement', () => {
  assert.match(template, /@allowed\(\['switzerlandnorth'\]\)/);
  assert.match(template, /param appEnabled bool = false/);
  assert.match(template, /enabled: appEnabled/);
  assert.match(template, /sku: \{ name: 'B1', tier: 'Basic', capacity: 1 \}/);
  assert.match(template, /reserved: true/);
  assert.match(template, /alwaysOn: true/);
  assert.match(template, /numberOfWorkers: 1/);
  assert.match(template, /healthCheckPath: '\/api\/health'/);
  assert.match(template, /linuxFxVersion: 'DOCKER\|\$\{imageRepository\}@sha256:\$\{imageDigest\}'/);
  assert.doesNotMatch(template, /autoscale|deploymentSlots|Premium|registryPassword/);
});

test('B1 SQL networking uses only a delegated QMT subnet service endpoint, not broad Azure/IP access', () => {
  assert.match(template, /serviceName: 'Microsoft.Web\/serverFarms'/);
  assert.match(template, /service: 'Microsoft.Sql', locations: \[location\]/);
  assert.match(template, /virtualNetworkSubnetId: subnet.id/);
  assert.match(template, /ignoreMissingVnetServiceEndpoint: false/);
  assert.match(template, /connectionType: 'Proxy'/);
  assert.match(template, /module database '\.\/database.bicep'/);
  assert.doesNotMatch(template, /firewallRules|0\.0\.0\.0|natGateways|publicIPAddresses|privateEndpoints/);
});

test('B1 keeps admin credentials out of app settings and owns its monitoring and guard environment', () => {
  const app = template.split("resource app 'Microsoft.Web/sites@")[1].split("resource ftpPolicy '")[0];
  assert.doesNotMatch(app, /sqlAdministrator/);
  assert.match(app, /name: 'SQL_USER', value: sqlUser/);
  assert.match(app, /name: 'SQL_PASSWORD', value: sqlPassword/);
  assert.match(app, /name: 'WEBSITES_PORT', value: '3000'/);
  assert.match(app, /name: 'QMT_AI_ENABLED', value: 'false'/);
  assert.match(template, /retentionInDays: 30/);
  assert.match(template, /workspaceCapping: \{ dailyQuotaGb: 1 \}/);
  assert.match(template, /workspaceId: workspace.id/);
  assert.match(template, /logWorkspaceName: workspace.name/);
  assert.match(template, /logWorkspaceResourceGroup: resourceGroup\(\).name/);
  assert.match(template, /logAnalyticsDestinationType: 'Dedicated'/);
  assert.match(template, /name: 'ftp'[\s\S]*?allow: false/);
  assert.match(template, /name: 'scm'[\s\S]*?allow: false/);
});
