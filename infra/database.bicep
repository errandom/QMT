targetScope = 'resourceGroup'

@description('An independently approved, existing logical server dedicated to QMT. No server or firewall is created by this template.')
param serverName string
@allowed(['qmt-staging', 'qmt-production'])
param databaseName string = 'qmt-production'
@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'

resource server 'Microsoft.Sql/servers@2023-08-01' existing = {
  name: serverName
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: server
  name: databaseName
  location: location
  tags: { solution: 'QMT', platform: 'errandom', costProfile: 'bounded-production' }
  sku: { name: 'Basic', tier: 'Basic', capacity: 5 }
  properties: {
    maxSizeBytes: 2147483648
    requestedBackupStorageRedundancy: 'Local'
  }
}

resource retention 'Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies@2023-08-01' = {
  parent: database
  name: 'default'
  properties: { retentionDays: 7 }
}

resource longTermRetention 'Microsoft.Sql/servers/databases/backupLongTermRetentionPolicies@2023-08-01' = {
  parent: database
  name: 'default'
  properties: {
    weeklyRetention: 'P4W'
    monthlyRetention: 'PT0S'
    yearlyRetention: 'PT0S'
  }
}
