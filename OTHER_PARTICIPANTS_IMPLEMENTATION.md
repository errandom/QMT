# Other Participants and Estimated Attendance Implementation

## Summary
Added support for storing `other_participants` and `estimated_attendance` fields when creating or editing events. These fields are now persisted in the database and properly handled throughout the application.

## Changes Made

### 1. Database Migration
**File: `add-event-participants-attendance.sql`** (NEW)
- Added migration script to add two new columns to the events table:
  - `other_participants` (NVARCHAR(500)): Stores names of participants not in teams (e.g., guest teams, officials)
  - `estimated_attendance` (INT): Stores expected number of attendees for the event

**To Run Migration:**
```bash
node migrate-db.js add-event-participants-attendance.sql
```

Note: The migration uses `IF NOT EXISTS` checks, so it's safe to run multiple times.

### 2. Backend Routes
**File: `server/routes/events.ts`**
- **POST route (Create Event)**: 
  - Extracts `other_participants` and `estimated_attendance` from request body
  - Includes these fields in INSERT query for both single and recurring events
  
- **PUT route (Update Event)**:
  - Extracts `other_participants` and `estimated_attendance` from request body
  - Includes these fields in UPDATE query for regular updates
  - Includes these fields when converting existing events to recurring

**Fields are properly typed:**
- `other_participants`: `sql.NVarChar` (nullable)
- `estimated_attendance`: `sql.Int` (nullable)

### 3. Frontend API Layer
**File: `src/lib/api.ts`**
- `transformEvent()` function already handles bidirectional transformation:
  - Database format: `other_participants`, `estimated_attendance` (snake_case)
  - Frontend format: `otherParticipants`, `estimatedAttendance` (camelCase)
- No changes needed - already working correctly

### 4. Frontend Form Component
**File: `src/components/OperationsOffice/ScheduleManager.tsx`**
- Updated `formData` type to allow `estimatedAttendance` to be either `string` (from input) or `number` (from Event object)
- Updated `handleSubmit()` for both create and edit operations:
  - Added `other_participants` to apiData
  - Added `estimated_attendance` to apiData with proper type conversion (string to int)
- Form fields already exist in UI - just needed to be sent to backend

**Type conversion logic:**
```typescript
estimated_attendance: formData.estimatedAttendance ? 
  (typeof formData.estimatedAttendance === 'string' ? 
    parseInt(formData.estimatedAttendance) : 
    formData.estimatedAttendance) : null
```

### 5. Type Definitions
**File: `src/lib/types.ts`**
- Event interface already includes these fields:
  - `otherParticipants?: string`
  - `estimatedAttendance?: number`
- No changes needed

## Data Flow

### Creating an Event:
1. User fills form including Other Participants and Estimated Attendance
2. ScheduleManager converts form data to API format (snake_case)
3. API sends POST request with `other_participants` and `estimated_attendance`
4. Backend extracts fields and inserts into database
5. Database stores values in events table
6. Backend returns created event(s)
7. API transforms response to camelCase
8. Frontend displays event with all fields

### Editing an Event:
1. User clicks edit on existing event
2. `handleEdit()` populates form with all event fields (including these two)
3. User modifies fields
4. ScheduleManager sends PUT request with updated values
5. Backend updates database
6. Frontend updates event in state

### Recurring Events:
Both fields are properly handled for:
- Creating multiple recurring events (each gets same `other_participants` and `estimated_attendance`)
- Converting existing event to recurring (values are copied to all generated events)

## Testing Checklist

Once the migration is run, verify:
- [ ] Create a new single event with other participants and attendance
- [ ] Verify data persists after page reload
- [ ] Edit an existing event and modify these fields
- [ ] Create a recurring event with these fields
- [ ] Convert existing event to recurring (fields should copy to all instances)
- [ ] Check database directly to confirm values are stored

## SQL Query to Verify Data:
```sql
SELECT id, description, other_participants, estimated_attendance 
FROM events 
WHERE other_participants IS NOT NULL OR estimated_attendance IS NOT NULL
ORDER BY id DESC;
```

## Next Steps
1. Run the migration script to add database columns
2. Test event creation and editing with these fields
3. Verify data persistence across page reloads
4. Confirm recurring events handle these fields correctly
