# 修正記録: タスクグループ1.2（レビュー指摘修正・3回目）

**修正日時**: 2026-01-08
**対象Issue**: #22
**タスクグループ**: 1.2

## 修正内容

### 1. `.templateignore`の更新（Einja固有ファイルの除外）

#### ルートディレクトリ
**ファイル**: `.templateignore`

以下のEinja固有パターンを追加：
```
# Einja固有のClaude設定
.claude/agents/einja/
.claude/commands/einja/
.claude/skills/einja/

# 仕様書・タスク記録（Einja固有のプロジェクト管理ファイル）
docs/specs/
modifications/
qa-tests/
```

#### create-einja-appパッケージ
**ファイル**: `packages/create-einja-app/.templateignore`

以下の除外パターンを追加：
```
# Einja固有ファイル
.claude/agents/einja/
.claude/commands/einja/
.claude/skills/einja/
scripts/task-vibe-kanban-loop/
docs/specs/
modifications/
qa-tests/
```

### 2. Lintエラーの修正

#### 2.1 `as any`問題の修正

以下のファイルで`as any`にBiome抑制コメントを追加：

**ファイル**:
- `packages/server-core/src/domain/entities/User.test.ts`
- `packages/server-core/src/infrastructure/database/mappers/UserMapper.test.ts`
- `packages/server-core/src/infrastructure/database/repositories/UserRepository.test.ts`

すべての`as any`箇所に以下のコメントを追加：
```typescript
// biome-ignore lint/suspicious/noExplicitAny: test fixture initialization
// または
// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
```

#### 2.2 import type問題の修正

**ファイル**: `packages/server-core/src/testing/fixtures/users.ts`

修正前：
```typescript
import { Prisma, UserRole, UserStatus } from "@prisma/client";
```

修正後：
```typescript
import { type Prisma, UserRole, UserStatus } from "@prisma/client";
```

#### 2.3 生成ファイルの除外

**ファイル**: `.biomeignore`（新規作成）

以下の内容で作成：
```
# Biome ignore patterns
**/node_modules
**/.next
**/.turbo
**/dist
**/build
**/.cache
**/coverage
**/.vercel
**/.pnpm-store
styled-system
**/test-results
**/playwright-report
.claude
**/__generated__
```

**ファイル**: `biome.json`

`files.ignore`を削除し、`.biomeignore`ファイルで管理する方式に変更。

### 3. テンプレート更新スクリプトの再実行

**コマンド**: `pnpm -F create-einja-app template:update`

**結果**:
- コピー: 311個のファイル
- 変換: 48個のファイル
- Einja固有ファイルが適切に除外された

## 検証結果

### ✅ AC-008-3: テンプレート更新でEinja固有が除外され、CLIテンプレートが含まれること

**確認項目**:
1. ✅ Einja固有ファイルがテンプレートに含まれていない
   - `.claude/agents/einja/` → 除外
   - `.claude/commands/einja/` → 除外
   - `.claude/skills/einja/` → 除外
   - `modifications/` → 除外
   - `qa-tests/` → 除外

2. ✅ 汎用テンプレートファイルが含まれている
   - `.claude/agents/specs/` → 含まれる
   - `.claude/agents/task/` → 含まれる

3. ✅ Lintエラーがゼロ
   - `pnpm lint` → 全パッケージでエラーなし

## 影響範囲

### 新規作成されたファイル
- `.biomeignore`

### 編集されたファイル
- `.templateignore`
- `packages/create-einja-app/.templateignore`
- `biome.json`
- `packages/server-core/src/domain/entities/User.test.ts`
- `packages/server-core/src/infrastructure/database/mappers/UserMapper.test.ts`
- `packages/server-core/src/infrastructure/database/repositories/UserRepository.test.ts`
- `packages/server-core/src/testing/fixtures/users.ts`

### 削除されたファイル
- なし

## 備考

- `.biomeignore`ファイルを使用してBiomeの除外パターンを管理する方式に変更しました。Biome 1.9.4では`biome.json`の`files.ignore`キーが非推奨または未対応のため、`.biomeignore`ファイルでの管理を採用しました。
