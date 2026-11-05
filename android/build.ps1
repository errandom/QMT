param(
    [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$JavaHome = "C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot",
    [string]$OutputApk = "",
    [string]$KeyStore = $env:QMT_ANDROID_KEYSTORE,
    [string]$PasswordFile = $env:QMT_ANDROID_PASSWORD_FILE,
    [string]$KeyAlias = "qmt"
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$env:PATH"
$tools = Join-Path $Sdk "build-tools\36.0.0"
$platform = Join-Path $Sdk "platforms\android-36\android.jar"
$build = Join-Path $root "build"
if (!$KeyStore -or !(Test-Path $KeyStore)) { throw "Set QMT_ANDROID_KEYSTORE to your owner-local signing keystore." }
if ($PasswordFile) {
    $securePassword = (Get-Content $PasswordFile -Raw).Trim() | ConvertTo-SecureString
    $env:QMT_ANDROID_STORE_PASSWORD = [Net.NetworkCredential]::new("", $securePassword).Password
    $env:QMT_ANDROID_KEY_PASSWORD = $env:QMT_ANDROID_STORE_PASSWORD
}
if (!$env:QMT_ANDROID_STORE_PASSWORD -or !$env:QMT_ANDROID_KEY_PASSWORD) { throw "Set signing passwords in QMT_ANDROID_STORE_PASSWORD and QMT_ANDROID_KEY_PASSWORD." }
function Run([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "$exe failed with exit code $LASTEXITCODE" }
}
New-Item -ItemType Directory -Force "$build\classes","$build\generated","$build\dex","$build\test" | Out-Null
Run "$tools\aapt2.exe" @("compile","--dir","$root\res","-o","$build\resources.zip")
Run "$tools\aapt2.exe" @("link","-o","$build\unsigned.apk","--manifest","$root\AndroidManifest.xml","-I",$platform,"--java","$build\generated","$build\resources.zip")
$sources = @(Get-ChildItem "$root\src","$build\generated" -Recurse -Filter *.java | Select-Object -ExpandProperty FullName)
Run "$JavaHome\bin\javac.exe" (@("--release","8","-encoding","UTF-8","-classpath",$platform,"-d","$build\classes") + $sources)
Run "$JavaHome\bin\javac.exe" @("--release","8","-encoding","UTF-8","-d","$build\test","$root\src\com\errandom\qmt\Policy.java","$root\test\PolicyTest.java")
Run "$JavaHome\bin\java.exe" @("-cp","$build\test","com.errandom.qmt.PolicyTest")
Run "$JavaHome\bin\jar.exe" @("--create","--file","$build\classes.jar","-C","$build\classes",".")
Run "$tools\d8.bat" @("--release","--min-api","26","--lib",$platform,"--output","$build\dex","$build\classes.jar")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("$build\unsigned.apk", [IO.Compression.ZipArchiveMode]::Update)
try {
    foreach ($dex in Get-ChildItem "$build\dex" -Filter *.dex) {
        $existing = $zip.GetEntry($dex.Name); if ($existing) { $existing.Delete() }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$dex.FullName,$dex.Name,[IO.Compression.CompressionLevel]::NoCompression) | Out-Null
    }
} finally { $zip.Dispose() }
Run "$tools\zipalign.exe" @("-f","-p","4","$build\unsigned.apk","$build\aligned.apk")
Run "$tools\apksigner.bat" @("sign","--ks",$KeyStore,"--ks-key-alias",$KeyAlias,"--ks-pass","env:QMT_ANDROID_STORE_PASSWORD","--key-pass","env:QMT_ANDROID_KEY_PASSWORD","--out","$build\QMT-Android.apk","$build\aligned.apk")
Run "$tools\apksigner.bat" @("verify","--verbose","--print-certs","$build\QMT-Android.apk")
Run "$tools\aapt.exe" @("dump","badging","$build\QMT-Android.apk")
Run "$tools\aapt.exe" @("dump","permissions","$build\QMT-Android.apk")
if ($OutputApk) { Copy-Item "$build\QMT-Android.apk" $OutputApk -Force }
Get-FileHash "$build\QMT-Android.apk" -Algorithm SHA256 | Format-List
