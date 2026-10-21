---
goal: Relaunch QMT under errandom with predictable operating costs and reliable club operations
version: 1.6
date_created: 2026-10-20
last_updated: 2026-10-21
owner: errandom
status: 'In progress'
tags: [architecture, migration, cost-optimization, deployment, product]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

QMT by errandom helps American football and flag football clubs coordinate practice and game schedules, fields, facilities, equipment, and operational requests. Launch with those sports as the explicit audience; retain a path to other field sports without presenting an unproven general-purpose sports platform.

This is an implementation plan, not authorization to provision infrastructure, restore billable resources, publish site changes, or deploy. The initial planning pass made no application/cloud changes. The subsequent implementation request authorized local code preparation; local changes now exist in QMT and the platform website, but nothing has been committed, pushed, published or deployed.

**Recommended first release:** a public product page at `https://www.errandom.com/QMT/`, linked from the main site's Ventures section, and a separate application at `https://qmt.errandom.com`. The apex domain currently redirects to `www`; preserve that behavior. Reuse errandom's existing Azure Container Apps Consumption environment if the preflight checks pass, but deploy QMT as its own app, identity, database, and release pipeline. Retain SQL Server compatibility for the production relaunch and evaluate Azure SQL Basic against real data and load before selecting it. Do not recreate the former App Service deployment.

**Delivery boundary:** production practice/game field management for the owner's football club, not a new pilot or demonstration; no public signup or shared-database multi-club service. Generalize club branding without substituting sample identity or data. Introduce tenant isolation before accepting a second club into the same application/database. Do not advertise billing, membership administration, player analytics, or arbitrary sports as available.

### Evidence baseline: 2026-10-20

| Surface | Verified evidence | Planning consequence |
|---|---|---|
| QMT source | `errandom/QMT`, main commit `774bc483329b11719bac44759b94a7bc9753449a`. Last successful legacy deployment workflow inspected: 2026-02-08. | A successful historical deployment is not evidence of a currently running service. |
| Actual production entry point | `package.json:15` starts `server.js`; `.github\workflows\main_qmt.yml` packages that file, not `server\index.ts`. | Preserve and characterize the deployed implementation first; do not optimize the wrong backend. |
| Divergent backend | `server\db.ts:103-133` pings SQL every two minutes; `server\index.ts:333-378` self-pings warmup every ten minutes. These files are not shipped by the inspected workflow. | Remove the divergence after contract coverage. Do not claim these timers caused historical production spending. SQL auto-pause depends on idle sessions and activity [S03]. |
| Current production database behavior | `server.js:35-54` uses a lazy pool with `min: 0`; `server.js:4851-4877` nevertheless opens SQL at process startup. | Eliminate startup database access. Distinguish DB-independent liveness from explicit readiness checks. |
| Expensive or misleading enrichment | `src\lib\weatherService.ts:23-115` requests LLM-generated weather and substitutes seasonal values; `server.js:4763-4816` exposes a generic model-completion endpoint. | Remove generated weather, disable model calls by default, and use real forecast data only when separately configured. |
| Request persistence | `src\components\FacilityRequestDialog.tsx:18-81` submits into context/local storage; `src\contexts\DataContext.tsx:65-122,153-188` does not load requests from SQL. Other request dialogs use the same state surface. | A success toast is not proof of a shared submission. Require two-browser persistence tests before launch. |
| Read amplification and failure UX | `server.js:652-681` reads all events; `src\contexts\DataContext.tsx:125-199` warms up, loads five full collections, and replaces rejected responses with empty arrays. | Bound event queries, load only necessary data, and retain explicitly stale data on failures. |
| Booking correctness | `server.js:741-825` expands recurrence; the inspected `server.js` contains no conflict/overlap transaction implementation. `src\components\EventList.tsx:16-36` changes confirmation status only in browser state. | Implement authoritative overlap handling and confirmation semantics, not merely UI warnings. |
| Platform website | `errandom/errandom-com`, local `site`, main commit `237daa1b91a596cf8394547d897ccd506387f28d`; Pages API reports legacy publishing from main/root and custom domain `www.errandom.com`. Live page returns 200 and contains no QMT link. | The umbrella website is not a shared backend. Pages is static hosting, with restrictions relevant to commercial SaaS [S01, S02]. |
| Existing Azure runtime | Read-only inspection found an existing Consumption-profile Container Apps environment in Switzerland North and an independently deployed platform app. | Reuse compatible infrastructure, not another product's process, credentials, or data. Do not copy its always-running replica configuration. |
| Resource deletion check | In the selected Azure subscription, the resource-name filter found no `QMT`/`qmt` resources; resource-type inspection found no App Service plans or SQL databases. | This is a bounded inventory check, not proof that all historical QMT-related services, subscriptions, backups, or bills are clear. |

Historical billing evidence is retained privately. The candidate retires paid-model calls and replaces the former Premium hosting footprint without publishing account charges or claiming request-level caller attribution. See `plan\evidence\cost-baseline-2026-10-20.md` for public forward estimates and limitations.

### Operating-policy update: 2026-10-21

The owner rejected idle sleeping and approved QMT application suspension at
monthly budget exhaustion. Current templates use min 1/max 1, not scale-to-zero.
The model charges 744 hours at active rates with known USD subtotals of 28.93,
31.39, 222.77 and 259.31 before tax, including conditional USD 1.34538 guard costs.
The hourly Consumption job, pinned budget reader, scoped revision suspender,
manual fallback and heartbeat/error alert are now prepared and tested offline.
Default operation is manual/read-only. Real `budgetSuspensionValidated` and
`budgetScopeValidated` evidence remain mandatory; shared-workspace/other off-scope
charges must not be omitted. No Azure execution/stop/notification is proven.
There is no approval for automatic resume, deployment or overruns.
The following 2026-10-20 checkpoint is historical where it differs.

### Implementation checkpoint: 2026-10-20

Local implementation now includes lazy bounded SQL pools, database-free liveness, required signing configuration, production-disabled providers, removal of generated weather/Spark/warmup, bounded events/export, public DTO allowlists, active-user/role enforcement, persistent idempotent requests and transactional booking/review services. Additive nonseeding migrations, explicit administrator bootstrap, a database checker, non-root image recipe, bounded Consumption/Basic templates, validation-only workflows and a fail-closed cost gate have been added. The separate product page and homepage card are local pilot-preparation drafts, not published services.

The dated weekly view now displays actual materialized occurrences, including weekends, morning fixtures and day-clipped overnight/multiday intervals. End dates survive editing, notifications and export. Transport availability is explicit, has no inherited recipient and uses authenticated, timeout-bounded requests; recurring games require deliberate per-event draft actions rather than bulk SQL/mail-client activity. Runtime dependencies are separated from frontend/build/provider development dependencies.

Local checks now report 21 passed and one explicitly skipped real-SQL suite; lint, type checking, frontend build, production-only installation smoke and both Bicep compilations have passed. The main frontend bundle still triggers an unsuppressed large-chunk warning. Real SQL integration tests and the image build are not locally verified: Docker is unavailable. CI now contains fresh/legacy-schema disposable SQL tests, both template compilations and image smoke checks; their existence is not a passing result. Recovery, actual historical-schema migration, Basic load, browser acceptance, proxy assumptions, image, restore, pause/resume, complete pricing and owner approval remain release gates. Timestamp semantics are explicitly preserved pending a data-provenance decision; tenant isolation, managed-identity SQL access and universal club-contact generalization are not complete.

The updated forward model prices all six ancillary categories conditionally, including usage-dependent logs, egress and DNS and a proposed LRS LTR/restore allowance. The unmeasured monthly scenarios are USD 8.48 light use, 14.18 routine use, 220.95 sustained/high traffic and 257.10 full-month two-replica overlap stress, before tax/FX. These supersede the incomplete USD 6.47/29.10/48.81 subtotals and are not hard caps. Actual configuration review, implementation of the proposed backup/monitoring policy and owner approval remain outstanding. Deployment is blocked, not silently assigned a higher budget; see the dated cost evidence.

The ten-step execution sequence is in `architecture-qmt-relaunch-1.md`. The owner
clarified that QMT is their football club's operational production system. The
earlier demonstration selection and first-step completion claim are withdrawn.
Step 1 is now complete for real production: the owner selected a fresh database
with manual application entry on 2026-10-20, and the source-backed club, canonical
timezone and owner-selected administrator login are privately recorded. No account
or database has been created. Recovery is optional, not a launch blocker; preserve
any later-discovered source without automatically importing it. The bounded recovery inventory remains in
`evidence\data-recovery-2026-10-20.md`. Older "pilot" terminology below denotes the
original bounded-release proposal, not permission to launch an experiment or
substitute sample data; the corrected production requirements take precedence.

## 1. Requirements & Constraints

- **REQ-001**: Position the product as "QMT by errandom" with the headline "Practice, game and field management for American football and flag football clubs." Supporting copy: "Coordinate teams, fields, facilities and equipment in one shared schedule." Describe other field sports as future expansion, not supported functionality.
- **REQ-002**: Add a main-site Ventures card linking to `/QMT/`. Create a product page with the problem, current capabilities, audience, truthful production-readiness status, and a working application link only after release gates pass. Do not present the owner's operational system as a demonstration.
- **REQ-003**: Keep the application at `qmt.errandom.com` for the first release. `/QMT/` is the product page, not a promise that the running app lives beneath that path. A full-path application is a separate routing decision described in Alternatives.
- **REQ-004**: Preserve public scheduling, filters, list/week views, authenticated operations, recurring practices, sites/fields/meeting rooms, equipment, request review, and existing CSV export. Publish only features proven by acceptance tests.
- **REQ-005**: Store all operational mutations in the database. Verify requests, approvals, cancellations, equipment changes, and events across independent browser contexts and process restarts. Browser storage is never the system of record.
- **REQ-006**: Prevent conflicting field allocations transactionally. Use half-open intervals: `existing.start < proposed.end AND existing.end > proposed.start`. Adjacent bookings are allowed; Cancelled events do not reserve fields. Full/Shared fields retain a conservative exclusive-booking rule until explicit subdivision/capacity rules are implemented.
- **REQ-007**: Configure club name, slug, timezone, supported sports, and contact labels without a code fork. `Europe/Zurich` is proposed but must be confirmed for the actual club. Do not invent historical UTC conversion semantics; classify recovered timestamps before conversion.
- **REQ-008**: Keep AI event creation and Spond integration optional. They are disabled by default; Spond is admin-triggered, bounded, and preview-first if enabled. Core scheduling must work without either provider.
- **SEC-001**: Enforce authentication, active-user checks, and role authorization on the server for every operational write and private read. Public request submission is a separately validated and rate-limited exception. Public schedule DTOs must omit contact details, internal notes, request contents, credentials, and attendance-person details.
- **SEC-002**: Fail startup on missing signing configuration, eliminate documented/default bootstrap credentials, rotate legacy credentials before any reuse, and keep secrets out of client bundles, source, artifacts, diagnostic responses, and logs. Use an admin bootstrap command with protected input.
- **SEC-003**: Before multi-club hosting, scope users, sessions, every operational table, API query, cache key, integration secret, export, and audit event to an organization; add negative cross-organization tests. A club name setting is not tenant isolation.
- **SEC-004**: Use independent QMT managed identity, least-privilege database access, protected deployment environment, and host-only secure sessions. Do not share ARGOS sessions, database tables, or signing keys. If adopting cookies, implement CSRF protection and Origin validation on writes.
- **CON-001**: Planning does not authorize commits, pushes, DNS changes, deployment, restoring resources, adding providers, changing existing platform infrastructure, or disabling the existing GitHub workflow. Execution of those actions requires explicit authorization.
- **CON-002**: Use the owner-confirmed CHF monthly budget privately recorded on 2026-10-20, not the superseded unapproved USD 20 target. Count database, runtime, logs, image storage/builds, backups, egress, tax/currency adjustments and additional providers within that budget; do not silently add exclusions on top. Existing platform/domain baseline is excluded but incremental QMT consumption is included. No subscription-wide free grants are assumed. The budget is not a guaranteed billing cap or provisioning authority; full envelope/response acceptance remains pending.
- **CON-003**: Provisioning is blocked until a region- and subscription-specific estimate satisfies CON-002 and explicitly budgets active-traffic and continuously-active scenarios. If Basic SQL or the runtime fails cost/performance criteria, record the result and obtain approval for a revised design or budget; never silently upgrade.
- **CON-004**: No dedicated App Service plan, dedicated Container Apps workload profile, premium edge gateway, provisioned model capacity, Redis, or Kubernetes for the proposed cost-controlled production release. One always-running Consumption replica is now the owner-selected availability policy.
- **CON-005**: Runtime settings are Consumption, `minReplicas=1`, `maxReplicas=1`, `cpu=0.25`, `memory=0.5Gi`, one active revision, and no self-ping or periodic warmup. Model all 744 hours of a 31-day month at active rates. Suspend QMT at actual monthly budget exhaustion through an authenticated QMT-only action; never delete data, stop another venture or automatically resume without approval. Verify and price that action before release; delayed billing is not a hard spending cap.
- **CON-006**: Proposed database is one QMT-only Azure SQL Basic database, 5 DTUs, maximum 2 GB, only if migration and load tests pass. It has a fixed billed floor; it does not scale to zero [S05, S06]. Keep data below 1.5 GB at acceptance to retain headroom. No production data in a container-local SQLite file.
- **GUD-001**: Preserve behavior by recording a route/feature matrix before consolidation. Retain `server.js` as the initial canonical backend; extract only test seams and shared logic required by this plan. A full backend rewrite is not part of the cost fix.
- **GUD-002**: Migrate runtime/build/CI from Node 20 to Node 24 LTS; check compatible package versions and pin the selected production image digest. Node 20 is EOL at this plan's evaluation date [S10].
- **PAT-001**: Deploy app and `/api` together on the application subdomain, keeping browser API calls same-origin. Keep the marketing website independent. Use `src\lib\api.ts` for all frontend network requests instead of hardcoded root paths.

### Product scope and operating model

| Release | Included | Explicitly excluded |
|---|---|---|
| Production relaunch | The owner's actual club; tackle/flag teams; practice/game scheduling; recurring events; exclusive field booking; equipment tracking; persisted public requests and office review; CSV export; configurable identity. | Demonstration substitution, unapproved empty replacement of operational data, public account signup, subscriptions/payments, multiple clubs in one database, invented weather, autonomous external changes, new sports claims. |
| Later expansion | A second isolated organization after SEC-003; configurable sport catalog; authenticated club onboarding; optional real weather; validated manual Spond sync. | Rebuilding Spond/member communication, federation management, coaching/playbooks, player health/performance data, generic all-sports ERP. |

### Cost control design

| Meter | Proposed control | Acceptance evidence |
|---|---|---|
| Web/API compute | Small Consumption app, one minimum/maximum replica, single active revision, no scheduled wakeups. | Verify one warm replica during idle periods and a measured always-on monthly estimate. No idle discounts are assumed; deployments/failures can still restart the app [S04]. |
| SQL | Evaluate Basic first; bounded queries; maximum pool size 5 and minimum 0; no recurring database pings. | Actual regional estimate, data-size measurement, and load-test results. Keep SQL compatibility instead of rewriting T-SQL prematurely. |
| AI | `QMT_AI_ENABLED=false`; do not inject model credentials; reject model-backed routes before invoking a provider. | Public page load, requests, and scheduling complete with zero model calls. |
| Integrations | `QMT_SPOND_ENABLED=false`, `QMT_WEATHER_ENABLED=false`; opt-in manual integration tests only. | No external sync loop; disabled controls explain availability rather than pretending success. |
| Logs | No recordset/body/contact logging; retain errors and sampled request metadata; scoped ingestion alert and retention policy compatible with the shared workspace. | Measured daily log bytes; no modification of shared platform retention/caps without approval. |
| Registry/backups/builds | Reuse authorized registry capacity when compatible; retain current and previous images plus a bounded rollback history; built-in database backups and tested recovery. | Incremental storage/build/backup charges included; no unbounded deployment artifacts. |
| Spend alerts | Use the privately recorded CHF budget. Early actual/forecast warnings remain proposed; the owner approved suspension at actual 100% monthly spend. Do not invent an approved USD conversion. | Verified alert delivery and authenticated QMT-only automatic action, priced in `budgetAutomation`, with `budgetSuspensionValidated` evidence. Budgets alone notify rather than stop consumption [S07]. |
| Emergency stop | At the approved threshold, deactivate QMT app revisions only; keep a protected manual fallback. The separate product page communicates maintenance, but its publication failure must not delay suspension. Database/backups remain intact and continue charging. | Rehearse automatic trigger/action failure handling, idempotency, QMT isolation and controlled resume. Verify data/TLS before resume [S11]. No exact billing cap or unapproved automatic restart. |

## 2. Implementation Steps

The checkpoint above records implemented work and remaining gaps. Task rows are not marked complete unless their entire description and acceptance evidence have been satisfied; a blank Completed/Date cell means completion is unverified, not that no local code exists. Tasks are independent within a phase except for the explicit task dependencies below. Every phase lists its prerequisite phases and a measurable exit gate. Cloud actions remain subject to CON-001.

### Implementation Phase 1

- **GOAL-001**: Establish historical costs, recoverability, and a safe implementation baseline.

**Prerequisites:** none. **Exit gate:** route/feature inventory, cost attribution evidence or explicit gaps, and a data-provenance decision are recorded without recreating resources.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `plan\evidence\cost-baseline-2026-10-20.md` containing a sanitized summary of the preceding 60 days' Cost Management data grouped by resource ID, service, SKU, and day, plus inventory checks across authorized subscriptions. Keep raw billing exports in approved private storage, not this public repo. Classify App Service, SQL, AI, monitoring, storage, registry, and residual charges. If unavailable, explicitly record missing permissions/data and prohibit definitive historical attribution. | | |
| TASK-002 | Create `plan\evidence\data-recovery-2026-10-20.md` with a non-sensitive inventory of available SQL exports, deleted-database backups, long-term backups, and soft-deleted logical-server eligibility. Include deletion dates and retention deadlines when available. Check the current preview recovery path rather than assuming server deletion is universally recoverable or unrecoverable [S08, S09]. Do not restore yet. Record either an authorized recovery source or a clean-start decision; never label sample/browser data as recovered production data. | | |
| TASK-003 | Create `plan\evidence\route-feature-matrix.md` from `server.js`, `server\index.ts`, `server\routes\*.ts`, `src\lib\api.ts`, and request dialogs. Record actual method/path, authentication, data fields, persistence, recurrence, Spond, natural-language creation, and export behavior. List missing server-side guarantees explicitly. This is the deletion/consolidation checklist. | | |
| TASK-004 | Update `package.json`, `package-lock.json`, `.github\workflows\main_qmt.yml`, `tsconfig.json`, and new `eslint.config.js` to establish Node 24, reproducible `npm ci`, separate typecheck/build/lint/test commands, and a non-deploying validation job. Remove lockfile rewriting in CI and remove `--noCheck` only after type errors are resolved, without suppressing diagnostics. In the legacy workflow, gate deployment behind an explicitly approved environment and manual dispatch so a later source push cannot accidentally target the retired app. Depends on TASK-003 and authorization for workflow changes. | | |

### Implementation Phase 2

- **GOAL-002**: Make the canonical runtime independently testable, idle-friendly, and safe to configure.

**Prerequisites:** Phase 1. **Exit gate:** one documented production entry point, no keep-awake logic, no AI weather, and baseline contracts pass.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | In `server.js`, separate app construction from `listen` using a `require.main === module` entry guard and dependency injection for SQL/provider test doubles. Preserve current API contracts in `test\api-contracts.test.cjs` using Node's test runner. Update `package.json` start/test scripts. Do not start production jobs or connect to real SQL during unit tests. | | |
| TASK-006 | In `server.js`, replace the `poolConnecting` recursion with a shared connection-attempt promise, clear it on failure, reconnect after pool errors, configure pool min 0/max 5, and close cleanly on SIGTERM. Remove the startup SQL query. Keep `/api/health` database-independent, make database readiness an authenticated on-demand probe, and return JSON 404 for retired warmup endpoints. Depends on TASK-005. | | |
| TASK-007 | Add typed deployment configuration in `server\config.cjs` with exact flags `QMT_AI_ENABLED`, `QMT_SPOND_ENABLED`, `QMT_WEATHER_ENABLED` defaulting false; validate booleans and signing configuration. In `server.js`, reject disabled provider routes before database/provider access, and prevent missing configuration from becoming success-shaped fallback behavior. Update `.env.template` with names and descriptions, not real values. Depends on TASK-005. | | |
| TASK-008 | Remove the generated-weather implementation from `src\lib\weatherService.ts` and its use in `src\components\EventCard.tsx`; display "Weather unavailable" unless a separately enabled real forecast adapter returns timestamped data. Do not return seasonal numbers as forecasts. Gate `src\components\NaturalLanguageEventCreator.tsx` and Spond controls on server-advertised capabilities. Depends on TASK-007. | | |
| TASK-009 | After TASK-003 and TASK-005 through TASK-008, remove the unused parallel backend entry/config/routes/services only where the matrix proves replacement coverage. In `src\main.tsx`, `src\hooks\useInitializeData.ts`, `server.js`, `vite.config.mts`, and `vite.config.build.mts`, remove unused Spark initialization, in-memory KV endpoints, and Spark-only plugins after reference checks. Remove unused dependencies through npm, preserving lockfile integrity. Do not import the old keep-alive database module into the production runtime. Update `README.md` and `DEPLOYMENT.md` to name the single entry point and retire conflicting deployment instructions. | | |

### Implementation Phase 3

- **GOAL-003**: Deliver a trustworthy shared system of record and enforce the pilot's access boundaries.

**Prerequisites:** Phase 2; TASK-002 determines recovered-data versus clean-start fixtures. **Exit gate:** two-browser workflows, unauthorized-write rejection, booking conflicts, and restart persistence all pass on disposable SQL.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Replace scattered/manual schema assumptions in `database-schema.sql`, `run-all-migrations.sql`, `migrate-db.js`, and `run-migration.js` with one ordered, versioned migration runner and ledger, implemented under `migrations\` and `scripts\migrate.cjs`. Reconcile request status casing, multi-team/field links, notes, recurrence, settings, and Spond columns from TASK-003. Separate synthetic seeds from production initialization. Eliminate schema-column discovery from individual writes in `server.js`. Test an empty database and the recovered schema fixture; run migrations out of band, never on every app startup. | | |
| TASK-011 | In `server.js`, apply `verifyToken` plus active-user/role checks to all operational mutations and private collections, including AI/Spond endpoints when enabled. Keep explicit public schedule/reference DTOs and validated request submission separate. Restrict diagnostics; redact error output; add login/request rate limits with tested proxy/IP handling. Add `scripts\bootstrap-admin.cjs` with protected password input, no default credentials, and no secrets in command history. Add host-only Secure/HttpOnly/SameSite session cookies with CSRF/Origin checks and adapt `src\lib\api.ts`, `src\lib\auth.ts`, and `src\components\LoginDialog.tsx`. Depends on TASK-010. | | |
| TASK-012 | In `server.js` and `src\lib\api.ts`, define persistent facility/equipment/cancellation request DTOs, including multi-team selection and cancellation event references. Update `src\contexts\DataContext.tsx`, `src\components\FacilityRequestDialog.tsx`, `src\components\EquipmentRequestDialog.tsx`, `src\components\CancellationRequestDialog.tsx`, and `src\components\OperationsOffice\RequestsManager.tsx` to submit/load/review through those APIs. Record reviewer/timestamp and append-only audit events; remove ordinary request deletion. Approvals create/change the corresponding event and request status in one transaction; repeated submissions/approvals use idempotency keys. Show success only after server commit. Depends on TASK-010 and TASK-011. | | |
| TASK-013 | In `server.js` and new `server\booking.cjs`, validate active fields/sites, valid intervals, maximum 366-day recurrence range, and at most 366 occurrences per request. Normalize field assignments into indexed `event_fields` rows via a migration. Acquire transaction-owned SQL application locks in sorted field-ID order, check half-open overlap intervals, then insert/update all occurrences atomically. Use the same booking service for manual edits, request approvals, natural-language commits, and Spond imports. Return HTTP 409 with public-safe conflict details and roll back the entire requested series on conflict. Depends on TASK-010 through TASK-012. | | |
| TASK-014 | In `server\booking.cjs`, `server.js`, `src\lib\api.ts`, `src\components\EventList.tsx`, and `src\components\OperationsOffice\ScheduleManager.tsx`, use explicit club-local input with `Europe/Zurich` timezone and UTC instants in storage; preserve club-local start time when generating each recurring occurrence across DST. Preserve existing Planned-to-Confirmed-within-24-hours behavior as a server-side computed effective status on reads, not a browser write or wakeup job; preserve explicit Cancelled/Completed values and audit actual edits. Label computed confirmation in the office. Add optimistic concurrency tokens for edits. Depends on TASK-010 and TASK-013. | | |
| TASK-015 | In `src\contexts\DataContext.tsx` and `src\lib\api.ts`, remove warmup fetches and global localStorage as authoritative operational storage. Namespace any retained public cache by `qmt:v1:clubSlug`, clear private data on logout/club change, expose loading/error/stale states, retain last confirmed data on a failed refresh, and invalidate affected queries after commits. Never show empty-success states for API failures. Depends on TASK-011 through TASK-014. | | |

### Implementation Phase 4

- **GOAL-004**: Reduce workload and product-specific coupling without rewriting the platform.

**Prerequisites:** Phase 3. **Exit gate:** bounded data access, cold/warm performance measurements, and configurable football-club identity.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | In `server.js`, change event reads to require/default a bounded range, return explicit DTO columns, filter at SQL level, and support cursor pagination with page size 100 and maximum 500. The default range is today minus 7 days through today plus 90 days in club time; the maximum range is 366 days. Update `src\lib\api.ts`, `src\components\ScheduleView.tsx`, and `src\components\ScheduleExportDialog.tsx` so week navigation and exports request all required pages for the selected range. Add matching measured indexes through `migrations\`; do not truncate exports to the first page. | | |
| TASK-017 | In `src\contexts\DataContext.tsx`, reuse the existing `@tanstack/react-query` dependency for deduplication, 60-second public-schedule freshness, 10-minute reference-data freshness, and targeted invalidation. Do not poll background tabs or prefetch private office collections publicly. Add public-only ETags and `Cache-Control: public, max-age=60`; all private responses use `no-store`. In `src\App.tsx`, lazy-load `OperationsOffice` and optional integrations. In `server.js`, use long immutable caching only for hashed assets and revalidation for HTML. Depends on TASK-016. | | |
| TASK-018 | Add a non-secret public club configuration endpoint in `server.js`; update `src\components\Header.tsx`, `src\components\Dashboard.tsx`, `src\components\OperationsOffice\TeamsManager.tsx`, `src\components\OperationsOffice\RequestsManager.tsx`, `src\lib\whatsappService.ts`, `src\lib\types.ts`, `index.html`, and sharing/export labels to use configured club identity. Keep Tackle Football and Flag Football as the only enabled pilot sports; do not expose an unimplemented "all field sports" selector. Add "QMT by errandom" and a link back to the product page while retaining club identity inside the app. | | |
| TASK-019 | In `server.js`, remove full data/request/provider-response logging, emit bounded structured operational metadata, and redact contact and auth fields. Add `scripts\measure-workload.cjs` and synthetic fixtures under `test\fixtures\` to measure SQL queries, bytes, CPU/memory, warm API latency, and log volume for 10,000 events, 10 concurrent users, 100 daily visitors, and 10 office sessions/day. Record measurements and expected/worst-case monthly meter quantities in `plan\evidence\pilot-capacity.md`. Depends on TASK-016 and TASK-017. | | |

### Implementation Phase 5

- **GOAL-005**: Prepare an isolated, reproducible, cost-gated errandom deployment.

**Prerequisites:** Phases 1 through 4. **Exit gate:** reviewed IaC/what-if and cost worksheet fit the proposed budget; after separate deployment authorization, staging proves rollback, one warm idle replica, budget-triggered zero-replica suspension, and restore.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Create `infra\main.bicep` and `infra\pilot.bicepparam` for a separate QMT app/database/identity, Consumption environment reuse by explicit parameter, proposed resource bounds from CON-005/CON-006, HTTP scale rule, port, probes, and managed identity. Select one active revision and no public periodic health monitor that wakes a zero-replica app. Configure narrow SQL network access and least-privilege authentication; prefer managed identity and a separate migration identity. Verify subscription/tenant/region/quota, registry access, subnet egress implications, and compatible SQL connectivity without weakening another venture. Store no private platform resource identifiers in this public repository. | | |
| TASK-021 | Update `plan\evidence\cost-baseline-2026-10-20.md` and `infra\cost-model.json` from TASK-001, TASK-019, current Azure pricing and authorized environment parameters. Itemize Basic SQL, measured and 744-hour always-on runtime, logs/retention, registry/build/cache, backups, egress, authenticated budget-suspension automation and tax/currency treatment. Count shared free grants only as an additional scenario. Basic is accepted only below 1.5 GB with passing workload tests; the complete envelope must meet the privately confirmed CHF budget and unchanged release gates. Do not fabricate USD approval or drop stress cases; if a gate fails, keep deployment blocked and present a revised SKU/provider/controlled-envelope option for approval, without upgrading automatically. Depends on TASK-020. | | |
| TASK-022 | Add `Dockerfile` and `.dockerignore` with a multi-stage Node 24 production build, non-root runtime, required production dependencies only, and no source credentials or test fixtures. Update `.github\workflows\main_qmt.yml` or replace it with `.github\workflows\deploy-qmt.yml`: immutable commit-tagged image, OIDC, concurrency control, required checks, approved production environment, separate migration execution, smoke tests, and previous-image rollback. Keep provisioning and production promotion manual; PR validation never deploys. Depends on TASK-020 and TASK-021. | | |
| TASK-023 | In `infra\main.bicep`, configure QMT tags, scoped budget alerts from the cost-control table, supported database backup retention, and private log settings. Add protected manual `pause`/`resume` actions in `.github\workflows\deploy-qmt.yml` and exact operator procedures in `DEPLOYMENT.md` for deactivating/restoring QMT revisions and preserving its database. Coordinate a separately approved maintenance notice/CTA change on the product page; do not claim the stopped app can serve maintenance. Document residual fixed charges, delayed billing signals, certificate-renewal implications of prolonged deactivation, and TLS verification on resume [S11]. Do not modify shared workspace caps/retention or other apps. Depends on TASK-021 and TASK-022. | | |
| TASK-024 | After deployment authorization, deploy a separately named ephemeral staging app/database with the same limits on its generated Azure hostname; apply versioned migrations; import only the approved TASK-002 source or synthetic seed. Do not point production DNS at staging. Record non-secret deployment evidence in `plan\evidence\release-readiness.md`; verify a warm idle replica and startup/restart/load/restore/rollback/budget-stop-resume behavior, preserve the approved image digest and migration versions, then remove the specifically named staging resources after recording results. Depends on TASK-022 and TASK-023. | | |

### Implementation Phase 6

- **GOAL-006**: Introduce QMT on the errandom website without falsely marking an unavailable product live.

**Prerequisites:** Phase 1 for content; live CTA activation depends on Phase 5 and TASK-028. **Exit gate:** root page links to the accessible product page, with truthful availability and working URLs.

Paths beginning `site\` refer to the separate `errandom/errandom-com` checkout at the workspace root; they are not files inside QMT.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Create `site\QMT\index.html` using the existing site typography, tokens, navigation, mobile behavior, reduced-motion support, legal links, and canonical `https://www.errandom.com/QMT/`. Include REQ-001 copy, "Built for club administrators, coaches and team managers", three concrete capability groups (schedule/fields, equipment/requests, shared visibility), and a clear pilot notice. Keep the app CTA absent until TASK-028; use the existing contact route for pilot interest without adding a new data-collection provider. Do not embed operational forms, login, or commercial transactions in Pages. | | |
| TASK-026 | In `site\index.html`, add a QMT venture card targeting `/QMT/`, initially labeled "Pilot preparation". Update metadata/about facts only where needed and do not increase "Live ventures" until the app is live. Preserve existing links, legal routes, accessibility, and layout. Validate against Pages' intended-use restrictions; reassess main-site hosting before introducing a commercial SaaS funnel or transactions [S02]. Depends on TASK-025. | | |
| TASK-027 | In `site\QMT\index.html`, `site\index.html`, and new QMT `test\e2e\platform-links.spec.ts`, verify apex-to-www behavior, `/QMT` to `/QMT/`, canonical metadata, main-site link, return-to-errandom navigation, mobile layout, keyboard operation, and no broken assets. If running-app path hosting is later approved, set Vite `base` and central API URLs together and add nested-path/deep-link tests; never assume changing Vite `base` alone rewrites raw fetch URLs [S12]. Depends on TASK-025 and TASK-026. | | |

### Implementation Phase 7

- **GOAL-007**: Promote only a verified pilot, observe its costs, and gate broader club/sport expansion.

**Prerequisites:** Phases 3 through 6, with TASK-024 staging evidence available. **Exit gate:** pilot sign-off, visible product entry point, recoverable operations, and seven-day actual-cost review.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-028 | Add and run `test\e2e\club-operations.spec.ts`, `test\booking.test.cjs`, `test\authorization.test.cjs`, and `test\persistence.test.cjs` for all Section 6 launch tests; run TEST-015 after seven days and TEST-016 only before expansion. Record pass/fail and known limitations in `plan\evidence\release-readiness.md`. After explicit production authorization, provision the separately named production resources from the validated IaC, deploy the approved image digest, apply the validated migration versions, and import only the approved TASK-002 source or explicitly authorized clean-start data. Never promote disposable test data. Bind `qmt.errandom.com` to the production app with domain-verification records and a managed TLS certificate while keeping ingress reachable for issuance/renewal, without changing root/www or ARGOS DNS [S11]. Set the product-page CTA to `https://qmt.errandom.com` and change site status to "Pilot" only after production smoke tests pass. Do not mark generally available or "Live" merely because deployment succeeded. Depends on TASK-024 and TASK-027. | | |
| TASK-029 | After seven pilot days, update `plan\evidence\pilot-cost-model.md` and `plan\evidence\release-readiness.md` with actual daily cost, runtime replica activity, database DTU/storage, latency, provider-call counts, and error/log volume. Project the month from actual billable meters and compare with CON-002; distinguish incomplete billing data from zero cost. If projected cost exceeds target, disable optional integrations and execute the documented pause/review process with operator authorization instead of scaling up. Depends on TASK-028. | | |
| TASK-030 | Before enabling another club or additional sports, create `plan\feature-qmt-multiclub-1.md` specifying organizations/memberships, organization-bound auth, row/query/cache/export/integration scoping, audit attribution, configurable sport catalog, per-club quotas, and migration/negative-isolation tests. Do not implement billing or signup during the pilot. Evaluate a PostgreSQL migration only against measured SQL limitations and total migration/operating cost; keep the first club operational during any future transition. Depends on TASK-029. | | |

## 3. Alternatives

- **ALT-001**: Put the entire application at `errandom.com/QMT/`. This remains feasible with an HTTP path router/reverse proxy in front of the appropriate origin or a move of the main site to hosting supporting that routing. DNS alone cannot split paths, and the current Pages site does not run Express. It adds shared-domain deployment/cookie/cache/routing risk and may add edge-service costs. Not selected for the pilot. If it becomes a strict requirement, separately approve edge/site-host migration, route `/QMT/api/*` and assets correctly, and test deep links and root-site regressions. A redirecting product page is not equivalent to app path hosting.
- **ALT-002**: Run QMT inside the existing ARGOS process or reuse ARGOS user data/session secrets. Rejected: unrelated release lifecycle, load, data governance, and failure blast radius. Reusing an authorized Consumption environment or registry is different from sharing an application.
- **ALT-003**: Recreate dedicated App Service plus vCore SQL and keep both warm. Rejected for the pilot: fixed compute exposure and unnecessary idle work. Empty/stopped App Service arrangements can continue billing depending on remaining plan resources [S13].
- **ALT-004**: Use Azure SQL serverless and rely on auto-pause. Not the default recommendation: open sessions and activity can prevent pause, and public traffic can repeatedly wake the database [S03]. Compare a measured serverless scenario only if its total cost beats the accepted Basic design without warmup loops.
- **ALT-005**: Rewrite immediately to PostgreSQL/serverless PostgreSQL or an edge-worker/SQLite service. Deferred: `server.js` and the SQL migrations depend heavily on T-SQL and `mssql`; this changes persistence, auth, runtime, and recovery simultaneously. It may win later but requires a costed spike and compatibility tests, not an assumption of free hosting.
- **ALT-006**: Store SQLite on ephemeral container storage or assume a shared network file mount solves durability/concurrency. Rejected for this design: persistence and writer semantics are not established; no production club data may depend on that shortcut.
- **ALT-007**: Publish a commercial application/login workflow directly on GitHub Pages because the frontend is static. Rejected: Pages is static and its published limits restrict commercial SaaS and sensitive transactions [S01, S02]. Limit current website changes to informational product content and re-evaluate hosting before commercialization.
- **ALT-008**: Launch immediately as a general all-field-sports SaaS. Rejected for initial positioning: present types, database constraints, filters, terminology, and original requirements explicitly target tackle/flag football. Lead with a specific, credible user problem; generalize only after another sport's workflow is validated.

## 4. Dependencies

- **DEP-001**: Explicit authorization for each cloud/DNS/publication action under CON-001; approved subscription, billing currency, region, budget, and production release environment before TASK-024.
- **DEP-002**: Historical billing records and deleted-resource metadata for TASK-001; if unavailable, the baseline must remain explicitly unverified rather than block safe local improvements.
- **DEP-003**: Data source determination from TASK-002. Database/server restore availability depends on actual retention and configuration; preview soft-delete support does not establish recoverability of this deployment.
- **DEP-004**: Compatible existing Consumption environment, authorized registry access, DNS control for the QMT subdomain, OIDC/managed identity permissions, and narrow SQL connectivity. Failure requires a separately costed design, not implicit permission changes.
- **DEP-005**: Disposable SQL Server-compatible test infrastructure and approved isolated staging resources; SQL transaction behavior must be tested against a real SQL engine, not only mocks.
- **DEP-006**: Node 24 toolchain; existing React/Vite/TanStack stack; add a browser-test runner only as a declared dev dependency during execution. Use built-in Node tests for backend logic; no production test-tool dependency.
- **DEP-007**: Spond credentials/API suitability and real weather provider terms are separate opt-in dependencies. Neither may block core pilot scheduling or silently trigger new paid usage.
- **DEP-008**: Main-site publication follows the `errandom-com` repository's deployment model and review process; do not combine QMT app deployment and unrelated main-site changes in one uncontrolled release.

## 5. Files

- **FILE-001**: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.env.template`: supported runtime, genuine checks, dependency pruning, non-secret configuration.
- **FILE-002**: `server.js`, `server\config.cjs`, `server\booking.cjs`: canonical runtime, test seams, session/auth enforcement, capabilities, transactional booking, bounded DTO/query behavior.
- **FILE-003**: `server\index.ts`, `server\db.ts`, `server\routes\*.ts`, `server\services\*.ts`, `server\middleware\auth.ts`: compare against the route matrix and retire only proven duplicate/dead runtime code.
- **FILE-004**: `database-schema.sql`, `run-all-migrations.sql`, `migrate-db.js`, `run-migration.js`, `migrations\*`, `scripts\migrate.cjs`, `scripts\bootstrap-admin.cjs`: one schema lifecycle, safe initialization and provenance-aware import.
- **FILE-005**: `src\contexts\DataContext.tsx`, `src\lib\api.ts`, `src\lib\auth.ts`, `src\lib\types.ts`: server-authoritative state, typed contracts, sessions, errors, caching, timezone handling.
- **FILE-006**: `src\components\FacilityRequestDialog.tsx`, `src\components\EquipmentRequestDialog.tsx`, `src\components\CancellationRequestDialog.tsx`, `src\components\OperationsOffice\RequestsManager.tsx`, `src\components\OperationsOffice\ScheduleManager.tsx`: end-to-end persisted operational workflows.
- **FILE-007**: `src\App.tsx`, `src\main.tsx`, `src\hooks\useInitializeData.ts`, `src\components\Header.tsx`, `src\components\Dashboard.tsx`, `src\components\EventList.tsx`, `src\components\EventCard.tsx`, `src\components\ScheduleView.tsx`, `src\components\ScheduleExportDialog.tsx`, `src\components\LoginDialog.tsx`: pilot branding, public/private separation, lazy loading, calendar/export behavior.
- **FILE-008**: `src\lib\weatherService.ts`, `src\lib\whatsappService.ts`, `src\components\NaturalLanguageEventCreator.tsx`, `src\components\OperationsOffice\SpondIntegration.tsx`, `src\components\OperationsOffice\SpondSetupWizard.tsx`, `src\components\OperationsOffice\SpondSyncWizard.tsx`, `src\components\EventUpdateShareDialog.tsx`, `src\components\OperationsOffice\TeamsManager.tsx`: optional provider flags, centralized requests, club-aware labels.
- **FILE-009**: `vite.config.mts`, `vite.config.build.mts`, `index.html`, `Dockerfile`, `.dockerignore`, `infra\main.bicep`, `infra\pilot.bicepparam`, `.github\workflows\main_qmt.yml`, `.github\workflows\deploy-qmt.yml`: deployable artifacts and cost-bounded infrastructure.
- **FILE-010**: `test\*.test.cjs`, `test\e2e\*.spec.ts`, `test\fixtures\*`, `scripts\measure-workload.cjs`: contract, authorization, persistence, booking, browser and workload evidence.
- **FILE-011**: `site\index.html`, `site\QMT\index.html`: separately reviewed informational website entry points in `errandom/errandom-com`.
- **FILE-012**: `README.md`, `DEPLOYMENT.md`, `plan\evidence\*.md`, `plan\feature-qmt-multiclub-1.md`: operator instructions, sanitized evidence, and future isolation specification. Raw private billing or recovered club data must never be committed.
- **FILE-013**: `scripts\budget-guard.cjs`, `infra\budget-guard.bicep`, `test\budget-guard.test.cjs` and `test\cost-controls.test.cjs`: pinned budget reader, scoped suspension, manual fallback, hourly job/alert and offline fault/cost gates. Live scope and suspension evidence remain separate release requirements.

## 6. Testing

The implementation phase introduces the named checks below. They are acceptance criteria, not claims that tests already exist or pass.

- **TEST-001**: Clean checkout on Node 24: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` succeed without rewriting the lockfile, suppressing diagnostics, or relying on Spark-hosted services.
- **TEST-002**: Boot without database connectivity: liveness returns 200; operational database routes return explicit unavailable responses; startup and liveness perform zero SQL/provider calls. Missing signing configuration fails closed.
- **TEST-003**: Anonymous public schedule/reference reads expose only approved fields. Anonymous/ordinary-user operational writes, private reads, diagnostics, AI/Spond/admin actions fail with 401/403. Inactive/expired sessions are rejected; cookie origin/CSRF controls reject cross-site writes; logout removes private cache. Public requests remain valid but rate-limited.
- **TEST-004**: Browser A submits each request type; browser B's authenticated office sees it after refresh; approve/reject attribution survives restart. Repeated idempotency keys do not duplicate requests or approved events. Failed submissions show an error and no success toast.
- **TEST-005**: Two simultaneous overlapping bookings on one field yield exactly one commit and one 409. Adjacent bookings both succeed; different fields do not conflict; multi-field conflicts and recurring-series conflicts roll back the whole mutation; Cancelled events release fields. Exercise every event-write path, not only the office form.
- **TEST-006**: A recurring club-local 18:00 practice spanning Zurich DST changes stays at 18:00 local time. Test invalid/nonexistent/ambiguous times explicitly, midnight-crossing events, recurrence range/count limits, cancellation, editing concurrency, and the read-time confirmation rule. Test recovered-data conversion separately.
- **TEST-007**: Empty-database migration and recovered-schema-fixture migration produce the same required schema; applying the runner twice changes nothing the second time. No production bootstrap uses default users, mixed sample data, or out-of-band schema discovery.
- **TEST-008**: With all optional features disabled, public visits, scheduling, requests and exports make zero model/Spond/weather-provider calls. Weather never displays seasonal/generated numbers as a forecast. Disabled capability controls communicate availability.
- **TEST-009**: Public queries enforce ranges/page caps, exports include every selected-range page, private collections are not fetched before login, duplicate mounts deduplicate reads, and hidden tabs do not poll. Failed refresh retains an explicitly stale snapshot rather than replacing it with empty-success data.
- **TEST-010**: For TASK-019 synthetic workload, target warm API p95 below 1 second and no unexpected errors at 10 concurrent users. Verify one replica stays running while idle. Measure startup/restart first-success latency separately, target at most 20 seconds with an honest loading state, and reject the profile if it misses acceptance. Record sample size/cache state; do not hide recovery interruptions in warm averages.
- **TEST-011**: After at least 15 minutes without visitor/integration traffic, one QMT replica remains warm and produces no self-ping/SQL/provider work. In a separately authorized actual-budget-threshold rehearsal, all QMT revisions become inactive and every replica list becomes empty; requests do not wake the suspended app. Resume requires the protected operator procedure. SQL/backups remain intact and can continue charging.
- **TEST-012**: Main site, existing ventures/legal pages, product page, canonical/redirect behavior, CTA, return navigation, mobile layout, keyboard access and asset URLs remain correct. If app path routing is chosen later, test `/QMT/` assets/API/deep-link reloads and root-site behavior together.
- **TEST-013**: Restore a backup into an isolated temporary database, verify representative records and request audit data, and measure recovery. Initial pilot targets: backup RPO at most 24 hours and operational RTO at most 4 hours. Test previous-image rollback with backward-compatible schema and verify another venture is unaffected. Include temporary recovery-resource cost.
- **TEST-014**: Protected pause/resume actions affect only QMT, preserve database/backups, show truthful maintenance on the separate product page, and resume with persisted data and valid TLS. Confirm the runbook handles certificate renewal after prolonged deactivation without assuming ingress remains available while revisions are stopped. Alerts deliver to the approved operator; cost evidence explicitly states that delayed budgets are not a hard cap.
- **TEST-015**: Seven-day production review contains actual meter/cost evidence and monthly projection within the accepted target; no additional unapproved replica, provider calls, retained staging deployment, parallel paid revision, or unbounded logs/artifacts remain.
- **TEST-016**: Before a second club enters a shared service, adversarial cross-organization tests reject reads/writes/exports/cache reuse/secret access across organizations. No future marketing of multi-club availability precedes those tests.

## 7. Risks & Assumptions

- **RISK-001**: Deleted resources may have removed the only authoritative club data. A new deployment does not recover it. Check recovery sources immediately and preserve provenance; do not import speculative browser caches into production. The general recovery guide [S08] states that deleting a logical server removes PITR recovery, whereas the newer preview guide [S09] describes recovery for eligible soft-deleted servers within their configured retention. Verify actual eligibility and deletion dates rather than treating either statement as a universal guarantee.
- **RISK-002**: Billing attribution is unknown. The inactive backend's keep-awake code is a clear design risk but not established evidence of the actual old production bill. Pricing, deployment history, and billed meter history must remain distinct.
- **RISK-003**: Basic SQL may be too slow or too small; documentation notes its limited compute and HDD-backed storage [S05]. The plan deliberately gates it on measured workload and data rather than treating the cheapest SKU as automatically suitable.
- **RISK-004**: A one-replica cap limits concurrent capacity, not monthly active duration, requests, logs, egress or every ancillary charge. Bots and public request abuse can keep compute busy. Budget alerts are delayed notifications, not spending enforcement.
- **RISK-005**: Reusing an environment/registry/log workspace can create resource contention and unattributed shared costs. Tag app-specific resources, measure incremental shared consumption, keep separate identities/data, and never change shared controls as a QMT shortcut.
- **RISK-006**: Auth, request persistence, recurrence/timezone interpretation, and schema drift are launch blockers, not cosmetic technical debt. Changing them requires regression fixtures; recovering the old UI alone is insufficient.
- **RISK-007**: Existing Spond behavior may depend on undocumented API contracts. Keep it opt-in, avoid automatic writes, and never imply a supported provider partnership without evidence.
- **RISK-008**: GitHub Pages' commercial-use limits may constrain a later commercial umbrella/product site. Informational content is not approval for a future paid SaaS flow; reassess hosting before commercialization.
- **ASSUMPTION-001**: The first pilot serves one club using tackle/flag football, with roughly 100 daily visitors, 10 office sessions/day, and at most 10 concurrent active users. These are planning inputs, not measured historic demand.
- **ASSUMPTION-002**: The product-page/subdomain split satisfies the initial intent of hosting QMT under the errandom umbrella. If the entire application must remain at `/QMT/`, approve ALT-001 before deployment work; do not silently substitute a redirect.
- **ASSUMPTION-003**: Switzerland North is the initial hosting preference because a compatible environment was observed there. Actual data residency, provider terms, club permission, networking and budget still need execution-time approval; no legal compliance claim is made here.
- **ASSUMPTION-004**: The owner supplied a CHF monthly budget and fewer than five expected users, rarely concurrent, on 2026-10-20. These replace the old unapproved USD planning target, not the need to verify actual traffic, CHF billing rates, tax reserve and cost-response policy. User count is not an ingress/egress cap or cloud-spending authorization.
- **ASSUMPTION-005**: No general-purpose errandom identity, tenant provisioning service, or shared database contract is assumed to exist. The inspected main website is a venture directory, not evidence of those platform services.

## 8. Related Specifications / Further Reading

Repository evidence: QMT `PRD.md`, `package.json`, `server.js`, `server\index.ts`, `server\db.ts`, `database-schema.sql`, `.github\workflows\main_qmt.yml`, `src\contexts\DataContext.tsx`, `src\lib\api.ts`, and the UI paths listed above. Read legacy deployment/security/setup documents as historical context; their recommendations are not automatically current.

External sources checked on 2026-10-20. Recheck pricing, preview recovery eligibility and provider restrictions before implementation. These references support service behavior, not an actual cost quote or proof of recovery eligibility.

- **[S01]** GitHub Pages static-hosting model: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- **[S02]** GitHub Pages intended-use and sensitive-transaction limits: https://docs.github.com/en/enterprise-cloud%40latest/pages/getting-started-with-github-pages/github-pages-limits
- **[S03]** SQL serverless auto-pause requirements and open sessions: https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-auto-pause-resume?view=azuresql
- **[S04]** Container Apps Consumption billing, subscription-wide grants, and associated charges: https://learn.microsoft.com/en-us/azure/container-apps/billing
- **[S05]** SQL Basic DTU, storage and performance limits: https://learn.microsoft.com/en-us/azure/azure-sql/database/resource-limits-dtu-single-databases?view=azuresql
- **[S06]** SQL pricing models; obtain an offer/region-specific estimate: https://azure.microsoft.com/en-us/pricing/details/azure-sql-database/single/
- **[S07]** Azure budgets alert without stopping consumption: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets
- **[S08]** Deleted SQL database recovery and long-term backups: https://learn.microsoft.com/en-us/azure/azure-sql/database/recovery-using-backups?view=azuresql
- **[S09]** Deleted logical-server recovery preview and retention requirements: https://learn.microsoft.com/en-us/azure/azure-sql/database/deleted-logical-server-restore?view=azuresql
- **[S10]** Node release support status: https://nodejs.org/en/about/previous-releases
- **[S11]** Container Apps custom subdomain verification and managed TLS: https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates
- **[S12]** Vite nested public base paths and dynamic URL handling: https://vite.dev/guide/build
- **[S13]** App Service plan and residual-resource costs: https://learn.microsoft.com/en-us/azure/app-service/overview-manage-costs
