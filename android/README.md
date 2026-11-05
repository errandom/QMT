# QMT Android sideload app

Native Java WebView shell for `https://qmt.errandom.com`, application ID
`com.errandom.qmt`, version 1.0 (1). Android 8.0/API 26 minimum; compile and target
API 36. No Play Store, Capacitor, Firebase, FCM, provider registration or added
external service. The installed device WebView must be kept up to date.
The hosted web application remains authoritative and supplies its phone layout.
This shell does not inject viewport/CSS overrides or replace the web deployment.

## Install and use

Transfer `QMT-Android.apk` to your phone, open it and grant the **install unknown
apps** permission to the transferring app when Android asks. You may revoke that
permission after installation. Alternatively, with an already configured device:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\build\QMT-Android.apk
```

Sign in normally inside QMT. Native **Reload** reloads the page, **Alerts** opens
notification settings. Back navigates WebView history, then closes the activity.
Insets protect the system bars/cutout and resize content above the keyboard.
Only HTTPS QMT same-origin pages navigate internally; user-activated external
HTTPS, email, phone, SMS and WhatsApp links open appropriate installed apps.
Unrecognized schemes and cleartext links are blocked. TLS errors are cancelled,
never bypassed. Network/main-page HTTP errors show a native retry screen.

File inputs use Android's document picker without broad storage permissions.
Same-origin HTTPS and QMT-generated blob downloads offer a document-save picker
(8 MB maximum); external downloads open in the browser. Authenticated HTTPS
downloads can use the encrypted session when notifications are enabled.
Blob exports use their existing web session. Redirecting download endpoints are
not followed. Failed saves may leave a partial document; delete it and retry.
Camera capture, arbitrary `intent:` links, and arbitrary JavaScript-to-native
bridges are deliberately absent.

## Notifications: opt-in periodic checks, NOT real-time push

Alerts default **off**. Enable them in **Alerts** and grant Android 13+ notification
permission when prompted. The `QMT updates` notification channel can also be
disabled through Android settings. Denying permission turns the opt-in off.
Disabling alerts or **Forget background session** erases the native captured
token/baselines and cancels the periodic job/notification; it does not sign out
the web application.

The persisted JobScheduler job requests network-connected checks roughly every
15 minutes. Android may defer or skip runs due to Doze, battery saver, app standby,
background restrictions, force-stop, network availability and manufacturer
policies. Do not expect exact 15-minute delivery. No exact alarm, foreground
service, wake lock, battery-optimization exemption, or real-time FCM push is used.
A force-stopped app must be opened again. A persisted job can survive reboot,
but reboot/deferred real-device delivery has not been verified.

Checks use **GET only**:

* `/api/events?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500&after=ID`:
  upcoming raw events in the current Zurich calendar day plus the next 14 days,
  with API timestamps retained as delivered. Pagination follows increasing IDs.
  Changed, newly added, or removed still-upcoming events produce a generic alert.
  Natural expiry and events merely entering the moving horizon do not.
* `/api/auth/me`: validates the current account's ID, active `is_active`, and
  authoritative role. Only active `admin`/`mgmt` accounts fetch requests.
* `/api/requests?after=ID`: complete increasing-ID pagination, 500 rows/page;
  newly observed **Pending** requests beyond the last complete high-water mark
  produce a generic alert. Already reviewed requests do not. Current records are
  fetched read-only; no requests are submitted, reviewed, deleted or messaged.

At most 32 pages/collection and 8 MB/response are accepted. An oversized,
non-advancing, malformed or incomplete response preserves the previous complete
baseline and retries later. The first complete fetch establishes a silent
baseline; account changes and logout reset it. All required collections must
succeed before baselines advance. Generic notifications contain no participant,
event title, requestor or account details. Tapping opens QMT.

While the trusted main document is loaded and alerts are opted in, the shell
polls `localStorage.auth_token` via `evaluateJavascript` approximately once/second
while foregrounded and once when pausing. It checks the current trusted origin,
the document's reported origin and navigation generation before accepting any
result. There is no persistent JS bridge and no token capture from external
content. The web's `auth_user` is not treated as authorization.
Logout erasure follows this foreground synchronization, not a backend logout
event. JWT expiry is checked locally, but decoding claims is only an isolation
hint; server `/auth/me` is authoritative.

The native token is AES-GCM encrypted using a non-exportable Android Keystore key.
Backups are disabled. Token values are never logged, embedded, or sent anywhere
except trusted QMT HTTPS endpoints; redirects are not followed. On 401, inactive
account or missing account, the session and baselines are erased. A rejected
token fingerprint prevents re-capturing the same stale token from web storage;
sign in again with a fresh token. Public schedule checks can continue without
an authenticated session. Native security does not change the hosted site's
existing localStorage authentication/security model.

## Repeatable build using installed tools only

No Gradle/network dependencies are needed. `build.ps1` uses installed Microsoft
Java 21 and Android SDK 36.0.0 `aapt2`, `javac`, `jar`, `d8`, `zipalign`, and
`apksigner`. It also runs the dependency-free policy tests, verifies v2/v3
signatures and prints APK package, SDK levels and permissions using `aapt`.
The build is repeatable, not byte-for-byte deterministic (archive timestamps).
Increment `AndroidManifest.xml` versionCode/versionName for future releases.
Keep the same signing key to install updates over an existing installation.

From this directory, using the generated owner-local key on this Windows account:

```powershell
.\build.ps1 `
  -KeyStore "$env:LOCALAPPDATA\errandom\QMT-signing\qmt-release.p12" `
  -PasswordFile "$env:LOCALAPPDATA\errandom\QMT-signing\signing-password.dpapi"
```

The password file is Windows DPAPI encrypted, outside the repository and session
artifacts, restricted to its owner. It is usable only by the original Windows
identity/machine. Signing passwords are placed only in the executing process's
environment and passed through keytool/apksigner's environment-password options.
Never copy the plaintext password, key or password file into the repository.
For another owner-controlled key, set `QMT_ANDROID_KEYSTORE`,
`QMT_ANDROID_STORE_PASSWORD`, `QMT_ANDROID_KEY_PASSWORD` (or use the corresponding
key path plus `QMT_ANDROID_PASSWORD_FILE` DPAPI file). `create-signing-key.ps1`
creates a 3072-bit RSA PKCS12 key outside the repository using supplied environment
passwords and restricts its ACL. It refuses to overwrite an existing key.
Keep key recovery material securely; losing it prevents signed in-place updates.

Optional output destination:

```powershell
.\build.ps1 -KeyStore $env:QMT_ANDROID_KEYSTORE `
  -OutputApk 'C:\Users\kennethf\.copilot\session-state\7e165fa3-1c6f-47af-b08a-60c33b7d24c7\files\QMT-Android.apk'
```

All build products are under ignored `android\build`. No existing web manifests,
workflows, deployment documents, branches or commits are changed by these scripts.

## Tests and verified evidence — November 5, 2026

* Java 21 compilation against API 36 succeeded; d8 release conversion succeeded.
* **18 policy checks** pass: strict origin boundaries, baseline suppression,
  additions/changes/deletions, natural expiry and horizon movement.
* The owner-signed app and same-signed instrumentation test APK installed on an
  isolated read-only existing emulator, Android 15/API 35, WebView 124.0.6367.219.
* **26 offline Android fixture checks** cover opt-in, persisted 15-minute job
  configuration, Keystore round-trip/no plaintext, silent first baseline,
  unchanged checks, observed local generic schedule/request notifications,
  failed-complete-fetch retention, 401 erasure/re-capture blocking, new account
  resets and logout. The scheduled real-network job is cancelled before fixtures;
  emulator networking is disabled during fixture execution. Synthetic bearer
  values never authenticate to a real account.
* Public QMT startup and native settings/offline error screens were observed.
  Retry after reconnect restored the public schedule. Public touchscreen Login
  opened successfully before the parent requested a pause pending PR20's phone
  dialog geometry rollout. No further production UI test was performed.
* A separate **offline native-shell UI fixture** passed real touchscreen button
  activation and confirmed that focusing an empty input shrinks the WebView above
  the Android keyboard. This is not a test of the pending production web dialogs.
* No real login, booking, request mutation, messaging, Spond/provider invocation
  or real admin notification was performed. Physical-device/API 26/API 36 runtime,
  actual battery/reboot scheduling and file chooser/export flows need owner
  acceptance testing. Synthetic local delivery is not evidence of real-time
  push or real production admin delivery.

Build fixture tests after building the app:

```powershell
.\test\build-instrumentation.ps1 `
  -KeyStore "$env:LOCALAPPDATA\errandom\QMT-signing\qmt-release.p12" `
  -PasswordFile "$env:LOCALAPPDATA\errandom\QMT-signing\signing-password.dpapi"
```

Install the app and `build\instrumentation\QMT-tests.apk` only on an isolated test
device. Grant its notification permission for fixture testing; disable networking
before invoking `com.errandom.qmt.test/com.errandom.qmt.AndroidTests`. This test
clears the test device's QMT preferences/notification state, so never run it over
a real signed-in installation. `UiTests` is a separate offline native-shell
fixture: it opens a local test form and focuses an empty field, never submits it.
Keep emulator networking disabled for both instrumentation entrypoints.

## Source inventory

* `.gitignore`, `AndroidManifest.xml`, `README.md`
* `build.ps1`, `create-signing-key.ps1`
* `res\drawable\qmt_icon.xml`, `res\drawable\notification.xml`
* `src\com\errandom\qmt\MainActivity.java`
* `src\com\errandom\qmt\SessionStore.java`
* `src\com\errandom\qmt\Policy.java`
* `src\com\errandom\qmt\Poller.java`
* `src\com\errandom\qmt\PollJob.java`
* `test\PolicyTest.java`, `test\AndroidTests.java`, `test\UiTests.java`
* `test\AndroidManifest.xml`, `test\build-instrumentation.ps1`

Final signed artifact:
`C:\Users\kennethf\.copilot\session-state\7e165fa3-1c6f-47af-b08a-60c33b7d24c7\files\QMT-Android.apk`

APK SHA-256:
`221B95FFC64D3C1B2AF1C524EAF2291F3028E1EEB3EB24D34BE3F09E7A247587`

Signing certificate SHA-256:
`923d24f52f718e7d2bd6773cb05b106e06212a3fe10734c3e60c5fcea82fca31`

The APK verifies under signing schemes v2 and v3. Its four declared permissions
are INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED.
The application is not debuggable, disallows cleartext and disables backups.
An identical, discoverable copy is retained at
`C:\Users\kennethf\OneDrive\errandom\QMT\android\build\QMT-Android.apk`.
