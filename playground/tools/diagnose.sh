#!/bin/bash

echo "=== Playground Environment Diagnostics ==="

# 1. Node.js環境チェック
echo "[1/6] Checking Node.js..."
if command -v node &> /dev/null; then
  node --version
else
  echo "❌ Node.js not found"
fi

# 2. pnpmチェック
echo "[2/6] Checking pnpm..."
if command -v pnpm &> /dev/null; then
  pnpm --version
else
  echo "❌ pnpm not found"
fi

# 3. Docker/Docker Composeチェック
echo "[3/6] Checking Docker..."
if command -v docker &> /dev/null; then
  docker --version
else
  echo "❌ Docker not found"
fi

# 4. MCP設定チェック
echo "[4/6] Checking MCP configuration..."
if [ -f "../.claude/settings.json" ]; then
  echo "✅ MCP settings found"
else
  echo "❌ MCP settings not found"
fi

# 5. pnpm workspace確認
echo "[5/6] Checking pnpm workspace..."
if [ -d "playground" ]; then
  cd playground
  if [ -f "package.json" ]; then
    echo "✅ Playground workspace configured"
    pnpm list --depth=0 2>/dev/null | head -10 || echo "⚠️  Dependencies not installed yet"
  else
    echo "❌ package.json not found"
  fi
  cd ..
else
  echo "❌ playground directory not found"
fi

# 6. モックデータチェック
echo "[6/6] Checking mock data..."
MOCK_COUNT=$(ls playground/mock-data/issues/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Found $MOCK_COUNT mock issues"

echo ""
echo "=== Diagnostics Complete ==="
