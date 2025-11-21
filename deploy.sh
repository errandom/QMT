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
