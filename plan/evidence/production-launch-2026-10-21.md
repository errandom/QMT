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
