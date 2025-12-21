#!/bin/bash

# Azure deployment script
# This ensures dependencies are installed and the app is built correctly

echo "Starting deployment..."

# Install dependencies
echo "Installing npm dependencies..."
npm install --production=false

# Build frontend
echo "Building frontend..."
npm run build

echo "Deployment complete!"
