---
goal: Return QMT to service under errandom through ten owner-light release steps
version: '1.24'
date_created: 2026-10-20
last_updated: 2026-10-22
owner: errandom
status: 'In progress'
tags: [architecture, relaunch, deployment, cost-control, acceptance]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This is the ten-step execution sequence for the QMT relaunch. The technical
architecture remains in `architecture-errandom-deployment-1.md`; operational
procedures and release blockers remain in `..\DEPLOYMENT.md`. This sequence
does not relax either document's controls or authorize cloud expenditure.

**Production relaunch:** the owner's football club; core scheduling, requests, equipment and exports;
AI and external synchronization disabled. Publish the product page at
`www.errandom.com/QMT/`. The live application uses the verified branded
HTTPS hostname `qmt.errandom.com`; the Azure hostname remains available.
American football and flag football are the initial audience.

**Current position, 2026-10-21:** the owner explicitly authorized go-live at
22:39 Zurich. The existing B1/Basic foundation is enabled and healthy, not
re-provisioned. The main site links to the published `/QMT/` product page and
the real Azure HTTPS application. QMTadmin API and Edge-browser sign-in and
bounded live booking/rollback checks passed; all exact synthetic rows were
removed. The hourly QMT-only CHF 30 guard is active, and its identity's actual
stop and controlled owner recovery were verified. Its heartbeat log alert is
enabled with query validation. Notification test requests fail in Azure, so
email delivery remains unverified. The temporary restored database was removed.
The old acceptance cleanup task is disabled and its operator is retired;
production data must never be deleted by replaying acceptance cleanup.
The local masked administrator shortcut is available to the owner.
Notification delivery, extended workflow/mobile acceptance and seven dated
stabilization observations remain open. No generic release flag was changed to
represent uncollected evidence. See `evidence/production-launch-2026-10-21.md`.

**Domain update, 2026-10-22:** the two approved GoDaddy records resolve on both
authoritative nameservers and a public resolver. Azure's custom hostname and
managed SNI certificate are bound. Trusted HTTPS, application assets,
administrator API sign-in and SQL-backed reads passed without operational data
changes. The published product CTA points to the branded origin; its exact Pages
build and the main-site-to-product navigation passed public verification. Existing
hosting, data, credentials, default hostname and budget controls are preserved.

| Step | Current status | Remaining outcome |
|------|----------------|-------------------|
| 1. Production brief and data decision | Complete | Fresh production/manual entry selected; preserve any later-discovered history. |
| 2. Full operating envelope | Live controls; observation open | Reconcile actual QMT-only spending, delayed billing and residual fixed charges. |
| 3. Application candidate | Published and in use | Preserve the immutable accepted runtime; operator/docs changes do not require rebuilding it. |
| 4. Infrastructure and release plumbing | Production promoted | Keep validation-only CI and exact-scope IaC; do not replay historical failed deployments. |
| 5. Database, administrator and restore | Complete | Real restore and owner sign-in passed; temporary restore removed, production retained. |
| 6. AI-free launch | Complete | AI and external synchronization remain disabled. |
| 7. Deployed application and club acceptance | Core acceptance passed | Complete the extended two-session/request/export/DST/mobile matrix; do not claim it ran. |
| 8. Budget alerts, suspension and recovery | Hourly control active; email test blocked | Verify email delivery; continue cost/usage observation. Stop/recovery and retained guard logs passed. |
| 9. Application/domain/product publication | Complete | Preserve DNS/managed TLS and the independent product page; no runtime redeployment needed. |
| 10. Seven-day stabilization | Started; not complete | Collect seven dated observations; no unattended agent is implied. |

**Historical disabled-acceptance checkpoint (superseded by production promotion):**
the immutable acceptance image is published and
anonymous digest access is verified. The owner authorized the isolated disabled
B1/Basic acceptance foundation, protected initialization, one temporary Basic
restore and conditional cleanup. A real current-owner Windows cleanup task is
armed and its protected, pre-deadline no-op was executed successfully. It requires
the owner to remain logged in and the machine/network/authentication to work; it
is not a guaranteed deadline or cost cap. The exact 17-create provider preview
passed with actual protected parameters. The first apply created the QMT hosting,
network, monitoring and guard environment but SQL creation failed its password
policy. Only the unusable SQL credentials were repaired in protected storage;
the application administrator credential and signing key were preserved.
The old preview terminated with `DeploymentWhatIfTimeout`; one new successful
preview passed the exact-manifest and independently checked four-delta reviewer
before one continuation was submitted. SQL and the disabled application now exist.
The continuation's retention operation failed `LongTermRetentionMissingWeekOfYear`;
a separate provider preview and exact-policy repair fixed it without increasing
weekly retention or enabling monthly/yearly backups. The failed deployment history
remains visible and is not an instruction to replay the whole stack.
Protected bootstrap and the live pristine-data/cleanup audit passed. QMTadmin
exists, operational tables are empty, operator SQL access was removed, and the
application remains explicitly disabled. The real provider state `Disabled` is
accepted only with `enabled=false`, alongside the previously supported `Stopped`.
The single approved Basic restore is verified. After two bounded waits without
a request, a fixed-time check found a genuine continuous restore point. Exactly
one restore was submitted at 22:16:23 Zurich. Its initial GET returned 404;
read-only reconciliation found the Online Basic/5-DTU, Local-redundancy target
without repeating PUT. Protected restored-schema/migration, unchanged QMTadmin
and zero-operational-data checks passed at 22:22:16 Zurich. Operator access was
removed and the app stayed disabled. Final independent inspection verified both
databases eligible for conditional cleanup and no retained backups.
No restore waiter remains active. Preserve the source and the recorded restore
receipt; never repeat PUT or replay the failed historical deployment.
Operator commit `9178eace4b11e143264fbfd1c6105aff8ccf110d` passed exact CI
`39659275216`; the validated runtime image is unchanged.
Public release and production cost controls remain gated.
The cleanup deadline remains October 22, 2026, 14:50:55 Zurich; deletion itself
has not been exercised. The provisioned foundation can incur charges.
The detailed ten-step status is authoritative over historical checkpoints below.

| Step | Historical acceptance status | Outcome remaining at that checkpoint |
|------|----------------|-------------------|
| 1. Production brief and data decision | Complete | Fresh production and manual application entry are selected; preserve any subsequently found history. |
| 2. Full operating envelope | Partial | Verify the complete ongoing QMT-only cost envelope and live response controls; bounded acceptance is not production approval. |
| 3. Application candidate | Published | Retain the validated immutable runtime image; persist and validate operator-only changes separately. |
| 4. Infrastructure and release plumbing | Disabled foundation verified | Preserve isolated B1/Basic configuration; production release plumbing remains gated. Failed historical deployment receipts are retained. |
| 5. Database, administrator and restore | Bootstrap and real restore verified | QMTadmin and least-privilege SQL user exist; both databases passed pristine-data inspection and temporary operator access is removed. Complete protected owner sign-in during separately approved application acceptance; keep the temporary restore inside the original cleanup scope. |
| 6. AI-free launch | Complete | Keep paid AI and alternative providers disabled; optional AI work is deferred. |
| 7. Deployed application and club acceptance | Not executed | Verify actual browser workflows and production empty-state onboarding under separately approved enablement. |
| 8. Budget alerts, suspension and recovery | Prepared only | Deploy and test QMT-only attribution, notification and suspension; do not claim that app stop removes fixed charges. |
| 9. Application/domain/product publication | Drafts only | Obtain Gate C, then perform authorized app/DNS/TLS and errandom product/main-site publication. |
| 10. Seven-day stabilization | Not started | Observe actual usage, costs and operational behavior after launch. |

**Historical candidate checkpoint (before publication/apply):** substantial hardening, tests, deployment templates and
marketing drafts exist. Draft PR #6 is published and its corrected candidate
passed real-SQL, Linux image startup and all validation-only CI checks on
2026-10-21 under the owner's renewed instruction to continue implementation
autonomously. Production deployment, image publication, DNS and website
publication remain separate, unexecuted operations.
The owner clarified that QMT supports their real football club's practice/game
field operations. The earlier demonstration selection and step-1 completion claim
are withdrawn. Step 1 has now been completed for the real production scope,
not on the basis of that demonstration. On 2026-10-20, the
owner selected a fresh production database with manual data entry through QMT
after launch. Historical recovery is no longer a launch prerequisite; preserve
any subsequently discovered backup. The original specification establishes a source-backed
working club identity. All 49 SQL provider regions in the selected subscription
returned no deleted logical servers or long-term backups in 98 successful queries.
Historical browser caches are a possible, unverified recovery route and must not
be cleared or refreshed before preservation. Local SQL and Linux-container
execution remain unavailable; actual verification passed on GitHub's Linux runner.
The source-backed club, canonical timezone and owner-controlled administrator
login are selected in the private brief. Their local configuration was checked
without SQL or production credentials. Full cost-envelope acceptance, actual protected
account creation and deployment prerequisites remain incomplete. The owner
subsequently supplied the CHF monthly budget and fewer-than-five-user,
rare-concurrency scope at 22:54 +02:00; the amount and decision are recorded
privately. On 2026-10-21 the owner rejected idle sleeping and approved suspension
at monthly budget exhaustion. Local min/max 1 and conservative 744-hour estimates
now reflect this choice. A scoped hourly guard and alert are prepared locally
with conditional pricing; real suspension, charge-scope, alert and full operating-
envelope validation remain pending. No deployment or overrun approval is implied.

**Preflight update, 2026-10-21:** read-only Azure, repository and DNS checks ran.
No surviving QMT stack was found in the selected subscription. The shared
Consumption environment has no custom VNet; SQL networking is unresolved.
`infra\app-service.bicep` now prepares an unselected Linux B1 alternative with
Always On and QMT-owned subnet/SQL/monitoring foundations. The guard supports
exact-site stop/state verification with site-only read/stop permissions; fixed
B1 plan charges continue. No hosting pivot or cloud spending was authorized;
the later candidate publication is recorded below. Existing cost/release commands remain ACA-only; B1
needs a complete model and independent acceptance. A protected single-operator-IP
bootstrap path, limited contained SQL principal, transactional administrator setup
and verified temporary-rule cleanup are now implemented locally, not run in Azure.
The real-SQL suite now uses the limited principal for application workflows and
checks bootstrap rollback; Docker-capable execution subsequently passed in CI.

**Candidate execution update, 2026-10-21:** draft PR #6 on
`copilot/qmt-cost-controlled-relaunch-20261021` passed validation-only run
`39592325727` at commit `c4f87cd662698f36344a77e291f1e299705c33d7`.
The initial run `39591709652` passed SQL and image build but failed its immediate
health request with a connection reset. The corrected workflow bounds startup
retries, requires `ok: true` and a non-root running container, prints failure logs,
and verifies exact-container cleanup. The same transient reset recurred and
recovered during the successful run; runtime checks were not removed.
Do not merge into
`main`, dispatch the legacy deployment workflow, publish an image, provision
resources or alter DNS as part of candidate validation. Historical billing
amounts and all private configuration remain outside the published candidate.

**B1 foundation update, 2026-10-21:** `infra\app-service-acceptance.bicep`
wraps the isolated B1 foundation at subscription scope with its app fixed disabled.
`scripts\prepare-app-service.ps1` compiles offline by default and only requests a
provider-level what-if when explicitly selected. Actual read-only execution
resolved the exact 17-resource QMT manifest; the reviewer rejects missing, extra,
cross-venture, existing-resource or unresolved changes and unexpected hosting/
database size. Independent inventory remained unchanged. Subscription checks
reported Linux B1 regional support, Web/SQL server quota headroom, Basic SQL
capability and both names available, not reserved deployment capacity.
Eight new script-level regression tests passed; the integrated normal suite
passed 99 tests with its separate real-SQL suite skipped. The workflows now
compile six templates. TASK-004 remains open: no image publication, provisioning,
budget activation, actual Azure initialization or launch approval occurred.

**Acceptance authorization update, 2026-10-21:** the owner explicitly approved
bounded disabled B1 foundation acceptance, image publication, protected fresh
credentials/bootstrap and conditional removal of newly created acceptance-owned
resources only when no operational data exists. This is not public launch,
DNS/site publication, main merge, production guard activation or acceptance of
budget overruns. Actual current-month billing/headroom must be checked privately.
The manual `main_qmt.yml` publication path requires the reviewed commit and exact
candidate branch, waits for validation, uses a separate package-write job and
tests anonymous digest pull. Default push/PR checks stay read-only; Azure
provisioning still requires a usable image, protected credentials and budget
headroom. Do not broaden the local GitHub token to make publication work.

**Publication and controlled-execution evidence, 2026-10-21:** source
`55e8346215e1e696d1ccafa05c6afbe1d1322e2d`, validation run `39598721077` and
publication run `39598766729` passed. The publisher and an independent anonymous
manifest request verified
`ghcr.io/errandom/qmt@sha256:5d1a7ce14520fadcf88120be60dc143a995d1cc9b4141a4f77f4b63940241b8e`.
Do not republish this unchanged application to validate operator-only changes.
The subscription wrapper now supports an optional acceptance ownership UUID;
the tag itself schedules nothing. `scripts\cleanup-app-service.cjs` is an explicit
protected-caller module, offline by default. It verifies exact owned resources,
disabled isolation, immutable image, Basic databases, empty operational tables
and at most the unchanged bootstrap administrator before removing anything.
Unknown resources, changed accounts, unverified/immutable or pre-acceptance
backups, failed reads and incomplete inventories preserve the stack. An inspection
uses and removes a temporary exact-IPv4 SQL rule but never deletes the stack.
The current local suite passed 119 checks with one explicit SQL skip; exact
operator CI `39659275216` separately passed actual disposable SQL. Ten cleanup
checks cover retained-backup ownership timestamps
and preservation-safe handling of the specific no-SQL credential-policy failure.
Those mocks alone do not establish live acceptance. The later protected bootstrap
and independent live empty-data audit passed on October 21. The single actual
Basic restore and pristine-data inspection of both databases subsequently passed
at 22:22 Zurich. Resource deletion remains unexercised and conditional.

**Ownership:** Copilot executes technical work using available authorized tools,
prepares decision-ready evidence and fixes failures. The owner supplies only
business decisions, account/secret approvals and release acceptance. Missing
permissions or tools are reported explicitly; execution is not guaranteed across
unattended time or future sessions.

## 1. Requirements & Constraints

- **REQ-001**: Complete the ten tasks below in dependency order. Record the exact commit, image digest, environment, command results and evidence date for each applicable acceptance gate.
- **REQ-002**: Relaunch production for the owner's football club and preserve manual scheduling without AI. This is an operational service, not a demonstration or experimental pilot. Do not introduce multi-club tenancy, paid AI, real-weather integration or Spond synchronization into the critical launch path.
- **REQ-003**: Copilot prepares scripts, configuration, tests, migrations, deployment changes, marketing updates and the operating runbook. Do not assign the owner routine terminal commands, Docker setup, manual database editing or repetitive portal configuration when authorized automation can perform the work.
- **REQ-005**: The owner selected fresh production with manual application entry on 2026-10-20. Create the schema without sample operational data, establish protected administrator access, and verify empty-state onboarding through site, field, team, equipment and practice/game creation before public release. Recovery of historical records is optional and must not block launch. Preserve any subsequently discovered backup; do not automatically import it.
- **REQ-004**: Batch owner decisions into three gates: production brief and cost/data approval; exact provisioning/recovery approval; final public-release acceptance. Autonomous execution does not authorize a demonstration substitution, historical-data abandonment, empty production replacement, cloud spending or publication. Obtain any additional secret, repository-write or DNS authorization when the relevant account requires it.
- **SEC-001**: Never commit credentials, recovered records, raw billing exports or identifiable club data. Use protected secret entry and approved private storage. Public-repository evidence contains sanitized outcomes and references only.
- **SEC-002**: Preserve server-side role checks, public DTO restrictions, transaction-backed bookings and durable requests. Never enable the legacy AI SQL writers or broad SQL firewall access to make deployment easier.
- **CON-001**: This plan authorizes no commit, push, cloud apply, restore, provider activation, DNS write or site publication. Obtain explicit approval before each category of external write; technical preparation may proceed locally.
- **CON-002**: The owner supplied a CHF monthly budget on 2026-10-20, privately recorded; the earlier unapproved USD 20 target is superseded, not converted into an approved USD amount. All seven ancillary categories have conditional prices, including the hourly guard/alert/email allowance. Production requires the complete estimate and response controls to pass every release gate, including sustained traffic and rollout overlap. Separately approved, bounded disabled acceptance is not production release or an ongoing budget increase. Do not delete stress cases or bypass the gate to fit the budget.
- **CON-003**: Budgets notify; they do not stop consumption. Pausing the application does not remove database, backup, registry or other residual charges. Do not describe replica limits, API throttles or delayed billing-triggered automation as a hard currency cap.
- **CON-004**: Use an isolated QMT acceptance stack and promote the accepted stack where practicable. Concurrent staging/production resources require separate pricing and approval. Never modify another venture's runtime, data, identity or shared limits.
- **CON-005**: The owner requires no idle sleeping: `infra\main.bicep` must keep min/max 1. Model 744 hours at active rates with no assumed idle discount or suspension savings. Owner-approved suspension occurs at actual monthly budget exhaustion and affects QMT only; preserve SQL/backups and other ventures. Price and test authenticated budget-triggered revision deactivation and notification before setting `budgetSuspensionValidated`. If selecting the B1 alternative, retain Always On and one Linux B1 worker, price its complete fixed month, and test exact-site stopping without claiming plan billing stops. No automatic resume is approved.
- **GUD-001**: Prefer existing helpers, scripts and workflows. The current workflows validate only; the app template assumes an existing environment and the database template assumes an existing logical server. Implement and review missing release infrastructure before any apply.
- **PAT-001**: A blocked gate stays blocked. Do not set `infra\cost-model.json` approval flags until the corresponding evidence exists. New code or data changes invalidate affected checks and require their rerun against the release candidate.

### Owner decision packets

| Gate | Copilot prepares | Owner-only input |
|------|-----------------|------------------|
| A: production brief | Actual club operating scope; selected source-backed club/timezone and owner-controlled administrator login; cost scenarios; sanitized recovery inventory and risks. | Fresh production, CHF budget and fewer-than-five rarely concurrent users received on 2026-10-20; no idle sleeping and budget-exhaustion suspension received on 2026-10-21. Do not request those decisions again. Complete pricing, request/log/egress assumptions and tested response controls remain outstanding. |
| B: controlled execution | Passing release-candidate checks; exact target resources and what-if; isolated acceptance cost, duration and cleanup proposal; secret/access instructions. | Authorize the named repository writes, image publication, resource provisioning and selected restore/migration operations; supply inaccessible credentials through protected channels. |
| C: public launch | Verified production candidate; rollback and pause results; tested alert delivery; final URL and site preview. | Accept the operational service and authorize production DNS/TLS changes and website publication. |

## 2. Implementation Steps

Each phase contains one launch outcome. Dependencies below are prerequisites, not
permission to perform external writes. Empty completion cells mean the full gate
has not been verified. Optional AI work never blocks the core launch.

### Implementation Phase 1

- **GOAL-001**: Establish the production club, current operational source and data-preservation decision without restoring resources.

**Dependencies:** none. **Owner gate:** A, together with Phase 2.
**Exit:** the source-backed production club, timezone and intended owner-controlled
administrator login are selected and privately recorded, with selection provenance
distinguished from owner confirmation and actual account creation. An evidenced recovery/migration source or
explicitly approved fresh production database is selected. Demonstration data is
not an alternative to this gate. Database writes and spending remain gated.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Copilot reviews the local candidate, `DEPLOYMENT.md` and `plan\architecture-errandom-deployment-1.md`; checks authorized recovery inventories read-only; records sanitized recoverability, retention deadlines, schema/timestamp uncertainties and the production decision in `plan\evidence\data-recovery-2026-10-20.md`. Prepare the Gate A brief and private production configuration for the actual club and operational source. Preserve legacy records; leave spending/migration approvals false. Do not infer club identity or source availability from resource names, substitute sample data, or restore merely to investigate. | ✅ | 2026-10-20 |

**Checkpoint, 2026-10-20:** the expanded read-only inventory and decision packet
are recorded in `evidence\data-recovery-2026-10-20.md`. Matching SQL deletion
events are dated 2026-10-14. All 49 provider regions were checked for deleted
servers and long-term backups: 98 successful queries, zero entries and no failed
queries. This is not proof that no source exists outside the checked scope.
`PRD.md` explicitly identifies the original club; its name and provenance are
recorded privately as the working identity, not inferred from resource names.
The historical frontend's eight browser cache keys were identified; a failed
refresh could overwrite five datasets with empty arrays. Browser records have
not been accessed or recovered. At 22:21 +02:00 on 2026-10-20, the owner selected
a fresh production start and manual entry through the application once live.
The data decision is resolved; recovery is optional, not a release blocker.
TASK-001 is complete as a production scope/configuration decision. Under delegated
execution, Copilot selected the PRD-backed club, the canonical timezone and an
owner-controlled local administrator login, recorded privately. The owner
subsequently selected the administrator login explicitly at 22:32 +02:00; the
private configuration and its local verification were updated. Club/timezone
remain editable delegated settings, not assertions of separate owner confirmation
or a created account.
Six local HTTP checks verified the selected configuration with a synthetic
in-memory signing secret, zero SQL connection attempts and a closed temporary
listener. No demonstration dataset, resource provisioning, account creation or
database execution is authorized by this data-scope decision.

The local-only preservation helper `scripts\export-legacy-cache.js` is implemented,
with nine targeted tests and an actual synthetic-data download in an isolated
Edge profile. Private snapshot filenames are excluded from Git and Docker.
No real cache was accessed or recovered; TASK-001 instead uses the owner's
explicit fresh-production decision.

### Implementation Phase 2

- **GOAL-002**: Obtain a complete, owner-approved operating envelope before spending.

**Dependencies:** TASK-001 for the selected data/club scope.
**Owner gate:** A. **Exit:** all seven ancillary categories, including budget automation, have priced evidence;
the owner has approved budget, traffic assumptions and cost-response policy;
acceptance resources and build/registry usage are included.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-002 | Copilot refreshes regional/account-specific assumptions in `infra\cost-model.json` and the sanitized cost evidence, including 744-hour always-on runtime, SQL, requests, registry/builds, logging, networking, backups, shared-environment features, DNS/TLS and authenticated budget-suspension automation. Run `npm run cost`; explain low-traffic, sustained and rollout cases without unused free grants or assumed suspension savings. If the target cannot cover the envelope, present a concrete alternative or revised budget for approval rather than silently increasing capacity. Set only supported owner/cost fields; technical flags remain false until evidence passes. | | |

**Operating-policy checkpoint, 2026-10-21:** The owner has now explicitly selected
always-on operation and suspension at actual monthly budget exhaustion. This
supersedes the idle-sleep/pause-authority assumptions in the dated checkpoint
below. Min/max 1 and full 744-hour known subtotals are prepared locally:
USD 28.93, 31.39, 222.77 and 259.31 before tax, including conditional USD 1.34538
for the prepared hourly guard, logs, alert and paid email. LTR is configured in
the template, not deployed/restored. TASK-002 remains incomplete until the full
envelope passes. The guard defaults to manual/read-only; actual cost-scope,
suspension, heartbeat query and notification evidence remain unverified. Do not
set `budgetScopeValidated` or `budgetSuspensionValidated` from offline tests.

**Checkpoint, 2026-10-20:** the independent technical pricing pass now covers all
six ancillary categories, with scenario-specific logs, egress and DNS; public
GHCR/standard public Actions; conditional Consumption environment costs; and a
proposed four-week LRS LTR/24-hour restore-target allowance. The backup policy
and monitoring proposal are not yet implemented. The dated evidence records
approximately USD 8.48 light use, 14.18 routine use, 220.95 high traffic and
257.10 full-month overlap stress, before tax/FX. These unmeasured scenarios are
not caps. Acceptance must use the promoted stack within its modeled usage and
temporary restore allowance, not an unpriced permanent second stack.

Ten targeted tests and lint pass; the release gate remains intentionally blocked.
At 22:54 +02:00, the owner supplied the CHF monthly budget and expected fewer
than five users, rarely concurrent; these decisions are privately persisted.
Do not infer request/egress quotas, cold-start acceptance, permission to pause or
acceptance of high-traffic overruns from the user count.

An indicative CHF comparison uses direct CHF reference quotes where nonzero.
The CPU/memory micro-unit CHF rows returned zero, so compute is not treated as
free: use nonzero USD compute with an explicitly inferred 0.832 reference factor,
corroborated by matching DNS-zone and request quotes. This is not contractual FX.
The comparison gives about CHF 7.05 light use, 11.80 routine use and 24.60 if the
same routine traffic keeps one replica active all month, before tax/adjustments.
High traffic and overlap still exceed the private budget. Validate billing rates,
reserve for tax/currency uncertainty, actual configuration and a reviewed
response policy. All public USD release-approval fields remain unchanged;
TASK-002 is incomplete.

### Implementation Phase 3

- **GOAL-003**: Produce a verified release candidate without requiring the owner to install Docker.

**Dependencies:** none for local preparation; TASK-002 before using any unapproved
billable build capacity. **Owner input:** repository-write approval when needed.
**Exit:** real disposable-SQL tests, Linux image build/smoke, lint, typecheck/build
and infrastructure compilation pass for the same candidate commit.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-003 | Copilot reviews the full diff, fixes relevant failures and, after approval, pushes a reviewable candidate and runs `.github\workflows\main_qmt.yml` on its Docker-capable runner. Use `npm test`, `npm run test:sql`, `npm run lint`, `npm run build` and all six Bicep compilations. Verify fresh/legacy-schema transactions, conflict races, recurrence/update rollback, request idempotency, restart persistence and non-root image startup. Record sanitized run/commit references below. A skipped SQL suite or merely written workflow is not a pass. Record the existing bundle-size warning and assess actual browser performance later. | ✅ | 2026-10-21 |

**TASK-003 evidence:** run `39592325727`, commit
`c4f87cd662698f36344a77e291f1e299705c33d7`: 91 normal-suite tests passed
(the SQL suite is intentionally skipped in that invocation); the separate
disposable-SQL invocation passed all 11 tests with zero skips, including atomic
administrator/contained-user bootstrap rollback and restricted operational DML.
Lint, typecheck/frontend build, both cost reports, all five Bicep compilations,
Linux image build and non-root health/frontend/disabled-provider smoke passed.
The existing 522.50 kB minified initial-bundle warning remains; deployed browser
performance, Azure Basic networking/initialization and production acceptance
are not established by these runner results. Cost-report success is not release
approval; every live release-evidence flag remains gated.

### Implementation Phase 4

- **GOAL-004**: Complete the release plumbing and create only the approved QMT acceptance infrastructure.

**Dependencies:** TASK-001, TASK-002 and TASK-003.
**Owner gate:** B. **Exit:** approved resource scope, network path, identity,
secret handling and immutable image work in the acceptance environment; no other
venture changes appear in the reviewed what-if.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Copilot completes `infra\main.bicep`, `infra\database.bicep`, `scripts\prepare-release.ps1` and the protected release workflow as required for the selected target. Explicitly implement or verify the logical SQL server, least-privilege application/migration identities, reviewed SQL network access, authorized registry/image pull, secret injection, protected environment and narrowly scoped deployment authentication. Preserve validation-only CI; any new deploying path is manual and approval-gated. Run validation/what-if, obtain Gate B approval, then publish the approved digest and apply only the named QMT resources. Do not weaken `release:check` to bootstrap acceptance: unvalidated technical flags stay false, and acceptance provisioning receives a distinct, explicit, costed approval rather than production-release status. | | |

### Implementation Phase 5

- **GOAL-005**: Establish the real database and a usable administrator without risking the recovery source.

**Dependencies:** TASK-004 and the approved recovery decision from TASK-001.
**Owner gate:** B for the exact data operation.
**Exit:** migration/readiness checks pass on the selected dataset, restoration is
proven, and a protected administrator can sign in.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Copilot rehearses the selected restore or approved clean initialization in isolation, retaining the recovery source. Use `scripts\migrate.cjs`, `scripts\check-database.cjs` and `scripts\bootstrap-admin.cjs` under the documented approval variables and separate principals. Review the actual recovered schema, legacy request payloads, timestamp/DST semantics and Basic-tier size/headroom. Test restoration from a new backup as well as successful initialization. Bootstrap only when no active administrator exists, rotate historical secrets and transfer access through a protected channel. Record readiness and recovery outcomes without personal records. | ✅ | 2026-10-21 |

**Bounded foundation evidence, 2026-10-21:** protected Azure Basic initialization,
least-privilege application-principal reads, the single real post-bootstrap PITR
and independent pristine-data inspection of both databases passed. The original
source was not overwritten, temporary operator access was removed, and no sample
operational data was inserted. Keep TASK-005 open for protected owner sign-in/
credential delivery during authorized application acceptance; do not treat
database verification as an enabled-browser acceptance result.

### Implementation Phase 6

- **GOAL-006**: Remove AI as a launch dependency and define a zero-paid-fallback enhancement.

**Dependencies:** none for leaving integrations disabled; TASK-003 and separate
provider approval before implementing or exercising an external adapter.
**Owner input:** provider account/terms approval only if the enhancement is pursued.
**Exit:** the core launch explicitly works with AI off; any free-AI experiment is
separate and cannot create billable fallback usage.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Copilot retains `QMT_AI_ENABLED=false` and `QMT_SPOND_ENABLED=false` for launch and checks the disabled UI/manual-entry behavior in `server\config.cjs` and `src\components\OperationsOffice\ScheduleManager.tsx`. Groq-hosted GPT-OSS 20B is a candidate for a later synthetic-data benchmark, not a committed provider. Before any activation, verify current free-plan eligibility, quota-exhaustion behavior, privacy/retention, age-related and commercial terms. Any subsequent implementation must replace the legacy confirmation inserts in `server.js` with `server\bookings.cjs`, add strict extraction validation and durable atomic quotas, disable provider retries/paid fallback, restrict staff initiation and retain manual preview/confirmation. Do not relax the production prohibition merely to connect a free API. Record deferral as a valid completion of this launch step. | ✅ | 2026-10-21 |

**TASK-006 evidence:** the published candidate rejects AI activation at startup,
retires the legacy provider/SQL-write route and preserves manual scheduling.
Actual Linux image checks verified disabled-provider responses. The enhancement
is explicitly deferred; no free-provider account, benchmark call or paid fallback
is required or approved for the core release. This completes launch deferral,
not an assertion that an external AI replacement has been integrated.

### Implementation Phase 7

- **GOAL-007**: Prove the actual club workflows and public/private boundaries end to end.

**Dependencies:** TASK-005 and TASK-006's launch configuration.
**Owner input:** one short guided acceptance session, not a technical test workload.
**Exit:** automated browser/API evidence covers the deployed candidate and the
owner has seen the principal operating flow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Copilot automates two independent browser sessions and API checks against the production candidate in acceptance: staff login/roles; public schedule privacy; practice/game creation and conflicts; recurring/overnight/multiday bookings; request submission, retry and review; cancellation; equipment; selected-range CSV export; outage/error recovery and restart persistence. Exercise the configured club's DST/date boundaries and the real ingress/proxy chain, including forwarded-header spoofing and admission limits. Check phone/desktop layout, cold navigation and bundle performance. Use synthetic fixtures with exact recorded IDs; remove only task-owned fixtures after approval, never operational rows. Record results in the acceptance evidence and fix failures before proceeding. | | |

### Implementation Phase 8

- **GOAL-008**: Demonstrate cost containment, recovery and a practical emergency pause.

**Dependencies:** TASK-007; backup restoration evidence from TASK-005.
**Owner input:** approve alert destination, incident thresholds and any costed drill.
**Exit:** measured operational load fits the approved envelope; idle scaling, alert
delivery, application rollback, pause/resume and TLS checks are evidenced.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Copilot runs bounded real-tier acceptance/load checks within the approved duration/request budget, measures SQL utilization/log volume, verifies one warm replica while idle and startup/restart behavior, and reconciles the cost model. Configure/test approved budget notifications and authenticated QMT-only suspension at actual 100% monthly spend. Rehearse failure/idempotency handling, controlled resume, independent maintenance messaging and previous-digest rollback in `DEPLOYMENT.md`; maintenance publication failure must not delay suspension. Verify data/TLS afterward and report residual charges/billing delay. Set each technical flag, including `budgetSuspensionValidated`, only after evidence passes; run release/preflight against the exact commit/digest. If the priced envelope no longer fits, return to Gate A rather than upgrading automatically. | | |

### Implementation Phase 9

- **GOAL-009**: Publish the accepted service and the errandom entry point together.

**Dependencies:** TASK-008, passing release preflight and Gate C.
**Owner gate:** C. **Exit:** public HTTPS application and marketing navigation work,
with no dead CTA, unintended data exposure or cross-venture change.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Copilot prepares the final acceptance packet and site preview, obtains Gate C, and configures the approved `qmt.errandom.com` DNS/TLS binding. Promote the accepted stack/candidate rather than provisioning an unpriced second copy. Update `..\site\QMT\index.html` to link to the verified live app and publish it with the homepage card in `..\site\index.html` through the website's approved process. Verify DNS, certificate, public schedule, staff sign-in, main-site navigation and the `/QMT/` product page externally. Preserve the existing apex-to-www behavior. If cutover fails, execute the rehearsed rollback and keep the independent page truthful. | ✅ | 2026-10-22 |

**TASK-009 evidence:** the owner-authorized controlled pilot is published on the
existing stack. October 21 API/browser/core scheduling evidence and October 22
custom-origin trusted HTTPS/API/assets/sign-in/SQL checks are recorded in
`evidence/production-launch-2026-10-21.md`. Website commit
`f71b6dae0a9a6303aa84395bcc9ccb18f5e3561b` built successfully; the homepage,
product page and branded CTA passed public verification at 08:49:05 Zurich.
This publication completion does not certify TASK-008's unresolved notification
delivery, the extended acceptance matrix or seven-day stabilization.

### Implementation Phase 10

- **GOAL-010**: Complete seven days of post-release stabilization and hand over a repeatable production operating routine.

**Dependencies:** TASK-009.
**Owner input:** report operational issues and accept the production handover.
**Exit:** seven completed daily observations show acceptable actual/forecast cost,
error rate, data integrity and staff usability; the runbook and next decision are recorded.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Copilot configures approved bounded monitoring/reports and documents the daily cost/error/usage review, backup status, incident owner, exact pause/resume commands and rollback digest in `DEPLOYMENT.md`. Collect seven dated post-release observations through authorized automation or scheduled review sessions; do not imply an agent is watching unattended. Account for delayed billing and reconcile actual charges against the approved estimate. Investigate anomalies without silently adding capacity. Record keep-live, pause or corrective-action acceptance in the sanitized evidence; keep AI deferred unless its separate controls and provider approval pass. | | |

## 3. Alternatives

- **ALT-001**: Recreate the former Premium App Service footprint. Rejected. A different, single-worker Linux Basic B1 candidate is selected for bounded disabled acceptance after the no-sleep clarification. Production still requires complete pricing and acceptance, including residual plan charges.
- **ALT-002**: Rewrite the database or introduce multi-tenancy before launch. Deferred because it expands migration risk and is not required for one club.
- **ALT-003**: Require free AI at launch. Rejected because provider quota, availability and terms would become unnecessary launch blockers. Manual entry is the baseline.
- **ALT-004**: Host the full application at `/QMT/`. Deferred; the separate product page and application subdomain avoid an additional reverse-proxy/base-path migration.

## 4. Dependencies

- **DEP-001**: Authorized read access to cost and recoverability evidence; recovery availability is not assumed.
- **DEP-002**: Owner decisions and protected account access at Gates A, B and C. Credentials are never requested in a public issue or committed document.
- **DEP-003**: A Docker-capable runner, adequate authorized CI capacity and repository-write permission to run the candidate workflows.
- **DEP-004**: Approved QMT cloud/network/registry prerequisites, DNS control and website publication access.
- **DEP-005**: Production dataset or explicitly approved fresh initialization; actual club acceptance and timestamp provenance.

## 5. Files

- **FILE-001**: `DEPLOYMENT.md` and `plan\architecture-errandom-deployment-1.md`: technical controls, existing baseline and operator procedure.
- **FILE-002**: `infra\cost-model.json` and `scripts\cost-check.cjs`: dated estimate, owner approval and evidence gate.
- **FILE-003**: `.github\workflows\main_qmt.yml`, `.github\workflows\qmt_release_preflight.yml`, `Dockerfile` and `scripts\prepare-release.ps1`: candidate verification and controlled release preparation.
- **FILE-004**: `infra\main.bicep` and `infra\database.bicep`: app/database definitions and missing-prerequisite integration where approved.
- **FILE-005**: `scripts\migrate.cjs`, `scripts\check-database.cjs`, `scripts\bootstrap-admin.cjs` and `migrations\`: migration and database acceptance.
- **FILE-006**: `server.js`, `server\config.cjs`, `server\bookings.cjs`, `server\requests.cjs` and `test\sql-integration.test.cjs`: canonical behavior and transaction evidence.
- **FILE-007**: `src\components\OperationsOffice\ScheduleManager.tsx`, `src\components\ScheduleView.tsx` and `src\lib\api.ts`: staff/manual scheduling and deployed acceptance surfaces.
- **FILE-008**: `..\site\QMT\index.html` and `..\site\index.html`: independent product page, truthful status and homepage navigation.
- **FILE-009**: `plan\evidence\data-recovery-2026-10-20.md` records the current bounded inventory and pending decisions; `plan\evidence\relaunch-acceptance-2026-10-20.md` remains a planned results record. Their presence alone does not establish a passing gate.
- **FILE-010**: `scripts\export-legacy-cache.js`, `test\legacy-cache-export.test.cjs`, `.gitignore`, `.dockerignore` and `eslint.config.js`: local-only raw-cache preservation, strict origin/authentication boundaries, private-file exclusions and regression coverage.
- **FILE-011**: `scripts\budget-guard.cjs`, `infra\budget-guard.bicep`, `test\budget-guard.test.cjs` and `test\cost-controls.test.cjs`: prepared manual/read-only guard, hourly job/alert, exact-app identity permissions and offline fault/cost coverage. Real execution and complete charge-scope evidence remain pending in TASK-008.
- **FILE-012**: `infra\app-service.bicep`, `infra\app-service-cost-model.json`, `test\app-service-infra.test.cjs` and `test\app-service-cost.test.cjs`: B1 acceptance foundation, subnet-only SQL service-endpoint route, isolated monitoring, comparison and offline contracts. CI compiles/reports this option without deploying it; the ACA cost gate does not authorize it, and `--app-service --release` always fails.
- **FILE-013**: `scripts\initialize-app-service.cjs`, `scripts\provision-database-user.cjs` and `test\database-bootstrap.test.cjs`: approval-gated fresh B1 initialization through a temporary exact-IPv4 SQL rule, protected matching credentials, operator-only migration/readiness checks, atomic limited-principal/admin setup and verified cleanup. No application start or deployment is performed; an interrupted process requires independent cleanup of the reported rule ID.
- **FILE-014**: `infra\app-service-acceptance.bicep`, `scripts\prepare-app-service.ps1` and `test\app-service-preflight.test.cjs`: disabled subscription foundation, default-offline compilation and explicitly selected read-only provider preview with exact manifest/SKU review.
- **FILE-015**: `.github\workflows\main_qmt.yml`, `scripts\smoke-image.sh` and `test\acceptance-image.test.cjs`: read-only default validation, separate manually selected exact-source publisher, shared real-image smoke checks, ephemeral package token and required anonymous digest pull. No Azure deployment operation is added.
- **FILE-016**: `scripts\cleanup-app-service.cjs` and `test\acceptance-cleanup.test.cjs`: default-offline conditional cleanup module; explicit ownership, initialization and start/deadline receipts; exact resource and retained-backup inventory; unchanged bootstrap-only SQL audit; verified temporary rule removal and deletion confirmation. Actual protected orchestration/scheduling and execution receipts remain private, outside the repository.

## 6. Testing

- **TEST-001**: TASK-003 passes the repository's unit, real-SQL, lint, build, image and template checks for the candidate; skipped/unexecuted required tests block release.
- **TEST-002**: TASK-005 proves actual-schema migration, protected bootstrap, database readiness and isolated backup restoration without overwriting the source.
- **TEST-003**: TASK-007 proves two-session persistence, roles/privacy, conflicts, recurrence, date boundaries, requests, equipment, export and explicit error handling on the deployed candidate.
- **TEST-004**: TASK-008 proves the approved load/cost envelope, idle/cold behavior, ingress controls, alert delivery, pause/resume and compatible rollback.
- **TEST-005**: TASK-009 proves public DNS/TLS, application usability, homepage/product-page links and truthful publication after approval.
- **TEST-006**: TASK-010 records seven actual daily observations and a keep-live/pause decision; implementation of a report alone does not satisfy the observation period.
- **TEST-007**: `node --test test\legacy-cache-export.test.cjs` verifies exact raw preservation, authentication-key exclusion, strict original-origin guards, missing/malformed values, cancellation, explicit failures and cleanup. A synthetic isolated-browser download validates the browser path, not recovery of operational data. The owner selected fresh production for TASK-001; cache recovery is optional.
- **TEST-008**: `node --test test\budget-guard.test.cjs test\app-service-infra.test.cjs` verifies exact-site scope, malformed-state rejection, read-only default, threshold/manual behavior, stop verification/failure and explicit ongoing fixed charges. Compile `infra\app-service.bicep` and `infra\budget-guard.bicep` without cloud writes. These checks do not validate live connectivity, SQL grants, image/proxy behavior or billing.
- **TEST-009**: `node --test test\database-bootstrap.test.cjs` checks preview isolation, scope/credential rejection, parameterized principal creation, single-IP-only changes, SQL/create/cleanup failures and bounded firewall-only connection retries. `npm run test:sql` must additionally prove atomic rollback of principal/admin creation, contained-user login, operational-only DML and refusal of migration-table/schema/role privileges; all existing booking/request cases must pass using those application credentials before any live acceptance.
- **TEST-010**: `node --test test\app-service-preflight.test.cjs` executes the actual PowerShell preparation with mocked CLI responses, checking offline default, explicit subscription, provider errors, destructive/unresolved/cross-venture changes, exact manifest, SKU/isolation and rejected group names. An authorized actual provider what-if must independently resolve all 17 QMT foundation creates; passing preview never authorizes an apply.
- **TEST-011**: `node --test test\acceptance-image.test.cjs` checks the manual/branch/exact-commit publisher gate, separation of package-write permission, shared runtime checks and anonymous-pull requirement. Actual CI must smoke-test the image, and an explicitly approved manual run must independently prove registry push and anonymous digest access before provisioning.
- **TEST-012**: `node --test test\acceptance-cleanup.test.cjs` verifies default preview, deadline no-op, scope/image/approval rejection, unchanged bootstrap-only database acceptance, foreign/changed resource and backup rejection, temporary-rule cleanup, explicit failures and exact-group deletion confirmation. A real protected scheduled no-op and live inspect-only SQL audit are separate gates; mocked tests do not prove either.

## 7. Risks & Assumptions

- **RISK-001**: No hard monthly currency ceiling is guaranteed on the proposed consumption architecture. Alert delay and residual fixed costs remain even after an application pause.
- **RISK-002**: Recovery may be unavailable or time-limited. Never conceal a clean start or silently discard malformed historical requests.
- **RISK-003**: SQL Basic and the proposed container size are candidates, not proven capacity. Failure returns to the owner-approved architecture/cost decision.
- **RISK-004**: Existing templates do not provision every prerequisite. An approved acceptance apply cannot be described as an already implemented one-command production deployment.
- **RISK-005**: Free inference quotas or terms can change and do not make hosting/database operations free. AI unavailability must leave manual scheduling usable.
- **RISK-006**: The current production gate requires technical evidence that only a real acceptance environment can supply. An explicitly approved isolated acceptance deployment is distinct from approving public production release; never fabricate flags or weaken the gate to resolve this ordering.
- **ASSUMPTION-001**: The relaunch restores an operational production service for the owner's football club, with no AI or synchronization dependency.
- **ASSUMPTION-002**: The owner retains spending, data disposition/recovery and public-release decisions. Autonomous technical work does not permit substituting a demonstration for their operational system.

## 8. Related Specifications / Further Reading

- Existing architecture: `architecture-errandom-deployment-1.md`.
- Operating procedures: `..\DEPLOYMENT.md`.
- Historical cost evidence: `evidence\cost-baseline-2026-10-20.md`.
- Microsoft Learn, "Billing in Azure Container Apps": https://learn.microsoft.com/azure/container-apps/billing (checked 2026-10-20).
- Microsoft Learn, "Create and manage budgets": https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets (checked 2026-10-20).
