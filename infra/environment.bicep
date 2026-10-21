targetScope = 'resourceGroup'

@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'
@description('QMT-only environment. Reuse a reviewed shared environment instead if one is already approved.')
param environmentName string = 'qmt-production'
@description('Existing approved Analytics Logs workspace; this template creates no workspace or paid dedicated profile.')
param logWorkspaceName string
param logWorkspaceResourceGroup string

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logWorkspaceName
  scope: resourceGroup(logWorkspaceResourceGroup)
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: { solution: 'QMT', platform: 'errandom', costProfile: 'bounded-production' }
  properties: {
    workloadProfiles: [
      { name: 'Consumption', workloadProfileType: 'Consumption' }
    ]
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

output environmentId string = environment.id
