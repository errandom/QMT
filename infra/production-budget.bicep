targetScope = 'resourceGroup'

@description('Owner-approved notification recipient. No application credentials are used by budget notifications.')
param notificationEmail string
@description('First day of the calendar budget period, at UTC midnight.')
param startDate string
param endDate string
param budgetName string = 'qmt-monthly'
param actionGroupName string = 'qmt-operations'
@minValue(1)
param monthlyAmount int = 30

// Resource-group scope includes only QMT, including its monitoring and guard.
resource operations 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  tags: { solution: 'QMT', platform: 'errandom' }
  properties: {
    groupShortName: 'QMT'
    enabled: true
    emailReceivers: [
      {
        name: 'QMT owner'
        emailAddress: notificationEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource budget 'Microsoft.Consumption/budgets@2024-08-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: monthlyAmount
    timeGrain: 'Monthly'
    timePeriod: { startDate: startDate, endDate: endDate }
    notifications: {
      actual50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [notificationEmail]
      }
      actual75: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 75
        thresholdType: 'Actual'
        contactEmails: [notificationEmail]
      }
      actual90: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 90
        thresholdType: 'Actual'
        contactEmails: [notificationEmail]
      }
      actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [notificationEmail]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [notificationEmail]
      }
    }
  }
}

output budgetResourceId string = budget.id
output actionGroupResourceId string = operations.id
