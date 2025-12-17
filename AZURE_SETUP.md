# Azure App Service Configuration Guide

## Problem Identified

Your app is deployed to Azure App Service on Linux, but data isn't loading. The database has test data, so the problem is that **environment variables are not set in your Azure App Service**.

The Express server reads from these environment variables:
- `SQL_SERVER` - Your Azure SQL Server hostname (e.g., `myserver.database.windows.net`)
- `SQL_DATABASE` - Your database name (e.g., `QMT`)
- `SQL_USER` - Database username
- `SQL_PASSWORD` - Database password

## How to Fix

### Step 1: Get Your Database Credentials

In Azure Portal, go to **Azure SQL Database** and find:
- **Server name**: Something like `myserver.database.windows.net`
- **Database name**: The name you created
- **Admin login**: Your username
- **Password**: The password you set (if you don't know it, reset it in Portal)

### Step 2: Set Environment Variables in App Service

1. Open **Azure Portal** → **App Service** (your Linux app)
2. Click **Configuration** (left sidebar)
3. Click **+ New application setting** for each:

| Setting Name | Value | Example |
|---|---|---|
| `SQL_SERVER` | Your server name | `myserver.database.windows.net` |
| `SQL_DATABASE` | Your database name | `QMT` |
| `SQL_USER` | Your database login | `adminuser` |
| `SQL_PASSWORD` | Your database password | `P@ssw0rd123!` |
| `JWT_SECRET` | Any long random string (for security) | `your-super-secret-key-here-12345` |

**Example screenshot:**
```
Name: SQL_SERVER
Value: myserver.database.windows.net

Name: SQL_DATABASE  
Value: QMT

Name: SQL_USER
Value: adminuser

Name: SQL_PASSWORD
Value: P@ssw0rd123!
```

4. Click **Save** button at the top

### Step 3: Restart the App Service

After saving environment variables, you MUST restart:
1. Click **Overview** (left sidebar)
2. Click **Restart** button
3. Wait 30-60 seconds for app to restart

### Step 4: Verify It Works

1. Go to your app URL: `https://yourappname.azurewebsites.net`
2. In browser, open DevTools (F12) → Console tab
3. Reload the page
4. Look for these logs:
   - `[useInitializeData] 🚀 Starting data initialization...`
   - `Events: X records`
   - `Teams: X records`
   - `Sites: X records`
   - `Fields: X records`
   - `Equipment: X records`

5. If records show > 0, you're good!

### Alternative: Test Diagnostic Endpoint

You can also test directly:
```
https://yourappname.azurewebsites.net/api/diagnostic
```

This will show:
- Database connection status
- Record counts in each table
- Sample of first record from each table

## Troubleshooting

### "Invalid login" error
- **Problem**: Username/password is wrong
- **Fix**: Check Azure SQL credentials, reset password if needed

### "Cannot open database" error
- **Problem**: Database name is wrong
- **Fix**: Check exact database name in Azure Portal

### Still showing "0 records"
- **Problem**: Environment variables are set, but database is empty
- **Fix**: You mentioned you have test data - verify data exists with this query in Azure Data Studio:
```sql
SELECT COUNT(*) FROM teams;
SELECT COUNT(*) FROM sites;
SELECT COUNT(*) FROM fields;
SELECT COUNT(*) FROM equipment;
SELECT COUNT(*) FROM events;
```

### "Connection timeout" error
- **Problem**: Firewall blocking access
- **Fix**: In Azure SQL Server settings, check **Networking** → **Firewall rules**
  - Add rule for Azure services (if App Service in same region)
  - Or add your IP address range

## Where to Find Azure Credentials

**In Azure Portal:**

1. **SQL Server name:**
   - SQL Database → Overview → Server name

2. **Database name:**
   - SQL Database → Overview → Database name

3. **Login:**
   - SQL Server → Settings → Administrator login

4. **Password:**
   - If you forgot: SQL Server → Reset password

## Quick Checklist

- [ ] Found SQL_SERVER hostname
- [ ] Found SQL_DATABASE name
- [ ] Found SQL_USER login
- [ ] Found SQL_PASSWORD (or reset it)
- [ ] Set all 4 values in App Service Configuration
- [ ] Clicked Save
- [ ] Clicked Restart on App Service
- [ ] Waited 1-2 minutes for restart
- [ ] Loaded app URL and checked browser console
- [ ] See record counts > 0 ✓

## After Configuration Works

The app will now:
1. Load data from database on startup
2. Show teams in dropdowns
3. Show events in schedule
4. Display all sections in Operations Office
5. Allow creating/editing through the UI (persisted to database)

## Still Not Working?

Run the diagnostic in your browser:
```
https://yourappname.azurewebsites.net/api/diagnostic
```

Share the JSON response - it will show exactly what's wrong:
- If all tables show 0, database is empty
- If shows error, there's a connection issue
- If shows data, but UI is empty, frontend issue

---

**TL;DR:** Set `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` in App Service Configuration, click Save and Restart.
