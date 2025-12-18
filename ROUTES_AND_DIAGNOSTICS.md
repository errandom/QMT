# Data Loading - Routes & Diagnostics Fixed

## Changes Made

### 1. **Fixed Backend Routing Architecture**
   - **File**: `server/index.ts`
   - **Issue**: GET routes were not properly exposed before the protected middleware
   - **Fix**: Reorganized routing so GET requests are handled directly without authentication
   - **Result**: All GET endpoints (`/api/teams`, `/api/sites`, `/api/fields`, `/api/equipment`, `/api/events`) now return data publicly
   - **Added**: Equipment GET endpoints were missing - now included

### 2. **Enhanced Logging Throughout**
   - **Files**: All route handlers and `src/hooks/useInitializeData.ts`
   - **Changes**:
     - Backend now logs how many records are returned from each endpoint
     - Frontend logs each API response with full data
     - Console messages show the exact data being fetched
   - **Why**: Makes it easy to diagnose if data is in DB or if APIs are returning empty

### 3. **Better Debugging**
   - **New**: `DIAGNOSTIC.sh` script for testing
   - **Use**: Run `./DIAGNOSTIC.sh` to check all endpoints

## Expected Console Output

### On Browser Load (DevTools → Console tab):
```
[useInitializeData] Starting data initialization...
[useInitializeData] Events API Response: [...]  ← Shows actual event data or []
[useInitializeData] Teams API Response: [...]   ← Shows actual team data or []
[useInitializeData] Sites API Response: [...]   ← Shows actual site data or []
[useInitializeData] Fields API Response: [...]  ← Shows actual field data or []
[useInitializeData] Equipment API Response: [...] ← Shows actual equipment data or []
✓ [useInitializeData] Application data initialized successfully
```

### On Backend (Terminal running npm start):
```
[API GET Teams] Retrieved X teams
[API GET Sites] Retrieved Y sites
[API GET Fields] Retrieved Z fields
[API GET Equipment] Retrieved N equipment items
[API GET Events] Retrieved M events
```

## Troubleshooting Steps

### Step 1: Check Backend is Running
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","database":"connected"...}
```

### Step 2: Test Each Endpoint
```bash
curl http://localhost:3000/api/teams
curl http://localhost:3000/api/sites  
curl http://localhost:3000/api/fields
curl http://localhost:3000/api/equipment
curl http://localhost:3000/api/events
```

Expected response format:
- If data exists: `[{id: 1, name: "...", ...}, {...}]`
- If no data: `[]` (empty array)

### Step 3: Check Browser Console
- Open DevTools (F12)
- Go to Console tab
- Reload page
- Look for the logging messages above
- If you see `[]` arrays, database is empty (needs data seeded)
- If you see errors, check error messages for clues

### Step 4: Check Database Directly
If you have Azure SQL access:
```sql
-- Check if data exists
SELECT COUNT(*) FROM teams;
SELECT COUNT(*) FROM sites;
SELECT COUNT(*) FROM fields;
SELECT COUNT(*) FROM equipment;
SELECT COUNT(*) FROM events;

-- Check specific data
SELECT TOP 5 * FROM teams;
SELECT TOP 5 * FROM sites;
```

## Why Data Might Not Appear

1. **Database is empty** → No records inserted yet
   - Solution: Create records via UI or seed database

2. **Teams filter is active** → Route filters for `WHERE active = 1`
   - Solution: Ensure teams have `active=1` in database
   - Test: Check `SELECT * FROM teams;` to see active status

3. **API not returning data** → Check backend logs
   - Solution: Look at terminal running `npm start`
   - Check for "[API GET Teams] Retrieved 0 teams" messages

4. **Frontend not receiving API response** → Check network tab
   - Solution: Open DevTools → Network tab → filter for "teams"
   - Click the request and check Response tab
   - Should show `[...]` or `[]`

5. **CORS or authentication issue** → API call blocked
   - Solution: Check browser console for CORS errors
   - Public GET endpoints shouldn't require authentication

## What Works Now

✓ **New data persists to database** when created via UI
✓ **GET endpoints return all data** without authentication  
✓ **Detailed logging** on both frontend and backend
✓ **Equipment endpoint** now properly exposed
✓ **All manager CRUD operations** make API calls

## What Still Needs Verification

You mentioned existing data doesn't load. This is likely because:
1. Database is empty (nothing seeded)
2. Active flag issue (old data has active=0)
3. API actually returning data but frontend not displaying it

**Next: Run the tests above and check console/backend logs to identify which case applies.**
