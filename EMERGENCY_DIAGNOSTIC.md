# 🆘 DATA NOT LOADING - EMERGENCY DIAGNOSTIC GUIDE

## Current Issues
- Request Facility button not opening dialog
- Teams dropdown empty
- Equipment dialog teams not showing
- Operations Office completely empty (ALL sections)

## This Indicates: **Data is not being loaded at all**

---

## IMMEDIATELY DO THIS (5 minutes)

### 1. Run diagnostic script:
```bash
./FULL_DIAGNOSTIC.sh
```

### 2. Check backend is running:
```bash
# You should see this in terminal:
npm run dev
# Shows: ✓ Server running on port 3000
```

### 3. Test API endpoint:
```bash
curl http://localhost:3000/api/teams
```

**Expected to see:**
- JSON array like: `[{"id": 1, "name": "Team A", ...}]`

**If you see:**
- `[]` (empty) → Database empty or query wrong
- Error message → Backend not responding
- HTML error page → Endpoint broken

### 4. Check browser console (F12):
After opening app and reloading:
- Look for `[useInitializeData] 🚀 Starting...`
- Look for record counts (should be > 0)
- Any error messages?

### 5. Report what you see:
- **API curl result:** ____________
- **Console logs (copy/paste):** ____________
- **Database record counts:** ____________

---

## ROOT CAUSE POSSIBILITIES

| Possibility | Check | Fix |
|------------|-------|-----|
| Database empty | `SELECT COUNT(*) FROM teams;` | Create test data |
| Database empty for all tables | Check all tables | Create test data for each |
| Backend not returning data | `curl http://localhost:3000/api/teams` | Check server/index.ts |
| Backend endpoint broken | Check HTTP status in curl | Verify GET handler exists |
| Frontend not calling API | Check browser console | Verify useInitializeData runs |
| API returns but not array | Check console `[API] Raw teams` | Check server returns valid JSON |
| Data transformed wrong | Check console `[API] Transformed teams` | Check transformation functions |
| Data in KV but not displayed | Check React DevTools state | Check component reads KV correctly |

---

## WHAT I FIXED (Previous session)

✅ Removed `.filter(t => t.isActive)` from components that hide data
✅ Enhanced data transformation to handle edge cases  
✅ Added better error handling in api.ts
✅ Added comprehensive logging

## NEW DIAGNOSTIC LOGGING ADDED

I've enhanced the API client to log errors. When you reload the app now, you should see:

**Good logs (data loading):**
```
[API] Raw teams from server: [...]
[API] Transformed teams: [...]
```

**Error logs (something wrong):**
```
[API] ERROR: teams is not an array: string
[API] Error fetching teams: TypeError: ...
```

---

## IMMEDIATE ACTION PLAN

### Step 1: Collect Information
```bash
# Run in 3 separate terminals

# Terminal 1
npm run dev

# Terminal 2  
curl http://localhost:3000/api/teams
curl http://localhost:3000/api/sites
curl http://localhost:3000/api/fields
curl http://localhost:3000/api/equipment
curl http://localhost:3000/api/events

# Terminal 3
# Open browser: http://localhost:5173
# Press F12 (Console tab)
# Reload (Ctrl+R)
# Copy everything in console
```

### Step 2: Check Database
```sql
-- Run in SQL tool (Azure Data Studio, etc.)
SELECT COUNT(*) as total FROM teams;
SELECT COUNT(*) as total FROM sites;
SELECT COUNT(*) as total FROM fields;
SELECT COUNT(*) as total FROM equipment;
SELECT COUNT(*) as total FROM events;
```

### Step 3: Report Findings
Share:
1. Output from Step 1 (curl results)
2. Database counts from Step 2
3. Console logs screenshot or copy/paste
4. Any error messages

---

## MOST LIKELY SCENARIOS

### Scenario A: Database is Empty
**Symptoms:**
- `curl` returns `[]`
- Database count queries return 0
- Console shows "Events: 0 records, Teams: 0 records, ..."

**Fix:**
Create test data using one of:
1. SQL INSERT statements
2. Create via UI (if persistence works)
3. Run database seed script if exists

---

### Scenario B: Backend Query Issue
**Symptoms:**
- `curl` returns error
- Backend logs show error
- `npm run dev` shows error

**Fix:**
1. Check server/index.ts GET endpoints
2. Look for WHERE clauses that might filter data
3. Check database connection string in .env

---

### Scenario C: Frontend Not Fetching
**Symptoms:**
- `curl` works and shows data
- Console shows NO [useInitializeData] logs
- Console shows NO [API] logs

**Fix:**
1. Verify useInitializeData hook is called in App.tsx
2. Check for React errors in console
3. Check Network tab for failed requests

---

### Scenario D: API Returns Wrong Format
**Symptoms:**
- `curl` works and shows data
- Console shows `[API] ERROR: teams is not an array`
- Console shows error message

**Fix:**
1. Check what backend is actually returning
2. Verify it's JSON array, not single object
3. Check server/index.ts returns `res.json(array)` not `res.json(object)`

---

## DEBUGGING FILE LOCATIONS

**For testing:**
- `FULL_DIAGNOSTIC.sh` - Run this script for diagnosis
- `DIAGNOSE_NOW.md` - Detailed troubleshooting steps

**Files that were modified:**
- `src/lib/api.ts` - Enhanced with error handling
- `src/components/Dashboard.tsx` - Removed isActive filter
- `src/components/EquipmentRequestDialog.tsx` - Removed isActive filter
- `src/components/FacilityRequestDialog.tsx` - Removed isActive filter
- `src/components/ScheduleView.tsx` - Removed isActive filters
- `src/lib/teamUtils.ts` - Removed isActive filter

---

## QUICK CHECKLIST

- [ ] Backend running: `npm run dev` shows "✓ Server running on port 3000"
- [ ] API responds: `curl http://localhost:3000/api/teams` shows records or []
- [ ] Database has records: `SELECT COUNT(*) FROM teams;` > 0
- [ ] Browser console shows [useInitializeData] logs
- [ ] Console shows record counts > 0
- [ ] No error messages in console
- [ ] Operations Office has data showing

---

## IF NOTHING IS WORKING

This likely means one of three things:

1. **Database connection issue**
   - Check .env file has correct DB credentials
   - Run: `curl http://localhost:3000/api/health`
   - Should return: `{"status":"ok","database":"connected"}`

2. **Backend not responding**
   - Check `npm run dev` is actually running
   - Look for errors in the terminal
   - Try `curl http://localhost:3000/api/health`

3. **Complete system failure**
   - Check for Node.js crashes
   - Check terminal for red error messages
   - Stop npm (Ctrl+C) and restart: `npm run dev`

---

## NEXT STEPS FOR YOU

**Priority 1 (Do immediately):**
1. Run the diagnostic script: `./FULL_DIAGNOSTIC.sh`
2. Test API with curl
3. Share the results

**Priority 2 (If that doesn't help):**
1. Check database directly
2. Check browser console logs
3. Describe exactly what you see

**Priority 3 (If still stuck):**
1. Check .env file database credentials
2. Try stopping and restarting backend
3. Check if database server is running

---

## KEY FILES TO CHECK

1. **Backend data return:** `server/index.ts` lines 70-90
   - Look for GET endpoints
   - Check for `res.json(result.recordset)`

2. **Frontend initialization:** `src/hooks/useInitializeData.ts`
   - Look for `api.getTeams()`, `api.getSites()`, etc.
   - Look for `setTeams(teamsData)`, `setSites(sitesData)`, etc.

3. **API transformation:** `src/lib/api.ts`
   - Look for `transformTeam()`, `transformSite()`, etc.
   - Check for error handling

4. **Component reading:** `src/components/Dashboard.tsx`
   - Look for `const [teams] = useKV('teams', [])`
   - Check if teams variable is used

---

## FINAL SUMMARY

**You need to diagnose:**
1. Is backend returning data? (curl test)
2. Is database populated? (SQL count)
3. Is frontend receiving data? (console logs)
4. Is data in KV store? (React DevTools)
5. Are components reading it? (UI showing data)

**Once you identify WHERE the data stops flowing, the fix is specific to that location.**

**I've added better logging to help identify exactly where it stops.**

---

## WHEN YOU HAVE INFO TO SHARE

Come back with:
1. `curl http://localhost:3000/api/teams` output
2. Browser console logs (copy/paste or screenshot)
3. Database record counts
4. Any error messages

This will tell me exactly where the problem is and I can fix it!

---

**The fact that EVERYTHING is empty suggests the problem is early in the pipeline (backend or frontend fetching). Let's find it!** 🔍
