# Summary: Why Data Isn't Loading & How to Fix It

## The Problem

Your app is deployed to Azure App Service. The database has test data. But the app shows nothing:
- ❌ Teams dropdown empty
- ❌ Equipment dialog shows no teams
- ❌ Operations Office blank
- ❌ No schedules, events, or users visible

## The Root Cause

The Express server **cannot connect to the Azure SQL Database** because:

**Environment variables are not configured in your App Service**

The server needs these environment variables to connect:
```
SQL_SERVER = your-sql-server.database.windows.net
SQL_DATABASE = database-name
SQL_USER = username
SQL_PASSWORD = password
```

Without these, the server tries to connect with `undefined` credentials → connection fails → API returns empty data → frontend displays nothing.

## The Solution

Set 5 environment variables in Azure App Service Configuration:

1. `SQL_SERVER` - Your SQL server hostname
2. `SQL_DATABASE` - Your database name
3. `SQL_USER` - Database admin username
4. `SQL_PASSWORD` - Database admin password
5. `JWT_SECRET` - Random string for authentication

**Then restart the app.**

That's it. Your app will then:
1. ✅ Connect to the database
2. ✅ Fetch all data
3. ✅ Display in UI
4. ✅ Allow create/edit/delete operations

## How to Do It (Step-by-Step)

### Step 1: Find Your Database Credentials (2 minutes)

**In Azure Portal:**

1. Search: "SQL databases"
2. Click your database
3. Note these values:
   - **SQL_SERVER**: Server name (ends with `.database.windows.net`)
   - **SQL_DATABASE**: Database name

4. Click on the SQL Server (not database)
5. Note:
   - **SQL_USER**: Admin login name
   - **SQL_PASSWORD**: If you don't remember, reset it here

Example values:
```
SQL_SERVER = mycompany.database.windows.net
SQL_DATABASE = QMT
SQL_USER = sqlAdmin
SQL_PASSWORD = MySecurePassword123!
```

### Step 2: Set Environment Variables in App Service (3 minutes)

1. Azure Portal → App Services → Your app
2. Left sidebar → Click **Configuration**
3. Click **+ New application setting** for each:

| Name | Value |
|------|-------|
| SQL_SERVER | your value here |
| SQL_DATABASE | your value here |
| SQL_USER | your value here |
| SQL_PASSWORD | your value here |
| JWT_SECRET | any-random-secure-string |

**Important**: Each field name must match exactly (case sensitive)

4. Click **Save** button (top)

### Step 3: Restart the App Service (2 minutes)

1. Click **Overview** (left sidebar)
2. Click **Restart** button
3. Wait 1-2 minutes for restart

### Step 4: Verify It Works (1 minute)

1. Open your app: `https://yourappname.azurewebsites.net`
2. Press **F12** (DevTools)
3. Go to **Console** tab
4. Reload the page (Ctrl+R)
5. Look for logs like:
   ```
   [useInitializeData] 🚀 Starting data initialization...
   Events: 5 records
   Teams: 3 records
   Sites: 2 records
   Fields: 4 records
   Equipment: 1 records
   ✅ Application data initialized successfully!
   ```

If you see **record counts > 0** → ✅ **IT'S WORKING!**

## If Still Not Working

### Diagnostic Endpoint

Visit: `https://yourappname.azurewebsites.net/api/diagnostic`

This shows exactly what's happening:
- Can it connect to database?
- How many records in each table?
- Any errors?

### Common Issues

| Issue | Check | Fix |
|-------|-------|-----|
| Returns empty array | Is database populated? | Verify data exists in SQL |
| Error: Invalid login | Are SQL_USER and SQL_PASSWORD correct? | Reset password in Portal |
| Error: Cannot open database | Is SQL_DATABASE name correct? | Copy exact name from Portal |
| Error: Cannot open server | Is SQL_SERVER format correct? | Should end with `.database.windows.net` |
| App still loading after restart | Did you restart the app? | Click Restart button in Overview |

### Still Stuck?

1. Go to `/api/diagnostic`
2. Look at error message
3. Fix what it says
4. Restart app
5. Try again

## What Changed in the Code

**Backend (server.js):**
- Added `/api/diagnostic` endpoint for troubleshooting
- Added logging to show when credentials are missing
- Added error details to help identify problems

**Frontend:**
- No changes needed (already fetching correctly)
- Already has comprehensive logging
- Already storing data correctly

**Documentation:**
- Created setup guides for Azure deployment
- Created troubleshooting guides

## Architecture After Fix

```
User opens app
   ↓
React app loads
   ↓
useInitializeData hook runs
   ↓
Makes API calls: /api/teams, /api/sites, /api/fields, /api/equipment, /api/events
   ↓
Express server receives request
   ↓
Server uses environment variables to connect to Azure SQL:
   - SQL_SERVER: Connection host
   - SQL_DATABASE: Select database
   - SQL_USER: Authenticate user
   - SQL_PASSWORD: Authenticate password
   ↓
Server queries database: SELECT * FROM teams
   ↓
Server returns JSON array to frontend
   ↓
Frontend stores in KV store
   ↓
React components render data
   ↓
✅ User sees teams in dropdown, schedule view, etc.
```

## Deployment Checklist

- [ ] Get Azure SQL credentials from Portal
- [ ] Open App Service Configuration
- [ ] Add 5 environment variables (SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD, JWT_SECRET)
- [ ] Click Save
- [ ] Restart App Service
- [ ] Wait 1-2 minutes
- [ ] Open app and check console for record counts
- [ ] See data loading ✅

**Total time: ~10 minutes**

## Why This Works

The code was already correct:
- ✅ Backend has GET endpoints for all data
- ✅ Frontend has initialization hook
- ✅ Components fetch and display correctly
- ✅ Database has test data

The ONLY missing piece was:
- ❌ Environment variables weren't set

Setting them connects everything together and data flows from database → API → frontend → UI.

## Next Steps

1. **Right now**: Gather Azure SQL credentials from Portal
2. **Next**: Set 5 environment variables in App Service Configuration
3. **Then**: Restart the app
4. **Finally**: Verify data loads by checking browser console

That's it! 🚀

---

## Additional Resources

- `AZURE_SETUP.md` - Detailed setup guide
- `AZURE_DEPLOYMENT_QUICK_FIX.md` - Troubleshooting reference
- `AZURE_ENVIRONMENT_SETUP.md` - Visual configuration guide
- `DATA_LOADING_FIX.md` - Technical explanation

For questions, visit `/api/diagnostic` endpoint to see the exact error.
