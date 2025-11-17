---
description: "ローカル開発環境を起動します。環境構築済みの場合に使用"
allowed-tools: Bash
---

# ローカル開発環境起動コマンド

## コマンドの目的

既に環境構築が完了している環境でローカル開発環境を起動します。

## 実行手順

### 1. PostgreSQL起動
```bash
echo "=== PostgreSQL起動 ==="
docker-compose up -d postgres
echo "✅ PostgreSQL起動完了"
```

### 2. 依存関係インストール
```bash
echo "=== 依存関係インストール ==="
npm install
echo "✅ npm install完了"
```

### 3. Prismaクライアント生成とマイグレーション
```bash
echo "=== Prismaクライアント生成 ==="
npm run db:generate
echo "✅ Prismaクライアント生成完了"

echo "=== データベースマイグレーション ==="
npm run db:push
echo "✅ マイグレーション完了"
```

### 4. 既存プロセス終了とログクリア
```bash
echo "=== 既存プロセス終了とログクリア ==="
echo "" > dev.log
echo "既存のNext.jsプロセスを終了中..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2
echo "✅ プロセス終了とログクリア完了"
```

### 5. Next.js アプリケーション起動（Turbopack）
```bash
echo "=== Next.js サーバー起動（Turbopack） ==="
npm run dev > dev.log 2>&1 &
echo "✅ Next.jsサーバー起動中..."
echo "起動ログ: tail -f dev.log で確認可能"
```

### 6. 起動確認
```bash
echo "=== 起動確認 ==="
sleep 15
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Next.js App: 起動完了 (http://localhost:3000)"
else
    echo "⏳ サーバーはまだ起動中です"
    echo "ログを確認してください: tail -f dev.log"
fi

echo ""
echo "📋 利用可能なサービス:"
echo "  • PostgreSQL: localhost:5432"
echo "  • Next.js App: http://localhost:3000"
echo ""
echo "💡 開発サーバーの停止:"
echo "  pkill -f 'npm run dev'"
echo ""
```
