# Data Loading Troubleshooting Guide

## Issues Fixed

I've made several improvements to fix data loading and persistence:

### 1. **Improved Data Initialization** (`src/hooks/useInitializeData.ts`)
   - Added detailed console logging to debug data fetching
   - Better error handling with `Promise.allSettled` instead of `Promise.all`
   - Now properly handles individual API failures without breaking others
   - Shows what data was loaded in console

### 2. **API Persistence for Teams** (`src/components/OperationsOffice/TeamsManager.tsx`)
   - **FIXED**: Team create/update/delete now actually calls the API
   - Previously only updated KV store locally (not persisted to database)
   - Now proper error handling and user feedback

### 3. **Better Error Visibility**
   - Added console logging throughout the initialization
   - Team operations now show toast errors to users
   - API errors are logged with context

## Diagnostic Steps

### Step 1: Check Browser Console
When you load the app, open DevTools (F12) and look for:
```
[useInitializeData] Starting data initialization...
[useInitializeData] Storing data: { events: X, teams: Y, sites: Z, ... }
✓ [useInitializeData] Application data initialized successfully
```

If you see errors instead, note them for Step 2.

### Step 2: Verify Backend Connection

Check if the server is running:
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{ "status": "ok", "database": "connected", "timestamp": "..." }
```

If not connected, check Step 3.

### Step 3: Check Environment Variables

The backend needs Azure SQL connection details. Create a `.env` file:
```env
DB_USER=your_username
DB_PASSWORD=your_password
DB_SERVER=your_server.database.windows.net
DB_NAME=your_database
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
```

Then restart the server.

### Step 4: Check Database

Verify tables exist and have data:
```sql
SELECT COUNT(*) as team_count FROM teams;
SELECT COUNT(*) as event_count FROM events;
SELECT COUNT(*) as site_count FROM sites;
```

If counts are 0, seed some test data.

### Step 5: Test API Endpoints Directly

```bash
# Test teams endpoint
curl http://localhost:3000/api/teams

# Test events endpoint
curl http://localhost:3000/api/events

# Test sites endpoint
curl http://localhost:3000/api/sites
```

## Common Issues & Solutions

### Issue: "Failed to load teams" in console
**Cause**: Backend not running or database not connected
**Solution**: Start server with proper .env file and check database connection

### Issue: Teams created locally but not in database
**Cause**: API calls failing silently (this is now fixed in TeamsManager)
**Solution**: Check browser console for error messages

### Issue: Dashboard/Office still shows no data
**Cause**: Database is empty or API returns empty arrays
**Solution**: 
1. Check database has data: `SELECT * FROM teams;`
2. Run API tests in Step 5
3. Check browser console logs for load messages

### Issue: CORS errors in console
**Cause**: Frontend and backend not talking properly
**Solution**: Ensure API_BASE_URL is correct (defaults to `/api`)

## Testing the Fix

1. Open browser DevTools (F12)
2. Go to Console tab
3. Reload the page
4. Look for initialization messages
5. If no teams appear:
   - Check if there's error output
   - Run manual API tests from Step 5
   - Verify .env file if running locally

## Next Steps to Complete

The following components also need API persistence fixes (similar to TeamsManager):
- `SitesManager.tsx` - create/update/delete sites
- `FieldsManager.tsx` - create/update/delete fields
- `EquipmentManager.tsx` - create/update/delete equipment

These follow the same pattern: add `api` calls to create/update/delete operations.
