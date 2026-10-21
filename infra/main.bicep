targetScope = 'resourceGroup'

@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'
@allowed(['qmt-staging', 'qmt-production'])
param appName string = 'qmt-production'
param environmentName string
param environmentResourceGroup string
@description('Public OCI repository without a tag or digest. Do not publish data or secrets in the image.')
param imageRepository string
@minLength(64)
@maxLength(64)
param imageDigest string
param sqlServer string
param sqlDatabase string
param sqlUser string
@secure()
param sqlPassword string
@secure()
@minLength(32)
param jwtSecret string
param clubName string = 'QMT by errandom'
@description('Optional club transport recipient. Empty disables draft generation; never inherit another club contact.')
param transportEmail string = ''

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
  scope: resourceGroup(environmentResourceGroup)
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: { solution: 'QMT', platform: 'errandom', costProfile: 'bounded-production' }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      maxInactiveRevisions: 1
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        { name: 'sql-password', value: sqlPassword }
        { name: 'jwt-secret', value: jwtSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'qmt'
          image: '${imageRepository}@sha256:${imageDigest}'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'SQL_SERVER', value: sqlServer }
            { name: 'SQL_DATABASE', value: sqlDatabase }
            { name: 'SQL_USER', value: sqlUser }
            { name: 'SQL_PASSWORD', secretRef: 'sql-password' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'SQL_POOL_MAX', value: '5' }
            { name: 'QMT_AI_ENABLED', value: 'false' }
            { name: 'QMT_SPOND_ENABLED', value: 'false' }
            { name: 'QMT_API_REQUESTS_PER_MINUTE', value: '120' }
            { name: 'QMT_CLUB_NAME', value: clubName }
            { name: 'QMT_TRANSPORT_EMAIL', value: transportEmail }
            { name: 'QMT_TIMEZONE', value: 'Europe/Zurich' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 3000, scheme: 'HTTP' }
              initialDelaySeconds: 15
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/health', port: 3000, scheme: 'HTTP' }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '10' } } }
        ]
      }
    }
  }
}

output appHostname string = app.properties.configuration.ingress.fqdn
