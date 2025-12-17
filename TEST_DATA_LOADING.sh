#!/bin/bash
# Quick Testing Script for Data Loading Fixes

echo "=== Spark Template Data Loading - Quick Test ==="
echo ""
echo "1. Checking environment..."
if [ -f .env ]; then
    echo "   ✓ .env file found"
else
    echo "   ✗ .env file NOT found"
    echo "   → Create .env with database credentials to enable data loading"
fi

echo ""
echo "2. Testing API health check..."
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status"'; then
    echo "   ✓ Backend is running"
    echo "   Response: $HEALTH"
else
    echo "   ✗ Backend not responding"
    echo "   → Start backend with: npm start"
fi

echo ""
echo "3. Testing Teams API..."
TEAMS=$(curl -s http://localhost:3000/api/teams 2>/dev/null)
if [ ! -z "$TEAMS" ]; then
    TEAM_COUNT=$(echo "$TEAMS" | grep -o '"id"' | wc -l)
    echo "   ✓ Teams endpoint working"
    echo "   Teams in database: $TEAM_COUNT"
else
    echo "   ✗ Teams endpoint not responding"
fi

echo ""
echo "4. Browser Console Checks..."
echo "   When you load the app, open DevTools (F12) and check for:"
echo "   → [useInitializeData] Starting data initialization..."
echo "   → [useInitializeData] Storing data: { events: X, teams: Y, ... }"
echo "   → ✓ [useInitializeData] Application data initialized successfully"
echo ""
echo "5. Testing Dashboard..."
echo "   → Open app in browser"
echo "   → Should see teams and events in Dashboard view"
echo "   → If empty, check browser console logs"
echo ""
echo "6. Testing Operations Office..."
echo "   → Click 'Operations Office' button"
echo "   → Go to 'Teams' tab"
echo "   → Try creating a team"
echo "   → Should see success message"
echo "   → Refresh page - team should still exist"
echo ""
echo "=== End of Test ==="
