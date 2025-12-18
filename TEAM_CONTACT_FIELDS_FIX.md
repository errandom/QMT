# Team Contact Fields Fix

## Issues Fixed

### 1. Sport Type Selector Inactive in Edit Mode
**Problem**: When editing a team, the sport type dropdown appeared inactive/unresponsive.

**Root Cause**: The `transformTeam` function in `api.ts` was using `team.sportType || team.sport`, which caused issues when the database field is `sport` but the frontend expects `sportType`.

**Solution**: Changed to `team.sport || team.sportType || 'Tackle Football'` to prioritize the database field and provide a fallback.

### 2. Contact Details Not Saving to Individual Columns
**Problem**: Coach and team manager contact information was being concatenated into the `coaches` column, but individual detail columns (first name, last name, email, phone) were not being populated.

**Root Cause**: Frontend was sending data like `coaches: "John Doe"` along with individual fields, and the backend was writing to the `coaches` column.

**Solution**: 
- Removed the `coaches` field from frontend API data
- Removed the `coaches` field from backend POST and PUT routes
- Only individual contact fields are now sent and saved

## Files Modified

### Frontend
- **src/lib/api.ts**
  - Fixed `transformTeam` to properly map `sport` → `sportType`
  - Changed priority: `team.sport` first, then `team.sportType`, with 'Tackle Football' fallback

- **src/components/OperationsOffice/TeamsManager.tsx**
  - Removed `coaches` field from apiData object
  - Only sends individual contact fields now

### Backend
- **server/routes/teams.ts**
  - Removed `coaches` parameter from POST route
  - Removed `coaches` parameter from PUT route
  - Removed `coaches` column from INSERT statement
  - Removed `coaches` column from UPDATE statement

## Data Flow (After Fix)

### Creating/Editing a Team:

```typescript
// Frontend sends:
{
  name: "Warriors",
  sport: "Tackle Football",  // Now correctly mapped
  age_group: "U-14",
  active: true,
  headCoachFirstName: "John",
  headCoachLastName: "Doe",
  headCoachEmail: "john@example.com",
  headCoachPhone: "555-1234",
  teamManagerFirstName: "Jane",
  teamManagerLastName: "Smith",
  teamManagerEmail: "jane@example.com",
  teamManagerPhone: "555-5678"
  // NO MORE: coaches: "John Doe"
}

// Backend saves to individual columns:
head_coach_first_name = "John"
head_coach_last_name = "Doe"
head_coach_email = "john@example.com"
head_coach_phone = "555-1234"
team_manager_first_name = "Jane"
team_manager_last_name = "Smith"
team_manager_email = "jane@example.com"
team_manager_phone = "555-5678"
// coaches column is NOT updated
```

### Loading Teams:

```typescript
// Database returns:
{
  id: 1,
  name: "Warriors",
  sport: "Tackle Football",
  head_coach_first_name: "John",
  head_coach_last_name: "Doe",
  // ... other fields
}

// transformTeam converts to:
{
  id: "1",
  name: "Warriors",
  sportType: "Tackle Football",  // Properly mapped from 'sport'
  headCoach: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "555-1234"
  },
  teamManager: {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "555-5678"
  }
}
```

## Testing

### 1. Test Sport Type Selection (Edit Mode)
1. Create a new team with any sport type
2. Close the dialog
3. Click Edit on the same team
4. The sport type dropdown should show the correct value and be clickable
5. Change the sport type and save
6. Verify the change persists

### 2. Test Contact Fields Persistence
1. Go to Operations Office → Teams
2. Click "Add Team"
3. Fill in:
   - Team Name: "Test Team"
   - Sport Type: "Tackle Football"
   - Head Coach First Name: "John"
   - Head Coach Last Name: "Doe"
   - Head Coach Email: "john@test.com"
   - Head Coach Phone: "555-1234"
   - Team Manager First Name: "Jane"
   - Team Manager Last Name: "Smith"
   - Team Manager Email: "jane@test.com"
   - Team Manager Phone: "555-5678"
4. Click Save
5. Check browser console for:
   ```
   TEAMS FRONTEND: Submitting team data: {
     name: "Test Team",
     sport: "Tackle Football",
     headCoachFirstName: "John",
     ...
     // NO coaches field
   }
   ```
6. Check server console for:
   ```
   [Teams POST] Received data: { name: 'Test Team', sport: 'Tackle Football', headCoachFirstName: 'John', ... }
   ```
7. Query database:
   ```sql
   SELECT TOP 1 
     name,
     sport,
     head_coach_first_name,
     head_coach_last_name,
     head_coach_email,
     head_coach_phone,
     team_manager_first_name,
     team_manager_last_name,
     team_manager_email,
     team_manager_phone
   FROM teams 
   ORDER BY id DESC;
   ```
8. Verify all individual fields have values (not NULL)

### 3. Test Edit Functionality
1. Click Edit on the team you just created
2. Verify ALL fields populate correctly:
   - Sport type dropdown shows correct value
   - All coach contact fields are filled
   - All manager contact fields are filled
3. Change some values (e.g., change email addresses)
4. Click Save
5. Click Edit again
6. Verify changes persisted

## Database Cleanup (Optional)

The `coaches` column is no longer used. You can optionally remove it from the database:

### Option 1: Keep It (Recommended for Now)
- Leave the column in the database as a backup
- It won't be written to anymore, but existing data remains
- Safer approach until you're confident the new system works

### Option 2: Drop It (After Testing)
Run the migration script after thoroughly testing:
```bash
sqlcmd -S your_server -d your_database -i drop-coaches-column.sql
```

Or in Azure Data Studio/SSMS, execute: [drop-coaches-column.sql](drop-coaches-column.sql)

## Troubleshooting

### Sport Type Still Not Selectable in Edit
1. Check browser console for JavaScript errors
2. Verify the team data in console log shows `sportType` field
3. Check that `transformTeam` is being called (add console.log if needed)

### Contact Fields Not Saving
1. Check browser console - does `TEAMS FRONTEND` log show all fields?
2. Check server console - does `[Teams POST]` log show all fields?
3. If frontend log is good but backend log is missing fields, check network tab
4. If backend log is good but database is missing data, run the migration script

### Edit Shows Empty Fields
1. Query the database directly to see if data exists
2. If data exists in DB but not in edit dialog, issue is in `transformTeam`
3. Check that individual field names match between DB and transform function
4. Verify field names use snake_case in DB (head_coach_first_name) and camelCase in frontend (headCoach.firstName)

## Success Checklist

✅ Sport type dropdown is selectable when editing teams  
✅ Browser console shows NO `coaches` field in submitted data  
✅ Server console receives individual contact fields  
✅ Database shows values in head_coach_* and team_manager_* columns  
✅ Edit dialog populates all contact fields correctly  
✅ Changes made in edit dialog persist to database  
✅ Sport type changes persist correctly  

## Next Steps

1. **Test immediately**: Create a new team with all fields filled
2. **Verify database**: Query to confirm individual fields have data
3. **Test editing**: Edit the team and verify sport type is selectable
4. **Optional cleanup**: After 1-2 weeks of successful use, drop the coaches column using provided script

## Questions?

If issues persist, provide:
- Browser console output (TEAMS FRONTEND log)
- Server console output ([Teams POST] log)
- Database query results for the affected team
- Screenshot of the edit dialog if sport type still appears inactive
