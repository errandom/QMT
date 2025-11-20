# 🚀 Deployment Readiness Checklist

## ✅ Current Status: **READY** (Security Fixed)

### ✅ Completed Items

#### Database & Backend
- ✅ SQL Server schema defined (`database-schema.sql`)
- ✅ CRUD API routes implemented for all entities
- ✅ Connection pooling configured
- ✅ Parameterized queries (SQL injection protected)
- ✅ Error handling middleware
- ✅ Health check endpoint (`/api/health`)
- ✅ **SECURITY FIX**: Removed hardcoded credentials
- ✅ Environment variable validation added

#### Frontend
- ✅ API client library (`src/lib/api.ts`)
- ✅ Build configuration (Vite)
- ✅ Development proxy configured
- ✅ Production static serving configured

#### Configuration
- ✅ Example environment file (`.env.example`)
- ✅ Deployment documentation (`DEPLOYMENT.md`)
- ✅ Build scripts configured

---

## 📋 Pre-Deployment Steps

### 1. Environment Configuration ⚠️ **REQUIRED**

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` with your actual credentials:
```env
DB_SERVER=qmt.database.windows.net
DB_NAME=renegadesdb
DB_USER=QMTmgmt
DB_PASSWORD=<your-actual-password>
NODE_ENV=production
PORT=3000
```

**⚠️ NEVER commit the `.env` file to Git!**

### 2. Database Setup

Run the schema script in Azure SQL Database:
```bash
# Using Azure Data Studio, SQL Server Management Studio, or Azure Portal Query Editor
# Execute: database-schema.sql
```

### 3. Azure Configuration

In Azure App Service → Configuration → Application Settings, add:
- `DB_SERVER`: qmt.database.windows.net
- `DB_NAME`: renegadesdb
- `DB_USER`: QMTmgmt
- `DB_PASSWORD`: <your-password>
- `NODE_ENV`: production
- `PORT`: 8080 (Azure App Service default)

### 4. Azure SQL Firewall

Enable in Azure Portal → SQL Server → Networking:
- ☑️ Allow Azure services and resources to access this server
- Add your App Service's outbound IPs to firewall rules

### 5. Build & Test Locally

```bash
# Install dependencies
npm install

# Test backend connection
npm run dev:server

# In another terminal, test health check
curl http://localhost:3000/api/health

# Build for production
npm run build
npm run build:server

# Test production build
npm start
```

### 6. Deploy to Azure

Choose one method:

**Option A: Azure CLI**
```bash
az webapp deployment source config-zip \
  --resource-group <your-rg> \
  --name QMT \
  --src <path-to-deployment-package>
```

**Option B: GitHub Actions** (See DEPLOYMENT.md)

**Option C: VS Code Azure Extension**
- Install Azure App Service extension
- Right-click on `dist` folder → Deploy to Web App

---

## ✅ Post-Deployment Verification

### 1. Health Check
```bash
curl https://qmt.azurewebsites.net/api/health
```
Expected: `{"status":"ok","database":"connected"}`

### 2. API Endpoints
```bash
# Get all teams
curl https://qmt.azurewebsites.net/api/teams

# Get all events
curl https://qmt.azurewebsites.net/api/events
```

### 3. Frontend
Visit: https://qmt.azurewebsites.net

---

## 🔒 Security Checklist

- ✅ No hardcoded credentials in code
- ✅ `.env` in `.gitignore`
- ✅ Environment variables used for all secrets
- ⚠️ **TODO**: Add authentication/authorization
- ⚠️ **TODO**: Add rate limiting
- ⚠️ **TODO**: Add request validation middleware
- ⚠️ **TODO**: Configure CORS for production domain only

---

## 📊 Monitoring Setup

### Application Insights (Recommended)
1. Enable in Azure Portal → App Service → Application Insights
2. View metrics: Performance, Failures, Live Metrics

### Log Streaming
```bash
az webapp log tail --name QMT --resource-group <your-rg>
```

Or in Azure Portal → App Service → Log stream

---

## 🚨 Known Limitations

1. **No Authentication**: Anyone can access the API
2. **No Rate Limiting**: Vulnerable to abuse
3. **Basic Error Handling**: Could be more granular
4. **No Request Validation**: Should add input validation middleware
5. **No Caching**: Database hit on every request

---

## 📝 Next Steps After Deployment

### Priority 1 (Security)
- [ ] Implement authentication (JWT, OAuth, etc.)
- [ ] Add authorization middleware
- [ ] Configure CORS for production domain
- [ ] Add rate limiting (express-rate-limit)

### Priority 2 (Reliability)
- [ ] Add request validation (express-validator, zod)
- [ ] Implement proper logging (winston, morgan)
- [ ] Add database transaction support
- [ ] Implement retry logic for database failures

### Priority 3 (Performance)
- [ ] Add caching layer (Redis)
- [ ] Optimize database queries
- [ ] Add pagination to list endpoints
- [ ] Implement CDN for static assets

### Priority 4 (Features)
- [ ] Real-time updates (WebSocket/SignalR)
- [ ] File upload support (for equipment photos, etc.)
- [ ] Email notifications for requests
- [ ] Reporting and analytics dashboard

---

## 🆘 Troubleshooting

### "Cannot connect to database"
- Check Azure SQL firewall rules
- Verify environment variables in Azure
- Check App Service outbound IPs

### "Application not responding"
- Check if server is listening on PORT env variable
- View logs in Azure Portal
- Verify build completed successfully

### "500 errors on API calls"
- Check Application Insights for exceptions
- Verify database schema matches code
- Check connection string format

---

## 📞 Support Resources

- Azure Documentation: https://docs.microsoft.com/azure
- Node.js on Azure: https://docs.microsoft.com/azure/app-service/quickstart-nodejs
- Azure SQL: https://docs.microsoft.com/azure/azure-sql/
