#!/bin/bash

# COMPREHENSIVE DATA LOADING DIAGNOSTIC
# This script will help identify exactly where data is getting lost

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 SPARK TEMPLATE - COMPREHENSIVE DIAGNOSTIC"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

# Helper functions
test_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((FAIL++))
    fi
}

# ============================================
echo -e "${BLUE}STEP 1: Backend Connectivity${NC}"
echo "============================================"

echo -n "Checking if backend is running at http://localhost:3000... "
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ NOT RUNNING${NC}"
    echo ""
    echo -e "${YELLOW}FIX: Run in terminal:${NC}"
    echo "  npm run dev"
    echo ""
    exit 1
fi

# ============================================
echo ""
echo -e "${BLUE}STEP 2: API Endpoints Response${NC}"
echo "============================================"

test_api() {
    local name=$1
    local endpoint=$2
    
    echo -n "GET $endpoint ... "
    response=$(curl -s http://localhost:3000/api$endpoint)
    
    # Check if response is valid JSON and not empty
    if echo "$response" | jq empty 2>/dev/null; then
        count=$(echo "$response" | jq 'length' 2>/dev/null || echo "?")
        if [ "$count" -gt 0 ]; then
            echo -e "${GREEN}✅ $count records${NC}"
        else
            echo -e "${YELLOW}⚠️  Empty array${NC}"
        fi
    else
        echo -e "${RED}❌ Not JSON: $response${NC}"
    fi
}

test_api "Teams" "/teams"
test_api "Sites" "/sites"
test_api "Fields" "/fields"
test_api "Equipment" "/equipment"
test_api "Events" "/events"

# ============================================
echo ""
echo -e "${BLUE}STEP 3: Database Records (SQL)${NC}"
echo "============================================"

echo -e "${YELLOW}To check if database has records, run this SQL:${NC}"
echo ""
echo "  SELECT COUNT(*) as teams FROM teams;"
echo "  SELECT COUNT(*) as sites FROM sites;"
echo "  SELECT COUNT(*) as fields FROM fields;"
echo "  SELECT COUNT(*) as equipment FROM equipment;"
echo "  SELECT COUNT(*) as events FROM events;"
echo ""

# ============================================
echo ""
echo -e "${BLUE}STEP 4: Browser Console Checks${NC}"
echo "============================================"

echo -e "${YELLOW}Follow these steps IN THE BROWSER:${NC}"
echo ""
echo "1. Open http://localhost:5173 (or your vite port)"
echo "2. Press F12 (Open DevTools)"
echo "3. Click 'Console' tab"
echo "4. Press Ctrl+R (Cmd+R on Mac) to reload"
echo "5. Look for these logs:"
echo ""
echo "   Expected GOOD logs:"
echo "   [useInitializeData] 🚀 Starting data initialization..."
echo "   [API] Raw teams from server: [...]"
echo "   [API] Transformed teams: [...]"
echo "   Teams: X records (where X > 0)"
echo ""
echo "   Expected BAD logs (indicates problem):"
echo "   Nothing at all"
echo "   Or: TypeError: teams is not iterable"
echo "   Or: Cannot read property 'map' of undefined"
echo ""

# ============================================
echo ""
echo -e "${BLUE}STEP 5: Network Tab Checks${NC}"
echo "============================================"

echo -e "${YELLOW}In DevTools Network tab:${NC}"
echo ""
echo "1. Open DevTools (F12)"
echo "2. Go to 'Network' tab"
echo "3. Reload page"
echo "4. Look for requests: teams, sites, fields, equipment, events"
echo "5. Click each request"
echo "6. Check 'Response' tab"
echo ""
echo "   GOOD: Response shows JSON with records"
echo "   BAD: Response is empty [] or error"
echo ""

# ============================================
echo ""
echo -e "${BLUE}STEP 6: Summary of Checks${NC}"
echo "============================================"

echo -e "${YELLOW}If API endpoints (Step 2) show records:${NC}"
echo "  ✅ Database has data"
echo "  ✅ Backend is returning data"
echo "  → Problem is in frontend (Steps 3-5)"
echo ""

echo -e "${YELLOW}If API endpoints (Step 2) show empty:${NC}"
echo "  ❌ Either database empty OR query issue"
echo "  → Check database records first"
echo ""

echo -e "${YELLOW}If API works but console shows 0 records:${NC}"
echo "  ❌ Frontend transformation or KV store issue"
echo "  → Check console for errors"
echo "  → Check [API] Raw teams log"
echo ""

echo -e "${YELLOW}If API works, console shows data, UI is empty:${NC}"
echo "  ❌ Component rendering issue"
echo "  → Check React DevTools"
echo "  → Check for JavaScript errors"
echo ""

# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Run the SQL checks above to verify database has records"
echo "2. Check if Step 2 (API endpoints) shows records"
echo "3. Check Step 5 (browser console) for [useInitializeData] logs"
echo "4. Share what you see in each step for debugging"
echo ""
