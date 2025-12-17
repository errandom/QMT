# Data Reading Issue - Targeted Diagnostic

## What We Know ✓
- ✅ Database connection works (you can write data)
- ✅ Test data exists in database
- ✅ Data is not filtered by `active` status
- ❌ Data doesn't load when app opens

## Where's The Problem?

The issue is in the **READ path**, not the connection. Let's find where:

```
Database (has data)
       ↓ ❓ [PROBLEM IS HERE]
GET /api/teams endpoint
       ↓
Frontend receives response
       ↓
Stored in KV store
       ↓
Components display it
```

## Diagnostic Steps (Run These)

### Step 1: Check Network Traffic

1. Open app: `https://yourappname.azurewebsites.net`
2. Press F12 (DevTools)
3. Go to **Network** tab
4. Reload page (Ctrl+R)
5. Look for these requests:
   - `/api/teams`
   - `/api/sites`
   - `/api/fields`
   - `/api/equipment`
   - `/api/events`

**What to check:**
- Are these requests being made? (Yes/No)
- What's the HTTP status? (200 / 404 / 500)
- What's in the Response? (Click on request → Response tab)

### Step 2: Check Console Logs

1. In **Console** tab (F12)
2. Reload page
3. Look for: `[API] Raw teams from server:`

**Expected to see:**
```
[API] Raw teams from server: [
  {id: 1, name: "Team A", ...},
  {id: 2, name: "Team B", ...}
]
```

**If you see:**
- `[API] Raw teams from server: []` → API returns empty
- `[API] ERROR: teams is not an array:` → API returns wrong format
- Nothing → API not being called

### Step 3: Test GET Endpoints Directly

Visit these URLs in browser:
```
https://yourappname.azurewebsites.net/api/teams
https://yourappname.azurewebsites.net/api/sites
https://yourappname.azurewebsites.net/api/fields
https://yourappname.azurewebsites.net/api/equipment
https://yourappname.azurewebsites.net/api/events
```

Each should return a JSON array like:
```json
[
  {"id": 1, "name": "Team A", "sport": "Football", ...},
  {"id": 2, "name": "Team B", "sport": "Basketball", ...}
]
```

**If you see:**
- `[]` (empty array) → Database query returns nothing
- `{"error": "..."}` → Error in backend
- HTML page → endpoint not found (404)

---

## Most Likely Issues

### Issue A: GET Endpoints Return Empty Array `[]`

**Symptoms:**
- `/api/teams` returns `[]`
- But database has records
- Data can be written successfully

**Cause:** SQL query in GET endpoint might be wrong or using a WHERE clause

**Check:** Look at [server.js GET endpoints](server.js#L172-L180)

The query should be:
```sql
SELECT * FROM teams ORDER BY name
```

**NOT:**
```sql
SELECT * FROM teams WHERE active = 1 ORDER BY name
```

### Issue B: GET Endpoints Not Being Called

**Symptoms:**
- Network tab shows NO /api/teams request
- Console shows NO `[API]` logs
- But app loads without errors

**Cause:** `useInitializeData` hook not running

**Check:** Look at [src/hooks/useInitializeData.ts](src/hooks/useInitializeData.ts)

Should see `[useInitializeData] 🚀 Starting data initialization...` in console

**Fix if missing:** Verify hook is called in `App.tsx`

### Issue C: API Returns Data But Wrong Format

**Symptoms:**
- `/api/teams` returns something
- But console shows `[API] ERROR: teams is not an array:`
- Network response is object not array

**Cause:** Backend returns single object instead of array

**Example wrong response:**
```json
{"id": 1, "name": "Team A"}  // ❌ Single object
```

**Should be:**
```json
[{"id": 1, "name": "Team A"}]  // ✅ Array
```

---

## What To Report

After running diagnostics, tell me:

1. **Network Tab:** Do GET requests appear? What's the status code?
2. **GET /api/teams response:** What exactly do you see? (paste the JSON)
3. **Console logs:** What [API] messages appear? (exact text)
4. **Are records in database?** (You said yes, but verify one more time)

---

## Quick Diagnostic Script

Paste this in browser console (F12 → Console tab):

```javascript
// Test if API is accessible
async function testAPI() {
  console.log('🧪 Testing API endpoints...\n');
  
  const endpoints = [
    '/api/teams',
    '/api/sites', 
    '/api/fields',
    '/api/equipment',
    '/api/events'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      console.log(`✓ ${endpoint}:`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Records: ${Array.isArray(data) ? data.length : 'NOT AN ARRAY'}`);
      console.log(`  Data:`, data.slice(0, 1)); // First record only
    } catch (err) {
      console.error(`✗ ${endpoint}: ${err.message}`);
    }
  }
}

testAPI();
```

Run this and paste the output.

---

## My Hypothesis

Since you can WRITE but can't READ, I suspect:

**Most likely:** GET endpoints have a `WHERE` clause or condition that filters out records

**Example problem in server.js:**
```javascript
// ❌ WRONG - returns empty
app.get('/api/teams', async (req, res) => {
  const result = await pool.request()
    .query('SELECT * FROM teams WHERE active = 1'); // ← This filter!
  res.json(result.recordset);
});
```

**Should be:**
```javascript
// ✅ RIGHT - returns all records
app.get('/api/teams', async (req, res) => {
  const result = await pool.request()
    .query('SELECT * FROM teams'); // ← No filter
  res.json(result.recordset);
});
```

Let me check this...
