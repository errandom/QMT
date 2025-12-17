#!/bin/bash

# Quick diagnostic to check if API and data transformation are working

echo "🔍 Spark Template - Quick Diagnostic"
echo "===================================="
echo ""

# Test 1: Backend connectivity
echo "1️⃣  Testing backend connectivity..."
curl -s http://localhost:3000/api/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Backend is running"
else
  echo "❌ Backend is NOT running. Start with: npm run dev"
  exit 1
fi

echo ""

# Test 2: Raw API response
echo "2️⃣  Getting raw teams data from API..."
echo ""
teams_response=$(curl -s http://localhost:3000/api/teams)
teams_count=$(echo "$teams_response" | grep -o '"id"' | wc -l)

if [ "$teams_count" -gt 0 ]; then
  echo "✅ Backend returning $teams_count teams"
  echo "Sample (first team):"
  echo "$teams_response" | jq '.[0]' 2>/dev/null || echo "$teams_response" | head -c 200
else
  echo "❌ Backend returning empty array"
  echo "Response: $teams_response"
fi

echo ""
echo "===================================="
echo "Next steps:"
echo "1. Check browser console (F12) for [useInitializeData] logs"
echo "2. Look for 'Teams: X records' in console output"
echo "3. If console shows 0 records but API shows data above:"
echo "   - Check for JavaScript errors in console"
echo "   - Verify useInitializeData hook is running"
echo "4. If API shows 0 records but database has data:"
echo "   - Run: SELECT COUNT(*) FROM teams;"
echo "   - Verify WHERE clause is removed in server/index.ts"
echo ""
