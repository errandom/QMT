# Data Persistence Fix - Complete Guide

## Problem Summary
Form data entered in the Operations Office dialogs (Teams, Sites, Fields) was not being saved to the database. While the database schema was updated, there were critical issues preventing data from persisting:

1. **Nested Object Initialization**: Team form inputs used non-null assertion (`!`) on potentially undefined objects
2. **Missing Database Migrations**: Database columns existed in schema but weren't applied to the running database
3. **Lack of Debugging**: No visibility into what data was being sent from frontend to backend

## Fixes Applied

### 1. Fixed Team Manager Nested Object Handling
**File**: `src/components/OperationsOffice/TeamsManager.tsx`

**Problem**: Form inputs for `headCoach` and `teamManager` used this pattern:
```typescript
onChange={(e) => setFormData({
  ...formData,
  headCoach: { ...formData.headCoach!, firstName: e.target.value }
})}
```

The `!` operator assumed `headCoach` exists, which would fail on first input.

**Solution**: Now properly initializes all fields:
```typescript
onChange={(e) => setFormData({
  ...formData,
  headCoach: { 
    firstName: e.target.value,
    lastName: formData.headCoach?.lastName || '',
    email: formData.headCoach?.email || '',
    phone: formData.headCoach?.phone || ''
  }
})}
```

This ensures the entire object structure exists with every keystroke.

### 2. Added Frontend Logging
**Files**: 
- `TeamsManager.tsx`
- `SitesManager.tsx`
- `FieldsManager.tsx`

Added console logging before API calls:
```typescript
console.log('TEAMS FRONTEND: Submitting team data:', apiData)
console.log('SITES FRONTEND: Submitting site data:', apiData)
console.log('FIELDS FRONTEND: Submitting field data:', apiData)
```

This allows you to verify in browser console that all data is being collected from forms correctly.

### 3. Backend Logging Already Present
**Files**:
- `server/routes/teams.ts`
- `server/routes/sites.ts`
- `server/routes/fields.ts`

Backend already logs received data:
```typescript
console.log('[Teams POST] Received data:', req.body);
console.log('[Sites POST] Received data:', req.body);
console.log('[Fields POST] Received data:', req.body);
```

Check server console to verify backend receives complete data.

## Required Actions

### CRITICAL: Run Database Migration

**You MUST run the migration script to apply schema changes to your database.**

#### Option 1: Run Combined Migration (Recommended)
```bash
# Use the all-in-one migration script
sqlcmd -S your_server -d your_database -i run-all-migrations.sql
```

#### Option 2: Run Individual Migrations
```bash
sqlcmd -S your_server -d your_database -i migrate-teams-table.sql
sqlcmd -S your_server -d your_database -i migrate-sites-table.sql
sqlcmd -S your_server -d your_database -i migrate-fields-table.sql
```

#### Option 3: Azure Data Studio / SSMS
1. Open Azure Data Studio or SQL Server Management Studio
2. Connect to your database
3. Open `run-all-migrations.sql`
4. Execute the script
5. Verify output shows all columns added or already exist

### Verify Migration Success

Run this query to check columns exist:

```sql
-- Check Teams table
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'teams' 
AND COLUMN_NAME LIKE '%coach%' OR COLUMN_NAME LIKE '%manager%';

-- Check Sites table
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'sites' 
AND COLUMN_NAME IN ('city', 'zip_code', 'latitude', 'longitude', 'contact_first_name', 'contact_last_name', 'contact_phone', 'contact_email');

-- Check Fields table
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'fields' 
AND COLUMN_NAME IN ('has_lights', 'capacity', 'active');
```

## Testing the Fix

### 1. Start the Application
```bash
npm run dev
```

### 2. Open Browser Console
- Press F12 or right-click → Inspect
- Go to Console tab
- Keep it open while testing

### 3. Test Team Creation
1. Go to Operations Office → Teams
2. Click "Add New Team"
3. Fill in:
   - Team Name
   - Sport Type (Flag/Tackle)
   - Roster Size
   - Head Coach info (all 4 fields)
   - Team Manager info (all 4 fields)
4. Click Save

**Expected Console Output**:
```
TEAMS FRONTEND: Submitting team data: {
  name: "Test Team",
  sport: "Tackle Football",
  age_group: "U-14",
  coaches: "John Doe",
  active: true,
  headCoachFirstName: "John",
  headCoachLastName: "Doe",
  headCoachEmail: "john@example.com",
  headCoachPhone: "555-1234",
  teamManagerFirstName: "Jane",
  teamManagerLastName: "Smith",
  teamManagerEmail: "jane@example.com",
  teamManagerPhone: "555-5678"
}
```

**Expected Server Console Output**:
```
[Teams POST] Received data: { name: 'Test Team', sport: 'Tackle Football', ... }
```

### 4. Test Site Creation
1. Go to Operations Office → Sites
2. Click "Add New Site"
3. Fill in:
   - Site Name
   - Address
   - City
   - Zip Code
   - Latitude/Longitude
   - Contact info (all 4 fields)
   - Amenities checkboxes
4. Click Save

**Check Console**: Should show complete data including all address and contact fields.

### 5. Test Field Creation
1. Go to Operations Office → Fields
2. Click "Add New Field"
3. Fill in:
   - Field Name
   - Select Site
   - Select Turf Type
   - Select Field Size
   - Toggle Lights
   - Enter Capacity
   - Toggle Active
4. Click Save

**Check Console**: Should show complete data including site_id, has_lights, capacity, active.

### 6. Verify Database Storage

Query the database to confirm data was saved:

```sql
-- Check latest team
SELECT TOP 1 * 
FROM teams 
ORDER BY id DESC;

-- Check latest site
SELECT TOP 1 * 
FROM sites 
ORDER BY id DESC;

-- Check latest field
SELECT TOP 1 * 
FROM fields 
ORDER BY id DESC;
```

All columns should have values (not NULL for fields you entered).

### 7. Test Edit Functionality

1. Click Edit on a created record
2. Verify all fields populate in the dialog
3. Modify some values
4. Click Save
5. Verify changes persist in database

## Troubleshooting

### Issue: Frontend console shows NULL values
**Cause**: Form inputs not triggering onChange properly
**Solution**: Check that you're typing/selecting in ALL fields, not just clicking

### Issue: Backend receives incomplete data
**Cause**: Form state not updating properly
**Solution**: Check browser console for JavaScript errors, verify no React warnings

### Issue: Data saves but doesn't appear on reload
**Cause**: API transformation layer not mapping fields correctly
**Solution**: Check `src/lib/api.ts` functions `transformTeam`, `transformSite`, `transformField`

### Issue: SQL error "Invalid column name"
**Cause**: Migration script not run or failed
**Solution**: 
1. Check migration script output for errors
2. Run query to verify columns exist (see "Verify Migration Success" above)
3. Restart application after running migration

### Issue: Edit dialog shows empty fields
**Cause**: Transform functions not reconstructing nested objects
**Solution**: Check `transformTeam` properly rebuilds `headCoach` and `teamManager` objects from individual columns

## Database Schema Reference

### Teams Table - New Columns
- `head_coach_first_name` NVARCHAR(255)
- `head_coach_last_name` NVARCHAR(255)
- `head_coach_email` NVARCHAR(255)
- `head_coach_phone` NVARCHAR(50)
- `team_manager_first_name` NVARCHAR(255)
- `team_manager_last_name` NVARCHAR(255)
- `team_manager_email` NVARCHAR(255)
- `team_manager_phone` NVARCHAR(50)

### Sites Table - New Columns
- `city` NVARCHAR(255)
- `zip_code` NVARCHAR(20)
- `latitude` FLOAT
- `longitude` FLOAT
- `contact_first_name` NVARCHAR(255)
- `contact_last_name` NVARCHAR(255)
- `contact_phone` NVARCHAR(50)
- `contact_email` NVARCHAR(255)
- `is_sports_facility` BIT (DEFAULT 1)
- `active` BIT (DEFAULT 1)

### Fields Table - New Columns
- `has_lights` BIT (DEFAULT 0)
- `capacity` INT
- `active` BIT (DEFAULT 1)

## Data Flow Diagram

```
User Input (Form)
    ↓
FormData State (React)
    ↓
handleSubmit → apiData object
    ↓
[Frontend Console Log]
    ↓
api.createTeam/updateTeam (API call)
    ↓
HTTP POST/PUT request
    ↓
[Backend Console Log]
    ↓
Express Route Handler
    ↓
SQL Query with Inputs
    ↓
Database Table
    ↓
OUTPUT INSERTED.*
    ↓
Response to Frontend
    ↓
Update UI State
```

## Files Modified

### Frontend Components
1. `/src/components/OperationsOffice/TeamsManager.tsx`
   - Fixed nested object initialization for headCoach and teamManager
   - Added frontend logging

2. `/src/components/OperationsOffice/SitesManager.tsx`
   - Added frontend logging
   - (No structural changes needed - already correct)

3. `/src/components/OperationsOffice/FieldsManager.tsx`
   - Added frontend logging
   - (No structural changes needed - already correct)

### Backend Routes (Already Correct)
- `/server/routes/teams.ts` - Handles all contact fields
- `/server/routes/sites.ts` - Handles all address/contact fields
- `/server/routes/fields.ts` - Handles lights/capacity/active

### API Layer (Already Correct)
- `/src/lib/api.ts` - Transform functions properly map between camelCase and snake_case

### Migration Scripts
- `migrate-teams-table.sql` - Adds team contact columns
- `migrate-sites-table.sql` - Adds site address/contact columns
- `migrate-fields-table.sql` - Adds field metadata columns
- `run-all-migrations.sql` - **Use this one** - Combined migration with detailed logging

## Success Criteria

✅ Browser console shows complete data structure before API call
✅ Server console shows complete data received from frontend
✅ Database query shows all fields populated with entered values
✅ Edit dialog populates all fields when editing existing record
✅ Changes persist after browser refresh
✅ No NULL values in database for fields that were filled in form

## Next Steps

1. **Run the migration**: Execute `run-all-migrations.sql` against your database
2. **Restart the app**: Stop and restart `npm run dev` to ensure fresh connection
3. **Test thoroughly**: Create one of each record type (team, site, field) with ALL fields filled
4. **Verify database**: Query database to confirm all data was stored
5. **Test editing**: Edit each record and verify changes persist

## Questions or Issues?

If you still experience issues after following this guide:

1. Share the **browser console output** (frontend logs)
2. Share the **server console output** (backend logs)
3. Share the **database query results** for the affected record
4. Share the **migration script output** to confirm it ran successfully

This will help diagnose where in the data flow the issue is occurring.
