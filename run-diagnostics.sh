#!/bin/bash

# Comprehensive data loading diagnostic
# Run this script to verify the entire data pipeline

set -e

API_URL="${1:-http://localhost:3000/api}"
echo "📋 Spark Template - Comprehensive Data Loading Diagnostic"
echo "=========================================================="
echo "API URL: $API_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test backend connection
echo -e "${BLUE}1. Testing Backend Connection${NC}"
echo "-----------------------------------"

if ! curl -s "$API_URL/health" > /dev/null; then
    echo -e "${RED}❌ Backend is not running!${NC}"
    echo "Start with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Backend is running${NC}"
echo ""

# Test each endpoint
echo -e "${BLUE}2. Testing Data Endpoints${NC}"
echo "-----------------------------------"

test_endpoint() {
    local name=$1
    local endpoint=$2
    local min_count=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s "$API_URL$endpoint")
    count=$(echo "$response" | grep -o '"id"' | wc -l)
    
    if [ "$count" -ge "$min_count" ]; then
        echo -e "${GREEN}✅ OK${NC} ($count records)"
    else
        echo -e "${RED}⚠️  EMPTY${NC} ($count records)"
        if [ "$count" -eq 0 ]; then
            echo "   Response: $response" | head -c 100
        fi
    fi
}

# Test with minimum of 0 (warning if empty)
test_endpoint "Teams" "/teams" 0
test_endpoint "Sites" "/sites" 0
test_endpoint "Fields" "/fields" 0
test_endpoint "Equipment" "/equipment" 0
test_endpoint "Events" "/events" 0
test_endpoint "Health" "/health" 0

echo ""

# Summary
echo -e "${BLUE}3. Next Steps${NC}"
echo "-----------------------------------"
echo "1. Open the web app in browser"
echo "2. Open DevTools: Press F12"
echo "3. Go to Console tab"
echo "4. Reload page (Ctrl+R or Cmd+R)"
echo "5. Look for logs starting with [useInitializeData]"
echo "6. Check that record counts are > 0"
echo ""
echo -e "${YELLOW}If endpoints above show 0 records:${NC}"
echo "- Verify database has test data"
echo "- Run: SELECT COUNT(*) FROM teams;"
echo "- Check .env file database credentials"
echo ""
echo -e "${YELLOW}If endpoints work but console shows 0 records:${NC}"
echo "- Check browser console for JavaScript errors"
echo "- Verify useInitializeData hook is being called"
echo "- Check Network tab to see API responses"
echo ""
echo "=========================================================="
