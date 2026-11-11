# QMT controlled relaunch

## Planned-event attendance correction: November 11, 2026 (release preparation)

Attendance reads and explicit event linking accept both Planned and Confirmed
QMT schedules without changing their booking status or facility approval.
Cancelled and Completed events cannot acquire new links or scheduled reads;
the preview excludes them from attendance selection. Publication eligibility
is unchanged. Genuine time, team, mapping and provider-audience changes still
require review. Ineligible booking states now have a specific error instead
of being reported as a booking change.

## Persistent setup and bulk review: November 11, 2026 (local preparation)

The revised Spond settings use one explicit sign-in/token-retention confirmation.
The encrypted club connection can reopen short-lived administrator review
sessions without another password. Already-reviewed active team mappings are
reused only when their exact group/parent pair remains accessible. New or
changed mappings still require review; opening Settings never approves events.
Expired event-preview sessions can renew through the retained connection.

Connection details, account changes, team-link editing and linked-event
maintenance are collapsed. Event review offers a compact list, selection of all
single exact-time matches, and one attendance-only confirmation for up to 50
selected event pairs. Multiple candidates require an explicit choice first.
Each pair still passes the existing booking, audience, mapping and response
validation before it is saved. Partial results identify saved links and retain
failed selections for review/retry; this is not an all-or-nothing transaction.
The daily review quota reserves one unit per selected provider read, while
the administrator action limit counts the batch once.

This preparation adds no migration, deployment flag or infrastructure.
It does not activate a live connection, approve live links, merge PR #29,
or claim that the revised settings are deployed.

## Attendance-only release preparation: November 10, 2026

The attendance-only implementation is isolated from draft publisher PR #29.
`QMT_SPOND_ATTENDANCE_ENABLED=true` exposes the new administrator controls and
starts a one-minute scheduler check; leave legacy `QMT_SPOND_ENABLED` and
outbound publication disabled. Existing reviewed-access approval is required.
Deployment alone does not connect a Spond account or approve any event link.

In Office > Settings > Spond, run discovery, confirm team mappings, preview
events and explicitly confirm each existing QMT/Spond event pair. For a combined
QMT event, review sources from every participating team's preview. Several
QMT teams may share one Spond group; duplicate provider events and identical
response IDs are counted once, not multiplied by the number of team mappings.
Per-team counts require an exclusive, matching source audience and unambiguous
response attribution. Totals are responses, not guaranteed unique people across
different Spond group memberships. Team aggregates are under Office > Statistics,
not the front page.

An administrator must separately approve retaining an encrypted Spond access
token for scheduled reads. Passwords remain transient and are never stored.
The token is authenticated-encrypted with AES-256-GCM using an attendance-specific
HKDF key derived from the existing signing secret. Signing-secret rotation,
provider token expiry/revocation, or an inactive/non-admin connection owner
requires explicit reconnection. Stop controls remove the stored token without
removing bookings or previous attendance snapshots.

Reads run every 15 minutes while QMT is awake, for confirmed linked events from
yesterday through the next 30 days. Each cycle permits at most 50 unique source
reads and ten minutes of work, oldest attempts first; larger queues need more
than one cycle. The durable SQL lease and next-run time prevent overlapping
workers/restarts from bypassing the cadence. Keep the existing App Service's
Always On setting enabled for unattended cadence. There are no provider writes,
notifications, automatic event links, booking imports, schema migrations, new
resources or elevated database grants in this release.

Reviewed links and snapshots use existing `event_operations.payload`; an Office
save preserves the server-owned attendance block and uses the same revision and
transaction lock. The encrypted connection uses a reserved `user_settings` key,
hidden and write-protected in generic settings routes. The existing operational
DML grants cover both tables. Incomplete/malformed responses, changed bookings,
stale mappings and provider errors never become zero attendance. Previous
successful counts are retained with their last-sync time and an explicit error;
changed booking times hide the old snapshot. Anonymous schedule responses still
exclude attendance and provider IDs.

Release verification and the executed image/configuration changes are recorded
in the dated durable QMT skill handoff; the procedures above do not themselves
claim a deployed image or a connected production Spond account.

## Current friendly messages and event-card release: November 9, 2026

The friendly bilingual templates and event-card attendance/forecast UI are
merged, published and verified live at **20:19:41 Zurich (19:19:41 UTC)**.
PR #27 merged normally as `09b83b9a1e4f450ee673cd92f42bf1dfff9e60e3`,
the exact deployed runtime source. PR validation `42680063836`, main validation
`42680719645` and exact-main validation/publication `42680976827` succeeded.
The source suite passed 252 tests, with one gated SQL test skipped and no
failures; the separate disposable-SQL suite passed all 18 tests. Required lint,
build, cost/infrastructure checks and the non-root image smoke test passed.
Later documentation-only merges do not change this runtime source or require
image republication.

Current runtime image:
`ghcr.io/errandom/qmt@sha256:3194a217fe131000583a87410f3b3f05f2f10e674b3d4371966ff479742b436e`.
Immediate image rollback:
`ghcr.io/errandom/qmt@sha256:70efdcd79929f7471e8818e717a3ed143f6f0c491ece494f44dddb61d7e42773`.
Independent anonymous registry reads verified the immutable image, exact source
label and non-root `node` runtime. All 16 live static assets matched the image,
including correct PNG/ICO content types.

Only the existing App Service's `config/web.properties.linuxFxVersion` was
patched through ARM. App settings, complete non-image web configuration and
resource inventory fingerprints matched before/after. All five public
collection fingerprints matched: 10 teams, 9 sites, 19 fields, no equipment,
and 210 events in the October 1, 2026 to October 1, 2027 window. Health passed.
`spondReview:true`; weather, actual Spond sync, AI and transport remain false.
The disabled weather endpoint returned HTTP 503; no provider forecast call,
provider login, live mapping save, workbook edit, operational write or message
was performed. Rollback was prepared, not executed.

Durable evidence is archived in the QMT skill's
`references\releases\2026-11-09-friendly-cards` directory, including hashed
before/after snapshots, image/assets verification, source validation provenance,
the executed rollout record and the prepared patch/rollback bodies.

The signed **Android 1.0.2 (3)** app loads the updated website. No APK rebuild
or signing change was required. **Next owner step:** refresh the browser or
existing Android app and review a newly generated draft and stored attendance
counts. Existing manually edited/recorded messages are not overwritten.
Weather activation remains separate, pending provider eligibility/terms review.
Actual Spond sync and physical-device notification/battery/reboot acceptance
remain unfinished; neither was enabled or claimed complete by this release.

## Deployed friendly message templates: November 9, 2026

New English/German drafts use a friendly, direct tone, including `Hoi`, informal
German and `Danke & Gruss`. Facility details have readable calendar dates,
start/end times, hours/minutes, named recurrence weekdays and separate team/date
lists. The same QMT-generated note and personalized signature apply to facility
inquiries, follow-ups, decisions/rejections, event/transport messages and weekly
summaries. The note identifies generation, not automatic sending or human review.

Existing language-specific edits, recorded communications, recipient routing,
explicit send approval and booking/permit/shared-field safeguards are preserved.
No messages were sent or operational records changed during the release.
The templates are deployed with the card enhancement below and do not require
an Android wrapper rebuild.

## Deployed card forecasts and attendance: November 9, 2026

The event-card enhancement supports a daily venue forecast at the upper right,
confirmed | unanswered | declined beside teams, combined event totals, and team
response totals for the currently displayed events. These are response totals,
not unique roster headcounts. Missing, invalid and ambiguous counts remain
unavailable; real zero counts are preserved. Cancelled events are excluded from
team totals. Duplicate QMT/provider event IDs count only once, and a shared
provider event cannot be attributed to different teams merely by filtering.

The event API mapper now preserves stored attendance fields. Anonymous public
event DTOs still omit attendance; no participant identities are exposed. This
does not implement or enable a fresh attendance import or legacy Spond sync.
Multi-team combined counts still require a separately sourced per-team breakdown.

Weather is explicitly opt-in: `QMT_WEATHER_ENABLED=true` enables the read-only
`GET /api/weather` endpoint and capability; the default remains false. The service
uses only active, configured site coordinates, never user/team/event data, and
one batched Open-Meteo request for up to 50 locations and 16 forecast days.
Requests have an eight-second timeout, a 256 KiB response bound, schema checks,
30-minute caching/in-flight deduplication and a one-minute failure cooldown.
Provider errors are logged and surfaced without fabricated/stale-success weather.
The UI identifies daily (not match-time) forecasts, venue, Celsius range,
precipitation chance, retrieval time and source attribution. Away games without
verified destination coordinates and dates outside the returned horizon remain
unavailable rather than showing home/current weather.

Before enabling weather in a release, confirm the free provider's non-commercial
eligibility and usage terms: `https://open-meteo.com/en/terms`; API contract:
`https://open-meteo.com/en/docs`. The fixed free endpoint is not a paid-provider
integration. Weather remains disabled in production after the image-only release
above. No production flag, mapping, operational data or APK was changed, and no
provider forecast call was used for development or deployment verification.

## Previous one-to-many Spond mapping release: November 8, 2026

The administrator can select one Spond group/subgroup and explicitly review
multiple QMT team links before saving the grouped confirmation. Individual
editing and per-team read-only previews remain available. Unreviewed or
deselected teams preserve their saved links; discovery never saves automatically.
Existing and user-created Spond events remain untouched. No migration was needed.

Production was verified at **18:30:25 Zurich (17:30:25 UTC)**.
PR #25 merged normally as `d01f4cd195651574781d4278e12f51ec9e5a00bc`,
the exact deployed runtime source. PR validation `42504202275`, main validation
`42504498779` and exact-main validation/publication `42504517755` passed.
Later documentation-only merges do not change this runtime source or require
image republication.

Current runtime image:
`ghcr.io/errandom/qmt@sha256:70efdcd79929f7471e8818e717a3ed143f6f0c491ece494f44dddb61d7e42773`.
Immediate image rollback:
`ghcr.io/errandom/qmt@sha256:31fb679337e92f317e26df04c16b5100477e8589e5c641033bbfbbd4a853d5ec`.
Independent anonymous registry checks verified immutable digests, the exact
source label and non-root `node` runtime. All 16 live static assets matched
the image bytes, including correct PNG/ICO content types. The served lazy-loaded
Office chunk contains the new shared-group selector and multiple-team controls.

Only `config/web.properties.linuxFxVersion` was patched through ARM.
App settings, the entire non-image web configuration and resource inventory
fingerprints matched exactly before/after. All five public collection
fingerprints matched: 10 teams, 9 sites, 19 fields, no equipment and 210 events
in the October 1, 2026 to October 1, 2027 window. Health passed.
`spondReview:true`; actual Spond sync, AI, weather and transport remain false.
No grant, provider login/call, live mapping save, workbook edit, operational
write or message was performed during this release.

The signed **Android 1.0.2 (3)** app loads the updated website; no APK rebuild
or signing change was needed. All three latest delivery copies were verified
with SHA256 `c3d6391a1bb1a155bfea3a59d21a68e69fc4386b034b3a9c7ea60947f51898cc`.
The approved icon and integrated Refresh/Alerts dock are retained.
APK: `android\build\QMT-Android.apk`; native release and acceptance details
remain in `android\README.md`.

**Next owner step:** refresh QMT in the browser or existing Android app,
then rerun discovery and manually confirm the desired shared team links.
Provider sessions are in-memory and expire on restart or after 15 minutes.
Actual event synchronization is still disabled and unimplemented.
Physical-device and real-account Android notification/battery/reboot acceptance
remain unfinished; no release blocker remains.

## Previous QMT icon release: November 6, 2026

The approved blue-and-white QMT mark is deployed as the web favicon and packaged
as the Android launcher icon. Production was verified at **09:44:18 Zurich
(08:44:18 UTC)**. PR #22 merged as
`2a398d1e983de03e2c95c9118c5ebdd08bf885ca`, the exact runtime source.
PR validation `42188521258`, main validation `42188934684` and exact-main
validation/publication `42188951275` succeeded. Later documentation-only merges
do not change the runtime source and do not require another publication.

Current runtime image:
`ghcr.io/errandom/qmt@sha256:31fb679337e92f317e26df04c16b5100477e8589e5c641033bbfbbd4a853d5ec`.
Immediate image rollback:
`ghcr.io/errandom/qmt@sha256:855fb2b29036023a160ba53ffd3d3db2f7d694b00b76f6e66acdf4dcd12af9d6`.
Independent anonymous registry reads verified the digest, exact source label
and non-root runtime. All 16 live static assets matched the published image;
PNG/ICO responses had the correct image content types.

Both HTML entry points register the multi-size favicon and Apple touch icon.
The artwork was extracted from the approved design, not redrawn. Android uses
the same mark over brand navy with an adaptive foreground inside the safe
circle, circular-launcher support and a themed silhouette. The separate
monochrome notification status icon and native notification behavior are unchanged.

Only `config/web.properties.linuxFxVersion` was patched through ARM.
App settings, the complete non-image web configuration and resource inventory
fingerprints matched exactly before/after, including the already-retained
inactive debugger metadata described below. All five public collection
fingerprints matched: 10 teams, 9 sites, 19 fields, no equipment and 210 events
in the October 1, 2026 to October 1, 2027 window. Health passed.
Spond review remains enabled; actual Spond sync, AI, weather and transport remain
disabled. No migration, grant, provider call, mapping, workbook edit or message ran.

Signed **QMT Android 1.0.1 (2)** replaces 1.0 with the same package and signing
identity, permitting an in-place update. Both local APK copies were verified.
APK SHA256:
`ff3ccfeaa2bb47ebe8eadaa394d7a88dd80a21707c306bdde6994be26a3f9567`.
Certificate SHA256 remains
`923d24f52f718e7d2bd6773cb05b106e06212a3fe10734c3e60c5fcea82fca31`.
Java/API36 compilation, all 18 policy checks, packaged foreground pixels and
v2/v3 signing passed. Circle/rounded icon previews were inspected; this version
has not been tested on a physical phone. APK: `android\build\QMT-Android.apk`.
See `android\README.md` for install/update and opt-in notification instructions.

**Next owner step:** refresh the browser tab and install the new APK over the
existing app. Physical-device icon and real-account notification acceptance,
including battery/reboot scheduling, remain unfinished. No release blocker remains.

## Previous phone-ready web and Android release: November 5, 2026

The owner-requested web deployment was verified at **23:43:34 Zurich
(22:43:34 UTC)**. PR #19 merged as
`cdfc063a57b7f22385f2fbe0f24133ba4c67ee97`; PR #20 merged as
`6cb8c28ffdb7a44a817243401a8fe37a452b3f1d`, the exact deployed source.
PR validation `42121629463`, main validation `42122243333` and exact-main
validation/publication `42122247770` succeeded. A later documentation-only
commit does not change this runtime source or require another publication.

Current runtime image:
`ghcr.io/errandom/qmt@sha256:855fb2b29036023a160ba53ffd3d3db2f7d694b00b76f6e66acdf4dcd12af9d6`.
Immediate image rollback:
`ghcr.io/errandom/qmt@sha256:48413924d2ea56f58ae2ea8973083ac8bdccbdfe3d50973600448d3db96184ea`.
The earlier PR #19 image was published but never deployed.
Anonymous registry reads verified immutable digests, the exact OCI source
label and non-root `node` runtime. All 12 live HTML/JS/CSS assets matched
bytes read directly from this image, not a Windows build with different
line endings.

English-default/German-switchable message drafts and personalized
`Quick - Mean - Tough` / user-name signatures are live across the completed
communication experiences; `QMTadmin` signs as `Kenny`. Human-reviewed
QMT-to-Spond mapping destinations and save consequences are clearer.
Phone navigation, touch targets, input sizing, safe areas, wrapping toolbars
and bounded scrollable dialogs are deployed. Live-asset browser checks at
360px and 1280px passed all eight Office tabs without horizontal overflow or
runtime errors, using intercepted synthetic APIs and no operational writes.

App settings, resource inventory and all five public collection fingerprints
matched before/after: 10 teams, 9 sites, 19 fields, no equipment and 210 events
in the October 1, 2026 to October 1, 2027 window. Trusted HTTPS health passed.
`spondReview:true`; Spond sync, AI, weather and transport remain false.
No migration, infrastructure replacement, grant, provider call, mapping
confirmation, workbook edit or real message was performed.

**Explicit configuration exception:** the Azure CLI inserted
`remoteDebuggingVersion: "VS2022"` where the previous value was null.
`remoteDebuggingEnabled` stayed false. Replacing only this inactive metadata
value with null reproduces the entire original non-image configuration
fingerprint exactly. A targeted ARM null patch was ignored by the service.
The inactive value is retained and documented rather than risking a
whole-configuration recovery solely to clear it. The only intended
configuration change was `linuxFxVersion`; do not claim raw non-image
fingerprints are identical.

Signed **QMT Android 1.0**, package `com.errandom.qmt`, is available locally at
`android\build\QMT-Android.apk` (Android API26 minimum/API36 target).
APK SHA256:
`221b95ffc64d3c1b2af1c524eaf2291f3028e1eeb3eb24d34be3f09e7a247587`.
Certificate SHA256:
`923d24f52f718e7d2bd6773cb05b106e06212a3fe10734c3e60c5fcea82fca31`.
v2/v3 signing, Java/API36 compilation, 18 policy checks and 26 offline
Android emulator checks passed. The native trusted-HTTPS shell provides
keyboard/system insets, retry/offline handling and document export.
Alerts are opt-in, with approximately 15-minute network-connected checks,
not instant push. Synthetic notification delivery passed; real-account,
physical-device and battery/reboot delivery remain owner acceptance checks.
Signing material is outside source/OneDrive; preserve that identity for updates.
See `android\README.md` for installation, permissions and limitations.

**Next owner step:** transfer the APK to an Android phone, install it, sign in
normally, enable **Alerts** and grant notification permission. The first complete
check establishes a silent baseline; observe a later real schedule change or
new Pending request without expecting exact 15-minute timing. Actual Spond
synchronization remains disabled and unimplemented.

## Historical Spond compatibility release: November 5, 2026

The owner requested deployment at **18:08 Zurich**. The image-only rollout
completed and was verified at **18:17:40 Zurich (17:17:40 UTC)**.
PR #17 merged without a protection bypass as
`96052e38c579ee30b84a23eff0da5f520a2e7b91`. Main validation `42071841185`
and exact-main validation/publication `42071859447` succeeded, including
disposable SQL, lint/build, image smoke and anonymous digest pull.

Runtime image for that release:
`ghcr.io/errandom/qmt@sha256:48413924d2ea56f58ae2ea8973083ac8bdccbdfe3d50973600448d3db96184ea`.
Immediate code rollback:
`ghcr.io/errandom/qmt@sha256:1fadab2013799e6c3703a92d85c3e29c553489e3a2450c73bfc5d64b349af234`.
The November 3 image below is historical, not this release's immediate rollback.
Independent anonymous registry reads verified the OCI index, Linux amd64
manifest, configuration digests, exact source labels and non-root runtime.

This deploys `auth2/login` with nested `accessToken.token`, and optional
event-cancellation parsing. The corrected modules match the source used by the
successful November 4, 21:41 Zurich account probe at
`d9031b3833291b86c57d5d6f54f04cc901c81fd0`. That probe verified login,
discovery and a sampled parent-group event response, not full coverage or
subgroup recipient semantics. No Spond authentication or provider call was
repeated during this rollout.

Only `config/web.properties.linuxFxVersion` changed. All app settings remained
unchanged, including `QMT_SPOND_REVIEW_ENABLED=true`,
`QMT_SPOND_REVIEW_APPROVED=true` and `QMT_SPOND_ENABLED=false`.
Ten before/after invariant groups matched: app settings, non-image web
configuration, hosting/TLS, B1 plan, Basic SQL configuration, SQL firewall,
backup retention, network, budget and independent budget guard. No migration,
initialization, grant, resource replacement or infrastructure deployment ran.

The restarted runtime passed trusted-HTTPS health, protected administrator
sign-in and Spond status: review mode, event writes false, credential storage
none and durable quotas. Anonymous status returned 401; legacy configuration
returned 409. Nine traversed live HTML/JS/CSS assets matched their pre-rollout
bytes. Public collection fingerprints were unchanged: 10 teams, 9 sites,
19 fields, no equipment and 210 events in the October 1, 2026 to October 1,
2027 window. No mapping, booking, workbook or message was changed.

At that time the personalized bilingual request drafts remained separate, local
and undeployed; the current release above supersedes that status.
Actual event synchronization is still disabled and unimplemented.
The next account action is administrator-led in-app discovery followed by
explicit human mapping review; no mapping confirmation was automated.

## Live Spond review-only pilot: November 4, 2026

The owner-requested deployment is live at `https://qmt.errandom.com`, verified at
**18:11 Zurich (17:11 UTC)**. Administrators can run discovery, review mapping
suggestions, explicitly confirm selected mappings, and inspect read-only event
coexistence. Suggestions are never automatically saved. Actual event
publication/synchronization is not implemented or enabled by this release.
See `SPOND_INTEGRATION.md` for workflow, quotas and compatibility limits.

PR #14 merged as `304749a6476641df2a419dedca246900f4363231`.
Exact-main publication `41871891351` and main validation `41871835611` succeeded,
including disposable SQL, lint/build, Bicep, non-root image smoke and anonymous
digest pull. The live immutable image is
`ghcr.io/errandom/qmt@sha256:1fadab2013799e6c3703a92d85c3e29c553489e3a2450c73bfc5d64b349af234`.
The code-rollback image is the November 3 release:
`ghcr.io/errandom/qmt@sha256:f7d1405551c4e88f1983b48dc2b303ee15635cf041b3b031465670bad346aeea`.

Additive migration `005-spond-review.sql` was applied over the existing four
verified migrations through Azure-authenticated SCM on the existing app network.
All five checksums, database readiness and the runtime-credential Spond preflight
passed. The existing runtime principal received only SELECT, INSERT and UPDATE
on `dbo.spond_review_quotas`; no principal or broad role was created.
Fingerprints of all 11 existing operational tables were unchanged, using their
pre-migration columns. The new quota table was empty. Temporary remote operator
files and the transient credential input were removed.

Only the immutable image and the two approved review flags changed:
`QMT_SPOND_REVIEW_ENABLED=true`, `QMT_SPOND_REVIEW_APPROVED=true`.
`QMT_SPOND_ENABLED=false` remains unchanged. All unrelated settings, non-image
web configuration, hosting/TLS, SQL tier/retention/firewall, network, budget and
independent budget-guard fingerprints matched their before/after values.
No initialization, resource replacement, stop/start rehearsal or workbook edit
was performed. An initial operator readiness check treated the old runtime's
missing capability as an error and automatically restored the prior image;
after correcting the wait condition, the final rollout completed successfully.

Independent anonymous registry reads verified the source label, manifest/layer
digests and non-root runtime. All 12 live HTML/JS/CSS assets matched the published
image bytes over trusted HTTPS. Administrator sign-in and review status passed:
`spondReview:true`, `spond:false`, `mode:review`, `writesEnabled:false`,
`credentialStorage:none`, `quotas:durable`. Anonymous review status returned 401;
the retained legacy configuration endpoint returned 409. Before/after public
collections matched: 10 teams, 9 sites, 19 fields, no equipment and all 210
events in the October 1, 2026 to October 1, 2027 window.

No provider call, mapping confirmation, operational booking write or participant
notification was made during the original release verification. The interactive
account probe had not completed at the 18:11 rollout; a later corrected-source
probe passed at 21:41 Zurich, as recorded in the November 5 release above.
Do not treat deployment or the sampled probe as proof of provider completeness
or subgroup semantics. The original November 4 rollback was the November 3
image with review flags disabled; retain the additive schema and migration
ledger. Use the newer immediate rollback recorded above for November 5.

Evaluated 2026-10-22. **The owner-authorized single-club pilot is live.**
The explicit instruction to go live was recorded at 22:39 Zurich. It supersedes
the disabled-acceptance-only authorization below; it does not approve AI,
cross-venture changes, automatic budget recovery or unlimited spending.
The independent product page is `https://www.errandom.com/QMT/`, linked from
the main website. The verified branded application is
`https://qmt.errandom.com`, now used by the published **Open QMT** link.
The approved GoDaddy CNAME/TXT records resolve,
Azure's hostname is bound with managed SNI TLS, and trusted HTTPS, assets,
administrator API sign-in and SQL-backed reads passed on October 22.
The original Azure hostname remains available; no forced redirect was added.
Keep both DNS records for hostname ownership and managed-certificate renewal.

The existing Linux B1 single-worker, Always On app and Basic SQL database were
promoted, not replaced. QMTadmin API and real Edge-browser sign-in passed.
Real Basic-tier CRUD, adjacent/conflicting/concurrent booking and transaction
rollback checks passed; their exact synthetic rows were removed. The guard's
managed identity actually stopped the site (public HTTP 403); an explicitly
authorized owner restart restored healthy HTTPS and SQL-backed empty collections.
The temporary acceptance-restore database was then deleted; the production
database and its configured retention were preserved.

`infra/production-budget.bicep` creates the QMT-resource-group-only CHF 30
Monthly budget and operations email action group. The guard is now **Schedule**
with cron `0 * * * *`, `--execute`, zero retries and the unchanged pinned image.
Its identity can only read the exact budget and read/stop the exact site.
The missing-heartbeat/suspension log alert is enabled with real query validation.
Retained logs prove both `within_budget` and `suspended`. Email test requests
currently fail with Azure `BadRequest: There are no valid receivers in the request`,
despite an enabled receiver. **Notification delivery is not verified.**
App suspension is not an invoice cap: billing data is delayed and B1, SQL,
backups and monitoring can keep charging after application stop.

The acceptance deletion task is **disabled**, and the local acceptance operator
rejects execution after recorded production promotion. Never re-arm it or replay
the old initialization/restore/deployment. The owner receives the unchanged
administrator credential through the local masked **QMT administrator access**
desktop shortcut, not chat or a plaintext file.
See `plan/evidence/production-launch-2026-10-21.md` for exact evidence and
the dated domain cutover and remaining notification, extended acceptance and
seven-day stabilization work.
The historical preparation record below does not describe current live state.

## Live request and weekly-widget release: November 3, 2026

The owner's instruction to deploy all completed changes is fulfilled at
`https://qmt.errandom.com`, verified at **22:30 Zurich**. The release adds
request deletion with communication-state checks, named outdoor/indoor contact
presets, assisted F-N meeting-room workbook rows and manual-entry confirmation,
and the public, read-only `/embed/week` iframe widget. The widget provides
actual weekly bookings, team filters, week navigation, cancellations, unassigned
locations and copyable embed HTML. It never restores a visitor's login session.

Runtime source `b5033473c83e24cce5b971d032af39ce26ed318e` passed exact-source
validation/publication `41721301367`, including disposable SQL integration,
build/lint, non-root image checks and anonymous registry digest pull.
PR #13 merged as `07fb39e4c15cda06a1ab4953cf771357c5c14c31`.
The live image is
`ghcr.io/errandom/qmt@sha256:f7d1405551c4e88f1983b48dc2b303ee15635cf041b3b031465670bad346aeea`.
The preceding code-rollback image is
`ghcr.io/errandom/qmt@sha256:69e5c49aa7dc88605e286abf48d9de824c0b6aa18694495f490d3c67e5806a94`.

No migration or operational write was required. Existing non-image hosting
configuration and all existing app settings matched their before/after
fingerprints. Only the image and the private `QMT_MEETING_ROOM_WORKBOOK_URL`
setting changed. The workbook URL remains outside source, images and public
client output. Before/after public collection fingerprints matched: 10 teams,
9 sites, 19 fields, no equipment and all 210 events in the October 1, 2026 to
October 1, 2027 window. No request was deleted or advanced, no workbook was
edited and no email was sent during release verification.

Trusted HTTPS served the standalone widget and its linked assets. The weekly
API returned 10 actual bookings for November 2-8 without private fields.
Anonymous workbook-target reads and request deletion returned 401.
The normal application permits same-origin framing only; the widget permits
HTTPS parents by default. Set `QMT_EMBED_ORIGINS` to the intended HTTPS website
origins to narrow that policy. This release does not configure email or enable
Spond or AI. Separate Spond transport groundwork is tracked in draft PR #14;
it is not part of this deployed image or an authorization to import bookings.

## Live operations enhancements: November 2, 2026

The release adds linked, explicitly approved email; seasonal requests with
per-occurrence previews and partial decisions; time-dependent field halves and
external users; event readiness checklists; and the Actions queue. **Deployed and
verified at 19:25 Zurich.** No real email, external allocation, request decision
or schedule edit was made during deployment or verification.

Runtime source `202b0951ddb8b643377e44822ef7da7e5bb8b4a4` passed exact-source
validation/publication `41499142577`, including disposable SQL integration,
non-root image smoke checks and anonymous digest pull. PR #11 merged as
`5bede7df225a980181f19b8310d874b369b94b64`; main validation `41499841673` passed.
The current application image is
`ghcr.io/errandom/qmt@sha256:69e5c49aa7dc88605e286abf48d9de824c0b6aa18694495f490d3c67e5806a94`.
The previous code-rollback image is
`ghcr.io/errandom/qmt@sha256:819ec8edb000d80b015851e757836399ea799ba66f30d2746957ff69185c6ef3`.

Additive migration `004-operations.sql` was applied through Azure-authenticated
SCM using the existing app network and operator credentials. All four migration
checksums and database readiness passed; all eight existing operational table
fingerprints were unchanged. The existing runtime principal received only the
12 table-level DML grants below; its login and read access were verified.
Never run initialization against the existing database or repeat provisioning.
For another existing runtime principal, a database operator must grant only
`SELECT, INSERT, UPDATE, DELETE` on `dbo.event_operations`,
`dbo.external_allocations` and `dbo.request_communications` to that exact
principal. Review and substitute the already-configured runtime username:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.event_operations TO [existing_qmt_runtime_user];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.external_allocations TO [existing_qmt_runtime_user];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.request_communications TO [existing_qmt_runtime_user];
```

These grants are already applied in production. Fresh
provisioning includes the new tables; it deliberately still refuses to modify
an existing principal. Do not grant database roles, schema changes or migration
table access. Validate migrations with `db:check` and run the disposable SQL
suite in CI before release. Local SQL integration requires Docker; no production
database is an acceptable substitute.

Only the running site's image configuration changed after the database step.
All 13 captured non-image infrastructure invariants matched, including app
settings, hosting configuration, Basic SQL, TLS, resource inventory, budget
and guard settings. Eight live public assets matched the published container
byte-for-byte, and 13 backend files matched the exact source commit.
Administrator sign-in, SQL-backed reads, protected operations routes and
read-only desktop/mobile Edge checks passed, with no attempted writes,
uncaught exceptions, failed API reads or horizontal mobile overflow.
All six existing API collection fingerprints matched after excluding only the
new empty external-allocation projection: 10 teams, 9 sites, 19 fields,
210 events in the October 1, 2026 to October 1, 2027 window, no equipment and
two requests. Operational metadata, external allocations and linked messages
were empty. No existing records were changed.

Email is optional and **remains disabled in production**: no `QMT_MAIL_*`
settings are configured, and the live request workflow displays that nothing
will be sent until a mailbox is connected. Supply the four `QMT_MAIL_*`
settings in `.env.template` through the approved secret/configuration channel.
The adapter uses Microsoft Graph client credentials for the configured club
mailbox: authorize sending and reading that mailbox only using the tenant's
mailbox-scoping mechanism. Do not create tenant-wide access for convenience.
Test with a designated test mailbox/recipient before enabling real sends.
Provider acceptance is not delivery confirmation. Interrupted sends remain
visible as sending/unknown; check Sent Items before explicitly composing another
message. Syncing replies never approves a request automatically. Queue reminders
are in-app only, not scheduled emails.

Existing events are not guessed into series. New recurring bookings and approved
seasonal requests receive durable series IDs. Historical series can still be
edited individually. North/South halves need an agreed physical interpretation;
no actual Rugby allocation has been entered. Changing a duration with an existing
explicit timeline is rejected unless a complete replacement timeline is supplied.
Readiness prompts are not legal requirements or proof of permit approval.

Retain the additive schema and operational records for code rollback. Older
backends do not enforce external allocations or preserve the new operational
metadata, so reverting code requires reviewed operational handling rather than
assuming the old backend remains functionally equivalent.

## Previous facility workflow and schedule release: October 30, 2026

The owner's October 30 instruction to push the completed updates into production
is fulfilled at `https://qmt.errandom.com`, verified at **10:30 Zurich**.
Facility requests now track receipt acknowledgment, evaluation, City of Zurich /
ZVIS routing, external response, approval or rejection, and separate requester
notification. Fields and meeting rooms have distinct allocation choices.
Communication drafts remain manual: opening or copying one does not record it
as sent. Game-permit considerations are notes, not a completed permit workflow;
approval creates one booking, not a multi-day series.
The release also includes the compact day-first schedule, stable team colors
and activity-weighted day widths.

Runtime source `5430126f4d804ab7d6a71632618fa28d1cba2535` passed exact-source
validation/publication `41032940459`, including real disposable SQL integration,
non-root image smoke checks and anonymous digest pull. PR #10 merged as
`b87390d5d3910a1164589b2eeddb05241be163f1`; main validation `41033442905` passed.
The current application image is
`ghcr.io/errandom/qmt@sha256:819ec8edb000d80b015851e757836399ea799ba66f30d2746957ff69185c6ef3`.
The previous code-rollback image is
`ghcr.io/errandom/qmt@sha256:9b1fa71ec753315974386650c47177f6908799f1239e630bb9929cd87cbee4d5`.
Workflow history uses existing request JSON payloads; no migration was needed.
Before reverting to the previous backend, review how requests with workflow
metadata will be handled: the previous backend does not understand that metadata.
Do not roll back by restoring or deleting operational records.

Only the running site's image configuration changed. All 25 captured non-image
invariants matched, including app settings, B1 single-worker Always On hosting,
Basic SQL, TLS, network/firewall, resource inventory, budget and guard settings.
All seven public frontend assets matched the published container byte-for-byte;
the container's workflow and request backend files matched the exact source
commit. Trusted HTTPS, administrator sign-in, SQL health and authenticated
workflow input validation passed; anonymous workflow writes returned 401.
The six API collection fingerprints were unchanged: 10 teams, 19 fields, 9 sites,
210 events in the October 1, 2026 to October 1, 2027 window, no equipment and one
request. Read-only production Chromium checks confirmed the compact schedule,
the existing request's workflow, readable desktop/mobile labels, no horizontal
mobile overflow and no uncaught exceptions. No real request was advanced and
no communication was sent during verification.

## Previous operations release: October 30, 2026

The owner's October 29 instruction to "push this all into production" is
fulfilled at `https://qmt.errandom.com`, with live verification after midnight
Zurich on October 30. This release includes aligned Operations Office cards,
optional published facility schedule sources and checks, detailed booking
conflict review with explicit overrides, shared-field indicators, booked-fields-only
scheduling, the recurring Weekly program and the range selector below Upcoming Events.
Specific week remains available for actual dated bookings and exceptions.

Runtime source `f7edf8b180024deb5c1dfb2293dbc19c346e41c9` passed exact-source
validation/publication `40969738295`, including disposable SQL integration and
anonymous digest pull. PR #9 merged as
`118367534cdb2c624c762fbff847b2e5183a48e6`.
The current application image is
`ghcr.io/errandom/qmt@sha256:9b1fa71ec753315974386650c47177f6908799f1239e630bb9929cd87cbee4d5`.
The previous compatible code-rollback image is
`ghcr.io/errandom/qmt@sha256:bc08e479fd0ccf1e4ac1f0bf1b9239e70395a5c933c21a2a24971fc21c85e6a4`.

Migration `003-published-schedules.sql` was applied through Azure-authenticated
SCM using the existing app network, without changing SQL firewall or permissions.
It adds only two nullable site columns. All migration checksums and database
readiness checks passed, and fingerprints of all eight operational tables were
unchanged. Temporary remote migration files and credentials were removed.
For code rollback, retain the additive columns and migration record; do not
replay initialization, restore or event deletion.

Only the already-running site's image configuration was patched. All 26
non-image before/after invariants matched, including application settings,
network/firewall, B1 single-worker Always On, Basic SQL, managed TLS, resource
inventory, budget and the independent guard's identity, configuration and image.
Trusted live HTTPS matched all seven container assets byte-for-byte; protected
administrator sign-in, SQL, metadata reads and published-schedule route validation
passed with operational collections unchanged. Actual production Chromium checks
passed for desktop/mobile disclosure placement, both schedule modes, zero
horizontal mobile overflow and no uncaught exceptions.
Notification delivery, extended acceptance and stabilization remain open.

## Previous UI release: October 28, 2026

The owner-approved Sites card layout is live at `https://qmt.errandom.com`.
Cards use equal-height grid rows, and their status controls stay at the bottom
when amenity tags wrap or screen width changes. Permissions and status behavior
are unchanged.

Source `a6e75b8e56196be87712c92e7a3c9507dff9840f` passed exact-source
validation/publication `40776169926`. PR #8 merged as
`42c6ee764483dcc54f044e31b05f1d52c8a64b5f`; main validation `40776973274`
passed. The current application image is
`ghcr.io/errandom/qmt@sha256:bc08e479fd0ccf1e4ac1f0bf1b9239e70395a5c933c21a2a24971fc21c85e6a4`.
The previous application image, retained for compatible code rollback, is
`ghcr.io/errandom/qmt@sha256:b22324538b8545512d78518b8eb0931b6813892ce1a153b400553038b39cb26d`.
Backend, dependencies and schema are unchanged.

Only `config/web.properties.linuxFxVersion` was patched on the already-running
site, using a JSON-file ARM patch. At **23:07:17 Zurich**, trusted HTTPS, health,
SQL-backed sites read and anonymous rejection by the protected database probe
passed. Live entry JS/CSS and the OperationsOffice chunk matched the published
container byte-for-byte; the Windows build has different asset hashes and was
not used as the production byte reference. Before/after snapshots matched all
26 non-image invariants, including app settings, B1 single-worker Always On,
Basic Online SQL, managed TLS, resource inventory, budget and guard configuration.
No operational data, credentials, resources, migrations or budget policy changed.
The separate guard retains its approved image. Notification delivery, extended
acceptance and stabilization remain open. See the October 28 evidence below.

## Previous UI release: October 22, 2026

The owner-approved header and schedule-window refinements are live at
`https://qmt.errandom.com`. The header now places **an errandom product** beside
**QMT | Operations**, without the former prominent About link. The schedule
window uses the existing glass-card surface, navy/accent palette, shared form
controls and responsive layout; its date-loading behavior is unchanged.

Source `b8a43313c2c2b0c8fc73212d370b18b56b14e755` was validated and published by
manual run `39791274017`, including an anonymous immutable-digest pull. PR #7
merged as `92f726d7546b7ba71dae85f599292fbae865238e`; main validation
`39792410526` also passed. That release's application image was
`ghcr.io/errandom/qmt@sha256:b22324538b8545512d78518b8eb0931b6813892ce1a153b400553038b39cb26d`.
Its previous application image was
`ghcr.io/errandom/qmt@sha256:5d1a7ce14520fadcf88120be60dc143a995d1cc9b4141a4f77f4b63940241b8e`.
Server, dependency and schema sources are unchanged between these images.

Only the existing site's `config/web.properties.linuxFxVersion` was updated.
On Windows, use a JSON-file ARM configuration patch for this value: passing its
literal pipe through `az.cmd` can be parsed as a command pipeline. A failed CLI
attempt was independently reconciled as leaving the old image Running before
the successful exact-property patch; no stack deployment was replayed.

At **16:06:26 Zurich**, trusted public Edge rendering passed at 1440px and 390px,
including the attribution, real design styles, keyboard-operated disclosure
and single-column mobile form. Trusted HTTPS/assets, health, protected
administrator API sign-in and SQL-backed reads also passed. Before/after
snapshots matched 25 non-image invariants, including a checksum of all app
settings, B1 single-worker Always On, Basic SQL, managed TLS, budget definition,
guard identity/configuration/image and heartbeat rule. No operational rows or
credentials were changed, and no resources or migrations were created.
The guard deliberately retains its previous approved image. Notification
delivery, extended acceptance and stabilization remain open.
See the dated UI-release section in the production evidence below.

## Historical disabled-foundation preparation

This replaces the old App Service guide, including its unsafe example credentials
and broad SQL-network advice. Rotate every historical credential and signing key
before reuse; deleting examples does not remove them from Git history.

The published acceptance image is
`ghcr.io/errandom/qmt@sha256:5d1a7ce14520fadcf88120be60dc143a995d1cc9b4141a4f77f4b63940241b8e`,
from source `55e8346215e1e696d1ccafa05c6afbe1d1322e2d`.
Validation `39598721077` and publication `39598766729` succeeded; fresh anonymous
digest pull and an independent manifest request passed. The first exact-scope
apply created hosting/network/monitoring foundations, but Azure rejected SQL
creation with `PasswordNotComplex`. The protected SQL credentials were repaired;
the administrator's application password and signing key were preserved.
The old provider preview subsequently failed with `DeploymentWhatIfTimeout`.
After independently confirming that terminal failure, one fresh preview succeeded.
`scripts/review-app-service-continuation.cjs` verified the exact 17 approved IDs,
independent live ownership/capacity/network/logging invariants and only four
explicit resource-specific reference/default reconciliations before one continuation.
No general permission to modify resources was introduced.

The continuation created the Basic database and disabled application, but its
retention operation failed `LongTermRetentionMissingWeekOfYear`. A separate
provider preview and exact-policy repair supplied `weekOfYear: 1`, keeping
weekly retention `P4W` and monthly/yearly retention `PT0S`. Live Azure normalized
the unused week back to zero and confirmed the intended weekly-only policy.
The failed deployment history is retained; it was not replayed to obtain a green status.
Protected initialization created the schema, least-privilege application user
and QMTadmin, and verified removal of the single-IP operator rule. Live cleanup
inspection verified the unchanged administrator, zero operational rows, Basic
SQL, immutable image, Always On and absence of retained backups.
The site is explicitly disabled; this provider reports `Disabled`, not `Stopped`.
Initialization accepts either exact non-running state only with `enabled=false`,
and still rejects a running, enabled or unknown-state site.

The single post-initialization Basic restore is now verified. Two initial bounded
waits ended without a request. A later fixed-time check found a genuine continuous
restore point; exactly one restore was submitted on October 21 at 22:16:23 Zurich.
Its first GET returned 404 before the target became visible. Read-only
reconciliation, without another PUT, confirmed the exact Online Basic/5-DTU,
Local-redundancy target. Protected restored-schema/migration, unchanged QMTadmin
and zero-operational-data checks passed at 22:22:16 Zurich; the temporary
single-IP SQL rule was removed and the app remained disabled.
Final independent inspection verified both source and restored databases as
eligible for the existing conditional cleanup, with no retained backups.
No restore waiter remains active. Never repeat the recorded restore PUT or
replay the failed historical deployment. The temporary restored database remains
inside the original bounded acceptance/cleanup scope, not a permanent second stack.
Operator commit `9178eace4b11e143264fbfd1c6105aff8ccf110d` passed exact validation
run `39659275216`; the runtime image remains unchanged.
The real current-owner Windows cleanup task remains armed with its original
October 22, 2026, 14:50:55 Zurich deadline, but
requires a logged-in owner, working machine/network and Azure authentication.
No resource deletion was executed or proven by that pre-deadline check.
The provisioned foundation and temporary restored database can incur charges.
Enabled application acceptance, actual notifications/suspension/recovery and
production publication remain unverified and separately gated.
Historical proposal sections below do not override this
current status or the owner's separately recorded bounded acceptance approval.

## Boundaries and authorization

Push and pull-request workflows validate only. An explicitly selected manual run
of `main_qmt.yml` can additionally publish an acceptance image after validation:
`publish_acceptance_image=true`, the exact reviewed `approved_commit`, and the
named candidate branch are required. Package-write permission exists only in
that separate job, using its ephemeral GitHub token; ordinary validation remains
read-only. Both jobs use `scripts/smoke-image.sh` to verify the actual built image.
No workflow logs into Azure, creates cloud resources, runs a production migration,
changes DNS, or deploys. The manual
preflight additionally uses a `qmt-release` GitHub environment: configure required
reviewers and restricted release branches before relying on that approval surface.
Local code changes are not spending authorization.

Use a QMT-only resource group, database, least-privilege application SQL user and
independent signing secret. The Container Apps environment may be shared only after
its Consumption profile, incremental charges, networking and monitoring have been
reviewed. Never change another venture's replica count, credentials or resources.
The proposed production release uses SQL credentials, not a claim that managed-identity database access
has already been implemented.

Set `QMT_CLUB_NAME` for the actual production club, never a demonstration. `QMT_TRANSPORT_EMAIL` is optional and
has no historical-club default: transport draft generation returns 503 until a
recipient is configured. Cancellation/update drafts use only recorded site/team
contacts, with no inherited fixed recipients. Draft generation does not send mail.
Recurring away games never automatically open a draft per occurrence: staff use
the bus action on an individual saved game. This avoids bulk SQL/mail-client
activity and lets staff retry a failed draft without recreating the booking.
The schedule initially reads previous 7/next 90 days; its date-window control and
CSV export can fetch a selected interval of at most 366 days without unbounded reads.
End dates are preserved in the editor, cards, shares and CSV (`End Date` column).
The weekly view clips overnight/multiday intervals to each visible day and uses
half-open boundaries: an event ending at midnight does not occupy the following day.

## Historical release-gate checklist

The owner authorized the live pilot above with the documented residual limits.
The checklist remains the broader acceptance standard, not a claim that every
item passed or that the older Container Apps release flags apply to B1.

1. Owner-approved full cost/traffic envelope and response policy, dated within
   31 days. The owner supplied a CHF monthly budget and fewer-than-five-user,
   rare-concurrency expectation on 2026-10-20; the amount is privately recorded.
   The old unapproved USD 20 target is superseded, not silently converted into a
   USD approval. User count does not cap public traffic, log/egress volume or
   replica lifetime. On 2026-10-21 the owner rejected idle sleeping and approved
   suspension when the monthly budget is reached. Implement and verify this
   QMT-only response; it is not authorization to provision or accept overruns.
2. Review the priced ancillary proposal in `infra/cost-model.json` against the
   actual environment, monitoring, registry/build/cache and DNS configuration.
   Variable log ingestion, egress and DNS queries are added to fixed base charges,
   not treated as free. Refresh regional retail inputs within 31 days; record
   actual billing currency/FX/tax separately. No shared Azure free grants are
   assumed. For a full 31-day always-on month, the four unmeasured known subtotals
   are approximately USD 28.93, 31.39, 222.77 and 259.31 before tax, including a
   conditional USD 1.34538 budget-automation allowance; they are not caps. The release gate requires
   approval covering every modeled case, not only expected use. See
   `plan\evidence\cost-baseline-2026-10-20.md` for assumptions and remaining gaps.
3. The owner approved fresh production with manual application entry on
   2026-10-20; historical recovery no longer blocks launch. Verify schema creation
   without sample operational data and complete empty-state onboarding before
   public release. Preserve any subsequently discovered source; never import
   it automatically. Sample data and unvalidated browser caches are not recovered operational data.
   The original frontend cached eight operational datasets; its failed refresh
   could overwrite five of them with empty arrays. Do not clear legacy QMT site
   data or reload/refresh a surviving tab before preserving any authorized private
   copy. See `plan\evidence\data-recovery-2026-10-20.md` for the exact keys and
   inventory scope and local-only `scripts\export-legacy-cache.js` helper. The
   helper never refreshes the app, writes storage, uploads data or imports records.
   A downloaded candidate is not a verified recovery source. No browser records
   have been recovered.
4. Run the disposable SQL integration suite and a real Basic-tier acceptance/load
   test. Verify adjacent/conflicting/concurrent bookings, whole-series rollback,
   update rollback, duplicate request submission, atomic approval and restart.
5. If historical records are later imported, classify their timestamps first. Existing clients treat SQL timestamps as club
   wall-clock values serialized with a UTC-like suffix, not proven UTC instants.
   This relaunch preserves those display semantics; it does not silently convert
   historical data. `QMT_TIMEZONE` is descriptive, not a timezone-conversion engine.
   Review DST/date-boundary behavior for the configured club before launch.
6. Validate the built image, actual ingress IP/proxy chain and rate-limit behavior.
   `trust proxy = 1` must match the approved ingress; test spoofed forwarded headers.
   Keep a direct ingress path from bypassing any chosen edge control.
7. Rehearse restoration, stop/resume, rollback, TLS and independent maintenance
   messaging. Confirm cost-alert delivery and data/backup retention requirements.

Only set `approval.*` flags after collecting the named evidence; editing a flag is
not evidence. Require review of the model and corresponding evidence against the
same commit and image digest. A passing gate is an administrative check, not a
guarantee of future spending or an authorization bypass.

## Provisioning proposal (not automatically applied)

`infra/main.bicep` describes only QMT Consumption app configuration against an
existing approved environment: 0.25 vCPU, 0.5 GiB, min 1/max 1 replica, single active
revision, HTTPS ingress and no paid/external integrations. Image repository and
64-character digest are separate parameters, so the resulting reference is always
digest-based. A single revision setting does not remove rollout overlap; the cost
model includes a two-replica full-month stress scenario.

The earlier replacement proposal for Premium App Service was Container Apps
Consumption. A single-worker Linux B1 stack is now authorized for bounded
disabled acceptance, not production release. The retained ACA template keeps one replica running, even without
traffic; there is no routine idle scale-to-zero. The model conservatively charges
all 744 hours of a 31-day month at the active rate, without idle discounts or an
assumed suspension. SQL, logs, backups, HTTP requests and other services remain
separately priced. No subscription free grants are assumed. This avoids deliberate
idle cold starts, not restarts during deployment, failure or platform maintenance.
Price any external availability monitoring before enabling it.
`infra/environment.bicep` optionally creates a Consumption-only environment using
an existing approved Log Analytics workspace. It creates no dedicated profile,
workspace, private endpoint, NAT gateway, registry or App Service plan. Review the
workspace's retention, ingestion and cap settings and any existing environment's
paid features before using it. No log budget is enforced by this template.
The app/database names default to `qmt-production`; the app template outputs
`appHostname`. These defaults do not authorize production provisioning.

`infra/database.bicep` describes a separately approved Basic database (5 DTUs,
2 GB maximum, local backup redundancy, seven-day short-term retention) on an
existing QMT-only logical server. It creates neither the logical server nor
firewall rules. Basic is an evaluation candidate, not a verified performance fit.
The cost proposal additionally allows 10 GB-month of LRS long-term backup storage
for four-week weekly retention and one 24-hour Basic restore target each month.
The database template now configures four-week weekly LTR, with no monthly or
yearly copies. This has not been deployed: approve its actual storage cost and
verify an actual LTR restore before claiming protection after server deletion.
Backup volume and the weekly snapshot's potential data-loss window need acceptance.
Staging plus production databases are two billed databases: do not leave both
running without pricing both or treat this one-instance model as covering both.
Initial acceptance uses the stack to be promoted, within its modeled usage and
temporary restore-target allowances; additional targets or longer overlap must
be separately priced and approved.

The app image must be in an approved public registry and contain no secrets or
club data. A private registry requires a separately implemented and reviewed pull
identity; this template does not pretend it is already wired.

After cost/release approval, `scripts/prepare-release.ps1 -Image <repository@sha256:digest>
-OutputPath <local-output.json>` checks the image reference, enforces the release
gate and compiles the app template. It never applies it. Review parameter files
outside the repo; inject secrets through an approved secret store, not command-line
values or committed files. An authorized operator must run Azure validation and
what-if against the exact target subscription/resource group before an approved
apply. Reject any unexpected resource, region, SKU, dedicated profile or cross-
venture change. Provisioning itself requires separate authorization.

Do not enable SQL's broad "Allow Azure services" firewall rule. Choose a reviewed
egress allowlist or separately priced private networking, prove connectivity from
the actual environment, and reject release if it cannot meet the security/budget
constraints. No permissive firewall rule is created by either template.

### Lower-cost always-on acceptance candidate

The 2026-10-21 read-only preflight found no surviving QMT resources in the selected
subscription. The existing shared Consumption environment has no custom VNet;
its broad published outbound-address set is not a verified narrow SQL allowlist.
Do not solve this by opening SQL to all Azure services or changing that environment.

`infra/app-service.bicep` is a separate Linux Basic B1 candidate, **not** the former
Premium App Service footprint. On 2026-10-21 the owner authorized bounded, disabled
foundation acceptance and conditional cleanup of test-only resources, not public
production release. Actual current-month headroom, protected credentials and an
anonymously pullable image remain required before provisioning. The official
Switzerland North B1 Linux retail quote retrieved 2026-10-21 is USD 0.0198 or
CHF 0.0165/hour: USD 14.7312 or CHF 12.276 for 744 hours of hosting alone, before
SQL, backups, logs, traffic, automation, DNS and tax. Meter ID:
`1114cccb-d03c-4e4e-9ea8-14358c9eee53`. Do not substitute Windows or DevTest prices.

The candidate creates one Linux B1 worker, a QMT-only SQL logical server and the
existing Basic/PITR/LTR database module, an isolated VNet with a delegated `/26`
App Service subnet, and a SQL service endpoint/rule for **only that subnet**.
SQL's public endpoint remains enabled because service endpoints use it; no
public-IP firewall rule or "Allow Azure services" rule is created. It uses SQL
Proxy connections over TLS, without a NAT gateway, private endpoint, public-IP
resource or load balancer. Basic App Service supports regional VNet integration;
service-endpoint traffic follows that integration without routing all internet
traffic through the VNet. Real Basic-tier connectivity is still unverified.

The app uses the digest-pinned public image, SQL-free health checks and Always On.
FTP/SCM basic publishing credentials are disabled. App settings receive a separate
least-privilege SQL username/password, never the SQL administrator credentials.
All passwords/signing keys are secure deployment parameters without defaults or
outputs; supply them through the protected provisioning process. The app defaults
to `appEnabled=false` until an authorized operator completes migration, SQL-user
provisioning and acceptance preparation. This is prelaunch isolation, not an idle
sleep policy. The template creates no operational SQL user, bootstrap account,
budget, action group, custom-domain binding or certificate. In particular, the
subnet-only SQL rule does not grant the local machine or GitHub-hosted runner
bootstrap access. The separately approval-gated `scripts/initialize-app-service.cjs`
now prepares a temporary **single-operator IPv4** path, with verified cleanup and
no broad access; see the protected initialization procedure below. Disposable SQL
checks passed in CI; protected initialization and a live empty-data audit have
also passed against the disabled Azure Basic acceptance foundation.
Do not present this as a verified one-command deployment.

### Subscription-scoped B1 foundation preview

`infra/app-service-acceptance.bicep` wraps the B1 foundation in a new QMT-only
resource group, permitting an Azure subscription what-if **before that group
exists**. It allows only `qmt-production` or `qmt-staging` in Switzerland North
and fixes `appEnabled=false`; there is no app-start parameter. It does not add
budget resources, enable the guard, publish an image or authorize any apply.

Run `scripts\prepare-app-service.ps1 -SubscriptionId <reviewed-subscription-id>
-Image <ghcr.io/errandom/qmt@sha256:complete-digest> -OutputPath <new-private.json>`
to compile without an Azure request. Output files must be new files in an
existing private directory. Add `-AzureWhatIf` only for an authorized read-only
provider-level preview using the existing Azure CLI login. The script explicitly
targets the subscription without changing the CLI default, supplies **synthetic
preview-only credentials**, saves the full result beside the compiled template,
and rejects provider errors, incomplete/omitted resources, unresolved changes,
existing-resource mutations, extra resources and cross-venture changes. It also
requires the preview to retain one Linux B1 worker, disabled app and 2 GB Basic SQL.
Do not reuse the synthetic parameters for provisioning or treat successful
what-if as quota/capacity, cost, actual connectivity or launch acceptance.

The 2026-10-21 provider-level preview expanded all 17 foundation resources as
creates within the new QMT resource group, with no existing-resource mutations.
An independent inventory afterward still found no QMT resource group. This
proves preview execution, not deployment. Actual provisioning must separately
use protected fresh credentials, the approved published digest and bounded
spending authorization; this script implements no deployment operation.

For the separately authorized image operation, dispatch `main_qmt.yml` on the
exact reviewed candidate branch with `publish_acceptance_image=true` and
`approved_commit=<full-head-sha>`. The job rebuilds and smoke-tests the image,
publishes only `ghcr.io/errandom/qmt:acceptance-<full-head-sha>`, and records the
registry digest in its summary. It then attempts a digest pull with a fresh,
unauthenticated Docker configuration. A push alone is not Azure image readiness.
New GHCR packages default private; if the anonymous check fails, the owner must
make this package public in GitHub's package settings and anonymous access must
be independently verified. Do not add registry credentials to Azure, expand the
local GitHub token or create a paid registry to bypass this check.

Separate read-only checks on 2026-10-21 listed Switzerland North for subscription
Linux B1, reported Web regional usage of 0/30 instances and SQL server usage of
0/250, and returned both proposed names as available. SQL capabilities listed
Basic as available. The Web usage endpoint required API version `2025-05-01`;
`2024-04-01` returned HTTP 405. These checks report support and headroom at that
time; they neither reserve capacity/names nor prove deployment or connectivity.

### B1 monitoring and budget suspension

A QMT-owned, pay-as-you-go workspace receives console diagnostics; HTTP request/
failed-request tracing is disabled. The workspace has 30-day retention and a
1 GB/day ingestion quota, which is **not a precise billing cap** and may suppress
guard heartbeat logs during an incident. The template also prepares a
Consumption-only environment in the same resource group/workspace for the hourly
guard job, without altering another venture's resources. Create the reviewed
budget/action group separately, then use `infra/budget-guard.bicep` with
`hosting=appService`, the exact output `appResourceId`/site name and the returned
guard environment. Keep its manual/read-only defaults until acceptance.

Stopping an App Service **app does not stop plan billing**. The extended guard
reads the exact site, posts only its `/stop` operation and verifies its `Stopped`
state; it never deletes, resizes, changes or resumes a plan. It explicitly reports
`fixedPlanChargesContinue=true`. Price the full B1 month even when suspension is
expected, plus SQL, backups and automation. ARM stop-state verification is not
proof of a hard invoice cap, public unavailability or preserved data; those require
real acceptance checks.

`infra/cost-model.json`, `npm run cost`, `npm run release:check` and
`scripts/prepare-release.ps1` still cover **only Container Apps**. Do not use their
output to release B1. `infra/app-service-cost-model.json` holds the separate B1
quote. `node scripts/cost-check.cjs --app-service` reuses the shared-service and
traffic assumptions to compare B1: approximately USD 23.57 expected, 26.00 routine,
213.42 sustained and 244.59 for two full-month plans sharing one database with
per-plan logs. The last case is an additional-plan stress scenario, not B1
deployment slots or an assertion of extra ordinary rollout billing. There is no
per-request B1 compute fee. The full-month fixed/reserved subtotal retained during
suspension is approximately USD 22.57, including database, backup/restore,
DNS and automation allowances; it is not a new flat charge added at shutdown.
These are conditional before-tax USD figures, not a full CHF estimate or a cap.
Missing shared components remain explicitly reported; known subtotals do not
price unknown services. The comparison always sets `releaseAllowed=false`,
including with `--release` or existing ACA approval flags. A B1-specific ancillary
review, complete approved scenario/residual envelope, named-resource
authorization/what-if, protected bootstrap route and real stop/resume/notification
evidence must precede a B1 production release. Neither template compilation
nor autonomous local preparation authorizes spending.

The owner's later bounded acceptance authorization is distinct from these
production gates; it does not mark the B1 cost model release-ready.

### Conditional acceptance cleanup

`infra/app-service-acceptance.bicep` accepts an optional opaque `acceptanceId`
tag on the newly created resource group. This is ownership evidence only: tags
do not schedule or perform deletion. Arm and test the actual protected cleanup
mechanism before spending. The current private Windows task passed an actual
owner-context, pre-deadline no-op, but requires a logged-in owner, machine/network
availability and working Azure authentication. It is not an unattended guarantee
or hard currency cap.

`scripts/cleanup-app-service.cjs` exports `runCleanup`; importing it performs no
operation. A protected caller must provide `env`, an exact `acceptanceId`, an
explicit boolean `initialized`, `notBefore` and protected ARM authentication.
The environment includes `QMT_ACCEPTANCE_STARTED_AT` from the private execution
receipt and `QMT_EXPECTED_IMAGE` as the approved immutable digest, plus the
initialization module's exact-scope and independent credential settings.
Credentials and tokens must not be passed as command-line arguments, printed,
written to plaintext files or committed.

With neither `inspect` nor `execute`, the module returns offline preview.
`execute: true` before the deadline returns `not_due` without network calls.
`inspect: true` verifies live ownership, scope, single-worker B1 configuration,
disabled/stopped app, Basic databases and retained backups, then temporarily
opens only the reviewed operator IPv4 to audit the databases. It verifies removal
of that rule and never deletes the stack. Inspection is therefore not entirely
read-only at the firewall control plane.

Deletion additionally requires `QMT_ACCEPTANCE_CLEANUP_APPROVED=true`. A database
must be empty and explicitly uninitialized, or contain exactly the expected
schema with zero operational rows and at most the single unchanged generated
bootstrap administrator. Additional/changed users, unknown resources, locks,
unverified inventories, provider failures, pre-acceptance retained backups or
immutable backups preserve the stack. Eligible retained backups are removed and
their absence checked before exact-group deletion; final group absence is
independently polled. Failure is not successful cleanup. Stopping the app alone
does not stop plan, database or retained-backup charges. Do not delete operational
data to recover a budget, infer eligibility from a failed read or automatically
resume production.

A narrowly handled partial apply may be disposable without a SQL connection
only when initialization is explicitly false, both SQL server and application
are independently absent, all-location retained-backup inventory for this group
is empty, only the reviewed non-data foundation resources exist, and the nested
deployment failed SQL creation specifically with `PasswordNotComplex`. Running,
unverified or otherwise failed deployments are not eligible through this path.
The complete database path also rejects bootstrap profile/timestamp changes;
matching only the username or original password is insufficient.

## AI replacement: isolated evaluation, not production activation

The old natural-language endpoint returns HTTP 410 before authentication or SQL.
Its Azure model call, automatic regex fallback and alternate direct event inserts
are removed. `QMT_AI_ENABLED=true` now refuses startup in every environment;
manual scheduling remains the production path. Enabling that old flag is not a
way to activate the new candidate.

As checked on 2026-10-21, the evaluation candidate is Groq-hosted
`openai/gpt-oss-20b`, which supports strict JSON-schema outputs. Listed standard
rates are USD 0.075 per million input tokens and USD 0.30 per million output
tokens; account limits, availability and billing must be checked again before use.
For illustration only, 1,000 calls at 1,000 input plus 300 output tokens each
would be USD 0.165 before tax, excluding any other charges. This is not a measured
QMT workload, a monthly cap, a quality result or a promise of free production.
Use a free-plan-only account for an approved free evaluation; do not silently
upgrade billing when its quota is exhausted.

`npm run ai:benchmark` is offline by default and sends nothing. A separately
authorized operator can set `QMT_AI_BENCHMARK_APPROVED=true` and `GROQ_API_KEY` in a
protected process environment, then run `npm run ai:benchmark -- --run`.
Do not paste a key into a command line, commit it or enter it in the application.
The runner accepts no custom input and uses six fixed synthetic examples only.
It makes at most six sequential requests per invocation, caps each serialized
request at 8 KiB and completion at 1,024 tokens, limits response bodies to 64 KiB,
uses a 10-second request/body timeout, and never retries or falls back. Repeated
invocations are not a durable quota. Schema, date/time and fixture expectations
are checked locally; invalid output or provider failure stops explicitly.
Returned token usage is reported when present; unavailable usage is null, not zero.
It has no SQL access, booking writes, public route or application integration.
No live provider evaluation has been performed.

Google's current Gemini API terms require Paid Services for API clients made
available to users in Switzerland/EEA/UK and disallow clients directed towards
or likely accessed by under-18s. This makes the unpaid API an unsuitable default
for this Swiss sports-club release; do not assume youth-club suitability.
Groq's data documentation also requires review: usage metadata is retained,
inference data may be retained for reliability/abuse investigation, and data
location/zero-retention settings need explicit approval. No club/personal data
is approved for transmission by this benchmark.
Groq also requires adult service users and places responsibility for applications
accessed by minors on the customer; it is not automatically approved for youth
club data or usage.

A production assistant remains a separate release decision: verify provider
terms, age/region eligibility, data processing/location and availability; run an
authorized quality evaluation; implement durable per-user/global quotas with
atomic reservations and bounded input/output; and pass reviewed drafts through
the canonical booking validation/transaction path with explicit human confirmation.
Core scheduling must remain usable on quota exhaustion or provider outage.

Primary sources reviewed:
- Azure billing: https://learn.microsoft.com/azure/container-apps/billing
- Groq model/pricing: https://console.groq.com/docs/model/openai/gpt-oss-20b
- Groq strict output: https://console.groq.com/docs/structured-outputs
- Groq limits/data: https://console.groq.com/docs/rate-limits and https://console.groq.com/docs/your-data
- Groq agreement: https://console.groq.com/docs/legal/services-agreement
- Gemini terms: https://ai.google.dev/gemini-api/terms

## Database migration and bootstrap

Use a separate migration principal with DDL privileges, not the application user.
Supply `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` in the protected
operator environment. Encryption and certificate validation are mandatory.

```text
npm run migrate
```

This previews the required authorization and makes no SQL connection. After
backing up and proving restoration in an isolated target, explicitly set
`QMT_MIGRATION_APPROVED=true` and run:

```text
npm run migrate -- --apply
```

The runner takes a transaction-owned migration lock, applies ordered SQL batches
in one transaction, and records SHA-256 checksums. Applied files are immutable;
add a new migration rather than changing a recorded file. No sample clubs, users,
passwords, events or requests are seeded. Base tables are created only if absent.
This is not a universal repair tool for every unknown historical schema: exercise
the actual restored schema before approving production use.

The additive migration backfills legacy single team/field references but
does not invent missing request details. Existing requests without canonical
`payload` must be mapped with reviewed evidence or explicitly archived by an
authorized operator. Request management and the readiness checker fail explicitly
instead of returning an empty success state. Never delete historical requests
just to pass readiness.

For a fresh database only, set `QMT_BOOTSTRAP_APPROVED=true`, `QMT_ADMIN_USERNAME`
and a unique random `QMT_ADMIN_PASSWORD` (at least 20 characters, at most 72 UTF-8 bytes), then:

```text
npm run admin:bootstrap -- --apply
npm run db:check
```

Bootstrap refuses if an active admin already exists. Clear bootstrap variables
immediately afterward. The application user needs only the operational tables' required
DML permissions and permission to acquire the database application lock, not
schema modification rights. Verify these exact grants in staging.

### Protected B1 fresh initialization (executed for disabled acceptance)

`npm run db:provision-user` is a no-connection preview. For a separately authorized
operator with the approved narrow SQL path, `-- --apply` additionally requires
`QMT_SQL_PRINCIPAL_APPROVED=true`, migration credentials in `SQL_*`, and independent
`QMT_APP_SQL_USER`/`QMT_APP_SQL_PASSWORD`. The username is lower-case `qmt_` plus
2-48 lower-case letters/digits/underscores starting with a letter; use `qmt_application`.
The randomly generated password must be 20-128 printable, non-space ASCII characters.
The script creates a contained database user, grants only SELECT/INSERT/UPDATE/DELETE
on the eight operational tables, and refuses an existing principal rather than
rotating it or silently changing its permissions. It grants no migration-table,
schema, database-role or server permissions. Keep migration/readiness credentials
separate: do not grant the application access to `qmt_migrations` to make `db:check` pass.

For the new B1 foundation, prefer the combined operator
`scripts/initialize-app-service.cjs`. Its scope is intentionally restricted to
resource group `qmt-production` or `qmt-staging` and that foundation's suffixed
server/site name. This restriction is not permission to provision either group.
Use the `sqlServerResourceId` output and configure the following through a protected
process environment, not command-line secrets, checked-in files or CI logs:

| Settings | Required value |
|----------|----------------|
| `QMT_SQL_SERVER_RESOURCE_ID` | Exact foundation SQL server resource ID in the approved subscription and QMT-only group. |
| `QMT_OPERATOR_IPV4` | One reviewed public IPv4 address for the operator's actual outbound connection; never a CIDR/range or `0.0.0.0`. The script does not use a third-party IP-discovery service. |
| `SQL_SERVER`, `SQL_DATABASE` | Foundation server's `.database.windows.net` hostname and `qmt-production` or `qmt-staging`, matching the group. |
| `SQL_USER`, `SQL_PASSWORD` | Independent SQL administrator/migration credentials from the protected provisioning process. |
| `QMT_APP_SQL_USER`, `QMT_APP_SQL_PASSWORD` | Exactly the separate `sqlUser`/`sqlPassword` supplied to the foundation. |
| `QMT_ADMIN_USERNAME`, `QMT_ADMIN_PASSWORD` | `QMTadmin` and its unique random application-login password; the existing 20-character/72-UTF-8-byte bounds apply. All three passwords must differ. |

```text
npm run db:initialize-b1
```

This is a local preview with no token read, Azure requests or SQL connections.
Only after distinct named-target, temporary-firewall and fresh-initialization
approval, set `QMT_DB_INITIALIZATION_APPROVED=true`. An authorized operator pipes
the ARM token directly from Azure CLI; never print or paste it:

```powershell
az account get-access-token --resource https://management.azure.com/ --query accessToken --output tsv |
  node scripts\initialize-app-service.cjs --execute --token-stdin
```

The operator verifies the server's QMT tag/region/administrator, exact Basic online
database, and exact site with `enabled=false` and provider state `Stopped` or
`Disabled`. Running, enabled and unknown-state sites are rejected. The read-only App Service settings-list
operation checks that the deployed SQL credentials match and both integrations
remain disabled; secret values are held in memory and never printed. A new random
`qmt-bootstrap-` rule is created for exactly the operator address, without modifying
the app subnet rule or existing IP rules. Existing rule names are never overwritten.
The rule ID is reported before creation for interruption recovery.

Only connection establishment may retry a positively identified SQL firewall-cache
error (40615): at most 21 connection attempts, 15 seconds between attempts and a
330-second deadline. Bad credentials and all initialization writes are not retried.
TLS and certificate validation remain enabled. The operator refuses nonempty
operational tables before migration; additive migrations retain their existing
checksum/transaction controls. Principal creation and `QMTadmin` bootstrap then
share an outer transaction, so a bootstrap failure rolls both back. Successfully
applied migrations may remain for an inspected retry. Readiness checks run with the
operator principal before its connection closes and before access is removed.

Cleanup runs on ordinary success and failure, including an ambiguous create
response. It deletes only the new rule and requires a subsequent 404; accepting
DELETE alone does not count as cleanup. A cleanup failure emits
`SQL_OPERATOR_CLEANUP_REQUIRED` with the exact rule ID and exits unsuccessfully,
even if SQL initialization committed. Do not rerun fresh initialization against
the now-populated database or start the app to hide that failure.

There is **no server-enforced firewall-rule expiry**. Process termination, host
failure or lost authorization may prevent `finally` from completing. Preserve the
reported rule ID in the protected execution record; after interruption, an
authorized operator must inspect/remove that exact rule and verify its absence.
Firewall caches can delay data-plane changes; ARM absence does not prove immediate
network revocation. No broad access, application start, resource provisioning,
DNS change, secret output or automatic resume is performed by this procedure.
Real SQL rollback/contained-user checks and all booking/request integration cases
now run using the application principal in `npm run test:sql`; this requires the
Docker-capable validation route and has not been executed locally.

Official procedure references:
- Contained users: https://learn.microsoft.com/sql/t-sql/statements/create-user-transact-sql
- SQL firewall API: https://learn.microsoft.com/rest/api/sql/firewall-rules/create-or-update?view=rest-sql-2023-08-01
- App settings read: https://learn.microsoft.com/rest/api/appservice/web-apps/list-application-settings?view=rest-appservice-2024-04-01
- Firewall cache behavior: https://learn.microsoft.com/azure/azure-sql/database/firewall-configure

While their dashboard remains mounted, request forms preserve their idempotency
key across close/reopen and ambiguous failures. Reloading or navigating away can
discard the in-memory draft/key: check with staff before resubmitting in that case.
Retry unchanged details to recover the original submission rather than making a duplicate. A
changed body with the same key returns 409; confirm with club staff before starting
a genuinely separate request. Approvals that return 409 require refresh/review,
not a blind new booking.

## Validation and release order

```text
npm ci
npm test
npm run test:sql
npm run lint
npm run build
npm run cost
npm run release:check
```

CI also builds the non-root Docker image and compiles all five Bicep templates without
deploying, then smoke-tests the image's health, frontend shell and disabled providers
without SQL credentials. The initial read-only health request has a bounded
startup retry window, including connection resets before Node begins listening;
the response must report `ok: true`, and the running container must be non-root.
Failed smoke checks print container logs and remove only their named container.
The disposable SQL tests cover fresh and historical base
schemas; they do not substitute for testing the actual recovered schema/data.
The runtime stage uses `npm ci --omit=dev`: the frontend ships as built assets,
not a second React/toolchain installation. Provider SDKs are development-only
because this production release cannot enable those integrations.
Local validation currently lacks Docker/SQL; unexecuted integration and
image checks remain blockers even if unit checks and frontend builds pass.
Never replace those checks with mocked concurrency claims.
The disposable SQL runner retries connection readiness only, not database creation
or containment setup. It stops only its randomly named container after setup/test
failure. A cleanup failure is a validation failure even after passing SQL tests;
the error names the exact container requiring independent cleanup and preserves
any original setup/test failure.

Local checkpoint, 2026-10-20: 21 tests passed, with one real-SQL suite explicitly
skipped; lint, type checking and the production frontend build passed. A clean,
isolated production-only install also served the frontend/assets and SQL-free
probes with React, provider SDKs and build tools absent from runtime dependencies.
This is not a Linux-container or interactive-browser acceptance result. The main
JavaScript bundle remains 522.50 kB minified (153.84 kB gzip); its large-chunk warning
is unsuppressed, and measured startup/restart/browser/load acceptance remains outstanding.

Publish an immutable, approved image only after explicit authorization. Use the
generated Azure hostname for staging; do not assign production DNS during staging.
After migration and DB readiness, verify two independent browser sessions, public
DTOs, actual staff roles, every request form/review, exports outside the default
window, error states, one warm replica while idle, startup/restart and peak traffic. Measure the
Basic database and container under load; do not silently increase capacity.

Only after owner acceptance should an operator configure `qmt.errandom.com` and
TLS, then update the independent `errandom-com/QMT/index.html` status and working
app CTA. Publish the homepage card and product page through that site's own
approved process. Do not advertise an inactive/nonexistent endpoint as live.

## Monitoring, stop/resume and rollback

Use QMT tags and the dedicated resource group to track actual charges; reconcile
daily against the estimate during post-release stabilization. The owner approved
QMT application suspension when actual monthly spend reaches the private budget.
Earlier actual-spend and forecast warnings remain proposed, not separately
approved automatic shutdown triggers. Use the real billing currency and the
agreed QMT-only monthly scope; confirm its exact billing/calendar period before
creating the budget. Keep the configured amount out of public source files.
Budgets are notifications, not spending stops; billing data is delayed. Global
API limits do not cap static requests, egress, SQL storage, logs or other resources.
Measure bounded JSON error-log volume and its retention/ingestion cost; do not
change a shared workspace's limits without its owner's approval.

`scripts\budget-guard.cjs` and `infra\budget-guard.bicep` now prepare the suspension
mechanism locally; nothing is deployed or end-to-end verified. The native-Node job
uses the approved QMT image in the existing Consumption environment, polls once an
hour, runs one replica for at most 120 seconds with no platform retries and exits.
It adds no public webhook, always-running watchdog, Function/App Service plan or
database dependency. Its system-assigned identity has budget-read permission on
one exact budget and revision-read/replica-read/deactivate permission on the exact
QMT container app. With `hosting=appService`, it instead receives only
`Microsoft.Web/sites/read` and `Microsoft.Web/sites/stop/action` on the exact QMT
site, not the App Service plan or subscription. It cannot activate revisions,
start sites, update/delete apps/plans, read secrets or access SQL.
Missing/changed budgets, incorrect currency/amount, narrowed filters, unsupported
periods, expired budgets, failed authentication and failed API calls are explicit
errors, never fabricated zero spend. They do not justify an early unapproved stop.
There is no immediate retry storm; the next hourly execution retries the check.

The conditional allowance is USD 1.34538/month: 744 jobs at the full 120-second
limit (USD 0.6696), 0.02 GB additional logs (0.06578), one 15-minute log alert plus
one resource series (0.55), and 3000 paid emails to one approved recipient (0.06).
Do not enable additional recipients/channels, manual executions or duplicate
scheduled jobs without repricing. Actual log volume and billing remain unverified.
Keep `approval.budgetSuspensionValidated=false` until real execution, stop/resume,
failure/idempotency and alert delivery pass, together with zero-replica evidence
for Container Apps or verified stopped-site/public unavailability for App Service.

Also keep `approval.budgetScopeValidated=false` until every incremental QMT charge
is reconciled with the configured budget. The job accepts an unfiltered calendar-
monthly resource-group Cost budget in the app's QMT-only group and pins its amount
and billing currency. A shared workspace/environment or separately billed DNS
resource can leave QMT charges outside that group: merely attaching this guard
does not include those charges. Prefer a complete QMT-owned cost scope; otherwise
review an explicit accounting/trigger design before release. Never include another
venture's costs, silently lower the approved threshold, assume FX, or claim that a
partial-scope budget represents total QMT spend. Configure the exact approved
period/currency/amount outside source control. The gate rejects missing scope or
suspension evidence even if ordinary notification emails were tested.

The template defaults to `scheduled=false`, `execute=false`. After explicit named
resource/provisioning authorization, deploy a manual read-only job against the
reviewed app, budget, workspace and existing QMT notification action group. Supply
`expectedBudgetAmount` as a secure parameter; never put the private amount, token
or notification recipient into public parameters/artifacts. Start one authorized
read-only rehearsal, confirm its console logs reach the named workspace and verify
the managed identity's actual permissions. Only then enable hourly scheduling
and the log alert. Query validation is not skipped: the
`ContainerAppConsoleLogs_CL` table must exist. Confirm the job execution-name prefix,
environment/job resource IDs and structured logs match the prepared KQL before
trusting its missing-heartbeat/error/intervention notifications. Alert evaluation
is every 15 minutes; missing healthy logs for 110 minutes also fires. Test
notification delivery and image-pull failure/missing execution, not just script
errors. Enable execution only for an authorized stop rehearsal and the approved
operating configuration. Template compilation and mocked transport are not this
evidence. Maintain independent outage notifications/manual response if Azure or
Cost Management itself is unavailable.

For a protected manual fallback, use an approved Azure CLI identity. Set only the
exact reviewed app ID and pipe a short-lived ARM token to the helper, not a command
argument or log. From the QMT directory in PowerShell, preview:

```powershell
$env:QMT_APP_RESOURCE_ID = '<exact approved QMT app resource ID>'
az account get-access-token --resource https://management.azure.com --query accessToken --output tsv |
  node .\scripts\budget-guard.cjs --manual --token-stdin
```

After authorization to stop that app, repeat with `--execute` appended to the
Node command. Manual mode deliberately bypasses the budget read, not app-scope
validation. It is a fallback for a failed guard, not automatic resumption. The
Container Apps helper validates every revision before writing, attempts each validated active
revision even if another stop fails, and returns success only after all revisions
are inactive and no replicas remain. A failed/slow shutdown exits nonzero rather
than reporting a successful suspension.

Do not substitute `minReplicas=0`: incoming traffic can wake an active revision.
Do not automatically resume at a period reset without separate approval.

For suspension, change the separately hosted QMT product
page to maintenance and remove any app CTA. List QMT revisions with
`az containerapp revision list --name qmt-production --resource-group <QMT-only-group>`.
Deactivate each specific QMT active revision with `az containerapp revision deactivate
--revision <exact-QMT-revision> --resource-group <QMT-only-group>`. Verify externally
that the application is unavailable and no QMT replicas remain. Do not deactivate
an environment or another venture's revisions.
Do not delay suspension if maintenance-page publication fails: alert the operator
and stop QMT regardless, then repair the independently hosted status page.

The stopped app cannot serve a maintenance page. SQL, backups, registry and shared
services may keep charging. Preserve them unless an explicitly approved retention/
export/deletion decision says otherwise. A long pause can affect managed-certificate
renewal; verify TLS before resume. To resume, activate the reviewed QMT revision,
verify capabilities/SQL/role checks and data, then restore the independent app CTA.
Cost data is typically delayed 8-24 hours and budgets are evaluated every 24 hours;
the prepared guard additionally polls hourly. Crossing the amount can therefore
precede suspension substantially. Stopping the
app is not a guarantee that the final invoice stays at the budget.

For the unselected B1 alternative, set the exact `Microsoft.Web/sites` resource ID
instead. The same protected manual helper reads/validates that site before any
write and verifies `Stopped` after stopping it; it never enumerates Container Apps
revisions. Restore service only through a separately authorized start of that
same site, after checking the budget/incident cause, SQL/data and TLS. No automatic
start, month-reset resume, plan deletion or unpriced scale change is implemented.
Keep the full plan charge in residual spending even while the site is stopped.

Retain current and previous approved image digests. Roll back application code only
to a version compatible with the applied additive schema; test that pairing first.
Do not run a destructive down-migration. Data rollback requires separately approved,
tested restore/cutover, not deleting rows or overwriting the recovered source.

## Official references

- Container Apps billing: https://learn.microsoft.com/azure/container-apps/billing
- Azure budgets: https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets
- Budget API: https://learn.microsoft.com/rest/api/consumption/budgets/get?view=rest-consumption-2024-08-01
- Scheduled jobs: https://learn.microsoft.com/azure/container-apps/jobs
- Managed identity: https://learn.microsoft.com/azure/container-apps/managed-identity
- SQL DTU tiers: https://learn.microsoft.com/azure/azure-sql/database/service-tiers-dtu
- SQL backups: https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview
- Retail prices: https://prices.azure.com/api/retail/prices
- App Service billing: https://learn.microsoft.com/azure/app-service/overview-hosting-plans
- Always On: https://learn.microsoft.com/azure/app-service/configure-common
- App Service VNet integration: https://learn.microsoft.com/azure/app-service/overview-vnet-integration
- SQL subnet rules: https://learn.microsoft.com/azure/azure-sql/database/vnet-service-endpoint-rule-overview
