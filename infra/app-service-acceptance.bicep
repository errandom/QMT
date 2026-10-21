targetScope = 'subscription'

@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'
@allowed(['qmt-production', 'qmt-staging'])
param appName string = 'qmt-production'
param imageRepository string
@minLength(64)
@maxLength(64)
param imageDigest string
param sqlAdministrator string
@secure()
param sqlAdministratorPassword string
param sqlUser string
@secure()
param sqlPassword string
@secure()
@minLength(32)
param jwtSecret string
param clubName string
param transportEmail string = ''

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: appName
  location: location
  tags: { solution: 'QMT', platform: 'errandom', costProfile: 'bounded-production' }
}

module foundation './app-service.bicep' = {
  name: '${appName}-foundation'
  scope: group
  params: {
    location: location
    appName: appName
    imageRepository: imageRepository
    imageDigest: imageDigest
    sqlAdministrator: sqlAdministrator
    sqlAdministratorPassword: sqlAdministratorPassword
    sqlUser: sqlUser
    sqlPassword: sqlPassword
    jwtSecret: jwtSecret
    clubName: clubName
    transportEmail: transportEmail
    appEnabled: false
  }
}

output resourceGroupId string = group.id
output appResourceId string = foundation.outputs.appResourceId
output appHostname string = foundation.outputs.appHostname
output sqlServerResourceId string = foundation.outputs.sqlServerResourceId
output databaseName string = foundation.outputs.databaseName
output workspaceName string = foundation.outputs.workspaceName
output guardEnvironmentId string = foundation.outputs.guardEnvironmentId
