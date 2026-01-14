# Spond Integration Guide

This document describes how to integrate the Renegades Sports Management app with [Spond.com](https://spond.com).

## Overview

Spond is a popular sports team management platform used by clubs to organize teams, schedule events, manage attendance, and communicate with members. This integration allows you to:

- **Import Events**: Automatically sync events from Spond to your local calendar
- **Import Teams/Groups**: Sync Spond groups as teams in your app
- **Export Events**: Optionally push local events to Spond
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

### Export Event to Spond

```
POST /api/spond/export/event/:id
Content-Type: application/json

{
  "spondGroupId": "group-uuid-from-spond"
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
