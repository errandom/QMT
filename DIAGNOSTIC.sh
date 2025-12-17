#!/bin/bash

# Comprehensive Data Loading Diagnostic Script
# This script helps identify why data is not loading

set -e

echo "======================================"
echo "  DATA LOADING DIAGNOSTIC SCRIPT"
echo "======================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Backend health check
echo -e "${BLUE}[TEST 1]${NC} Checking if backend is running..."
if HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null); then
    if echo "$HEALTH" | grep -q '"status"'; then
        echo -e "${GREEN}✓${NC} Backend is running"
        echo "  Response: $HEALTH"
    else
        echo -e "${RED}✗${NC} Backend not responding correctly"
        echo "  Response: $HEALTH"
    fi
else
    echo -e "${RED}✗${NC} Backend is NOT running"
    echo "  Make sure to start the server with: npm start"
    exit 1
fi

echo ""
echo -e "${BLUE}[TEST 2]${NC} Checking each API endpoint..."

# Test Teams endpoint
echo -n "  Teams endpoint: "
if TEAMS=$(curl -s http://localhost:3000/api/teams 2>/dev/null); then
    TEAM_COUNT=$(echo "$TEAMS" | grep -o '"id"' | wc -l)
    if [ "$TEAM_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}ℹ${NC} 0 teams found (database might be empty)"
        echo "    Response: $TEAMS"
    else
        echo -e "${GREEN}✓${NC} Found $TEAM_COUNT teams"
    fi
else
    echo -e "${RED}✗${NC} Failed to fetch teams"
fi

# Test Sites endpoint
echo -n "  Sites endpoint: "
if SITES=$(curl -s http://localhost:3000/api/sites 2>/dev/null); then
    SITE_COUNT=$(echo "$SITES" | grep -o '"id"' | wc -l)
    if [ "$SITE_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}ℹ${NC} 0 sites found"
    else
        echo -e "${GREEN}✓${NC} Found $SITE_COUNT sites"
    fi
else
    echo -e "${RED}✗${NC} Failed to fetch sites"
fi

# Test Fields endpoint
echo -n "  Fields endpoint: "
if FIELDS=$(curl -s http://localhost:3000/api/fields 2>/dev/null); then
    FIELD_COUNT=$(echo "$FIELDS" | grep -o '"id"' | wc -l)
    if [ "$FIELD_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}ℹ${NC} 0 fields found"
    else
        echo -e "${GREEN}✓${NC} Found $FIELD_COUNT fields"
    fi
else
    echo -e "${RED}✗${NC} Failed to fetch fields"
fi

# Test Equipment endpoint
echo -n "  Equipment endpoint: "
if EQUIPMENT=$(curl -s http://localhost:3000/api/equipment 2>/dev/null); then
    EQUIP_COUNT=$(echo "$EQUIPMENT" | grep -o '"id"' | wc -l)
    if [ "$EQUIP_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}ℹ${NC} 0 equipment items found"
    else
        echo -e "${GREEN}✓${NC} Found $EQUIP_COUNT equipment items"
    fi
else
    echo -e "${RED}✗${NC} Failed to fetch equipment"
fi

# Test Events endpoint
echo -n "  Events endpoint: "
if EVENTS=$(curl -s http://localhost:3000/api/events 2>/dev/null); then
    EVENT_COUNT=$(echo "$EVENTS" | grep -o '"id"' | wc -l)
    if [ "$EVENT_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}ℹ${NC} 0 events found"
    else
        echo -e "${GREEN}✓${NC} Found $EVENT_COUNT events"
    fi
else
    echo -e "${RED}✗${NC} Failed to fetch events"
fi

echo ""
echo -e "${BLUE}[TEST 3]${NC} Browser console checks..."
echo "  1. Open your browser's DevTools (F12)"
echo "  2. Go to the Console tab"
echo "  3. Reload the page"
echo "  4. Look for these messages:"
echo "     - [useInitializeData] Starting data initialization..."
echo "     - [useInitializeData] Events API Response: [...]"
echo "     - [useInitializeData] Teams API Response: [...]"
echo "     - etc. for Sites, Fields, Equipment"
echo ""
echo "  If you see empty arrays [], the database might be empty"
echo "  If you see errors, check the error messages"

echo ""
echo -e "${BLUE}[TEST 4]${NC} Database checks..."
echo "  If you have access to your Azure SQL Database, run:"
echo ""
echo "    SELECT COUNT(*) as total_teams FROM teams;"
echo "    SELECT COUNT(*) as active_teams FROM teams WHERE active = 1;"
echo "    SELECT COUNT(*) as total_sites FROM sites;"
echo "    SELECT COUNT(*) as total_fields FROM fields;"
echo "    SELECT COUNT(*) as total_equipment FROM equipment;"
echo "    SELECT COUNT(*) as total_events FROM events;"
echo ""
echo "  If all counts are 0, your database is empty and needs to be seeded with test data."

echo ""
echo "======================================"
echo "  TROUBLESHOOTING SUMMARY"
echo "======================================"
echo ""
echo "Case 1: All API endpoints return empty arrays []"
echo "  → Solution: Database is empty. Insert test data or create records via the UI."
echo ""
echo "Case 2: API endpoints return data in terminal, but not in browser"
echo "  → Solution: Check browser console for errors. Might be CORS issue."
echo ""
echo "Case 3: Teams created in UI show up, but old data doesn't load"
echo "  → Solution: Database filtering issue. Check 'active' flag in database."
echo ""
echo "Case 4: Backend not responding"
echo "  → Solution: Start backend with: npm start"
echo "  → Make sure .env file exists with DB_* environment variables"
echo ""
echo "======================================"
