#!/bin/bash

# API Diagnostic Test Script
# Run this to test all API endpoints and verify they're returning data

echo "========================================="
echo "SPARK TEMPLATE - API DIAGNOSTIC TEST"
echo "========================================="
echo ""

API_BASE_URL="${1:-http://localhost:3000/api}"
echo "Testing API Base URL: $API_BASE_URL"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "200" ]; then
        count=$(echo "$body" | grep -o '"id"' | wc -l)
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code, $count records)"
        echo "Response: $body" | head -c 200
        echo ""
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "Response: $body"
    fi
    echo ""
}

# Test health check first
echo "🔍 Health Check:"
test_endpoint "Health Check" "/health"

# Test all data endpoints
echo "📊 Data Endpoints:"
test_endpoint "Teams" "/teams"
test_endpoint "Sites" "/sites"
test_endpoint "Fields" "/fields"
test_endpoint "Equipment" "/equipment"
test_endpoint "Events" "/events"

echo "========================================="
echo "Diagnostic complete!"
echo ""
echo "INTERPRETATION:"
echo "  - If all endpoints show ✓ OK with record count > 0: Data is loading correctly"
echo "  - If endpoints show 0 records: Database may be empty or query has no results"
echo "  - If endpoints show ✗ FAILED: Backend is not running or endpoint not found"
echo ""
echo "NEXT STEPS:"
echo "  1. If all tests pass: Check browser console for [useInitializeData] logs"
echo "  2. If tests fail: Make sure backend is running (npm run dev)"
echo "  3. If 0 records: Verify database has test data"
echo "========================================="
