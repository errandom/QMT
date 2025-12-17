# Data Loading Debugging Guide

## Overview
This guide helps diagnose why data is not loading from the database into the Operations Office and other views.

## Quick Diagnostic Steps (Do These First)

### Step 1: Check Backend API Responses
Start the backend server and test if the API endpoints are returning data:

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Test API endpoints
curl http://localhost:3000/api/teams
curl http://localhost:3000/api/sites
curl http://localhost:3000/api/fields
curl http://localhost:3000/api/equipment
curl http://localhost:3000/api/events
```

**Expected Result:** Each endpoint should return a JSON array. For example:
```json
[
  {
    "id": 1,
    "name": "Varsity Football",
    "sport": "Tackle Football",
    "coaches": "John Smith",
    "active": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

**If you get `[]` (empty array):**
- Database query is running but returning no records
- Check: Are there actually records in the database?
- Check: Is the active filter still in place?
- Solution: Run `SELECT COUNT(*) FROM teams` in SQL to verify records exist

**If you get an error:**
- Database connection might be failing
- Check: Is `.env` file configured with correct DB credentials?
- Check: Is the database server running?
- Solution: Run health check: `curl http://localhost:3000/api/health`

### Step 2: Check Backend Logs
While running the backend server, check the terminal output for API logs:

When you make an API call, look for messages like:
```
[API GET Teams] Retrieved 5 teams
[API GET Sites] Retrieved 3 sites
[API GET Fields] Retrieved 12 fields
[API GET Equipment] Retrieved 25 equipment items
```

**If you see:**
- `[API GET Teams] Retrieved 0 teams` → Database has no records or query failed
- `[API GET Teams] Retrieved 5 teams` → Data is being sent to frontend ✓

**If you don't see these messages:**
- The endpoint handler might not be executing
- Check: Is the route defined in server/index.ts?
- Solution: Look for "GET /api/teams" in the request logs

### Step 3: Check Frontend Initialization Logs
Open browser DevTools (F12) and look at the Console tab:

**Expected Log Output (on page load):**
```
========================================
[useInitializeData] 🚀 Starting data initialization...
========================================
📊 [useInitializeData] API RESPONSES:
   Events: 5 records [Array(5)]
   Teams: 3 records [Array(3)]
   Sites: 2 records [Array(2)]
   Fields: 8 records [Array(8)]
   Equipment: 12 records [Array(12)]
💾 [useInitializeData] Storing data into KV store...
   Setting events: 5 items
   Setting teams: 3 items
   Setting sites: 2 items
   Setting fields: 8 items
   Setting equipment: 12 items
========================================
✅ [useInitializeData] Application data initialized successfully!
Summary:
   Events: 5
   Teams: 3
   Sites: 2
   Fields: 8
   Equipment: 12
========================================
```

### Step 4: Identify the Exact Problem

| Symptom | Cause | Solution |
|---------|-------|----------|
| Backend API returns `[]` | Database query returning no records | Check database, verify active status is removed |
| Backend API returns error | Database connection failed | Check `.env` file, test connection |
| Backend logs show retrieved records but console shows `[]` | API response not being received by frontend | Check network tab in DevTools |
| Console shows API responses have data but Operations Office is empty | Data not being stored in KV store or components not reading it | Check if setTeams/setSites calls are working |
| All console logs show correct data but Operations Office still empty | Component rendering issue | Check React DevTools to see component state |

## Network Tab Debugging

1. Open DevTools (F12) → Network tab
2. Reload the page
3. Look for API requests: `teams`, `sites`, `fields`, `equipment`, `events`
4. Click on each request to view:
   - **Status:** Should be `200` (success)
   - **Response:** Should show JSON array with records
   - **Size:** Should show data size (not empty)

**If requests show `401` status:**
- Authentication issue - check token handling
- Solution: Verify authenticateToken middleware is not blocking public GET requests

**If requests show `404` status:**
- Endpoint doesn't exist
- Solution: Check server/index.ts for the GET handler

## Browser Console Commands

You can manually check the KV store state in the browser console:

```javascript
// Check if useKV is storing data correctly
// Run this after the app loads
Object.keys(window.localStorage).forEach(key => {
  if (key.includes('spark')) {
    console.log(key, JSON.parse(window.localStorage[key]))
  }
})

// Or check React component state using React DevTools
// Install React DevTools browser extension if not already installed
// Then inspect the App component to see the exact state
```

## Common Issues & Solutions

### Issue 1: "Teams returns `[]` even though database has records"
**Check:**
```sql
-- In your database tool, run this directly:
SELECT COUNT(*) FROM teams;
SELECT * FROM teams;
```
**If records exist but query returns empty:**
- The `WHERE active = 1` filter was still in place
- Solution: Remove the WHERE clause in server/index.ts

**If no records exist:**
- You need to create test data first
- Solution: Run the create operations from the UI or insert via SQL

### Issue 2: "Console shows data but Operations Office is empty"
**Steps:**
1. Verify in console that the data has the correct structure
2. Open React DevTools and inspect the TeamsManager component
3. Check if the `teams` state variable has data
4. If `teams` is empty, the KV store didn't update
5. Check if there are any JavaScript errors in console

**Solution:**
```typescript
// Add temporary logging to TeamsManager.tsx to verify it's reading data
useEffect(() => {
  console.log('TeamsManager mounted, teams from KV:', teams);
}, [teams])
```

### Issue 3: "Dropdowns in dialogs are empty"
**Cause:** Dialog components fetch data from a different KV key or don't refresh when data loads
**Solution:** Verify dialog components use the correct KV key: `'teams'`, `'sites'`, `'fields'`, `'equipment'`

## Step-by-Step Verification Flow

1. **✓ Database has records?** → Run `SELECT COUNT(*) FROM teams;`
2. **✓ API returns records?** → `curl http://localhost:3000/api/teams`
3. **✓ Frontend receives records?** → Check console logs for `Events: X records`
4. **✓ KV store updated?** → Check localStorage in DevTools
5. **✓ Components reading from KV?** → Check React component state in DevTools

If any step fails, that's where the problem is!

## File Locations to Check

- **Backend routes:** `server/index.ts` (main GET endpoints)
- **Frontend initialization:** `src/hooks/useInitializeData.ts` (API calls and KV store updates)
- **Component data reading:** `src/components/OperationsOffice/*Manager.tsx` (useKV hooks)
- **API client:** `src/lib/api.ts` (HTTP requests)

## Still Having Issues?

1. Share the output from: `curl http://localhost:3000/api/teams`
2. Share the browser console logs (copy everything from `[useInitializeData]`)
3. Share backend logs showing API calls
4. Confirm: Are there records in the database? (Run `SELECT COUNT(*) FROM teams;`)

This information will help identify exactly where in the data flow the problem is occurring.
