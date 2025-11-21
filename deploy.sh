#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Building frontend..."
npm run build

echo "Building backend..."
npm run build:server

echo "Preparing deployment folder..."
# Create a deployment folder (e.g., site)
mkdir -p site

# Copy backend build
cp -r dist/server site/

# Copy frontend build (Vite output)
cp -r dist site/public

# Copy package.json and node_modules for runtime
cp package.json site/
cp -r node_modules site/

