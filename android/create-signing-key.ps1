param(
    [string]$KeyStore = "$env:LOCALAPPDATA\errandom\QMT-signing\qmt-release.p12",
    [string]$JavaHome = "C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot"
)
$ErrorActionPreference = "Stop"
if (Test-Path $KeyStore) { throw "Existing key preserved; use it, never overwrite it." }
$repository = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$keyPath = [IO.Path]::GetFullPath($KeyStore)
if ($keyPath.StartsWith($repository + "\", [StringComparison]::OrdinalIgnoreCase)) { throw "Signing keys must be outside the repository." }
if (!$env:QMT_ANDROID_STORE_PASSWORD -or !$env:QMT_ANDROID_KEY_PASSWORD) { throw "Supply signing passwords via environment variables first; never put them in files or command arguments." }
New-Item -ItemType Directory -Force (Split-Path $keyPath -Parent) | Out-Null
& "$JavaHome\bin\keytool.exe" -genkeypair -keystore $keyPath -storetype PKCS12 -alias qmt `
    -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=QMT local sideload, O=errandom" `
    -storepass:env QMT_ANDROID_STORE_PASSWORD -keypass:env QMT_ANDROID_KEY_PASSWORD
if ($LASTEXITCODE -ne 0) { throw "keytool failed." }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $keyPath /inheritance:r /grant:r "${identity}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Restrict the key ACL before proceeding." }
Write-Output "Created owner-local signing key: $keyPath"
