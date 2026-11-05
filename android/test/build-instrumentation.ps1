param(
    [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$JavaHome = "C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot",
    [string]$KeyStore = $env:QMT_ANDROID_KEYSTORE,
    [string]$PasswordFile = $env:QMT_ANDROID_PASSWORD_FILE
)
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$env:PATH"
if ($PasswordFile) {
    $secret = (Get-Content $PasswordFile -Raw).Trim() | ConvertTo-SecureString
    $env:QMT_ANDROID_STORE_PASSWORD = [Net.NetworkCredential]::new("", $secret).Password
    $env:QMT_ANDROID_KEY_PASSWORD = $env:QMT_ANDROID_STORE_PASSWORD
}
$root = Split-Path $PSScriptRoot -Parent
$build = "$root\build\instrumentation"
$tools = "$Sdk\build-tools\36.0.0"
$platform = "$Sdk\platforms\android-36\android.jar"
function Run([string]$exe, [string[]]$arguments) {
    & $exe @arguments; if ($LASTEXITCODE -ne 0) { throw "$exe failed: $LASTEXITCODE" }
}
New-Item -ItemType Directory -Force "$build\classes","$build\dex" | Out-Null
Run "$tools\aapt2.exe" @("link","-o","$build\unsigned.apk","--manifest","$PSScriptRoot\AndroidManifest.xml","-I",$platform)
Run "$JavaHome\bin\javac.exe" @("--release","8","-encoding","UTF-8","-classpath","$platform;$root\build\classes.jar","-d","$build\classes","$PSScriptRoot\AndroidTests.java","$PSScriptRoot\UiTests.java")
Run "$JavaHome\bin\jar.exe" @("--create","--file","$build\classes.jar","-C","$build\classes",".")
Run "$tools\d8.bat" @("--release","--min-api","26","--lib",$platform,"--classpath","$root\build\classes.jar","--output","$build\dex","$build\classes.jar")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("$build\unsigned.apk", [IO.Compression.ZipArchiveMode]::Update)
try { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,"$build\dex\classes.dex","classes.dex",[IO.Compression.CompressionLevel]::NoCompression) | Out-Null }
finally { $zip.Dispose() }
Run "$tools\zipalign.exe" @("-f","-p","4","$build\unsigned.apk","$build\aligned.apk")
Run "$tools\apksigner.bat" @("sign","--ks",$KeyStore,"--ks-key-alias","qmt","--ks-pass","env:QMT_ANDROID_STORE_PASSWORD","--key-pass","env:QMT_ANDROID_KEY_PASSWORD","--out","$build\QMT-tests.apk","$build\aligned.apk")
Run "$tools\apksigner.bat" @("verify","$build\QMT-tests.apk")
Write-Output "Synthetic fixture instrumentation APK: $build\QMT-tests.apk"
