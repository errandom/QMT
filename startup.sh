#!/bin/bash
set -e  # Exit on error

echo "Starting QMT application..."

# Check server.js integrity
echo "Checking server.js..."
if grep -q "interface" /home/site/wwwroot/server.js; then
  echo "ERROR: server.js contains TypeScript code! File is corrupted."
  echo "First 20 lines of server.js:"
  head -20 /home/site/wwwroot/server.js
  exit 1
fi
echo "server.js looks valid"

# Extract node_modules if tarball exists
if [ -f /home/site/wwwroot/node_modules.tar.gz ]; then
  echo "Extracting node_modules..."
  cd /home/site/wwwroot
  tar -xzf node_modules.tar.gz
  echo "Node modules extracted successfully"
  rm node_modules.tar.gz
  echo "Tarball removed"
else
  echo "No node_modules tarball found, using existing node_modules"
fi

echo "Listing wwwroot contents:"
ls -la /home/site/wwwroot | head -20

echo "Starting Node.js server..."
exec node /home/site/wwwroot/server.js
