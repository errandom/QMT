# ⚡ QUICK ACTION SUMMARY

## The Problem
Your Azure App Service app isn't connecting to the SQL database, so no data displays.

## The Fix (10 minutes)

### Get Credentials (2 min)
1. Azure Portal → SQL Database
2. Note: Server name, Database name
3. Go to SQL Server → Note: Admin login
4. Reset password if needed

### Set Environment Variables (3 min)
1. App Service → Configuration
2. Click "+ New application setting" for each:
   - SQL_SERVER = `server.database.windows.net`
   - SQL_DATABASE = `database-name`
   - SQL_USER = `admin-user`
   - SQL_PASSWORD = `password`
   - JWT_SECRET = `any-secure-string`
3. Click **Save**

### Restart App (2 min)
1. Click **Overview**
2. Click **Restart**
3. Wait 1-2 minutes

### Verify (1 min)
1. Open app
2. Press F12 → Console tab
3. Reload
4. Look for: "Teams: X records" (where X > 0)
5. ✅ Done!

## If Not Working
Visit: `https://yourappname.azurewebsites.net/api/diagnostic`

Shows exactly what's wrong.

## Documentation Files
- `README_DATA_LOADING.md` - Full explanation
- `AZURE_SETUP.md` - Detailed setup
- `AZURE_DEPLOYMENT_QUICK_FIX.md` - Troubleshooting
- `AZURE_ENVIRONMENT_SETUP.md` - Visual guide

---

**That's it. Set 5 variables → Save → Restart → Done!** 🚀
