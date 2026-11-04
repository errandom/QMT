# Spond Integration Guide

## Controlled review increment: November 4, 2026

The current feature-branch implementation replaces the legacy setup entry point
with administrator-run discovery, suggested team/group/subgroup mappings,
per-team review and explicit final confirmation. Discovery itself does not
save mappings. Existing mappings remain unchanged unless selected and confirmed.
Mapping confirmation records the reviewing administrator and time in SQL and
rejects stale discoveries atomically.

Credentials are used only for the discovery login, never persisted to SQL or
browser storage. Only an administrator-scoped provider token remains in process
for up to 15 minutes; reconnect after expiry or restart. This is intentionally
not a persistent background connection.

After confirming mappings, the administrator can preview 1-31 days of events.
Already-linked and coexisting events are left alone. Overlapping, shifted,
renamed, cancelled or ambiguous events require human review. Unmatched
user-created Spond events are preserved, not imported as facility bookings.
Only unmatched, confirmed QMT events are labelled publication **candidates**,
never approved sends. Provider timestamps are converted once into the club's
wall-clock convention. Subgroup previews conservatively inspect the parent
group until recipient semantics are verified.

Endpoints: `POST /api/spond/discovery`, `POST /api/spond/mappings/confirm`,
and `POST /api/spond/reconciliation`; all require a current administrator role.
All legacy Spond credential-storage and sync endpoints are blocked.
The `spondReview` capability exposes the review UI only;
the separate event-sync capability `spond` remains false.

Apply the normal, reviewed migration flow for `migrations/005-spond-review.sql`
in a disposable database before considering release. It adds nullable mapping
audit/parent columns and an event-link ID while preserving existing values.
Mapping columns do not require new table permissions.

The same unapplied migration now also creates `dbo.spond_review_quotas`.
Existing runtime principals need `SELECT`, `INSERT` and `UPDATE` on this table;
the fresh-principal helper includes it in the normal operational DML grants.
Do not rerun fresh initialization or recreate an existing production principal.

### Read-only account verification before deployment

Use your own interactive terminal from this checkout:

```powershell
npm.cmd run spond:verify -- --live
```

Without `--live`, the command only prints instructions and contacts no provider.
Live mode refuses redirected/noninteractive input and credential arguments.
Enter the date window, email and hidden password at the prompts, then select
one discovered group. Do not reuse a password exposed in chat or put credentials
in arguments, environment variables, files or captured terminal sessions.

The probe makes one login, one group read with members excluded, and one bounded
event read using the same query and validation as the review endpoint. It never
connects to QMT SQL, saves mappings, reserves application quota, or creates,
updates or deletes provider events. It is an operator-only manual probe, not
an automatic retry loop. Group names are shown locally for selection; the final
JSON contains counts/status only, not names, IDs, event details or tokens.

Choose a window with known existing events. An empty sample exits with code 2
and explicitly leaves event-schema compatibility unverified; errors exit with
code 1. Success verifies only this account's sampled login/read/schema behavior.
Pagination/completeness and subgroup recipients remain unverified even on
success, and no probe result authorizes sync or production activation.
Retain only the redacted summary with reviewed source/run evidence; do not
record prompt input. Runtime SQL readiness is a separate `spond:check` step.

### Deployable review-only pilot

**Prepared for review, not deployed or activated.** Review has its own deployment
gate; `QMT_SPOND_ENABLED=true` remains rejected in production. Keep that legacy
flag false. `QMT_SPOND_REVIEW_ENABLED` is false by default. In production,
enabling review additionally requires `QMT_SPOND_REVIEW_APPROVED=true`, recording
explicit operator approval of the provider-access pilot. This is not a claim
that Spond has approved this client or that compatibility has been verified.

Discovery reserves durable quota before any login: 3 attempts per administrator
per 15-minute window and 30 club-wide per UTC day. Confirmation and preview share
10 actions per administrator per 15 minutes and 120 club-wide per UTC day.
SQL transactions and a database application lock reserve both scopes atomically.
Attempts remain consumed even if the subsequent provider/action fails; denied
reservations consume neither scope. SQL/permission failures fail closed without
provider calls. Quota exhaustion returns HTTP 429 with `Retry-After`.
Counters survive worker restarts and use SQL's UTC clock, not the application
clock. One reusable counter row per action/administrator bounds growth;
short-lived provider sessions and additional burst/concurrency limits remain
process-local. Use the existing single-worker deployment for this pilot;
multi-worker routing/session design is not part of this increment.

Release sequence (requires separate release/production authorization):

1. Review the diff and run the existing PR validation, including
   `npm run test:sql`, lint, build and Docker smoke checks. Local unit tests do
   not substitute for disposable-SQL validation. Merge reviewed code to `main`.
2. Manually dispatch `.github/workflows/main_qmt.yml` on `main` with publication
   selected and the exact reviewed 40-character `approved_commit`. Publication
   remains opt-in, runs after validation, and requires anonymous digest pull.
   Record the immutable image digest; no automatic Azure deployment is added.
3. Use the existing backup/restore-reviewed operator migration procedure for
   `005-spond-review.sql`. Keep review disabled while applying schema and
   granting the existing restricted runtime principal only
   `SELECT, INSERT, UPDATE ON OBJECT::dbo.spond_review_quotas`.
   Do not grant migration/schema/database-admin rights to runtime.
4. With **runtime** SQL credentials and the intended approved pilot settings,
   run `npm run spond:check` from the reviewed checkout. This read-only preflight
   checks configuration, required columns and runtime permissions. It makes no
   provider calls, reserves no quota and saves no mappings. Use `npm.cmd` on Windows.
5. Deploy the recorded image through the existing image-only App Service flow,
   preserving other settings, workbook target, budget guard and database.
   Deploying code with both Spond flags false is safe without pilot activation.
   Only for an explicitly approved pilot, set `QMT_SPOND_REVIEW_APPROVED=true`
   and `QMT_SPOND_REVIEW_ENABLED=true`, leaving `QMT_SPOND_ENABLED=false`.
6. Verify health, normal bookings and capabilities (`spondReview: true`,
   `spond: false` for an activated pilot). Sign in as a QMT administrator and
   enter Spond credentials only in the HTTPS review form. Verify real discovery,
   confirm only the intended pilot mappings, and preview existing/user-created
   events. Do not create test bookings or provider events in production.

Disable review by setting `QMT_SPOND_REVIEW_ENABLED=false`; transient tokens
disappear on restart. Leave the additive schema, reviewed mappings and quota
counters intact. For code rollback, restore the previous recorded image digest
while keeping both Spond flags false. Do not drop columns or erase event links.

Provider compatibility and response completeness are still unverified; preview
rows cannot authorize writes. Spond's official event help, checked November 4,
2026, says it does not offer an open API:
https://help.spond.com/app/en/articles/127163-creating-and-managing-events-in-spond-groups
Do not describe this client as an officially supported integration.
Explicit event review/link decisions and booking-safe idempotent publication
remain prerequisites for actual sync. Approved persistent secret-backed access
is additionally required only if background operation is introduced.

## Historical integration (not the current setup procedure)

The remainder documents the retained legacy implementation, not supported
production instructions. Do not run its standalone SQL scripts or credential
configuration/import/export endpoints to activate the controlled release.

This document describes how to integrate the Renegades Sports Management app with [Spond.com](https://spond.com).

## Overview

Spond is a popular sports team management platform used by clubs to organize teams, schedule events, manage attendance, and communicate with members. This integration allows you to:

- **Import Events**: Automatically sync events from Spond to your local calendar
- **Import Teams/Groups**: Sync Spond groups as teams in your app
- **Push Events to Spond**: Create events in your app and push them to Spond
- **Sync Attendance**: Pull attendance responses from Spond and display them in your app
- **Link Teams**: Map local teams to Spond groups for bidirectional sync

## Setup Instructions

### 1. Database Migration

First, run the database migration to add the required tables and columns:

```sql
-- Run in Azure SQL Database or your SQL Server instance
sqlcmd -S your-server.database.windows.net -d your-database -U admin -P password -i migrate-spond-integration.sql
```

Or execute the contents of `migrate-spond-integration.sql` in your SQL management tool.

### 2. Configure Spond Credentials

1. Log in to the Operations Office with an admin account
2. Navigate to **Settings** tab
3. Find the **Spond Integration** card
4. Click **Configure**
5. Enter your Spond credentials:
   - **Email**: The email you use to log into Spond
   - **Password**: Your Spond password
6. Optionally enable **Auto-sync** and set the sync interval
7. Click **Test Connection** to verify your credentials
8. Click **Save Configuration** to save

### 3. Link Teams to Spond Groups

After configuration:

1. Click **Team Mappings** in the Spond Integration card
2. You'll see a list of all Spond groups you have access to
3. For each Spond group, select a local team to link it to
4. Linked teams will show a green checkmark

### 4. Sync Data

- **Sync All**: Imports both groups and events from Spond
- **Sync Events**: Only syncs events
- **Sync Teams**: Only syncs team/group information

## API Endpoints

All Spond endpoints require authentication (admin or management role).

### Status

```
GET /api/spond/status
```

Returns the current integration status:
```json
{
  "configured": true,
  "connected": true,
  "lastSync": "2026-01-14T10:30:00.000Z",
  "syncedGroups": 5,
  "syncedEvents": 42
}
```

### Configure

```
POST /api/spond/configure
Content-Type: application/json

{
  "username": "your-email@example.com",
  "password": "your-password",
  "autoSync": true,
  "syncIntervalMinutes": 60
}
```

### Test Connection

```
POST /api/spond/test
Content-Type: application/json

{
  "username": "your-email@example.com",
  "password": "your-password"
}
```

### Get Groups

```
GET /api/spond/groups
```

Returns all Spond groups with their linked local teams.

### Get Events

```
GET /api/spond/events?groupId=xxx&daysAhead=30&daysBehind=7
```

Returns events from Spond with optional filtering.

### Sync Operations

```
POST /api/spond/sync
POST /api/spond/sync/groups
POST /api/spond/sync/events
```

Triggers synchronization from Spond.

### Push Event to Spond

Create a new event in Spond from a local event:

```
POST /api/spond/push/event/:id
Content-Type: application/json

{
  "spondGroupId": "group-uuid-from-spond",
  "sendInvites": true
}
```

Update an existing event in Spond:

```
PUT /api/spond/push/event/:id
```

Push multiple events to Spond:

```
POST /api/spond/push/events
Content-Type: application/json

{
  "eventIds": [1, 2, 3],
  "spondGroupId": "group-uuid-from-spond",
  "sendInvites": false
}
```

### Attendance Sync

Get real-time attendance from Spond for an event:

```
GET /api/spond/attendance/event/:id
```

Sync and store attendance for a single event:

```
POST /api/spond/sync/attendance/event/:id
```

Sync attendance for all Spond-linked events:

```
POST /api/spond/sync/attendance
Content-Type: application/json

{
  "onlyFutureEvents": true,
  "daysAhead": 30,
  "daysBehind": 7
}
```

Get stored participants for an event:

```
GET /api/spond/participants/event/:id
```

Returns:
```json
{
  "eventId": 123,
  "spondId": "xxx-xxx-xxx",
  "counts": {
    "accepted": 15,
    "declined": 3,
    "unanswered": 5,
    "waiting": 0
  },
  "lastSync": "2026-01-14T10:30:00.000Z",
  "participants": [
    {
      "first_name": "John",
      "last_name": "Smith",
      "email": "john@example.com",
      "response": "accepted",
      "response_time": "2026-01-13T09:00:00.000Z"
    }
  ]
}
```

### Link/Unlink Teams

```
POST /api/spond/link/team
Content-Type: application/json

{
  "teamId": 1,
  "spondGroupId": "group-uuid-from-spond"
}

DELETE /api/spond/link/team/:teamId
```

## Data Mapping

### Event Type Mapping

| Spond Type | Local Type |
|------------|------------|
| MATCH | Game |
| TRAINING | Practice |
| EVENT (heading contains "meeting") | Meeting |
| Other | Other |

### Event Status Mapping

| Spond Status | Local Status |
|--------------|--------------|
| cancelled=true | Cancelled |
| Event in past | Completed |
| Event <24 hours away | Confirmed |
| Event >24 hours away | Planned |

### Team/Group Mapping

Spond groups are mapped to local teams using the `spond_group_id` column. You can manually link teams through the UI or set the mapping directly in the database.

## Auto-Sync

When auto-sync is enabled, the system will automatically sync data at the configured interval. The sync runs as a background job and updates:

- Events from the past 7 days to 60 days in the future
- All group/team information

## Troubleshooting

### Common Issues

1. **"Invalid credentials" error**
   - Verify your email and password are correct
   - Make sure you're using your Spond login, not a social login
   - Check if your account is active on Spond

2. **"No groups found"**
   - Make sure you're a member of at least one group in Spond
   - Check if you have the correct permissions in those groups

3. **Events not syncing**
   - Ensure the team is linked to the correct Spond group
   - Check if the events are within the sync date range
   - Look at the sync logs in the database

4. **Duplicate events appearing**
   - Check if the same event exists locally with a different `spond_id`
   - Review the `spond_sync_log` table for errors

### Sync Log

Review the `spond_sync_log` table for sync history:

```sql
SELECT TOP 20 * FROM spond_sync_log 
ORDER BY created_at DESC
```

### Database Columns

New columns added by this integration:

**teams table:**
- `spond_group_id`: Links to Spond group UUID
- `spond_data`: Raw JSON data from Spond

**events table:**
- `spond_id`: Links to Spond event UUID
- `spond_group_id`: The Spond group this event belongs to
- `spond_data`: Raw JSON data from Spond

## Security Considerations

1. **Credential Storage**: Spond credentials are stored in the `spond_config` table. For production, consider encrypting the password or using a secrets manager.

2. **API Access**: All Spond API endpoints require authentication and admin/management role.

3. **Token Handling**: The Spond API token is held in memory and refreshed as needed.

## Spond API Reference

This integration uses the unofficial Spond API:

- **Base URL**: `https://api.spond.com/core/v1/`
- **Authentication**: Email/password login returns a bearer token
- **Rate Limits**: Be mindful of API rate limits; default sync fetches max 500 events

For more details, see the [Spond Python wrapper](https://github.com/Olen/Spond) which documents the available endpoints.

## Future Enhancements

Potential improvements:
- Push attendance data back to Spond
- Sync member information
- Support for Spond chat/messaging
- Webhook support for real-time updates
- Encrypted credential storage
