# QMT by errandom

Practice, game and field management for American football and flag football clubs.
The relaunch targets one configured club. It is not a multi-tenant service.

**Status (2026-10-21): local implementation and release preparation, not deployed.**
The release cost gate deliberately fails until the owner approves the full estimate
and the required data, SQL, recovery, image, ingress and operational evidence exists.

## Runtime

Node 24 is the CI/container runtime. `server.js` serves the Vite frontend and `/api`
on the same origin. It is the only supported backend entry point; the old
`server/index.ts` deliberately fails rather than starting a divergent service.
SQL is opened lazily, not during startup or health checks.
The runtime image installs only six direct server dependencies; frontend/build
libraries and development-only provider SDKs stay in the build stage.

```text
npm ci
npm test
npm run lint
npm run build
```

Copy `.env.template` to a local `.env`, supply an independently generated signing
secret and the approved SQL connection, then use `npm start`. Never commit `.env`.
`npm run dev:full` runs the API and Vite together; `npm run dev:api` and
`npm run dev` run them separately.
Use a disposable local database for development, never a recovered production
database for automated tests.

## Production relaunch safeguards

- AI and Spond are off by default and cannot be enabled in this production release.
  The legacy AI flag also refuses development startup. Its provider calls and
  alternate booking writes are removed; the old endpoint returns HTTP 410.
  Generated/fabricated weather, generic model completion, Spark KV and warmup are retired.
- API admission is bounded, JSON bodies are limited to 32 KB, and SQL pools to five
  connections. In-memory rate limits reset on restart and are not billing caps.
- Event reads require bounded date intervals and cursor pagination. The default
  window is the previous seven and next 90 days; export fetches the selected range.
- Booking writes and request reviews use SQL transactions and one club-wide
  application lock. Public requests require a retry-stable UUID idempotency key.
- Anonymous schedule responses use explicit public field lists. Operational
  requests and contact details require a current active, authorized user.
- Operational data is not stored in browser localStorage. Authentication still
  uses a browser-stored bearer token; this is not a cookie/session redesign.

`npm run test:sql` starts an isolated, loopback-only SQL Server Developer container
with a randomly generated temporary password, exercises transactions and migrations,
then stops that named container. It requires a working Docker daemon and downloads
the Microsoft SQL Server test image. Ordinary `npm test` does not access a real
database and explicitly skips this integration suite.
Only connection readiness is retried; database setup runs once and fails explicitly.
Cleanup failures also fail validation, retain any original test/setup failure, and
report the exact disposable container name for independent cleanup.

## Data and deployment

The [ten-step relaunch plan](plan/architecture-qmt-relaunch-1.md) defines the
execution order, technical ownership and three owner approval gates. Core
scheduling launches without an AI dependency; a free-provider experiment is
separate and must not enable paid fallback.
`npm run ai:benchmark` previews the fixed synthetic Groq/GPT-OSS evaluation offline;
it never sends club data or enables production AI. Live evaluation requires
separate explicit authorization and credentials as described in `DEPLOYMENT.md`.

Hosting templates use Container Apps Consumption with one always-running replica and a
Basic SQL candidate, not a Premium App Service plan. They include an optional
Consumption-only environment and four-week weekly long-term backup retention;
none is deployed and restoration/performance remain unverified.
`infra/app-service.bicep` also prepares an **unselected Linux B1 alternative** with
Always On, a QMT-owned SQL logical server/database, subnet service-endpoint access
and monitoring. It defaults to an offline app for acceptance preparation; even a
stopped B1 app incurs the plan's fixed charge. This alternative is not covered by
the current Container Apps cost model or release-preparation command.
The owner rejected idle sleeping and approved suspension at monthly budget
exhaustion. A scoped budget reader/revision suspender, manual fallback and hourly
job/heartbeat-alert template are prepared locally. The guard also supports exact-site
App Service stopping, without plan mutation or a claim that plan charges stop.
They are not deployed or
end-to-end verified. The job defaults to manual/read-only and has no SQL,
delete or resume permissions. Its conditional USD 1.35 monthly allowance includes
full job runtime, logs, monitoring and paid email; it is not a billing cap.
Actual currency/period/complete cost scope and real stop/notification delivery
remain release gates. `npm run budget:check` is read-only unless `--execute` is
explicitly passed and requires the protected settings described in `DEPLOYMENT.md`.

See [DEPLOYMENT.md](DEPLOYMENT.md) before any provisioning, migration or release.
`npm run migrate` is a no-write preview. Neither migrations nor administrator
bootstrap run at application startup. Historical sample/seeding scripts are not
production installation instructions.
`npm run db:provision-user` and `npm run db:initialize-b1` also preview without
connecting. The approval-gated B1 initializer checks the exact offline app and
matching credentials, temporarily permits one operator IPv4 address, initializes
the empty database with a separate limited SQL user and `QMTadmin`, and verifies
temporary-rule cleanup. It never starts the app. The Docker SQL suite exercises
bootstrap rollback and runs application workflows with the limited principal.
These checks have not been run against Azure; follow the protected procedure and
interruption-recovery limitations in `DEPLOYMENT.md`.

`npm run cost` prints scenario subtotals and unresolved inputs.
`node scripts/cost-check.cjs --app-service` compares the unselected B1 option using
the same shared-service/traffic assumptions; it always denies B1 release.
`npm run release:check` exits unsuccessfully while release conditions are missing.
See [cost evidence](plan/evidence/cost-baseline-2026-10-20.md) for the bounded
historical attribution and the distinction between light-use estimates and limits.

The independent product page belongs to `errandom-com` at `/QMT/`; the intended
application hostname is `qmt.errandom.com`, only after explicit release approval.
Neither publishing nor DNS is performed by this checkout's validation workflows.

## License

Original GitHub Spark template resources retain their MIT license and GitHub
copyright attribution. Removing Spark runtime integration does not remove those
license obligations.
