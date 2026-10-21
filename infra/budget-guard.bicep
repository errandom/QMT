targetScope = 'resourceGroup'

@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'
@allowed(['qmt-staging', 'qmt-production'])
param appName string = 'qmt-production'
@allowed(['containerApps', 'appService'])
param hosting string = 'containerApps'
@description('Used only for App Service; must match the exact QMT site name allowed by the guard.')
param appServiceName string = '${appName}-${uniqueString(resourceGroup().id)}'
param environmentName string
param environmentResourceGroup string
param workspaceName string
param workspaceResourceGroup string
@description('Existing QMT-only unfiltered Cost budget in this resource group; Monthly calendar period.')
param budgetName string
@secure()
@description('Exact approved amount in billing currency. No implicit currency conversion.')
param expectedBudgetAmount string
@minLength(3)
@maxLength(3)
param expectedBudgetCurrency string
@description('Existing approved QMT notification action group in this resource group.')
param actionGroupName string = 'qmt-operations'
param imageRepository string
@minLength(64)
@maxLength(64)
param imageDigest string
@description('Default is manual, not an automatically running job. Enable only after reviewed provisioning approval.')
param scheduled bool = false
@description('Default is read-only. Enabling writes requires authorized stop-rehearsal/operating approval.')
param execute bool = false

var jobName = '${appName}-budget'
var tags = { solution: 'QMT', platform: 'errandom', costProfile: 'bounded-production' }
var appResourceId = hosting == 'appService' ? webApp.id : app.id

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
  scope: resourceGroup(environmentResourceGroup)
}
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: workspaceName
  scope: resourceGroup(workspaceResourceGroup)
}
resource app 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: appName
}
resource webApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: appServiceName
}
resource budget 'Microsoft.Consumption/budgets@2024-08-01' existing = {
  name: budgetName
}
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' existing = {
  name: actionGroupName
}

resource stopRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(resourceGroup().id, appResourceId, 'qmt-budget-stop-only')
  properties: {
    roleName: 'QMT stop only ${uniqueString(appResourceId)}'
    description: 'Read and stop only the selected QMT app. No activation, app/plan update, secrets, SQL or deletion.'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [
      {
        actions: hosting == 'appService' ? [
          'Microsoft.Web/sites/read'
          'Microsoft.Web/sites/stop/action'
        ] : [
          'Microsoft.App/containerApps/revisions/read'
          'Microsoft.App/containerApps/revisions/replicas/read'
          'Microsoft.App/containerApps/revisions/deactivate/action'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
  }
}
resource budgetRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(resourceGroup().id, budget.id, 'qmt-budget-read-only')
  properties: {
    roleName: 'QMT budget read only ${uniqueString(budget.id)}'
    description: 'Read the one reviewed budget. No budget modification or access to other cost records.'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [
      {
        actions: ['Microsoft.Consumption/budgets/read']
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
  }
}
resource guard 'Microsoft.App/jobs@2024-03-01' = {
  name: jobName
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: scheduled ? 'Schedule' : 'Manual'
      replicaTimeout: 120
      replicaRetryLimit: 0
      scheduleTriggerConfig: scheduled ? {
        cronExpression: '0 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      } : null
      manualTriggerConfig: scheduled ? null : {
        parallelism: 1
        replicaCompletionCount: 1
      }
      secrets: [
        { name: 'budget-amount', value: expectedBudgetAmount }
      ]
    }
    template: {
      containers: [
        {
          name: 'budget-guard'
          image: '${imageRepository}@sha256:${imageDigest}'
          command: ['node', 'scripts/budget-guard.cjs']
          args: execute ? ['--execute'] : []
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'QMT_APP_RESOURCE_ID', value: appResourceId }
            { name: 'QMT_BUDGET_RESOURCE_ID', value: budget.id }
            { name: 'QMT_BUDGET_AMOUNT', secretRef: 'budget-amount' }
            { name: 'QMT_BUDGET_CURRENCY', value: expectedBudgetCurrency }
          ]
        }
      ]
    }
  }
}
resource stopAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (hosting == 'containerApps') {
  name: guid(app.id, guard.id, stopRole.id)
  scope: app
  properties: {
    roleDefinitionId: stopRole.id
    principalId: guard.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
resource webStopAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (hosting == 'appService') {
  name: guid(webApp.id, guard.id, stopRole.id)
  scope: webApp
  properties: {
    roleDefinitionId: stopRole.id
    principalId: guard.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
resource budgetAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(budget.id, guard.id, budgetRole.id)
  scope: budget
  properties: {
    roleDefinitionId: budgetRole.id
    principalId: guard.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
resource guardAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (scheduled) {
  name: '${jobName}-health'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    displayName: '${jobName}: stopped, failed or missing heartbeat'
    description: 'Inspect sanitized guard logs and maintain the independent QMT status page. Never automatically resume.'
    enabled: true
    severity: 1
    evaluationFrequency: 'PT15M'
    windowSize: 'PT2H'
    scopes: [workspace.id]
    autoMitigate: true
    skipQueryValidation: false
    criteria: {
      allOf: [
        {
          query: '''
ContainerAppConsoleLogs_CL
| where _ResourceId =~ '${environment.id}' or _ResourceId =~ '${guard.id}'
| where ContainerGroupName_s startswith '${jobName}-'
| extend payload = parse_json(Log_s)
| where tostring(payload.event) == 'qmt_budget_guard'
| summarize lastHealthy = maxif(TimeGenerated, tostring(payload.status) in ('within_budget', 'suspended', 'already_suspended')),
            lastFailure = maxif(TimeGenerated, tostring(payload.status) in ('failed', 'would_suspend')),
            lastSuspended = maxif(TimeGenerated, tostring(payload.status) == 'suspended')
| where isnull(lastHealthy) or lastHealthy < ago(110m) or lastFailure > lastHealthy or lastSuspended > ago(30m)
'''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
        }
      ]
    }
    actions: { actionGroups: [actionGroup.id] }
  }
}

output jobResourceId string = guard.id
