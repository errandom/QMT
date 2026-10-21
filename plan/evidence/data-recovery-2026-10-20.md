# QMT production scope and data-recovery decision

Evaluated: **2026-10-20**. Status: **step-1 production brief complete; fresh production selected; deployment remains gated**.

The owner clarified that QMT is the operational system for their football club's
practice/game fields, not a demonstration or a new pilot. The earlier demonstration
selection and completion claim were incorrect and are withdrawn. Production
records and any discovered backups must be preserved. On **2026-10-20 at
22:21 +02:00**, the owner accepted that the deleted SQL data may be lost and
selected a fresh production start, entering operational data through QMT after
launch. This is an empty real production dataset, not a demonstration. Recovery
is now optional and does not block launch. This decision does not authorize
deleting a discovered source, executing migrations, provisioning or spending.

## Scope and authorization

This records relaunch step 1, not permission to restore, initialize, provision,
change credentials or publish. The checks used the Azure CLI's default
subscription, the same subscription in which the matching historical QMT deletion
events were found. Other accessible subscriptions were not investigated.
Subscription identifiers, original club identifiers, raw activity records and
account details are intentionally omitted from this public-repository record.

No SQL data was read. No cloud resources, DNS records, files in a backup source,
or database contents were modified. No recoverability claim is based on sample
records, source-controlled schema scripts or browser state.

## Observed evidence

| Surface | Read-only check | Result | Limitation |
|---------|-----------------|--------|------------|
| Active logical SQL servers | `az sql server list` in the selected subscription. | Successful response with zero servers. | Does not inventory other subscriptions, deleted resources or exported data. |
| Deletion history | SQL activity-log query over the preceding 90 days, capped at 1,000 returned events, selecting server/database deletion operations. | Matching QMT database and logical-server deletions report `Succeeded` on **2026-10-14**. Matching entries span approximately 15:14-15:25 UTC. | Activity records are not backup inventory or proof of a specific retention configuration. Multiple operation entries are not treated as independent recovered datasets. The capped query is not an exhaustive audit. |
| Original resource group | Metadata lookup for the resource group identified by the matching deletion events. | `ResourceGroupNotFound`. | Absence of the group does not establish that all external exports or long-term backups are absent. |
| Deleted logical servers, expanded inventory | Enumerate all 49 regions returned by `Microsoft.Sql` provider metadata for `servers`; run `az sql server deleted-server list` in each, explicitly scoped to the selected subscription. | **49 successful queries, zero entries, zero failed queries.** | Complete for the returned provider-region list, not every subscription or external archive. The private report retains each region and response. |
| Long-term SQL backups, expanded inventory | Run `az sql db ltr-backup list` in the same 49 regions and subscription. | **49 successful queries, zero entries, zero failed queries.** | Does not cover other subscriptions, external exports or a separately managed backup system. |
| Local backup files | Workspace-descendant filename search for `.bacpac`, `.bak`, `.trn` and `.bcp`. Separate QMT filename search for backup/export/dump `.sql`, `.zip`, `.json` and `.gz` files. | No matching files found. No backup contents opened. | Filename-only searches do not cover arbitrary names, excluded paths, cloud-only files, other folders, storage accounts or remote backup locations. |
| Canonical product identity | Read `PRD.md:3` and `PRD.md:154` at source revision `774bc483329b11719bac44759b94a7bc9753449a`. | The specification explicitly names the original football club. The source-backed working identity is recorded privately. | This establishes historical product identity, not owner confirmation of the current club, administrator or dataset. Conflicting legacy AI prompts are not authoritative. |
| Historical deployment | Check the documented App Service hostname and list the original app name in the selected subscription. | Hostname did not resolve from this environment; no matching named app was returned. GitHub's repository deployments endpoint returned no records and repository metadata has no homepage URL. | Does not establish the state of another hostname, subscription, repository or current operational system. DNS failure is not proof of global service unavailability. |
| Repository artifacts | GitHub Actions artifact metadata for this repository. | Successful response with `total_count: 0`. No artifact contents downloaded. | Does not cover external archives, previous expired artifacts or other repositories. |
| Associated storage | Storage account metadata filtered by the original QMT app/resource-group identifiers in the selected subscription. | Successful response with zero matching accounts. | Name-based association only; no blob contents, account keys or unrelated accounts inspected. |
| Historical server changes | Subscription- and resource-ID-scoped Resource Graph query from 2026-10-07 onward; project only change time/type and region/retention changes. | Two records: an update on 2026-10-13 and deletion on 2026-10-14. Neither exposes region or retention values in the projected changes. Response was not truncated. | Unchanged properties are not established by absent changes. The metadata query recovered no records or backup. |
| SQL source files | Inspect statement metadata and sample-data markers without executing SQL or displaying row values; search current tracked files and available local Git history filenames. | Source files contain schema/migrations and sample inserts; `database-schema.sql:144,178` labels sample data/events. No matching SQL-backup, CSV, local-database or backup/export JSON filenames were found in the searched history. | Not an authoritative operational export; do not seed production from these files or treat them as recovered records. Only locally available Git refs/history were checked. |
| Historical browser cache | Read `src\contexts\DataContext.tsx` at the same source revision, not a browser profile. | Eight exact operational cache keys identified. Five API datasets were replaced with empty arrays on a failed refresh. | **Possible recovery route only.** No browser storage or records accessed; cache presence, completeness and freshness remain unknown. |
| Legacy Spark storage lead | Read `spark.meta.json`, `runtime.config.json` and the historical `src\hooks\useInitializeData.ts`; search tracked `src` for initializer callers. Send one unauthenticated HEAD request to a repository-derived candidate Spark hostname. | Metadata identifies a KV-backed template and an app identifier, not an export. The historical hook would copy five API datasets into Spark KV and initialize three request collections as empty, but no caller was found in the searched source. The candidate hostname returned HTTP 404. | No managed-store records were accessed or recovered. An inferred hostname is not a verified deployment URL; its response does not establish whether another Spark deployment or datastore exists. Configuration and unused initialization code are not evidence of an operational backup. No integration was re-enabled. |
| Azure tool access | Azure MCP subscription lookup, followed by an independent read-only Azure CLI check. | MCP reported a credential timeout; Azure CLI queries succeeded. | No login, credential change or policy bypass was performed. The tool error is not evidence of missing resources. |

The original server's region has **not** been established. The expanded inventory
no longer relies on the original two-region hypothesis. Its 98 successful queries
and zero returned entries are preserved in the private
`qmt-recovery-inventory.json` report, alongside a reproducible read-only script.
No provider/query failure was converted into an empty successful result.
Provider metadata for `locations/deletedServers` and
`locations/longTermRetentionBackups` independently returned the same 49 regions;
no additional backup-specific region was discovered.

## Recoverability and deadlines

**No usable recovery source has been verified. This does not mean that recovery
is impossible.** An existing private export, a backup in another region or
subscription, or a separately retained archive could change the result.

Microsoft documents a deleted-logical-server recovery preview that depends on
soft-delete retention and the resource remaining within that retention window.
The original QMT retention configuration is unknown, and no matching deleted
server was returned in any of the 49 searched regions. Therefore no reliable recovery
deadline can be assigned. Do not infer a guaranteed seven-day recovery window
from the deletion date or silently conclude that an expired window was checked.

Preserve any known external export or surviving browser cache, but do not delay
the approved fresh-production path to continue speculative recovery. Another
subscription is investigated only after identifying it as an authorized QMT data
source. Obtain explicit approval before any restore; the present inventory
authorizes no recovery costs.

## Preserve possible browser records

The historical frontend used the following operational `localStorage` keys:
`app_events`, `app_teams`, `app_sites`, `app_fields`, `app_equipment`,
`app_facility_requests`, `app_equipment_requests` and
`app_cancellation_requests`. Do not export unrelated keys, authentication tokens,
stored users, cookies or passwords.

Do not clear QMT site data, reload an existing legacy tab, run its refresh flow or
copy an empty new database over these values before preserving a private copy.
The old refresh flow replaced failed event/team/site/field/equipment reads with
empty arrays and persisted them. No claim is made that any particular browser
still contains records. The three request caches must also be considered.

An authorized operator must first identify the original browser/profile and
origin. Preserve raw values and acquisition time in approved private storage;
never commit them, paste them into public issues or send them to an AI provider.
The assistant has not accessed a browser profile or exported personal records.
Do not bypass browser protections or recreate a paid server merely to access the
old origin. If the original origin cannot be accessed, preserve the profile and
establish an owner-authorized recovery method before proceeding.

Any cache recovered later is an incomplete candidate source until its JSON,
record dates, relationships and coverage are reviewed against the owner's
operational needs. It is not a database restore and must not be imported
automatically.

### Local-only preservation helper

`scripts\export-legacy-cache.js` prepares a private JSON download from the eight
allowlisted keys. It preserves the exact raw strings, including malformed JSON,
and distinguishes missing, invalid, non-array and empty-array values. The
candidate includes capture time, origin and counts, with `verifiedRecovery: false`.
It never reads authentication keys, writes storage, refreshes the app, sends a
network request or imports data. It requests confirmation before downloading and
does not log records.

For an authorized operator with an **already-open original QMT tab**, review the
local script, open DevTools **Sources > Snippets**, create a snippet containing
that script and run it without reloading the page. The helper refuses any origin
other than the source-documented historical HTTPS origin. If that guard fails,
the original document is unavailable or a browser protection blocks execution,
stop and preserve the profile; do not weaken protections or navigate the old tab.
After confirming, verify the JSON file actually saved to approved private storage.
A download request is not evidence that a file was saved.

Files named `qmt-legacy-cache-*.json` are excluded from version control and the
Docker build context. These exclusions are defense in depth, not permission to
place personal records in a public workspace or force-add them. No actual browser
snapshot has been captured. Nine targeted unit tests cover preservation,
authentication-key exclusion, origin guards, missing/malformed data, explicit
storage/download failures, cancellation, resource cleanup and private-file
exclusions. Repository lint passes.

A separate check using the installed Microsoft Edge and a new isolated profile
saved an actual JSON download containing only synthetic records. The helper's
expected-origin constant was substituted only in the in-memory test fixture for
a loopback HTTP origin; the production script and its strict HTTPS-origin guard
were not weakened. The downloaded raw/malformed values, authentication exclusion
and unchanged storage were checked. Both temporary browser profiles and browser
processes were closed/removed. No existing profile or operational records were
accessed. This validates the download path, not availability or completeness of
the real cache.

## Step 1 decision packet

| Decision | Recommended handling | Approval status |
|----------|----------------------|-----------------|
| Existing operational data | Start fresh in production; the owner enters sites, fields, teams, equipment and bookings through the application. Preserve any discovered backup without automatic import. | **Fresh-production data scope selected on 2026-10-20 at 22:21 +02:00. Recovery is not a launch prerequisite. Database execution and provisioning remain separately gated.** |
| Production club | Use the original club explicitly named in `PRD.md`, not an inference from resource names. Record the selected name privately. | **Selected under delegated execution from repository provenance; no separate owner confirmation claimed. Editable before provisioning.** |
| Current operational instance | Use the approved fresh-production path; retain any subsequently identified old instance or export. | **No verified current source. Identifying one is no longer a prerequisite for launch.** |
| Club timezone | Select `Europe/Zurich`, matching the source-backed club and canonical runtime default, for fresh operational entry. | **Selected under delegated execution. Not a verified historical timestamp rule.** |
| First administrator | Record the owner's explicitly selected local login privately; create no account or password now. No invented email address is needed. | **Owner selected the login on 2026-10-20 at 22:32 +02:00. Configuration verification was repeated after the change. Actual protected bootstrap and credential transfer remain Phase 5 work; bootstrap stays disabled.** |
| AI and synchronization | Keep disabled; manual scheduling is the baseline. | **Explicitly disabled in the private environment settings.** |

The private session files are `qmt-production-brief.json` and
`qmt-production.env`. The source-backed club name is now populated, with its
provenance and confirmation status recorded in the brief. Incorrect demonstration
identifiers and the selected empty database name remain removed. The environment's
timezone and intended administrator login are now selected. SQL target and
credentials remain empty; migration and bootstrap approvals remain false.
These files are outside the repository. They complete the scope brief, not
deployable credential configuration or actual account creation.

Budget approval belongs to step 2 and remains separate. The fresh-start decision
does not authorize deleting any discovered backup or existing records.

## Schema and timestamp handling

No historical database/export has been opened or validated. The repository's
additive migrations and database checker remain preparation, not evidence that
they match the deleted production schema. Recovered request payloads, recurring
events, timestamp provenance and DST boundaries require later dataset-specific
review. Preserve recovered source data and do not silently convert wall-clock
values into absolute UTC timestamps.

## Completion gate

**Step 1 is complete for the production brief.** The owner selected fresh
production, populated through the application. No historical import or verified
recovery source is required. The source-backed club, canonical timezone and
intended owner-controlled administrator login are selected and privately recorded.
Club/timezone were selected under delegated execution; the owner subsequently
selected the administrator login explicitly. This does not claim separate owner confirmation of the club/timezone,
a created administrator, a working database or an accepted deployment.

Cost preparation can proceed using the selected fresh-production scope.
Fresh-schema initialization, protected administrator access and application
onboarding require release-candidate acceptance; empty sites, fields, teams,
equipment and schedules must be usable without SQL editing or sample seeding.
Spending, migration execution and publication remain separately gated.

No code release, image publication, cloud restoration or provisioning occurred.

## Selected production configuration verification

The selected private environment was exercised against the canonical `server.js`
application on a temporary loopback listener. The private
`qmt-production-config-check-result.json` records the environment checksum, check
time and six HTTP results. Club, timezone and administrator-login selections agree
with the private brief. Missing signing credentials are rejected as required.
For this check only, an independent synthetic signing secret was generated in
memory and never persisted.

Health and capabilities returned HTTP 200 and capabilities reported the selected
club/timezone with AI, Spond, weather and transport disabled. AI and Spond routes
returned HTTP 503; generic model completion returned HTTP 410; unauthenticated
booking creation returned HTTP 401. There were zero SQL connection attempts.
The temporary listener was closed. Production credentials remain empty and all
execution approvals remain false.

This verifies the selected local runtime configuration only. Real database
initialization, administrator sign-in, empty-state application onboarding,
backup restoration, cost acceptance and deployment remain later release gates.

## Previous demonstration verification, not used for acceptance

The previous, now-withdrawn demonstration environment was exercised against the
canonical `server.js` application on a temporary loopback listener:

- Private brief and environment agree on identity, timezone, database identifier
  and reserved administrator identifier.
- Starting without the missing signing secret is rejected as intended.
- With a synthetic, test-only signing value, health and capabilities respond
  successfully and expose the selected demonstration identity/timezone.
- AI, Spond, weather and transport capabilities are disabled; the AI/Spond request
  paths reject calls before invoking a provider.
- The injected database connector was called zero times.
- Credentials remain empty, migration/bootstrap approvals remain false, and the
  temporary listener is closed.

Those prior results were not used to accept the production brief. The
demonstration configuration has been removed; the selected production settings
were checked separately as documented above.

## Reference

Microsoft Learn, "Restore a deleted logical server in Azure SQL Database
(preview)", checked 2026-10-20:
https://learn.microsoft.com/azure/azure-sql/database/deleted-logical-server-restore

Microsoft Learn, "Get resource changes", checked 2026-10-20. Deleted-resource
snapshots are not supported; missing change values are not full configuration:
https://learn.microsoft.com/azure/governance/resource-graph/changes/get-resource-changes
