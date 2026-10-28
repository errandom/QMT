# QMT production launch evidence

Recorded October 21, 2026, Zurich time. This is a controlled single-club pilot,
not a statement that the entire extended acceptance/stabilization plan is complete.
The owner's 22:39 instruction, "get this live now - you have the permission",
authorized promotion and public entry-point publication.

## Running release

- Application: `https://qmt-production-au5trtsh5mkl2.azurewebsites.net`.
- Product page: `https://www.errandom.com/QMT/`; main-site QMT card verified.
- Website commit: `6d8826a29cd11e5347404e43eed82d0e575f8173`; Pages built and both public pages returned 200 with the intended links.
- Runtime source: `55e8346215e1e696d1ccafa05c6afbe1d1322e2d`.
- Unchanged image: `ghcr.io/errandom/qmt@sha256:5d1a7ce14520fadcf88120be60dc143a995d1cc9b4141a4f77f4b63940241b8e`.
- Existing single-worker Linux B1 Always On and isolated Basic SQL promoted in place; no AI or Spond activation.
- Old acceptance deletion task disabled; protected production authorization retained; local acceptance operator rejects post-promotion execution.

## Observed acceptance

Protected QMTadmin API and actual isolated Edge form sign-in passed. Secrets and
tokens remained in memory; the isolated owner-only browser profile was removed.
Core site/field/team/equipment CRUD, successful booking, adjacent booking,
overlap rejection, concurrent same-field serialization, whole-series rollback
and failed-update rollback passed on live Basic SQL. Anonymous team creation
returned 401. Exact synthetic IDs were tracked and removed in dependency order.
After restart, the operational collections were empty and SQL-backed reads worked.
The previously recorded real PITR/schema/administrator checks remain valid;
the temporary acceptance-restore database was deleted after verifying that the
application targets `qmt-production`, not the restore.

## Cost-control evidence

The unfiltered Monthly CHF 30 budget is scoped to the QMT resource group only.
Actual 50/75/90/100-percent and forecast 100-percent notifications are configured.
Budget, action group, guard scheduling and log alert were deployed through
reviewed provider previews. Guard settings: hourly `0 * * * *`, `--execute`,
120-second timeout, zero retries, 0.25 CPU/0.5 GiB Consumption execution.
The unchanged system-assigned identity has exactly two narrow assignments:
one-budget read, and one-site read/stop. It has no start/delete/config/SQL rights.

| Evidence | Observed result |
|----------|-----------------|
| `qmt-production-budget-aty8mml` | Succeeded; retained `within_budget` event at 22:50:16 Zurich. |
| `qmt-production-budget-0xjeogp` | Succeeded; one-off authorized manual mode, actual managed-identity suspension. |
| Retained suspension event | 22:58:11 Zurich, `suspended`, `fixedPlanChargesContinue: true`. |
| Stopped-site verification | 22:58:18 Zurich, ARM Stopped and public HTTP 403. |
| Owner recovery | One explicit start; initial 30-second cold-start check timed out, subsequent read-only reconciliation verified Running/healthy SQL-backed recovery at 23:01:18 Zurich without repeating stop/start. |
| Scheduled guard | Schedule trigger and hourly cron independently read back; no permanent `--manual` argument. |
| Heartbeat rule | Enabled, severity 1, exact QMT action group, `skipQueryValidation: false`. |
| Email test | Azure rejects requests with `BadRequest: There are no valid receivers in the request`; inbox delivery is not verified. |

Billing data is delayed. Application stop does not stop B1, database, backup or
monitoring charges, and does not guarantee a CHF 30 invoice ceiling. No automatic
restart is authorized after a real budget pause. The independent product page
explains possible budget unavailability and does not pretend to be real-time status.
Renew/review the budget before its configured November 1, 2027 UTC expiry.

## Owner access and remaining work

The owner-local desktop shortcut **QMT administrator access** opens the masked
DPAPI-backed credential UI. Username remains **QMTadmin**; no password is in the
shortcut, repository, website or launch receipt. The persistent helper is inside
the owner/SYSTEM-only local vault, outside OneDrive.

At the October 21 launch, the working application link intentionally used the
Azure hostname. GoDaddy authoritative DNS had neither required record:

| Type | Name | Value |
|------|------|-------|
| CNAME | `qmt` | `qmt-production-au5trtsh5mkl2.azurewebsites.net` |
| TXT | `asuid.qmt` | `40911895E149BAE1BC8132C5B9C466E23AA3DEE438509FBB03DB6B09545F75F7` |

These domain tasks were completed as recorded below. Resolve notification-test
rejection and verify actual delivery.
The full two-session request/review/export, mobile/performance, forwarded-header
and DST matrix is not claimed by the bounded core checks above. Collect seven
dated post-launch cost/error/backup observations and review the keep-live decision.

## Branded-domain cutover, October 22, 2026

The owner authorized the exact two-record GoDaddy change and delegated
completion. Both records above were saved once. Both authoritative nameservers
and public resolver `1.1.1.1` subsequently returned the exact values. Observed
DNS TTL was 3600 seconds. Apex/www, mail, ARGOS and nameservers were unchanged.

The existing Azure application received the `qmt.errandom.com` hostname binding.
One free managed-certificate request was accepted at 06:37:18 UTC and reported
Succeeded at 06:40:38 UTC. The CLI certificate inventory still returned an empty
list; direct ARM retrieval of `Microsoft.Web/certificates/qmt.errandom.com`
confirmed issuance, avoiding a duplicate request.

- Certificate subject: `qmt.errandom.com`.
- Thumbprint: `6090D71C6EC17D925CC07D74D287BE149E52C144`.
- Current expiry: April 22, 2027, 23:59:59 UTC; preserve renewal prerequisites.
- Binding: `SniEnabled` on the exact custom hostname.
- Initial TLS propagation briefly returned a name mismatch; no validation bypass
  was used. The complete trusted-HTTPS check passed at **08:47:50 Zurich**.
- Root, both referenced JS/CSS assets, health, QMTadmin API login/identity,
  database check and SQL-backed sites read passed.
- No operational rows or credentials changed; the immutable runtime, B1/Basic
  resources, Always On and QMT-only budget safeguards are unchanged.
- The original Azure HTTPS hostname is retained, without a forced redirect.

Website commit `f71b6dae0a9a6303aa84395bcc9ccb18f5e3561b` replaced only the
existing product CTA target with `https://qmt.errandom.com`. Its exact Pages
build reported `built`; the publicly served product CTA and main-site QMT
navigation passed at **08:49:05 Zurich**. Notification delivery, extended
acceptance and stabilization remain open.

## October 22 UI-only production update

The owner's instruction, "okay, now please deploy it", authorized deployment of
the two previously reviewed local UI refinements. No infrastructure expansion,
data migration, credential change, AI activation or budget-policy change was
included.

- Runtime source: `b8a43313c2c2b0c8fc73212d370b18b56b14e755`.
- PR #7 merge: `92f726d7546b7ba71dae85f599292fbae865238e`.
- Exact-source validation/publication: `39791274017`, successful; validation
  includes real disposable SQL, lint/build, template compilation and image smoke.
- Publication job: `119869190234`; exact-commit gate, image smoke and fresh
  anonymous digest pull all passed. The existing named candidate branch and
  approval checks were preserved, not broadened.
- PR validation: `39791357583`, successful; main validation:
  `39792410526`, successful.
- New application image:
  `ghcr.io/errandom/qmt@sha256:b22324538b8545512d78518b8eb0931b6813892ce1a153b400553038b39cb26d`.
- Previous application/compatible code-rollback image:
  `ghcr.io/errandom/qmt@sha256:5d1a7ce14520fadcf88120be60dc143a995d1cc9b4141a4f77f4b63940241b8e`.

The existing site's sole image property was patched at **16:05:22 Zurich**.
An earlier Windows CLI pipe-quoting error left the old image and Running state
unchanged, independently verified before the successful JSON-file ARM patch.
The subsequent read-back confirmed the exact new digest. No bootstrap,
infrastructure apply, cleanup, restore or stop/resume rehearsal was repeated.
Backend, dependency manifests and schema sources are unchanged from the previous
runtime source; the separate budget guard intentionally retains the old image.

Protected, read-only application acceptance passed at **16:06:17 Zurich**:
trusted root and both local JS/CSS assets, health, QMTadmin authentication,
identity, SQL connectivity and sites read. Passwords/tokens remained in memory.
No operational fixtures were created, deleted or altered.

An isolated public Edge browser passed at **16:06:26 Zurich**:
the former About link was absent and a single **an errandom product** attribution
linked to the existing product page beside **QMT | Operations**. The native
schedule disclosure opened with the keyboard and closed normally. Computed
glass-card radius, navy title/button, associated labels and semantic dates were
present. At 1440px the form had three columns; at 390px it stacked into one
column, with the card and date inputs fitting the viewport. No unhandled
JavaScript exceptions occurred. Displayed dates remained
`2026-10-15` to `2027-01-20`; the inclusive-end loading behavior is unchanged.
Served application assets were `index-DazQFGuW.js` and `index-peoG7pxG.css`.

Independent before/after snapshots matched all 25 non-image invariants:
application identity/enabled/HTTPS settings; B1 single-worker plan and Always On;
Basic Online production SQL; checksum of all app settings; exact QMT-only
CHF 30 Monthly budget definition; guard identity, schedule, arguments, resources
and image; heartbeat rule; managed TLS binding/thumbprint; and disabled acceptance
cleanup. Azure's delayed current-spend read was CHF 0 at both observations, not
a promise of zero costs or an exact CHF 30 invoice cap.

Private receipts are `qmt-ui-image-publication.json`,
`qmt-ui-deployment-operation.json`, `qmt-ui-settings-before.json`,
`qmt-ui-settings-after.json`, `qmt-custom-domain-check-result.json` and
`qmt-ui-browser-check-result.json`. Current-release handoffs reference these
separately from the historical launch/restore/stop-rehearsal evidence.
Email delivery, the remaining extended acceptance matrix and seven-day
stabilization are still unverified; this UI update does not close them.

## October 28 Sites card layout production update

The owner's instruction, "okay - go ahead and deploy", authorized the reviewed
Sites card layout fix. Its only application changes are four class substitutions
in `SitesManager.tsx`: equal-height grid rows, flex-growing card content,
wrapping amenity tags and a bottom-anchored status row. Shared components,
permissions, backend, dependencies and schema are unchanged.

- Runtime source: `a6e75b8e56196be87712c92e7a3c9507dff9840f`.
- PR #8 merge: `42c6ee764483dcc54f044e31b05f1d52c8a64b5f`.
- Exact-source validation/publication: `40776169926`, successful; publication
  job `123127342914` passed image smoke, the exact-commit gate and a fresh
  anonymous immutable-digest pull.
- PR validation `40776169536` and main validation `40776973274` passed,
  including the existing disposable SQL, lint/build and image checks.
- New application image:
  `ghcr.io/errandom/qmt@sha256:bc08e479fd0ccf1e4ac1f0bf1b9239e70395a5c933c21a2a24971fc21c85e6a4`.
- Previous compatible code-rollback image:
  `ghcr.io/errandom/qmt@sha256:b22324538b8545512d78518b8eb0931b6813892ce1a153b400553038b39cb26d`.

Local Chromium layout checks passed at 375, 768, 1024, 1200 and 1720px:
equal card heights across rows, status controls at bottom padding, wrapping
amenities without overlap and no horizontal overflow. Synthetic fixtures
included zero through six tags, long content, active/inactive sites and
administrator/management versus visitor controls. The pre-fix layout reproduced
the floating-status problem. These are local synthetic checks, not a claim of
new authenticated production-browser acceptance.

The already-enabled, Running app received one exact-property JSON-file ARM
patch to `config/web.properties.linuxFxVersion`; read-back confirmed the new
digest. No stop/start, infrastructure deployment, initialization or cleanup
was replayed. At **23:07:17 Zurich**, trusted public HTTPS, health, SQL-backed
sites read and HTTP 401 for anonymous `/api/db-check` passed. AI and Spond
remained disabled, and no operational rows were written.

The initial byte check correctly rejected the Windows build's different asset
names. The live names matched the publication build log. An independent anonymous
registry read verified the manifest digest, source revision, non-root Linux
image configuration and compiled UI layer digest
`sha256:2213153c1bf94a7244184a666720de46f5995532375414e7517f5969fc9929eb`.
Files extracted from that verified layer matched all three live assets exactly:
`index-KwYm1WAd.js`, `index-DFkLsRKg.css` and
`OperationsOffice-CW-CdrsP.js`. The served OperationsOffice chunk contains the
equal-row and bottom-anchoring layout classes.

Before/after snapshots matched all 26 non-image invariants: application identity,
enabled/Running state, HTTPS, hostnames, managed TLS, plan, network and identity;
non-image web configuration and all app settings checksums; B1 single-worker
Always On; Basic Online SQL tier, size and redundancy; guard identity,
configuration and image/template; budget definition; heartbeat rule; and
resource inventory. The separate budget guard retains its approved image.

Secret-free private receipts are `qmt-release-before.json`,
`qmt-release-after.json`, `qmt-release-image.json` and
`qmt-release-live-result.json` in the operator session artifacts. Credentials
and operational record contents are not retained there. Notification delivery,
extended acceptance and stabilization remain open; this layout release does
not close them.
