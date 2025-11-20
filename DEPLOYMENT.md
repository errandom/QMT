# Azure Deployment Guide

This guide covers deploying your full-stack application (Vite frontend + Express backend) to Azure App Service.

## Prerequisites

- Azure App Service Plan: **QMTgridiron** (already created)
- Web App: **QMT** on Linux (already created)
- Azure SQL Database: **renegadesdb** (already configured)
- Azure CLI installed locally (optional but recommended)

## Architecture

Your application runs as a single service:
- **Backend**: Express server serves the API on `/api/*` routes
- **Frontend**: Static Vite build served from `/dist` directory
- **Database**: Azure SQL Database connection via environment variables

## Deployment Steps

### 1. Configure Environment Variables in Azure

In the Azure Portal, go to your Web App (QMT) → Configuration → Application settings, and add:

```
DB_SERVER=qmt.database.windows.net
DB_NAME=renegadesdb
DB_USER=QMTmgmt
DB_PASSWORD=Renegades!1982
NODE_ENV=production
PORT=8080
```

**Important**: Azure App Service on Linux uses port 8080 by default. The PORT environment variable should be set to 8080.

### 2. Configure Azure SQL Firewall

Ensure your Azure SQL Server allows connections from your App Service:

1. Go to Azure SQL Server → Networking
2. Add your App Service's outbound IP addresses to the firewall rules
3. OR enable "Allow Azure services and resources to access this server"

### 3. Build and Deploy Options

#### Option A: Using Azure CLI (Recommended)

```bash
# Login to Azure
az login

# Build the application
npm run build
npm run build:server

# Deploy using zip deployment
az webapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name QMT \
  --src <path-to-zip-file>
```

#### Option B: Using Git Deployment

1. In Azure Portal → Web App (QMT) → Deployment Center
2. Choose GitHub or Local Git
3. Configure the repository
4. Azure will automatically build and deploy on push

Add a `.deployment` file to your project root:

```
[config]
command = deploy.sh
```

Create `deploy.sh`:

```bash
#!/bin/bash

# Install dependencies
npm install

# Build frontend
npm run build

# Build backend
npm run build:server

# Copy necessary files
cp package.json dist/
cp -r node_modules dist/
```

#### Option C: Manual FTP Deployment

1. Build locally: `npm run build && npm run build:server`
2. Get FTP credentials from Azure Portal
3. Upload `dist/` folder contents to `/site/wwwroot/`

### 4. Configure Startup Command

In Azure Portal → Web App (QMT) → Configuration → General settings:

**Startup Command**: `node server/index.js`

### 5. Verify Deployment

After deployment, test your application:

1. Visit: `https://qmt.azurewebsites.net/api/health`
   - Should return: `{"status":"ok","database":"connected"}`

2. Visit: `https://qmt.azurewebsites.net`
   - Should load your Vite frontend application

## Local Development

### Running Frontend Only
```bash
npm run dev
```
Runs Vite dev server on http://localhost:5173

### Running Backend Only
```bash
npm run dev:server
```
Runs Express server on http://localhost:3000

### Running Full Stack
```bash
npm run dev:full
```
Runs both frontend and backend concurrently:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- API calls from frontend are proxied to backend

## Database Schema

Ensure your Azure SQL database has the following tables:

### teams
```sql
CREATE TABLE teams (
  id INT PRIMARY KEY IDENTITY(1,1),
  name NVARCHAR(255) NOT NULL,
  sport NVARCHAR(50) NOT NULL,
  age_group NVARCHAR(50),
  coaches NVARCHAR(500),
  active BIT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE()
);
```

### sites
```sql
CREATE TABLE sites (
  id INT PRIMARY KEY IDENTITY(1,1),
  name NVARCHAR(255) NOT NULL,
  address NVARCHAR(500),
  amenities NVARCHAR(1000),
  created_at DATETIME DEFAULT GETDATE()
);
```

### fields
```sql
CREATE TABLE fields (
  id INT PRIMARY KEY IDENTITY(1,1),
  site_id INT FOREIGN KEY REFERENCES sites(id),
  name NVARCHAR(255) NOT NULL,
  field_type NVARCHAR(50),
  surface_type NVARCHAR(50),
  created_at DATETIME DEFAULT GETDATE()
);
```

### events
```sql
CREATE TABLE events (
  id INT PRIMARY KEY IDENTITY(1,1),
  team_id INT FOREIGN KEY REFERENCES teams(id),
  field_id INT FOREIGN KEY REFERENCES fields(id),
  event_type NVARCHAR(50) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  description NVARCHAR(1000),
  status NVARCHAR(50) DEFAULT 'scheduled',
  created_at DATETIME DEFAULT GETDATE()
);
```

### equipment
```sql
CREATE TABLE equipment (
  id INT PRIMARY KEY IDENTITY(1,1),
  name NVARCHAR(255) NOT NULL,
  category NVARCHAR(100),
  quantity INT DEFAULT 1,
  condition NVARCHAR(50) DEFAULT 'good',
  location NVARCHAR(255),
  created_at DATETIME DEFAULT GETDATE()
);
```

### requests
```sql
CREATE TABLE requests (
  id INT PRIMARY KEY IDENTITY(1,1),
  request_type NVARCHAR(50) NOT NULL,
  requestor_name NVARCHAR(255) NOT NULL,
  requestor_phone NVARCHAR(50),
  requestor_email NVARCHAR(255),
  team_id INT FOREIGN KEY REFERENCES teams(id),
  field_id INT FOREIGN KEY REFERENCES fields(id),
  event_type NVARCHAR(50),
  requested_date DATE,
  requested_time TIME,
  duration INT,
  description NVARCHAR(1000),
  status NVARCHAR(50) DEFAULT 'pending',
  admin_notes NVARCHAR(1000),
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);
```

## Troubleshooting

### Database Connection Issues
- Verify firewall rules in Azure SQL
- Check environment variables are set correctly
- Test connection: visit `/api/health` endpoint

### 500 Errors
- Check Azure App Service logs: Portal → Monitoring → Log stream
- Verify all dependencies are in `dependencies` (not `devDependencies`)

### Build Failures
- Ensure `build` and `build:server` scripts work locally
- Check Node.js version matches Azure (use `.nvmrc` or package.json "engines")

### Port Issues
- Azure App Service expects the app to listen on the PORT environment variable
- Default is 8080 on Linux App Service

## Scaling Considerations

For 10-20 concurrent users:
- **Current setup is sufficient** (Basic/Standard tier App Service)
- Database connection pooling is configured (max 10 connections)
- Consider enabling Application Insights for monitoring

For higher traffic:
- Scale up App Service tier
- Increase database connection pool size
- Add caching layer (Redis)
- Consider CDN for static assets

## Security Notes

1. **Never commit `.env` file** - it's in `.gitignore`
2. Use Azure Key Vault for production secrets (optional enhancement)
3. Enable HTTPS only in Azure App Service settings
4. Configure CORS appropriately in `server/index.ts`
5. Add authentication middleware before production use

## Monitoring

Enable Application Insights:
1. Azure Portal → Web App → Application Insights
2. Turn on Application Insights
3. Monitor performance, failures, and dependencies

## CI/CD Pipeline (Optional)

For automated deployments, set up GitHub Actions:

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: |
        npm run build
        npm run build:server
    
    - name: Deploy to Azure
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'QMT'
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: ./dist
```

## Next Steps

1. ✅ Set environment variables in Azure
2. ✅ Configure SQL firewall
3. ✅ Create database tables
4. ✅ Deploy application
5. ✅ Test API health endpoint
6. ✅ Verify frontend loads
7. 🔄 Update frontend components to use API
8. 🔄 Add authentication/authorization
9. 🔄 Enable monitoring and logging
