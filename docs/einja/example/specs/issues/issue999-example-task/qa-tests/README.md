# QAテスト結果ディレクトリ構造

## 概要
このディレクトリは、タスク実装後のQAテスト結果を記録するためのサンプル構造です。
実際のプロジェクトでは、タスクファイル（例：`.kiro/specs/subscription-management/tasks.md`）と同じディレクトリに`qa-tests`フォルダを作成して管理します。

## ディレクトリ構造
```
qa-tests/
├── README.md       # このファイル（QAテストガイド）
├── scenarios.md    # シナリオテスト仕様（必須）
├── phase1/         # フェーズ1のテスト
│   ├── 1-1.md     # タスク1.1.xのテスト結果
│   ├── 1-2.md     # タスク1.2.xのテスト結果
│   ├── 1-3.md     # タスク1.3.xのテスト結果
│   └── evidence/   # スクリーンショット等のエビデンス
├── phase2/         # フェーズ2のテスト
│   ├── 2-1.md
│   └── evidence/
└── summary.md      # 全体のテストサマリー（オプション）
```

## QAテストファイルの記載内容

各QAテストファイル（例：`phase1/1-1.md`）には以下を記載：

1. **ヘッダー情報**: テスト対象タスクID、タスク名、実装日、テスト実施日
2. **各タスクのテスト内容**: 受け入れ条件（AC番号）、テストシナリオ（表形式）、全体ステータス、主な問題点、対応策、エビデンス
3. **統合テスト結果サマリー**: フェーズ全体の結果サマリー、次フェーズへの引き継ぎ事項、改善提案
4. **報告と対応**: 失敗原因分類、差し戻し情報、修正優先度

## テスト結果の更新方針

- **上書き更新**: 実施結果セクションは最新の結果のみを記載。過去の履歴は保持しない（Gitで管理）。更新日時を必ず記載。
- **ステータス定義**: ✅ PASS（すべての受け入れ条件を満たす）、❌ FAIL（要修正）、⚠️ PARTIAL（軽微な問題あり）、🔄 未実施（テスト未実施）
- **エビデンスの保存**: `qa-tests/phase1/evidence/` 配下にログファイル、スクリーンショット、テストレポート等を保存。命名規則: `{タスク番号}-{内容}.{拡張子}`
- **実施タイミング**: タスク完了時（個別テスト）、フェーズ完了時（統合テスト）、リリース前（回帰テスト）

## テストシナリオの記載形式

### 画面操作テスト（簡潔な表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | ログイン画面に移動 (http://localhost:3000/auth/login) | URLが正しい | /auth/login | - | - |
| 2 | スナップショット取得 | メールアドレス入力欄が表示される | input[data-testid="email-input"]が存在 | - | - |
| 3 | メールアドレス入力: test@example.com | - | - | - | - |
| 4 | 送信ボタンをクリック | ローディング表示される | スピナーアイコンが表示 | - | - |

**重要**:
- 手順は自然言語で簡潔に記述（例: 「ログイン画面に移動」「メールアドレス入力: test@example.com」）
- mcp__playwrightなどのコマンドは記載しない
- 「-」は手順のみで確認項目がない場合に使用
- 備考欄はテストの区切りや注意事項を記載

### APIテスト（簡潔な表形式 + curlコマンド）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/auth/magic-link (email: test@example.com) | ステータスコード | 200 | - | - |
| 2 | - | レスポンスボディ | {"success":true,"message":"..."} | - | - |
| 3 | - | メールが送信される | 受信トレイにメールあり | - | - |

**実行例**:
```bash
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### UIインタラクションテスト（表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | メールアドレスフィールドをクリック | フォーカス状態 | 枠線の色が変化 | - | フィールドフォーカス |
| 2 | 空欄のまま送信ボタンをクリック | エラー表示 | 「メールアドレスを入力してください」、フィールド赤枠 | - | 空欄バリデーション |
| 3 | "test@"を入力して送信 | エラー表示 | 「有効なメールアドレスを入力してください」 | - | 形式バリデーション |
| 4 | 有効なメールアドレスで送信 | ローディング状態 | ボタン無効化、スピナー表示 | - | 正常系 |

### 視覚的回帰テスト（表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | ログイン画面を表示 | デフォルト状態 | ベースラインと一致 | - | evidence/login-default.png |
| 2 | メールフィールドにフォーカス | フォーカス状態 | ベースラインと一致 | - | evidence/login-focused.png |
| 3 | バリデーションエラーを発生させる | エラー状態 | ベースラインと一致 | - | evidence/login-error.png |

#### スクリーンショット命名規則
```
evidence/
├── [画面名]-[状態].png
├── login-default.png          # ログイン画面のデフォルト状態
├── login-error.png            # ログイン画面のエラー状態
├── email-sent.png             # メール送信確認画面
├── error-expired.png          # エラー画面（期限切れ）
└── ...
```

## テストツール使用例

### Playwright MCP（画面テスト実行）

```javascript
// ステップ1: navigate
mcp_playwright.navigate('http://localhost:3000')

// ステップ2: スナップショット取得
mcp_playwright.snapshot()

// ステップ3: click
mcp_playwright.click({
  element: 'ログインボタン',
  ref: '[data-testid="login-button"]'
})

// ステップ4: type
mcp_playwright.type({
  element: 'メールアドレス入力欄',
  ref: '[data-testid="email-input"]',
  text: 'test@example.com'
})

// スクリーンショット取得
mcp_playwright.screenshot({
  path: 'qa-tests/phase1/evidence/test.png'
})
```

### Bash（APIテスト実行）
```bash
# APIエンドポイントテスト
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# データベース確認
pnpm exec prisma db pull
```

### 自動テスト実行
```bash
# ユニットテスト
pnpm run test

# E2Eテスト
pnpm run test:e2e

# 全テスト
pnpm run prepush
```
