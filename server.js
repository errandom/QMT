name: Build and deploy Node.js app to Azure Web App - QMT

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout source
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Sync lockfile
        run: npm install --package-lock-only --no-audit --no-fund

      - name: Install dependencies
        run: npm ci

      - name: Build frontend (Vite)
        run: npm run build

      # Prune dev deps to keep runtime small
      - name: Prune devDependencies
        run: npm prune --production

      # Package runtime deps so App Service can extract them at startup
      - name: Create node_modules tarball
        run: tar -czf node_modules.tar.gz node_modules

      - name: Upload deployable artifact
        uses: actions/upload-artifact@v4
        with:
          name: qmt-app
          path: |
            dist
            server.js
            package.json
            package-lock.json
            node_modules.tar.gz

  deploy:
    runs-on: ubuntu-latest
    needs: build
    permissions:
      id-token: write
      contents: read

    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
                   name: qmt-app

      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZUREAPPSERVICE_CLIENTID_BFBAE102322E4F7DAEB495083C6F040E }}
          tenant-id: ${{ secrets.AZUREAPPSERVICE_TENANTID_F235CDF61BDD429D85E2A40EC4EB1385 }}
          subscription-id: ${{ secrets.AZUREAPPSERVICE_SUBSCRIPTIONID_C28A3FED0F5043218788CA86A94EC145 }}

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: 'QMT'
          slot-name: 'Production'
          package: './'
