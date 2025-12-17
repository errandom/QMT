# Quick Diagnostic Checklist for Azure Deployment

## Is Your Data Loading?

### Quick Test (2 minutes)

1. Open your app: `https://yourappname.azurewebsites.net`
2. Press F12 (browser DevTools)
3. Go to **Console** tab
4. Reload the page (Ctrl+R / Cmd+R)
5. Look for this line:
   ```
   [useInitializeData] 🚀 Starting data initialization...
   ```
   And then:
   ```
   Events: 5 records (or however many)
   Teams: 3 records
   Sites: 2 records
   Fields: 4 records
   Equipment: 1 records
   ```

**If you see record counts > 0 → ✅ WORKING**

**If you see record counts = 0 → Go to section below**

---

## Why Is Data Not Loading?

### Scenario 1: Zero Records Everywhere

**Console shows:**
```
Events: 0 records
Teams: 0 records
Sites: 0 records
Fields: 0 records
Equipment: 0 records
```

**Causes:**
1. ❌ Database is empty (no test data)
2. ❌ Connection is working but tables are empty
3. ❌ Wrong database selected

**Verify:** Access Azure SQL directly and run:
```sql
SELECT COUNT(*) FROM teams;
```

If result is 0, your test data wasn't created. If > 0, go to Scenario 2.

---

### Scenario 2: Database Has Data but Console Shows Error

**Console shows:**
```
[useInitializeData] ⚠️ Failed to initialize data
[API] Error fetching teams: TypeError: ...
```

Or browser Network tab shows:
```
/api/teams → 500 Internal Server Error
```

**Causes:**
1. ❌ SQL credentials not set in App Service
2. ❌ Wrong credentials in App Service
3. ❌ Firewall blocking connection
4. ❌ Database server connection string is wrong

**Fix Steps:**
1. Check Application Settings in your App Service:
   - SQL_SERVER
   - SQL_DATABASE
   - SQL_USER
   - SQL_PASSWORD
   
   All should be filled in. If empty → **SET THEM** (see AZURE_SETUP.md)

2. If settings exist, verify they're correct:
   - SQL_SERVER should end with `.database.windows.net`
   - SQL_USER format: `username` or `username@servername`
   - SQL_PASSWORD should be the actual password you use to login

3. After verifying settings, **RESTART** the App Service (Critical!)

---

### Scenario 3: Console Shows Error "Cannot open server" or "Login failed"

**Possible causes:**
1. Wrong SQL_USER format
2. Wrong SQL_PASSWORD
3. Server doesn't exist
4. User doesn't have permissions

**How to fix:**
- Try logging into Azure Data Studio manually with the same credentials
- If that fails, you found the bad credential
- Go to Azure Portal → SQL Database → Reset password (if forgot password)
- Get exact credentials and try again

---

### Scenario 4: No Console Logs at All

**The [useInitializeData] logs don't appear at all**

**Possible causes:**
1. App crashed on startup (React error)
2. App loaded from cache (try hard refresh: Ctrl+Shift+R)
3. Different issue entirely

**Fix:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Check for red errors in Console
3. Check Network tab - is /api/teams call being made?

---

## Testing Step-by-Step

### Test 1: Backend is responding

```
https://yourappname.azurewebsites.net/api/health
```

Expected: `{"ok":true,"uptime":123,"ts":"2025-12-17..."}`

If 404 or doesn't load → backend issue

### Test 2: Database connection works

```
https://yourappname.azurewebsites.net/api/db-check
```

Expected: `{"ok":true}`

If error → database connection issue (check credentials)

### Test 3: See actual database data

```
https://yourappname.azurewebsites.net/api/diagnostic
```

Expected: Full JSON with:
```json
{
  "database": {
    "teams": 5,
    "sites": 2,
    "fields": 4,
    "equipment": 1,
    "events": 3
  },
  "data": { ... }
}
```

Numbers > 0 = data in database
Error message = connection problem
All 0 = database empty

---

## Most Likely Issue (99% probability)

**Environment variables not set or wrong values**

**Symptoms:**
- App loads but shows no data
- Console has no errors
- But API calls return empty

**Solution:**
1. Azure Portal → App Service → Configuration
2. Check these are set:
   - `SQL_SERVER`
   - `SQL_DATABASE`
   - `SQL_USER`
   - `SQL_PASSWORD`
3. If any are empty → SET THEM
4. If wrong values → FIX THEM
5. Click **Save**
6. Click **Restart** (MUST DO THIS!)
7. Wait 2 minutes
8. Test again

---

## After Fix Verification

Once you fix the issue, verify with this quick test:

```bash
# Test 1: In browser, go to:
https://yourappname.azurewebsites.net/api/diagnostic

# Look for counts like:
# "teams": 3,
# "sites": 2,
# etc.

# Test 2: In app, click on Dashboard
# Teams dropdown should populate with team names

# Test 3: Check Operations Office
# All sections (Teams, Sites, Fields, Equipment, Events) should show data
```

**If all three pass → ✅ DEPLOYMENT COMPLETE**

---

## Emergency Restart

If something goes wrong, restart the app:

1. Azure Portal → App Service → Overview
2. Click **Restart** button
3. Wait 1-2 minutes
4. Reload app URL

---

## Getting Help

If you're stuck:

1. Go to `/api/diagnostic` in your app
2. Copy the full JSON response
3. Check if any values are `ERROR:`
4. That tells you exactly what's failing

Example response that indicates problem:
```json
{
  "database": {
    "teams": "ERROR: Login failed for user 'baduser'"
  }
}
```

This tells you: **SQL_USER is wrong**

---

## Summary

| Issue | Check | Fix |
|-------|-------|-----|
| All records 0 | Is database empty? | Add test data to SQL |
| Error in console | Check /api/diagnostic | Usually credentials |
| Blank console | Hard refresh, check errors | Reload or restart app |
| Error message | Read error text | Fix what it says |
| Still stuck | Visit /api/diagnostic | See exact error |

**Remember: After changing any Application Setting, you MUST RESTART the app!**
