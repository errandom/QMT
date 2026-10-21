param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')]
  [string]$SubscriptionId,
  [ValidateSet('qmt-production', 'qmt-staging')]
  [string]$AppName = 'qmt-production',
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^ghcr\.io/errandom/qmt@sha256:[a-f0-9]{64}$')]
  [string]$Image,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [switch]$AzureWhatIf
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$output = [System.IO.Path]::GetFullPath($OutputPath)
if (-not [System.IO.Directory]::Exists([System.IO.Path]::GetDirectoryName($output)) -or
    [System.IO.Path]::GetExtension($output) -ne '.json' -or
    [System.IO.File]::Exists($output) -or [System.IO.File]::Exists("$output.what-if.json")) {
  throw 'Use a new .json output in an existing private directory; existing files will not be overwritten.'
}
& az bicep build --file (Join-Path $root 'infra\app-service-acceptance.bicep') --outfile $output
if ($LASTEXITCODE -ne 0) { throw 'B1 subscription-template compilation failed.' }
if (-not $AzureWhatIf) {
  Write-Output "Compiled B1 foundation to $output. No Azure request, resource creation or release approval."
  return
}

$parts = $Image -split '@sha256:'
$previewParameters = @(
  "appName=$AppName"
  "imageRepository=$($parts[0])"
  "imageDigest=$($parts[1])"
  'sqlAdministrator=qmt_preview_admin'
  'sqlAdministratorPassword=Qmt-Preview-Admin-Only-9287'
  'sqlUser=qmt_preview_app'
  'sqlPassword=Qmt-Preview-App-Only-9731'
  'jwtSecret=Qmt-Preview-Jwt-Only-Not-For-Deployment-9392'
  'clubName=QMT preflight only'
)
$raw = & az deployment sub what-if --subscription $SubscriptionId `
  --location switzerlandnorth --name "$AppName-foundation-preview" `
  --template-file $output --parameters @previewParameters `
  --validation-level Provider --result-format FullResourcePayloads `
  --no-pretty-print --output json --only-show-errors
if ($LASTEXITCODE -ne 0) {
  throw 'Azure B1 what-if failed. No deployment was requested; resolve the provider error before acceptance.'
}
$result = ($raw -join "`n") | ConvertFrom-Json
$result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath "$output.what-if.json" -Encoding utf8
if ($result.status -ne 'Succeeded' -or $null -eq $result.changes -or $result.changes.Count -eq 0) {
  throw "Azure returned an incomplete what-if result; inspect $output.what-if.json."
}
$scope = "/subscriptions/$SubscriptionId/resourceGroups/$AppName"
$servers = @($result.changes | Where-Object {
  $_.resourceId -match "^$([regex]::Escape($scope))/providers/Microsoft\.Sql/servers/$AppName-[a-z0-9]{13}$"
})
if ($servers.Count -ne 1) { throw 'What-if must resolve exactly one QMT foundation SQL server.' }
$uniqueName = ([string]$servers[0].resourceId -split '/')[-1]
$expected = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($suffix in @(
  ''
  "/providers/Microsoft.App/managedEnvironments/$AppName-budget"
  "/providers/Microsoft.Network/virtualNetworks/$AppName-network"
  "/providers/Microsoft.Network/virtualNetworks/$AppName-network/subnets/app"
  "/providers/Microsoft.OperationalInsights/workspaces/$AppName-logs"
  "/providers/Microsoft.Sql/servers/$uniqueName"
  "/providers/Microsoft.Sql/servers/$uniqueName/connectionPolicies/default"
  "/providers/Microsoft.Sql/servers/$uniqueName/databases/$AppName"
  "/providers/Microsoft.Sql/servers/$uniqueName/databases/$AppName/backupLongTermRetentionPolicies/default"
  "/providers/Microsoft.Sql/servers/$uniqueName/databases/$AppName/backupShortTermRetentionPolicies/default"
  "/providers/Microsoft.Sql/servers/$uniqueName/virtualNetworkRules/qmt-app-subnet"
  "/providers/Microsoft.Web/serverfarms/$AppName-plan"
  "/providers/Microsoft.Web/sites/$uniqueName"
  "/providers/Microsoft.Web/sites/$uniqueName/basicPublishingCredentialsPolicies/ftp"
  "/providers/Microsoft.Web/sites/$uniqueName/basicPublishingCredentialsPolicies/scm"
  "/providers/Microsoft.Web/sites/$uniqueName/config/logs"
  "/providers/Microsoft.Web/sites/$uniqueName/providers/Microsoft.Insights/diagnosticSettings/qmt-console"
)) { [void]$expected.Add("$scope$suffix") }
$issues = [System.Collections.Generic.List[string]]::new()
foreach ($change in $result.changes) {
  $id = [string]$change.resourceId
  $inside = $id.Equals($scope, [System.StringComparison]::OrdinalIgnoreCase) -or
    $id.StartsWith("$scope/", [System.StringComparison]::OrdinalIgnoreCase)
  if (-not $inside -and $change.changeType -notin @('NoChange', 'Ignore')) {
    $issues.Add("Unexpected cross-scope change: $id")
  } elseif ($inside -and ($change.changeType -ne 'Create' -or -not $expected.Remove($id))) {
    $issues.Add("Fresh-foundation preview is unresolved or changes existing resources: $($change.changeType) $id")
  }
}
if ($expected.Count -ne 0) { $issues.Add("What-if omitted required foundation resources: $($expected -join ', ')") }
if ($issues.Count -ne 0) {
  throw ($issues -join "`n")
}
$plan = ($result.changes | Where-Object resourceId -EQ "$scope/providers/Microsoft.Web/serverfarms/$AppName-plan").after
$site = ($result.changes | Where-Object resourceId -EQ "$scope/providers/Microsoft.Web/sites/$uniqueName").after
$database = ($result.changes | Where-Object resourceId -EQ "$scope/providers/Microsoft.Sql/servers/$uniqueName/databases/$AppName").after
if ($plan.kind -ne 'linux' -or $plan.sku.name -ne 'B1' -or $plan.sku.capacity -ne 1 -or
    $site.properties.enabled -ne $false -or $database.sku.name -ne 'Basic' -or
    $database.properties.maxSizeBytes -ne 2147483648) {
  throw 'What-if does not preserve one Linux B1 worker, disabled app and 2 GB Basic SQL.'
}
Write-Output "Read-only B1 what-if saved to $output.what-if.json. Synthetic preview credentials only; app remains disabled."
Write-Output 'This is not provisioning, verified capacity, cost approval, budget activation or production-release approval.'
