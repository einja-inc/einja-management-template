#!/bin/bash

echo "=== Playground Setup ==="

# 1. 環境変数生成
echo "[1/5] Generating .env.playground..."
if [ ! -f playground/.env.playground ]; then
  cp playground/.env.template playground/.env.playground
  echo "✅ .env.playground created"
else
  echo "⚠️  .env.playground already exists"
fi

# 2. 依存関係インストール
echo "[2/5] Installing dependencies..."
cd playground
pnpm install
cd ..
echo "✅ Dependencies installed"

# 3. Prismaクライアント生成
echo "[3/5] Generating Prisma client..."
cd playground
pnpm db:generate
cd ..
echo "✅ Prisma client generated"

# 4. 必要なディレクトリ作成
echo "[4/5] Creating directories..."
mkdir -p playground/logs
mkdir -p playground/tmp
echo "✅ Directories created"

# 5. 診断実行
echo "[5/5] Running diagnostics..."
bash playground/tools/diagnose.sh

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "  cd playground/00-quick-start"
echo "  cat README.md"
echo ""
echo "⚠️  Note: GitHub Issues must be created manually."
echo "    Copy content from sample-issue.md files."
