# Data Loading Issue - Root Cause & Solution

## The Issue

Your app is deployed to Azure App Service, but no data is showing:
- Teams dropdown is empty
- Equipment dialog shows no teams
- Operations Office is completely empty (no schedule, requests, users, etc.)
- Yet: Database HAS test data in it ✓

## Root Cause Identified

**The Express server isn't connecting to the Azure SQL database.**

Why? The server reads database credentials from **environment variables**:
- `SQL_SERVER`
- `SQL_DATABASE` 
- `SQL_USER`
- `SQL_PASSWORD`

These variables are **not set in your Azure App Service Configuration**.

## Solution

### Quick Fix (5 minutes)

1. **Open Azure Portal** → Your App Service
2. Click **Configuration** (left sidebar)
3. Add these Application Settings:

```
SQL_SERVER       = yourserver.database.windows.net
SQL_DATABASE     = yourdbname
SQL_USER         = sqladmin
SQL_PASSWORD     = YourPassword123!
JWT_SECRET       = any-random-secure-string-here
```

4. Click **Save** button
5. Click **Restart** button (CRITICAL - app won't pick up vars until restart)
6. Wait 1-2 minutes for restart
7. Reload your app

### How to Find Your Azure SQL Details

In **Azure Portal**:
1. Go to **SQL Databases**
2. Click your database
3. Copy: **Server name** → This is `SQL_SERVER`
4. Copy: **Database name** → This is `SQL_DATABASE`
5. Go to **SQL Server** (not database) → **Administrator login** → This is `SQL_USER`
6. If you don't remember password, click **Reset password** to set a new one

## How It Works (After Fix)

```
User loads app
  ↓
Frontend calls /api/teams
  ↓
Express server reads environment variables
  ↓
Server connects to Azure SQL Database
  ↓
Fetches data from teams table
  ↓
Returns JSON array to frontend
  ↓
Frontend stores in KV store
  ↓
React components display data
  ↓
✅ App shows teams in dropdown, schedules, etc.
```

## Testing It Works

### Method 1: Check Console Logs

1. Open your app: `https://yourappname.azurewebsites.net`
2. Press F12 (DevTools)
3. Go to **Console** tab
4. Reload page
5. Look for: `[useInitializeData] 🚀 Starting data initialization...`
6. Then: `Teams: 5 records` (or however many)

If you see **record counts > 0** → ✅ It works!

### Method 2: Test Diagnostic Endpoint

Visit: `https://yourappname.azurewebsites.net/api/diagnostic`

Should return JSON like:
```json
{
  "database": {
    "teams": 5,
    "sites": 2,
    "fields": 4,
    "equipment": 1,
    "events": 3
  },
  "data": { ... sample data ... }
}
```

If **all numbers > 0** → ✅ It works!

## Troubleshooting

| Problem | Check | Fix |
|---------|-------|-----|
| App still shows no data | Visit `/api/diagnostic` | See what it says |
| Error: "Invalid login" | Check SQL_USER and SQL_PASSWORD | Verify credentials match |
| Error: "Cannot open database" | Check SQL_DATABASE name | Must be exact name |
| Error: "Cannot open server" | Check SQL_SERVER value | Should end with `.database.windows.net` |
| Still no data after restart | Is database really populated? | Run: `SELECT COUNT(*) FROM teams;` in SQL tool |

## After Configuration Works

The app will:
1. ✅ Load all data on startup
2. ✅ Show teams in dropdowns
3. ✅ Show schedule/events
4. ✅ Display operations sections
5. ✅ Allow creating/editing through UI (saved to database)
6. ✅ Persist data across refreshes

## What Was Added/Fixed

**Backend Enhancements:**
- Added `/api/diagnostic` endpoint for troubleshooting
- Added better logging when database credentials are missing
- Enhanced error messages to identify exact problem

**Frontend:**
- Already had comprehensive logging
- Already fetching from `/api/*` endpoints
- Already storing in KV store correctly

**Code Changes Made:**
- `server.js`: Added diagnostic endpoint and improved error logging
- Created `AZURE_SETUP.md`: Full setup guide
- Created `AZURE_DEPLOYMENT_QUICK_FIX.md`: Troubleshooting guide

## Next Steps

1. **Gather your Azure SQL credentials** (5 min)
2. **Set environment variables in App Service Configuration** (2 min)
3. **Restart your App Service** (2 min)
4. **Reload your app and verify** (1 min)

**Total time: ~10 minutes**

---

## Contact Support

If you get stuck:
1. Visit `/api/diagnostic` endpoint
2. Copy the JSON response
3. Check error messages
4. Return error text if you need help

The `/api/diagnostic` endpoint will tell you exactly what's wrong with the configuration.

---

**Key Point:** The database connection works fine in development. The issue is that environment variables aren't set in the Azure deployment. Setting them will fix everything.

