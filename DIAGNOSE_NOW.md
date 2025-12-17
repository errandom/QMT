# 🚨 Data Loading Troubleshooting - Complete Diagnosis

## Symptoms Reported
1. Request Facility button doesn't open dialog
2. Teams dropdown shows no teams
3. Equipment dialog teams not loading
4. Operations Office completely empty (no schedule, requests, teams, equipment, fields, sites, users)

## Critical Question: Is ANY data showing anywhere?

If ALL UI sections are empty, the issue is one of:
1. **Backend not returning data** (API returns empty array)
2. **Frontend not fetching data** (API calls not made or failing)
3. **Data not stored in KV** (setTeams, setSites, etc. not working)
4. **Components not reading from KV** (useKV not getting the data)

## Diagnostic Steps (IN ORDER)

### Step 1: Check Backend Data (CRITICAL)
```bash
# Terminal: Test if backend API is returning data
curl http://localhost:3000/api/teams

# Expected: JSON array with team objects
# [{"id": 1, "name": "Team A", "sport": "Tackle Football", ...}]

# If you get: []
# Problem: Database empty OR query not working

# If you get: error or no response
# Problem: Backend not running OR not responding
```

**Result:** ✅ PASS / ❌ FAIL
- Record count: _____

---

### Step 2: Check Browser Console (CRITICAL)
```
1. Open app in browser: http://localhost:5173
2. Press F12 (DevTools)
3. Go to Console tab
4. Reload page (Ctrl+R)
5. Look for logs starting with [useInitializeData]
```

**Expected to see:**
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
💾 [useInitializeData] Storing data into KV store...
   Setting events: X items
   Setting teams: X items
   Setting sites: X items
   Setting fields: X items
   Setting equipment: X items
========================================
✅ [useInitializeData] Application data initialized successfully!
```

**What you're seeing:**
- [ ] See logs above ✅
- [ ] See 0 records ❌
- [ ] See error messages ❌
- [ ] See nothing at all ❌

**Copy console output here:**
```

```

---

### Step 3: Check Network Tab (CRITICAL)
```
1. DevTools (F12) → Network tab
2. Reload page
3. Look for requests: teams, sites, fields, equipment, events
4. Click on "teams" request
5. Go to Response tab
```

**Expected to see:**
- Status: 200 (not 404 or 500)
- Response: JSON array with records

**What you're seeing:**
- Status code: _____
- Response: _____

---

### Step 4: Check If Dialog Opens (Simple UI Test)
```
1. Open app
2. Click "Request Facility" button
3. Does dialog appear?
```

- [ ] Dialog appears ✅
- [ ] Nothing happens ❌

---

### Step 5: Check React Component State (TECHNICAL)
```
1. DevTools (F12)
2. Install "React DevTools" extension if not already
3. Find "Dashboard" component
4. Check its state:
   - teams = [] or teams = [object, object, ...]?
   - showFacilityDialog = true or false?
```

**Teams in state:**
- [ ] Empty array [] ❌
- [ ] Has objects [object, object] ✅
- [ ] Undefined ❌

---

## Diagnosis Matrix

| Symptom | Cause | Fix |
|---------|-------|-----|
| Step 1 shows empty [] | Database has no records | Create test data with INSERT or create via UI |
| Step 1 shows empty [] | Query filtered data out | Check server/index.ts for WHERE clauses |
| Step 1 shows error | Backend down | Run `npm run dev` |
| Step 2 console empty | useInitializeData not running | Check App.tsx line with `useInitializeData()` |
| Step 2 shows 0 records | API returned empty | Check Step 1 result |
| Step 2 shows error | API call failed | Check Network tab (Step 3) for error details |
| Step 3 shows empty Response | Backend query returned nothing | Same as Step 1 - database or query issue |
| Step 3 shows error Status | Backend endpoint broken | Check server/index.ts GET handlers |
| Step 4 dialog won't open | React issue or data issue | Check console for errors |
| Step 5 teams = [] | Data not in KV store | Check Steps 1-3 |

---

## Quick Fixes Based on Diagnosis

### If Step 1 fails (No data from API):

**Check database directly:**
```sql
SELECT COUNT(*) FROM teams;
SELECT COUNT(*) FROM sites;
SELECT COUNT(*) FROM fields;
SELECT COUNT(*) FROM equipment;
SELECT COUNT(*) FROM events;
```

- If all return 0: **Database empty - create test data**
- If any return > 0: **Query issue in server/index.ts - check WHERE clauses**

### If Step 2 fails (No logs in console):

**Check if hook is running:**
1. Add this to browser console:
```javascript
// Check if localStorage has any Spark data
Object.keys(window.localStorage).forEach(key => {
  if (key.includes('spark')) {
    console.log('Found:', key, JSON.parse(window.localStorage[key]))
  }
})
```

2. If nothing found: Hook not running or KV not using localStorage
3. If data found: Data IS loading, component just not reading it

### If Step 2 shows error (API call failed):

**Check error details:**
- Look at which API call failed (Teams, Sites, Fields, etc.)
- Check Network tab for that specific request
- Look at Response tab for error message

**Common errors:**
- 404: Endpoint doesn't exist - check server/index.ts
- 500: Database error - check server logs
- Network error: Backend not running - run `npm run dev`

### If Step 3 works but Step 2 console empty:

**Problem: Frontend not receiving data**

Check:
1. Are transformation functions being called? (Look for "[API] Raw teams" logs)
2. Are they returning data? (Look for "[API] Transformed teams" logs)
3. Is setTeams being called? (Look for "Setting teams:" logs)

If none of these logs appear:
- Hook might not be running
- API calls might be failing silently
- Check for JavaScript errors in console

### If Step 4 dialog won't open:

**Check for errors:**
- Look for any JavaScript errors in console
- Try clicking button and check console
- Look for any error boundary messages

**If no errors:**
- Component might be working but data issue hiding it
- Check React DevTools to see if state is updating

---

## Next Action Items

**Please provide the output/results from:**
1. Step 1 result: Does `curl http://localhost:3000/api/teams` show records? YES/NO
2. Step 2 result: Copy/paste what's in the browser console
3. Step 3 result: What's the Status code and Response?
4. Step 4 result: Does dialog open? YES/NO

**This information will help identify:**
- [ ] Backend data availability (Step 1)
- [ ] Frontend receiving data (Step 3)
- [ ] Data being stored (Step 2)
- [ ] Data being displayed (Step 4)

---

## My Hypothesis

Based on ALL sections being empty, I suspect:

**Most likely:** Backend not returning data (API returns [])
**Less likely:** Frontend not fetching (but other things would break)
**Unlikely:** KV store issue (would see some data)

**To confirm:** Run Step 1 and share the result of:
```bash
curl http://localhost:3000/api/teams
```

If this is empty, focus on database and backend query.
If this has data, focus on browser console logs and frontend KV store.

---

## Commands to Run Right Now

```bash
# Terminal 1: Make sure backend is running
npm run dev

# Terminal 2: Test API
echo "=== Testing API ==="
curl http://localhost:3000/api/teams
curl http://localhost:3000/api/sites
curl http://localhost:3000/api/fields
curl http://localhost:3000/api/equipment
curl http://localhost:3000/api/events

# Terminal 3: Check database
# Open your SQL tool and run:
# SELECT COUNT(*) as teams FROM teams;
# SELECT COUNT(*) as sites FROM sites;
# SELECT COUNT(*) as fields FROM fields;
# SELECT COUNT(*) as equipment FROM equipment;
# SELECT COUNT(*) as events FROM events;
```

After running these, share:
1. What did the curl commands show?
2. What do the SQL counts show?
3. What's in the browser console?
