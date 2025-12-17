# Data Loading Fix - Step-by-Step Implementation

## What Changed

### 1. **Removed Active Record Filtering** ✓
**File:** `server/index.ts`

**Change:** The `/api/teams` endpoint was filtering records with `WHERE active = 1`, which would hide inactive teams. Based on your requirement "any record should show up, regardless of active/inactive status", this filter has been removed.

**Before:**
```typescript
app.get('/api/teams', async (req: Request, res: Response) => {
  const result = await pool.request().query(`SELECT * FROM teams WHERE active = 1 ORDER BY sport, name`);
  res.json(result.recordset);
});
```

**After:**
```typescript
app.get('/api/teams', async (req: Request, res: Response) => {
  const result = await pool.request().query(`SELECT * FROM teams ORDER BY sport, name`);
  res.json(result.recordset);
});
```

**Applied to:** Teams, Sites, Fields, Equipment, Events
**Result:** All records now returned from database, regardless of active status

### 2. **Enhanced Error Handling in API Endpoints** ✓
**File:** `server/index.ts`

All API endpoints now wrapped in try-catch blocks to catch and log any errors that occur during database queries.

**Before:**
```typescript
app.get('/api/teams', async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM teams ...`);
  res.json(result.recordset);
});
```

**After:**
```typescript
app.get('/api/teams', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT * FROM teams ...`);
    res.json(result.recordset);
  } catch (error) {
    console.error('[API GET Teams] ERROR:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
```

**Result:** Better error reporting if something goes wrong

### 3. **Enhanced Initialization Hook Logging** ✓
**File:** `src/hooks/useInitializeData.ts`

Completely rewrote the logging to be much more detailed and visual, making it easier to debug data loading:

**New Features:**
- Visual separators (`========================================`)
- Emoji indicators (🚀 starting, 📊 responses, 💾 storing, ✅ success, ❌ errors)
- Detailed count of records for each data type
- Shows exact API responses so you can see what data was received
- Clear error messages with stack traces
- Summary of total records loaded

**Example Output:**
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
```

## Next Steps to Verify Everything Works

### Step 1: Start the Backend Server
```bash
npm run dev
```

**What to look for in the terminal:**
- `✓ Server running on port 3000`
- `✓ API available at http://localhost:3000/api`

### Step 2: Test API Endpoints
In a second terminal, run the diagnostic script:
```bash
./test-api-endpoints.sh
```

**Expected output:**
```
Testing Teams... ✓ OK (HTTP 200, 5 records)
Testing Sites... ✓ OK (HTTP 200, 3 records)
Testing Fields... ✓ OK (HTTP 200, 8 records)
Testing Equipment... ✓ OK (HTTP 200, 12 records)
Testing Events... ✓ OK (HTTP 200, 2 records)
```

**If you see 0 records:**
- Check that test data exists in the database
- Run this SQL query to verify: `SELECT COUNT(*) FROM teams;`
- If count is 0, you need to create test data first

**If you see errors (❌):**
- Make sure backend is running on port 3000
- Check `.env` file is configured correctly
- Run health check: `curl http://localhost:3000/api/health`

### Step 3: Start Frontend and Check Console Logs
```bash
npm run dev
# In a second terminal, vite might be running on localhost:5173
```

**In the browser:**
1. Open DevTools (F12)
2. Go to Console tab
3. Reload the page (Ctrl+R or Cmd+R)
4. Look for logs starting with `[useInitializeData]`

**You should see:**
```
========================================
[useInitializeData] 🚀 Starting data initialization...
========================================
📊 [useInitializeData] API RESPONSES:
   Events: X records [...]
   Teams: X records [...]
   Sites: X records [...]
   Fields: X records [...]
   Equipment: X records [...]
```

**If you see `0 records` for all types:**
- API is returning empty arrays
- Check backend logs: should show `[API GET Teams] Retrieved 0 teams`
- This means database queries are returning no results
- Verify database has records with `SELECT COUNT(*) FROM teams;`

### Step 4: Check Operations Office View
Navigate to Operations Office in the app and check:
- Teams Manager: Should show all teams
- Sites Manager: Should show all sites
- Fields Manager: Should show all fields
- Equipment Manager: Should show all equipment

If these are still empty:
- Check React DevTools to see if the component state has the data
- Check if there's a JavaScript error preventing rendering

## Troubleshooting Map

| Problem | Likely Cause | Debug Step |
|---------|-------------|-----------|
| Nothing loads in UI | Frontend initialization not running | Check browser console for `[useInitializeData]` logs |
| Console shows 0 records | API returning empty array | Run `curl http://localhost:3000/api/teams` |
| curl returns 0 records | Database has no data | Run `SELECT COUNT(*) FROM teams;` in SQL |
| curl returns error | Backend issue | Check `.env` file and database connection |
| Console shows data but UI empty | Component not reading from KV store | Check React DevTools, verify component state |
| Some endpoints work, others don't | Specific database table issue | Run `SELECT COUNT(*) FROM [table_name];` for each |

## Data Flow Diagram

```
Database
    ↓
API Endpoints (GET /api/teams, etc.)
    ↓
useInitializeData Hook (src/hooks/useInitializeData.ts)
    ↓
setTeams(), setSites(), etc. (stores in KV)
    ↓
Components read from KV (TeamsManager, Dashboard, etc.)
    ↓
UI displays data
```

**To verify each step:**
1. Database: `SELECT COUNT(*) FROM teams;` in SQL
2. API: `curl http://localhost:3000/api/teams`
3. Frontend: Browser console `[useInitializeData]` logs
4. Components: React DevTools inspect component state

## Important Notes

### Teams Endpoint Changed
Previously, the `/api/teams` endpoint was filtering with `WHERE active = 1`. This has been removed so all teams are returned. The frontend can still filter based on active status in the UI if needed.

### KV Store Key Names (Must Match)
The components expect data to be stored in the KV store with these exact keys:
- `'events'` → Events
- `'teams'` → Teams
- `'sites'` → Sites
- `'fields'` → Fields
- `'equipment'` → Equipment
- `'facility-requests'` → Facility Requests
- `'equipment-requests'` → Equipment Requests
- `'cancellation-requests'` → Cancellation Requests

If any component uses a different key, it won't see the data!

## Files Modified

1. **`server/index.ts`**
   - Removed active status filters from GET endpoints
   - Added try-catch error handling
   - Added detailed logging

2. **`src/hooks/useInitializeData.ts`**
   - Enhanced logging with emoji and visual separators
   - Better error handling and reporting

3. **New Diagnostic Files**
   - `test-api-endpoints.sh` → Quick API testing script
   - `DEBUGGING_DATA_LOADING.md` → Comprehensive debugging guide

## Manual Testing with curl

If you want to test manually without running the full app:

```bash
# Test Teams endpoint
curl -X GET http://localhost:3000/api/teams

# Test with pretty JSON formatting (requires jq)
curl -X GET http://localhost:3000/api/teams | jq .

# Test specific site
curl -X GET http://localhost:3000/api/sites/1
```

## Common Issues Resolution

### Issue: "Database has 10 teams but API returns empty"
1. Check for SQL errors: Add logging to see the actual SQL query
2. Verify WHERE clause is removed (no `WHERE active = 1`)
3. Test directly in SQL tool: `SELECT * FROM teams;`

### Issue: "API returns data but console shows 0 records"
1. Check for network errors in DevTools Network tab
2. Verify API response status is 200 (not 404 or 500)
3. Check if response is actually JSON (not HTML error page)

### Issue: "All console logs show correct data but UI is empty"
1. Verify components use the right KV key names
2. Check React DevTools to see if component state is populated
3. Look for JavaScript errors in console
4. Try reloading the page

## Success Indicators

✅ Data loading is working when:
1. Backend logs show: `[API GET Teams] Retrieved X teams` (X > 0)
2. Browser console shows data in `[useInitializeData] API RESPONSES`
3. React DevTools shows components have data in state
4. Operations Office displays teams, sites, fields, equipment, and events
5. Dialog dropdowns show available teams and facilities

## Next: You Should See

When you navigate to the Operations Office after these changes:
- **Schedule Manager:** Shows all events from database
- **Teams Manager:** Shows all teams, can edit/delete
- **Sites Manager:** Shows all sites with field counts
- **Fields Manager:** Shows all fields organized by site
- **Equipment Manager:** Shows all equipment
- **Requests Manager:** Shows all requests

All data should now be preloaded from the database on app startup!
