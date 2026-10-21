param(
  [Parameter(Mandatory = $true)][string]$Image,
  [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if ($Image -notmatch '^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$') {
  throw 'Use a public registry image pinned to a complete sha256 digest, not a mutable tag.'
}
$root = Split-Path $PSScriptRoot -Parent
& node (Join-Path $PSScriptRoot 'cost-check.cjs') --release
if ($LASTEXITCODE -ne 0) { throw 'Release is blocked by missing approvals, cost inputs or acceptance evidence.' }
& az bicep build --file (Join-Path $root 'infra\main.bicep') --outfile $OutputPath
if ($LASTEXITCODE -ne 0) { throw 'Bicep compilation failed.' }
Write-Output 'Local preparation only: no deployment, database change, image publishing or DNS change performed.'
$parts = $Image -split '@sha256:'
Write-Output "Use imageRepository=$($parts[0]) and imageDigest=$($parts[1]) in the reviewed parameter file."
