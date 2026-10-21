targetScope = 'resourceGroup'

@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'
@allowed(['qmt-production', 'qmt-staging'])
param appName string = 'qmt-production'
@description('Public QMT OCI repository without a tag or digest. No registry or credentials are created.')
param imageRepository string
@minLength(64)
@maxLength(64)
param imageDigest string
param sqlAdministrator string
@secure()
param sqlAdministratorPassword string
@description('Separate, least-privilege database user; create it through the approved bootstrap procedure.')
param sqlUser string
@secure()
param sqlPassword string
@secure()
@minLength(32)
param jwtSecret string
param clubName string = 'QMT by errandom'
param transportEmail string = ''
@description('Keep the app disabled until migrations, the application SQL principal and acceptance authorization are ready. The B1 plan is billed even while disabled or stopped.')
param appEnabled bool = false

var uniqueName = '${appName}-${uniqueString(resourceGroup().id)}'
var tags = { solution: 'QMT', platform: 'errandom', costProfile: 'bounded-production' }

resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${appName}-network'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.47.0.0/24'] }
  }
}
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: network
  name: 'app'
  properties: {
    addressPrefix: '10.47.0.0/26'
    delegations: [
      { name: 'app-service', properties: { serviceName: 'Microsoft.Web/serverFarms' } }
    ]
    serviceEndpoints: [
      { service: 'Microsoft.Sql', locations: [location] }
    ]
  }
}
resource server 'Microsoft.Sql/servers@2023-08-01' = {
  name: uniqueName
  location: location
  tags: tags
  properties: {
    version: '12.0'
    administratorLogin: sqlAdministrator
    administratorLoginPassword: sqlAdministratorPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}
resource sqlNetworkRule 'Microsoft.Sql/servers/virtualNetworkRules@2023-08-01' = {
  parent: server
  name: 'qmt-app-subnet'
  properties: {
    virtualNetworkSubnetId: subnet.id
    ignoreMissingVnetServiceEndpoint: false
  }
}
resource connectionPolicy 'Microsoft.Sql/servers/connectionPolicies@2023-08-01' = {
  parent: server
  name: 'default'
  properties: { connectionType: 'Proxy' }
}
module database './database.bicep' = {
  name: '${appName}-database'
  params: { serverName: server.name, databaseName: appName, location: location }
}
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${appName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: 'B1', tier: 'Basic', capacity: 1 }
  properties: {
    reserved: true
    perSiteScaling: false
  }
}
resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: uniqueName
  location: location
  tags: tags
  kind: 'app,linux,container'
  properties: {
    enabled: appEnabled
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: subnet.id
    vnetRouteAllEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOCKER|${imageRepository}@sha256:${imageDigest}'
      alwaysOn: true
      numberOfWorkers: 1
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '3000' }
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'SQL_SERVER', value: server.properties.fullyQualifiedDomainName }
        { name: 'SQL_DATABASE', value: appName }
        { name: 'SQL_USER', value: sqlUser }
        { name: 'SQL_PASSWORD', value: sqlPassword }
        { name: 'JWT_SECRET', value: jwtSecret }
        { name: 'SQL_POOL_MAX', value: '5' }
        { name: 'QMT_AI_ENABLED', value: 'false' }
        { name: 'QMT_SPOND_ENABLED', value: 'false' }
        { name: 'QMT_API_REQUESTS_PER_MINUTE', value: '120' }
        { name: 'QMT_CLUB_NAME', value: clubName }
        { name: 'QMT_TRANSPORT_EMAIL', value: transportEmail }
        { name: 'QMT_TIMEZONE', value: 'Europe/Zurich' }
      ]
    }
  }
}
resource ftpPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: app
  name: 'ftp'
  properties: { allow: false }
}
resource scmPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: app
  name: 'scm'
  properties: { allow: false }
}
resource appLogs 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: app
  name: 'logs'
  properties: {
    applicationLogs: { fileSystem: { level: 'Warning' } }
    httpLogs: { fileSystem: { enabled: false } }
    detailedErrorMessages: { enabled: false }
    failedRequestsTracing: { enabled: false }
  }
}
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: 1 }
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'qmt-console'
  scope: app
  properties: {
    workspaceId: workspace.id
    logAnalyticsDestinationType: 'Dedicated'
    logs: [
      { category: 'AppServiceConsoleLogs', enabled: true }
    ]
  }
}
module environment './environment.bicep' = {
  name: '${appName}-guard-environment'
  params: {
    location: location
    environmentName: '${appName}-budget'
    logWorkspaceName: workspace.name
    logWorkspaceResourceGroup: resourceGroup().name
  }
}

output appResourceId string = app.id
output appHostname string = app.properties.defaultHostName
output sqlServerName string = server.name
output sqlServerResourceId string = server.id
output databaseName string = appName
output workspaceName string = workspace.name
output guardEnvironmentId string = environment.outputs.environmentId
