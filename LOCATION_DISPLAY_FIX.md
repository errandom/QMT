# Location Display Fix for Meeting/Other Events

## Problem
When creating Meeting or Other event types that reference non-sports sites, the location wasn't displaying correctly on event cards and schedule views because these sites weren't being stored as valid field references.

## Solution
Changed the approach so Meeting/Other events now use placeholder field records that reference non-sports sites, rather than trying to store site IDs directly in the field_id column.

## Changes Made

### 1. Database Migration (`create-site-fields.sql`)
- Creates placeholder field records for each non-sports site
- These fields have type "Meeting Room" to distinguish them
- The field name is "{Site Name} (Site)" for clarity
- Only creates fields for sites where `is_sports_facility = 0`
- Will not create duplicates if fields already exist

**To apply this migration:**
```bash
# Run when database is available
node -e "
const sql = require('mssql');
const fs = require('fs');
// ... (see create-site-fields.sql)
"
```

Or use your preferred SQL client to run the SQL directly.

### 2. Frontend Changes (`ScheduleManager.tsx`)

**Location Filtering Logic:**
- Meeting/Other events: Shows fields from non-sports facility sites
- Game/Practice events: Shows fields from sports facilities  
- No event type selected: Shows all fields

**Display Logic:**
- In the dropdown, shows the site name directly (e.g., "Conference Room A")
- The field name contains the site name, so it displays naturally
- Removed the redundant "(Site Name)" suffix from display

## How It Works

1. Non-sports sites automatically get a placeholder field entry
2. When creating a Meeting/Other event, the dropdown shows these placeholder fields
3. The field_id is stored normally in the events table
4. The existing JOIN queries in the backend automatically fetch the correct site name
5. Event cards and schedule views display the location correctly

## Benefits

- Uses existing database structure (no schema changes needed beyond field records)
- Leverages existing JOIN queries in backend
- Consistent data model across all event types
- Site names display correctly everywhere in the app

## Testing

After running the migration:
1. Create a Meeting or Other event
2. Select a non-sports site from the Location dropdown
3. Save the event
4. Verify the location displays correctly on:
   - Event card in Schedule Management
   - Schedule View
   - Any other views that show events
