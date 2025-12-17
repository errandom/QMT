# Quick Test - Check GET Endpoints Directly

## Instructions

Visit these URLs directly in your browser and tell me what you see:

### 1. Test Basic Health
```
https://yourappname.azurewebsites.net/api/health
```
Should show: `{"ok":true,...}`

---

### 2. Test Database Connection
```
https://yourappname.azurewebsites.net/api/db-check
```
Should show: `{"ok":true}`

---

### 3. Test Teams Data
```
https://yourappname.azurewebsites.net/api/teams
```

**What you should see:** Either
- `[{"id": 1, "name": "Team A", ...}, ...]` (array with data) ✅
- `[]` (empty array) ⚠️
- Error message ❌

**Report back:** Copy/paste exactly what appears

---

### 4. Test Diagnostic Endpoint
```
https://yourappname.azurewebsites.net/api/diagnostic
```

**What to look for:**
```json
{
  "database": {
    "teams": 0 or 5 or some number
  },
  ...
}
```

**Report back:** Paste the full JSON response

---

## Key Questions

After running these tests:

1. **Does `/api/teams` return data or empty array?**
2. **Does `/api/diagnostic` show record counts > 0 for the tables you've written to?**
3. **What error messages do you see, if any?**

This will immediately tell us if:
- Backend is working → `/api/health` returns ok
- Database connection works → `/api/db-check` returns ok
- Data is in database → `/api/diagnostic` shows record counts
- Frontend fetching issue → Still no data in UI
