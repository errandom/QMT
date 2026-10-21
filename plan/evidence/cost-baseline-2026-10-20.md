# QMT cost findings and release gate

Evaluated **2026-10-20**. No resources were provisioned or restored.
This is a sanitized summary, not a raw billing export. It contains no resource,
subscription, tenant or account identifiers.

**Availability update, 2026-10-21:** The owner subsequently rejected idle sleeping
and approved suspension at monthly budget exhaustion. The tables and approvals
below preserve the dated 2026-10-20 scale-to-zero proposal, not the current
operating configuration. Current `infra/cost-model.json` and `DEPLOYMENT.md` use
min 1/max 1, 744 hours at the active rate and known subtotals of USD 28.93, 31.39,
222.77 and 259.31 before tax, including conditional guard/alert/email costs.
LTR and the budget guard are prepared locally but not deployed or verified on
Azure. End-to-end suspension and complete charge-scope evidence explicitly block
release. No paid deployment or high-traffic overrun
approval is inferred.

## Budget guard proposal: 2026-10-21

One hourly Consumption job, no always-running watchdog or additional App Service:
0.25 CPU/0.5 GiB, 120-second execution limit, one replica and zero platform retries.
The default template is manual/read-only. Reviewed identity permissions permit
only reading one budget and reading/deactivating/verifying the named QMT app.

| Conditional component | USD/month, no free grants |
|---|---:|
| 744 executions x 120 seconds at existing CPU/memory active rates | 0.66960 |
| Additional 0.02 GB log allowance x 3.289/GB | 0.06578 |
| One 15-minute log-search alert (0.50) plus one resource series (0.05) | 0.55000 |
| 3000 emails to one approved recipient x 0.00002 | 0.06000 |
| Total additional allowance | 1.34538 |

The 2026-10-21 retail API queries returned Switzerland North Azure Monitor meters
`cf20b9c8-d39b-40df-8a95-35f38bbd6ed2` (0.50/month) and
`194c4a41-5447-5b27-a58d-55397212125b` (0.05/month), and commercial Global Emails
meter `a58b53c3-276c-41d2-9327-fb84df10afd2` with a paid 0.00002/email rate.
The zero-priced email tier was not used. These rates and the job's maximum
configured runtime support a proposal, not measured billing or a hard cap.
Reprice extra executions, multiple jobs, recipients/channels or alert series;
measure actual startup/log volume. Real KQL, email delivery and budget API
permissions must pass before release.

The budget reader rejects narrowed filters, changed amounts, mismatched currency
and unsupported/expired periods. It currently supports an unfiltered calendar-
monthly Cost budget in QMT's app resource group. Shared-workspace, environment or
other separately billed incremental charges require an explicit complete-scope
design; this partial resource-group counter is not proof of total QMT spend.
`budgetScopeValidated` and `budgetSuspensionValidated` remain false.

## Historical attribution

Historical billing amounts, account-level query results and invoice details are
retained only in the private handoff, not published with this candidate.
The implementation prioritizes retiring paid-model calls and replacing the former
Premium hosting footprint. Public forward estimates below use retail prices,
not the owner's billing records.

No request-level caller attribution or measured savings percentage is claimed.
In particular, the unused TypeScript backend's timers do not establish what
generated production costs: the historical deployed entry point was `server.js`.

## Forward model

`infra/cost-model.json` records the 2026-10-20 Switzerland North retail inputs in
USD, distinct from historical CHF billing. Do not mix those currencies or imply
an owner-approved exchange rate. Shared subscription free grants are not assumed.

The read-only retail queries selected the following Consumption meters. Rates
are not the subscription's negotiated CHF prices. Where free/paid tiers coexist,
the first paid rate is used without crediting the free tier.

| Selected product / meter | USD rate | Retail meter ID |
|---|---:|---|
| Container Apps Standard active vCPU-second | 0.000024 | `115e1dab-55c3-505e-8c26-b0afadcdba1a` |
| Container Apps Standard active GiB-second | 0.000003 | `ce446e5a-e27d-55fa-908f-059ff49fda83` |
| Container Apps Standard / million HTTP requests | 0.40 | `c1fefefd-2bc3-5edf-af4c-a39e74132d6f` |
| SQL Database Single Basic, SKU B / day | 0.1771 | `9d48f44d-8978-43a6-a842-11444bf342cd` |
| Log Analytics, Analytics Logs ingestion / GB | 3.289 | `d641d9a0-391e-44b4-a908-8f36b5d17707` |
| Bandwidth Standard, Rtn Preference: MGN, outbound / GB | 0.087 | `9995d93a-7d35-4d3f-9c69-7a7fea447ef4` |
| SQL Database - LTR Backup Storage, Backup LRS / GB-month | 0.03278 | `abedcefd-5939-4d70-b0cd-826de35d9114` |
| Azure DNS Public zone / month | 0.50 | `8f967c58-b144-4bd7-8882-8bf02767c839` |
| Azure DNS Public / million queries | 0.40 | `d54686f0-77ff-43f3-9e7c-2099030d32a7` |

The DNS meters are primary commercial global meters, not Swiss government or
private-zone meters. The SQL Basic retail ARM SKU field is empty: filtering the
retail `skuName` to `B` resolves the selected meter. Analytics Logs is the retail
SKU for the proposed pay-as-you-go Analytics plan; an empty query for the ARM
workspace SKU is not evidence that ingestion is free.

### All six ancillary categories

`ancillaryMonthlyUsd` now contains **fixed base charges only**. Zero fixed bases
for logs, networking and backups do not remove their variable charges: the
validator requires the corresponding prices and usage inputs and adds them
separately. Every scenario emits an itemized breakdown.

| Category | Priced proposal and conditions |
|---|---|
| Registry/builds | USD 0 for a public GHCR image and standard Ubuntu GitHub-hosted builds of the public repository. Repository visibility was verified read-only. No Azure Container Registry, larger runner or uploaded build artifacts. Existing npm cache must stay within the repository's included 10 GB; review its setting/usage before release. Current workflows validate but do not publish the image. |
| Logs/metrics | USD 3.289 per modeled ingestion GB. Propose 30-day Analytics retention, ordinary Analytics queries and built-in platform metrics, without Application Insights, custom metrics, exports, search jobs or paid alert rules. The first 31 days' Analytics retention are included in ingestion. Budget notifications are not a paid runtime-monitoring rule or a tested outage alert. Price additional monitoring before enabling it. |
| Networking/egress | USD 0.087 per modeled outbound GB, using Microsoft Global Network rather than the cheaper alternative routing product. No free outbound allowance assumed. Same-region app/SQL, no NAT gateway, private endpoint, Front Door, WAF or paid cross-region service. Actual egress routing remains a release review item. |
| Backup/recovery | Seven-day Basic DTU point-in-time backups included. Additionally propose weekly LRS LTR retained for four weeks: 10 GB-month storage allowance (USD 0.3278), plus one temporary Basic restore database for 24 hours (USD 0.1771), totaling USD 0.5049/month. Actual stored backup volume is unmeasured, not capped at 10 GB. |
| Shared environment | USD 0 incremental base only if the approved environment adds no dedicated profile, private endpoint, planned maintenance or other billable feature for QMT. The app template's Consumption selection alone does not verify the whole environment or authorize changes to another venture. |
| DNS/TLS | USD 0.50/month allowance for one public DNS zone, plus USD 0.40/million modeled queries; managed Container Apps certificate has no certificate charge. Existing authoritative DNS/provider and domain-renewal allocation are unverified. This is a conservative allowance for a proposed setup, not a decision to create a zone or migrate errandom's DNS. |

**Backup configuration gap:** `infra\database.bicep` currently configures only
seven-day point-in-time retention, not the proposed four-week LTR. Implement and
verify the selected LTR policy after approval, including a real restore drill.
LTR backups can be restored after deleting the logical server/resource group
while the subscription remains active and the operator retains subscription-scoped
permissions. They are not immutable or immune to explicit backup deletion. A
weekly snapshot can also lose changes since that snapshot after server deletion;
the owner must accept that recovery tradeoff or select a stronger policy.

### Usage scenarios and totals

All cases use 0.25 vCPU, 0.5 GiB, one continuously billed Basic database and a
730-hour modeled month. Inputs are **proposed allowances, not measured demand,
enforced quotas or a forecast of this club's actual bill**.

| Scenario | Active hours per replica | HTTP requests | Log GB per replica | Aggregate outbound GB | DNS queries | USD/month |
|---|---:|---:|---:|---:|---:|---:|
| Light use | 40 | 10,000 | 0.25 | 2 | 10,000 | 8.48 |
| Routine-use allowance | 160 | 100,000 | 0.5 | 20 | 100,000 | 14.18 |
| Sustained/high traffic | 730 | 10,000,000 | 5 | 2,000 | 1,000,000 | 220.95 |
| Full-month two-replica overlap stress | 730 | 10,000,000 | 5 | 2,000 | 1,000,000 | 257.10 |

Compute is USD 0.027 per active replica-hour. Basic is USD 5.38679 for the
modeled month. Formula for each scenario:

```text
compute = activeHours * replicas * 3600 * (0.25 * 0.000024 + 0.5 * 0.000003)
database = 730 / 24 * 0.1771
requests = aggregateRequests / 1,000,000 * 0.40
logs = logGBPerReplica * replicas * 3.289
egress = aggregateOutboundGB * 0.087
backup/recovery = 10 * 0.03278 + 24 / 24 * 0.1771
DNS/TLS = 0.50 + aggregateDnsQueries / 1,000,000 * 0.40
total = sum of those charges plus the other explicitly priced fixed bases
```

Overlap doubles compute and per-replica logs, not aggregate requests, outbound
traffic, DNS or the shared database. In the high-traffic case, egress alone is
USD 174: the former USD 29.10/48.81 subtotals omitted this exposure. These new
estimates supersede the earlier incomplete USD 6.47/29.10/48.81 totals.

Actual replica lifetime includes startup/cooldown/idle behavior; the light-use
active-hours assumption must be measured. Applying the active rate to all modeled
replica hours is conservative for compute, not a bound on traffic or other costs.
The two-replica case is a stress test, not an expected rollout duration or a
maximum possible bill. Static downloads, retries, logs, backup growth or abuse
can exceed the modeled volumes.

Initial acceptance must use the stack that will become production, within the
modeled active-hour/request/log/egress allowances. The included 24-hour temporary
restore-database allowance covers the initial recovery drill. There is no
permanent parallel staging stack or separate paid build service. Longer drills,
additional restore targets, paid monitoring or a second environment require
repricing and approval before creation.

The proposed USD 20/month target cannot cover the continuously active scenario
even before ancillary costs. It covers the proposed routine-use estimate, not a
guaranteed bill. The current release validator requires the approved budget to
cover **every modeled case**, including USD 257.10 stress; a smaller budget cannot
pass merely because light use looks inexpensive. If the owner prefers a tighter
currency ceiling, first evaluate a revised architecture/traffic-control envelope
and recovery/availability tradeoff; do not weaken the gate or silently approve
the stress bill.

Stopping runtime traffic still leaves roughly USD 6.21/month for Basic, the
modeled LTR storage and a DNS-zone allowance, before DNS queries or restore drills.
Keeping the monthly drill allowance raises that residual estimate to USD 6.39.
These are conditional model calculations, not a pause quote or cancellation
of resources/retained backups.

## Implemented controls versus limits

Paid/external integrations cannot be enabled in the production launch. The
generic model endpoint and generated weather are retired. The infrastructure
proposal contains no App Service plan, provisioned model, dedicated compute or
always-warm QMT replica. SQL is lazy and read windows/pools/API admission are bounded.

Those controls remove particular cost paths, not all billing risk. Rate limits are
in memory, restart with the process and do not limit static-file ingress or egress.
`maxReplicas=1` does not make bandwidth, logs, a database, backup retention or shared
environment features free. Azure budget alerts notify; they do not automatically
stop spending.

Log Analytics daily caps can overshoot and lose visibility after collection stops;
they are not exact ingestion limits. Do not impose a cap on another venture's
shared workspace as a QMT cost control. A QMT-only cap/filtering strategy still
requires an approved monitoring configuration and operational acceptance.

`npm run cost` reports the priced proposal and remaining gates.
`npm run release:check` fails until costs,
recent owner approval, traffic acceptance and all named technical evidence are
present. Leaving it blocked is intentional.

## Step-2 decision and local verification

The earlier preferences form returned user-unavailable. Subsequently, at
22:54 +02:00 on 2026-10-20, the owner supplied a CHF monthly budget and fewer than
five expected users, rarely concurrent. The exact budget and decision timestamp
are privately recorded, not published here. This supersedes the earlier unapproved
USD target. It does not approve high-traffic overruns or establish measured HTTP,
log or egress volumes; public/bot traffic and long-open tabs remain possible.

A read-only CHF Retail Prices API query selected the same nine meter IDs, Swiss
North rows and commercial global DNS. Nonzero reference rates were: Basic
0.1474/day, ingestion 2.7368/GB, outbound 0.0724/GB, requests and DNS queries
0.3328/million, LRS LTR 0.0273/GB-month and a public DNS zone 0.416/month.
The paid outbound tier starts at 100 GB and log ingestion at 5 GB; no free
allowances were deducted. The Swiss bandwidth row is nonprimary, and must not
be silently lost by filtering every regional meter to primary-only.

The selected CPU/memory CHF micro-unit rows returned zero. They are not accepted
as evidence of free compute. For an **indicative comparison only**, use the
existing nonzero USD compute rates times 0.832, inferred from matching CHF/USD
DNS-zone and HTTP-request quotes. That reference factor is not a verified
contractual invoice rate or an assumed approved market FX rate. Microsoft
documents non-USD retail prices as reference estimates.

The resulting indicative totals, before tax/contract adjustments, are CHF 7.05
light use, 11.80 routine use, 24.60 with routine traffic but all 730 hours active,
183.86 high traffic and 213.95 full-month overlap. Low usage appears compatible
with the privately confirmed budget, with tax/currency reserve still required.
Neither high-traffic case fits. Do not assign an approved USD budget, delete
stress cases or loosen release controls merely to fit the confirmed CHF amount.

This decision does not authorize image publication, provisioning, migration,
DNS changes, cloud spending or automatic pauses. Cold-start and cost-response
acceptance remain unconfirmed. All public USD release approval fields remain
null/false; TASK-002 remains incomplete.

Owner packet: currency, amount and user-count expectations are received. Prepare
the exact priced envelope and scale-to-zero/response proposal for acceptance.
Private proposed alerts correspond to 50%, 75% and 90% actual spend and a
100% forecast warning; they are not configured or approved for automatic action.
Proposed alerts
should distinguish actual and forecast costs, with QMT-only response authority,
residual charges and billing delay explained. No alert/pause mechanism has been
configured or tested. If a genuine hard monetary ceiling is required, do not
present this consumption-based design as satisfying it.

Local validation on 2026-10-20: ten targeted `cost-controls.test.cjs` tests pass,
including scenario arithmetic, missing/invalid variable inputs, overflow,
missing ancillary components and budget coverage of every case. `npm run lint`
passes. `npm run cost` returns the four totals above.
`npm run release:check` exits 1 with missing owner/technical evidence and
`releaseAllowed: false`; no unpriced-ancillary error remains in the checked-in
proposal. These checks are not cloud performance, backup or deployment evidence.

## Provenance and outstanding evidence

- Actual cost: authenticated, read-only Azure Cost Management results summarized
  above; raw private identifiers are deliberately excluded.
- Regional inputs: Azure Retail Prices API, Consumption prices filtered to
  Switzerland North; Basic product/SKU B, not a serverless vCore meter.
- Container Apps billing and paid environment features: https://learn.microsoft.com/azure/container-apps/billing
- Public registry pricing: https://docs.github.com/en/billing/concepts/product-billing/github-packages
- Standard public Actions and cache pricing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Included Analytics retention: https://learn.microsoft.com/azure/azure-monitor/logs/data-retention-configure
- Platform metrics and optional monitoring charges: https://learn.microsoft.com/azure/azure-monitor/fundamentals/cost-usage
- Daily-cap limitations: https://learn.microsoft.com/azure/azure-monitor/logs/daily-cap
- Basic DTU PITR and separately billed LTR: https://azure.microsoft.com/en-us/pricing/details/azure-sql-database/single/
- LTR after server deletion and restore permissions: https://learn.microsoft.com/azure/azure-sql/database/long-term-backup-retention-configure
- Free managed certificates: https://learn.microsoft.com/azure/container-apps/custom-domains-managed-certificates
- Alert behavior: https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets
- Retail source: https://prices.azure.com/api/retail/prices
- Non-USD reference-price caveat: https://learn.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices

Still outstanding: full envelope/cold-start/response-policy acceptance, not the
already received currency, monthly amount and user-count decisions;
actual shared environment, DNS, cache and paid-feature review; implementing the
selected backup/monitoring proposal; real Basic performance/size acceptance;
actual proxy behavior; image/SQL integration; idle/load/egress/log measurements;
backup restoration and pause/resume drills; tested alert delivery; contract,
tax and currency treatment. Historical recovery is optional following the owner's
fresh-production decision; it is no longer a launch prerequisite. The historical
cost audit remains bounded to the authorized selected subscription/name matches.
