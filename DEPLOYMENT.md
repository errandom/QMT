# QMT controlled relaunch

Evaluated 2026-10-21. **The owner-authorized single-club pilot is live.**
The explicit instruction to go live was recorded at 22:39 Zurich. It supersedes
the disabled-acceptance-only authorization below; it does not approve AI,
cross-venture changes, automatic budget recovery or unlimited spending.
The independent product page is `https://www.errandom.com/QMT/`, linked from
the main website. Its **Open QMT** link currently targets the verified HTTPS
application at `https://qmt-production-au5trtsh5mkl2.azurewebsites.net`.
Do not publish a broken `qmt.errandom.com` link: GoDaddy CNAME/TXT records,
hostname binding and its managed certificate remain outstanding.

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
remaining DNS, notification, extended acceptance and seven-day stabilization work.
The historical preparation record below does not describe current live state.

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
