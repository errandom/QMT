#!/bin/bash
# Extract node_modules if tarball exists
if [ -f /home/site/wwwroot/node_modules.tar.gz ]; then
  echo "Extracting node_modules..."
  cd /home/site/wwwroot
  tar -xzf node_modules.tar.gz
  rm node_modules.tar.gz
fi

# Start the server
node /home/site/wwwroot/server.js
