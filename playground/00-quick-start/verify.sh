#!/bin/bash

echo "=== Quick Start Environment Verification ==="

# 1. Node.js
echo "[1/5] Checking Node.js..."
if command -v node &> /dev/null; then
  echo "✅ Node.js $(node --version)"
else
  echo "❌ Node.js not found"
  exit 1
fi

# 2. pnpm
echo "[2/5] Checking pnpm..."
if command -v pnpm &> /dev/null; then
  echo "✅ pnpm $(pnpm --version)"
else
  echo "❌ pnpm not found"
  exit 1
fi

# 3. PostgreSQL
echo "[3/5] Checking PostgreSQL..."
if command -v psql &> /dev/null; then
  echo "✅ PostgreSQL $(psql --version | head -1)"
else
  echo "⚠️  psql not found (Docker経由の場合は問題なし)"
fi

# 4. playground依存関係
echo "[4/5] Checking playground dependencies..."
cd ../..
if [ -d "node_modules" ]; then
  echo "✅ Dependencies installed"
else
  echo "❌ Dependencies not installed. Run 'bash playground/setup.sh'"
  exit 1
fi
cd playground/00-quick-start

# 5. .env.playground
echo "[5/5] Checking .env.playground..."
if [ -f "../.env.playground" ]; then
  echo "✅ .env.playground exists"
else
  echo "❌ .env.playground not found. Run 'bash playground/setup.sh'"
  exit 1
fi

echo ""
echo "=== Verification Complete! ==="
echo "✅ All checks passed. You're ready to start!"
echo ""
echo "Next: Create a GitHub Issue using sample-issue.md content"
