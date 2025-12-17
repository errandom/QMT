# Environment Variables Configuration - Visual Guide

## Where to Set Them in Azure Portal

```
┌─ Azure Portal ─────────────────────────────────────────┐
│                                                         │
│  Search: "App Services"                                │
│  Select: Your App Service Name                         │
│                                                         │
│  ┌─ Left Menu ──────────────┐                          │
│  │ Overview                 │  ← You are here          │
│  │ Deployment               │                          │
│  │ Configuration ◄── CLICK! │                          │
│  │ General settings         │                          │
│  └──────────────────────────┘                          │
│                                                         │
│  ┌─ Configuration Panel ──────────────────────────────┐│
│  │ Application settings                               ││
│  │  ┌────────────────────────────────────────────────┐││
│  │  │ + New application setting                      │││
│  │  └────────────────────────────────────────────────┘││
│  │                                                    ││
│  │  Name          | Value                             ││
│  │  ─────────────────────────────────────────────────││
│  │  SQL_SERVER    | myserver.database.windows.net    ││
│  │  SQL_DATABASE  | QMT                              ││
│  │  SQL_USER      | adminuser                        ││
│  │  SQL_PASSWORD  | P@ssw0rd123!                     ││
│  │  JWT_SECRET    | your-secret-key-12345           ││
│  │                                                    ││
│  │  [Save] ◄── CLICK SAVE                            ││
│  │                                                    ││
│  └────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ After Saving ─────────────────────────────────────┐│
│  │ ⚠️  IMPORTANT: Application needs to be restarted   ││
│  │                                                    ││
│  │ Go to: Overview (top left)                        ││
│  │ Click: [Restart] button                           ││
│  │ Wait: 1-2 minutes                                 ││
│  └────────────────────────────────────────────────────┘│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## What Each Variable Does

```
SQL_SERVER
├─ What: Azure SQL server hostname
├─ Example: myserver.database.windows.net
├─ Find in: SQL Database → Overview → Server name
└─ Must: End with ".database.windows.net"

SQL_DATABASE  
├─ What: Database name to connect to
├─ Example: QMT
├─ Find in: SQL Database → Overview → Database name
└─ Must: Match exact database name

SQL_USER
├─ What: Database admin username
├─ Example: sqladmin  OR  sqladmin@myserver
├─ Find in: SQL Server → Admin login
└─ Note: Sometimes format is "user@server"

SQL_PASSWORD
├─ What: Password for the SQL user
├─ Find in: If forgotten, reset it in Portal
├─ Must: Be exactly correct (case sensitive!)
└─ Security: Change this after initial setup

JWT_SECRET
├─ What: Secret key for authentication tokens
├─ Example: any-random-long-string-here
├─ Can: Be any secure random string
└─ Must: Be set to something
```

## Finding Your SQL Credentials

### Step 1: Open Azure Portal

```
https://portal.azure.com
→ Search: "SQL databases"
→ Click your database name
```

### Step 2: Get Server Name

```
┌─ SQL Database Details ─────────────┐
│                                    │
│ Resource group: myresourcegroup    │
│ Status: Online                     │
│ Server name: myserver.database.windows.net ← COPY THIS
│ Database name: QMT                 │
│                                    │
└────────────────────────────────────┘
```

### Step 3: Get Admin Login

```
Go to: SQL Servers (not database)
       ↓
┌─ SQL Server Details ──────────────┐
│                                   │
│ Server name: myserver             │
│ Admin login: sqladmin             │ ← COPY THIS
│ Location: East US                 │
│                                   │
└───────────────────────────────────┘
```

### Step 4: Get Password

```
If you know the password:
  → Use it as SQL_PASSWORD

If you forgot:
  → SQL Server → Reset password
  → Set new password
  → Use new password as SQL_PASSWORD
```

## Data Flow After Configuration

```
Your App (Azure App Service)
│
├─ Startup
│  └─ Reads environment variables
│     ├─ SQL_SERVER = myserver.database.windows.net
│     ├─ SQL_DATABASE = QMT
│     ├─ SQL_USER = sqladmin
│     └─ SQL_PASSWORD = password
│
├─ Frontend Loads
│  └─ React app starts
│     └─ Calls useInitializeData hook
│
├─ API Requests
│  ├─ GET /api/teams
│  ├─ GET /api/sites
│  ├─ GET /api/fields
│  ├─ GET /api/equipment
│  └─ GET /api/events
│
├─ Express Server
│  └─ For each request:
│     ├─ Uses SQL_SERVER to connect to database
│     ├─ Selects SQL_DATABASE
│     ├─ Authenticates with SQL_USER + SQL_PASSWORD
│     ├─ Queries table (e.g., SELECT * FROM teams)
│     └─ Returns JSON array to frontend
│
└─ Frontend Display
   ├─ Stores data in KV store
   ├─ React renders components
   └─ ✅ Show teams, sites, events, etc.
```

## Configuration Validation

After setting environment variables, validate:

```
✓ Check 1: Are all 4 variables set?
  └─ SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD

✓ Check 2: Are values correct?
  └─ Run locally with same values and verify connection works

✓ Check 3: Did you RESTART the app?
  └─ App won't read new variables until restart

✓ Check 4: Did restart complete?
  └─ Wait 1-2 minutes, check app loads

✓ Check 5: Does app show data?
  └─ Open console, check for record counts
```

## Common Mistakes

```
❌ MISTAKE 1: Setting variables but not restarting
   └─ FIX: Click Restart button in App Service Overview

❌ MISTAKE 2: Using wrong format for SQL_USER
   └─ Try: user@servername  OR  just username
   └─ FIX: Test in SQL Management Studio first

❌ MISTAKE 3: Copied password wrong (spaces, typos)
   └─ FIX: Reset password in Portal, copy again carefully

❌ MISTAKE 4: Database name is wrong
   └─ FIX: Check exact name in Azure Portal, copy exactly

❌ MISTAKE 5: Server name is wrong
   └─ FIX: Must include .database.windows.net
```

## Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│ AZURE APP SERVICE CONFIGURATION CHECKLIST       │
├─────────────────────────────────────────────────┤
│                                                 │
│ □ Azure Portal → App Service → Configuration   │
│                                                 │
│ □ Click: + New application setting              │
│                                                 │
│ □ Add SQL_SERVER = ___________________         │
│   (from SQL Database → Overview → Server name) │
│                                                 │
│ □ Add SQL_DATABASE = ___________________       │
│   (from SQL Database → Overview → Database)    │
│                                                 │
│ □ Add SQL_USER = ___________________           │
│   (from SQL Server → Admin login)              │
│                                                 │
│ □ Add SQL_PASSWORD = ___________________       │
│   (password for SQL_USER)                      │
│                                                 │
│ □ Add JWT_SECRET = ___________________         │
│   (any random secure string)                   │
│                                                 │
│ □ Click SAVE button                             │
│                                                 │
│ □ Click RESTART button                          │
│   (Wait 1-2 minutes)                           │
│                                                 │
│ □ Test: Open app and check console             │
│   Look for: "Teams: X records"                 │
│                                                 │
│ □ ✅ DONE - Data should now load!              │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Verification Commands

Once configured, test with these endpoints:

```
Test 1: Is backend running?
URL: https://yourappname.azurewebsites.net/api/health
Expected: {"ok":true,"uptime":123.456}

Test 2: Is database connected?
URL: https://yourappname.azurewebsites.net/api/db-check
Expected: {"ok":true}

Test 3: Can it read data?
URL: https://yourappname.azurewebsites.net/api/diagnostic
Expected: JSON with counts like:
{
  "database": {
    "teams": 5,
    "sites": 2,
    ...
  }
}

Test 4: Does frontend get data?
Action: Open app, press F12, check Console
Expected: [useInitializeData] 🚀 Starting...
          Teams: 5 records
          Sites: 2 records
          ...
```

---

**Key Takeaway:** Just 5 environment variables in App Service Configuration is all you need. After setting them and restarting, your app will load data from the database! 🚀
