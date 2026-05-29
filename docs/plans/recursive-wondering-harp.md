# Plan: Prisma → Drizzle ORM 移行（einja-ai-base スタック準拠）

## Context

`einja-management-template` の DB アクセス層を Prisma から Drizzle ORM + drizzle-kit に完全置換する。

**動機**:
- 姉妹リポジトリ `einja-inc/einja-ai-base` で既に Prisma→Drizzle 移行が完了しており（PR-B/C/D の3段で実施、`docs/einja/memory/prisma-to-drizzle-grep-20260418.md` に記録あり）、テンプレート原本である本リポジトリも同じスタックに揃えることで、生成プロジェクト間の一貫性を確保する。
- テンプレート原本のため、`docs/einja/steering/*` と `.claude/skills/*` も Prisma 前提のまま放置すると、CLI 経由で下流リポジトリへ古い手順が配布され続ける。

**ユーザー確定済みスコープ**:
1. **完全置換**（ORM + マイグレーション、drizzle-orm + drizzle-kit）
2. **既存 migration 履歴を維持**し drizzle で継続（baseline introspect 方式）
3. **`@quramy/prisma-fabbrica` → 手書きファクトリ**（einja-ai-base と同じ `@faker-js/faker` ベース）
4. **DB driver**: `@neondatabase/serverless` + `pg`（migrate.ts 専用）のハイブリッド（einja-ai-base 準拠）
5. **コード + steering 5 ファイル + Skill 2 つを同一 PR で一括更新**

## 現状（調査済み）

### Prisma 構成

| 項目 | 内容 |
|------|------|
| Schema | `packages/server-core/prisma/schema.prisma`（モデル5: User, Account, Session, VerificationToken, Authenticator / enum2: UserStatus, UserRole） |
| Migrations | 1本のみ: `20260104184959_add_user_status_role_lastlogin` |
| Client singleton | `packages/server-core/src/infrastructure/database/client.ts`（globalThisパターン、`log: ["query"]`） |
| Repository | `UserRepository.ts`（Result型、`findMany`/`findFirst`/`findUnique`/`count`/`update`） |
| Mapper | `UserMapper.ts`（PrismaUser ↔ Domain User） |
| Factory | `@quramy/prisma-fabbrica`（UserFactory + 6 トレイト：active/inactive/pending/admin/moderator/verified） |
| Seed | `prisma/seed.ts`（`SEED_USERS` を upsert + bcrypt） |
| Direct prisma 呼び出し | `apps/web/src/app/api/auth/signup/route.ts`（Repository 未経由）、`apps/web/src/lib/prisma.ts`（再エクスポート） |
| pooler 切替 | `packages/server-core/prisma.config.ts`（Neon pooler URL検出時 `DIRECT_URL` 自動導出） |
| CI | `.github/actions/migrate/action.yml`（`prisma migrate deploy` + 3回リトライ、`-pooler.` 検出で `DIRECT_URL` 自動導出） |
| 高度機能 | `$transaction` / `$queryRaw` / Middleware / Extensions すべて **未使用**（移行が素直） |
| テスト | 統合テストなし、`vi.mock("../client")` でモック化（drizzle 化が容易） |

### 影響範囲

| カテゴリ | ファイル数 | 主要パス |
|---------|-----------|---------|
| Schema 定義 | 1 | `prisma/schema.prisma` → `db/schema.ts` |
| Migrations | 1 dir + config | `prisma/migrations/` → `db/migrations/` |
| DB client | 2 | `infrastructure/database/client.ts`, `apps/web/src/lib/prisma.ts` |
| Repository / Mapper / Factory / Seed | 5 | `UserRepository.ts`, `UserMapper.ts`, `user.factory.ts`, `prisma/seed.ts` |
| API route | 1 | `apps/web/src/app/api/auth/signup/route.ts` |
| ビルド設定 | 2 | `packages/server-core/package.json`, `turbo.json` |
| CI | 1 | `.github/actions/migrate/action.yml` |
| Steering docs | 5 | `db-schema-design.md`, `database-guidelines.md`, `backend-architecture.md`, `coding-standards.md`, `testing-strategy.md` |
| Skills | 2 | `einja-migration-fix/SKILL.md`, `einja-infra-maintenance/` 配下の関連ファイル |
| **合計** | **約21ファイル** | |

## 変更内容（einja-ai-base 準拠）

### 1. 新規パッケージ追加（`packages/server-core/` および `apps/web/`）

`packages/server-core/`:
```json
"dependencies": {
  "drizzle-orm": "^0.45.2",
  "@neondatabase/serverless": "^1.1.0"
},
"devDependencies": {
  "drizzle-kit": "^0.31.10",
  "@types/pg": "^8.11.10",
  "pg": "^8.13.1"
}
```

`apps/web/`（NextAuth/Auth.js Drizzle アダプタ）:
```json
"dependencies": {
  "@auth/drizzle-adapter": "<最新>"
}
```

### 2. 削除パッケージ

- `packages/server-core/`: `@prisma/client`, `prisma`, `@quramy/prisma-fabbrica`
- `apps/web/`: `@auth/prisma-adapter`（使用箇所確認の上、存在すれば削除）

### 3. 新規ファイル（einja-ai-base と同パス・同構造）

| パス | 内容 |
|------|------|
| `packages/server-core/drizzle.config.ts` | `dialect: "postgresql"`, `schema: "./db/schema.ts"`, `out: "./db/migrations"`, `dbCredentials.url: DIRECT_URL ?? DATABASE_URL`, `verbose: true`, `strict: true` |
| `packages/server-core/db/schema.ts` | 単一ファイル。pgEnum + pgTable + relations を ai-base スタイル（PascalCase テーブル名 = NextAuth 互換、camelCase カラム、`withTimezone: false`） |
| `packages/server-core/db/client.ts` | `@neondatabase/serverless` + `drizzle-orm/neon-serverless` + globalThis キャッシュ。**Edge/Node 分岐方針**: `typeof globalThis.EdgeRuntime === "undefined"` 判定で Node.js 環境のみ `ws` パッケージを `neonConfig.webSocketConstructor` に注入（einja-ai-base 準拠）。ローカル Docker PostgreSQL でも `@neondatabase/serverless` は標準 PostgreSQL プロトコル互換のため接続可能 |
| `packages/server-core/db/migrate.ts` | `pg.Client` + `drizzle-orm/node-postgres/migrator`、`DIRECT_URL` 優先 |
| `packages/server-core/db/seed.ts` | 手書き insert + `onConflictDoUpdate` + `NODE_ENV` ガード。**bcrypt 依存を維持**（既存 `prisma/seed.ts` と同じパスワードハッシュ化ロジック） |
| `packages/server-core/db/migrations/0000_baseline.sql` | 空ファイル（既存 Prisma 管理済み DB へのスナップショット登録用） |
| `packages/server-core/db/migrations/0001_baseline.sql` | `drizzle-kit introspect` で生成した実 baseline（既存 Prisma migration と同等のスキーマ） |
| `packages/server-core/db/migrations/meta/_journal.json`, `0000_snapshot.json`, `0001_snapshot.json` | drizzle-kit が自動生成 |

### 3.5 baseline 登録手順（既存 Prisma 適用済み DB への初回 migrate ハンドリング）

`db/migrations/0001_baseline.sql` には introspect 結果（CREATE TABLE 等のフル DDL）が含まれるため、既存 Prisma で同等スキーマが適用済みの DB に対して `tsx db/migrate.ts` を素朴に実行すると **重複 CREATE TABLE で失敗する**。einja-ai-base の実績手順に倣い、以下のいずれかで対応:

**選択肢1: `__drizzle_migrations` テーブルへ手動 INSERT で「実行済み」マーク**（既存 DB の場合）
```sql
-- ai-base 同等の手順。既存 DB に対して1度だけ実行する初期化スクリプトを scripts/db-baseline.sql として用意
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (...);
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES
  ('<0000_baseline.sqlのハッシュ>', extract(epoch from now()) * 1000),
  ('<0001_baseline.sqlのハッシュ>', extract(epoch from now()) * 1000);
```

**選択肢2: fresh DB（テンプレートとしての標準想定）**
- `db/migrate.ts` をそのまま実行すれば `0000_`（空）→ `0001_`（実 DDL）の順で適用され、新規 DB セットアップが完了

Plan ではテンプレートリポジトリ性質上、**fresh DB が標準想定**だが、開発者の既存 DB ローカル環境のために選択肢1の手順を `docs/einja/steering/db-schema-design.md` および `einja-migration-fix` Skill に文書化する。

### 4. 改修ファイル

| パス | 改修内容 |
|------|---------|
| `packages/server-core/package.json` | scripts を ai-base 準拠に置換（`db:generate`=`drizzle-kit generate`, `db:migrate`=`tsx db/migrate.ts`, etc.）、exports に `./db/schema`, `./db/client` 追加 |
| `packages/server-core/src/infrastructure/database/client.ts` | `db/client.ts` の再エクスポートに置換 |
| `packages/server-core/src/infrastructure/database/repositories/UserRepository.ts` | drizzle の `db.select().from(users).where(eq(...))` + `Promise.all([select, count])` パターンへ書き換え |
| `packages/server-core/src/infrastructure/database/mappers/UserMapper.ts` | `typeof users.$inferSelect` + `satisfies` 演算子で型安全化 |
| `packages/server-core/src/testing/factories/user.factory.ts` | `@faker-js/faker/locale/ja` + `build()` / `create()` / `buildActive()` etc. の手書きパターン |
| `packages/server-core/src/testing/fixtures/users.ts` | Prisma enum 参照を `pgEnum` 由来の型に変更 |
| `apps/web/src/app/api/auth/signup/route.ts` | `prisma.user.findUnique`/`create` を直接呼び出しから `userRepository.findByEmail`/`create` 経由に変更（Repository 経由に統一） |
| `apps/web/src/lib/prisma.ts` | 削除（または `db` 再エクスポートに置換） |
| `apps/web/src/lib/auth.ts`（および NextAuth/Auth.js 設定ファイル）| **NextAuth/Auth.js のアダプタを `PrismaAdapter` → `DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable, verificationTokensTable, authenticatorsTable })` に置換**。`@auth/prisma-adapter` の import を `@auth/drizzle-adapter` に切替。これが漏れるとサインイン/サインアップフローが壊れる |
| `turbo.json` | `generate` タスクの outputs を `src/__generated__/**` から `db/migrations/meta/**` 等へ調整、`db:migrate:deploy` の `dependsOn` 確認 |
| `.github/actions/migrate/action.yml` | `prisma migrate deploy` を `pnpm db:migrate:deploy`（= `tsx db/migrate.ts`）へ置換。pooler→DIRECT_URL 自動導出ロジックは流用 |

### 5. 削除ファイル

| パス | 理由 |
|------|------|
| `packages/server-core/prisma/schema.prisma` | drizzle へ移管 |
| `packages/server-core/prisma/migrations/` | drizzle 側で baseline 化済み |
| `packages/server-core/prisma/seed.ts` | `db/seed.ts` へ移管 |
| `packages/server-core/prisma.config.ts` | drizzle.config.ts へ移管 |
| `packages/server-core/src/__generated__/fabbrica/` | 手書きファクトリへ移管 |

### 6. Steering docs 改修（5ファイル）

| パス | 改修内容 |
|------|---------|
| `docs/einja/steering/db-schema-design.md` | Prisma スキーマ定義手順 → Drizzle schema.ts 定義手順、`prisma generate`/`prisma migrate dev` → `drizzle-kit generate`/`tsx db/migrate.ts` |
| `docs/einja/steering/development/database-guidelines.md` | DateTime/PostgreSQL 型マッピングを drizzle column types（`timestamp`, `varchar`, `uuid` 等）に置換、推奨テンプレートを drizzle 記法に |
| `docs/einja/steering/development/backend-architecture.md` | PrismaClient シングルトンのコード例 → drizzle client、UserMapper/Repository の実装例を `$inferSelect`/`satisfies`/`eq()` パターンに |
| `docs/einja/steering/development/coding-standards.md` | `import { prisma } from "@repo/server-core"` → `import { db } from "@repo/server-core/db/client"`、スキーマ import 経路の追加 |
| `docs/einja/steering/development/testing-strategy.md` | `prisma.user.deleteMany()` → `db.delete(users)` 等、テスト DB セットアップを ai-base 統合テスト構成に |

### 7. Skill 改修（2ファイル）

| パス | 改修内容 |
|------|---------|
| `.claude/skills/einja-migration-fix/SKILL.md` | Prisma 前提（`prisma migrate status`, `P3006`/`P3009` 等）を Drizzle 前提（`drizzle-kit check`, `_journal.json` 整合性確認等）へ完全書き換え。Skill description キーワードも更新 |
| `.claude/skills/einja-infra-maintenance/category-7-github-actions.md` (および `common-operations.md`) | `prisma migrate deploy` vs `db:push` の禁止ルール → `drizzle-kit migrate` 経由の `tsx db/migrate.ts` 運用に書き換え |

## タスク概要

| ID | タスク | 委託先 | 依存 |
|----|------|--------|------|
| 0-0 | TaskCreate でタスク一括登録（依存関係明示）| 親 | - |
| 0-1 | Planファイルの配置先を CLAUDE.md / `docs/plans/` 内既存ファイル群の慣例から確認の上、`docs/plans/recursive-wondering-harp.md` に配置（既存 plan が多数あるため慣例化済み）| 親 | - |
| 0-2 | worktree 作成 + 依存セットアップ [`_einja-worktree-guide`] | 親 | 0-1 |
| 0-3 | Skill 作成は不要（既存 `einja-migration-fix` 更新で対応） | - | - |
| **Phase A: 基盤整備（drizzle 側を構築、Prisma 共存）** | | | |
| A-0 | **Prisma 残存箇所の全文 grep** — `rg -n 'prisma\|@prisma\|prisma-fabbrica\|PrismaClient\|PrismaAdapter' .claude/skills docs/einja apps packages scripts presets` を実行し、Plan の対象ファイルリストとの差分を本ファイルに追記。差分があれば Phase E/F の対象に追加 [`backend-implementer`] | sub | 0-2 |
| A-1 | drizzle 依存パッケージ追加 / `apps/web` に `@auth/drizzle-adapter` 追加 / package.json scripts 書き換え [`backend-implementer`] | sub | A-0 |
| A-2 | `db/schema.ts` を Prisma schema から手動移植（einja-ai-base スタイル、複合主キーは `primaryKey({ columns: [...] })`）[`backend-architect`→`database-implementer`] | sub | A-1 |
| A-3 | `drizzle.config.ts` / `db/client.ts` / `db/migrate.ts` / `db/seed.ts` 新設 [`database-implementer`] | sub | A-2 |
| A-4 | `drizzle-kit generate` で `0001_baseline.sql` + meta 生成、`0000_baseline.sql` を空で作成。**fresh DB に対する `tsx db/migrate.ts` 動作確認**、および **既存 Prisma 適用済み DB 向け `scripts/db-baseline.sql`（`__drizzle_migrations` 手動 INSERT スクリプト）作成と動作検証** [`database-implementer`] | sub | A-3 |
| A-5 | `turbo.json` の generate タスク調整 [`backend-implementer`] | sub | A-1 |
| **Phase B: コード書き換え（Prisma → Drizzle 並列実行可）** | | | |
| B-1 | `UserRepository.ts` を drizzle 化（Result型維持）[`backend-implementer`] | sub | A-3 |
| B-2 | `UserMapper.ts` を `$inferSelect`/`satisfies` パターンに [`backend-implementer`] | sub | A-3 |
| B-3 | `user.factory.ts` を `@faker-js/faker` 手書きパターンに [`backend-implementer`] | sub | A-3 |
| B-4 | `apps/web/src/app/api/auth/signup/route.ts` を Repository 経由に変更 + `apps/web/src/lib/prisma.ts` 削除 [`backend-implementer`] | sub | B-1 |
| B-5 | `infrastructure/database/client.ts` を `db/client.ts` 再エクスポートに [`backend-implementer`] | sub | A-3 |
| B-6 | **NextAuth/Auth.js アダプタを `PrismaAdapter` → `DrizzleAdapter(db, { schema tables })` に切替**（`apps/web/src/lib/auth.ts` 等）。`@auth/prisma-adapter` の import を `@auth/drizzle-adapter` に置換 [`backend-implementer`] | sub | A-3, B-2 |
| **Phase C: CI / インフラ** | | | |
| C-1 | `.github/actions/migrate/action.yml` を drizzle 対応に書き換え [`backend-implementer`] | sub | A-3 |
| **Phase D: テスト・動作確認（直列）** | | | |
| D-1 | `vi.mock` 対象を `db/client` に変更、UserRepository.test の型修正 [`backend-implementer`] | sub | B-1, B-2 |
| D-2 | ローカル PostgreSQL に対して `pnpm db:migrate` + `pnpm db:seed` で動作確認 [`Bash`] | 親 | A-4, B-1, B-2, B-3, B-4, B-5, B-6 |
| D-3 | `apps/web` ローカル起動 → signup + signin フロー Playwright 動作確認（NextAuth アダプタ動作も含む）[`Playwright MCP`] | 親 | D-2 |
| **Phase E: ドキュメント・Skill（並列、コード変更とは独立）** | | | |
| E-1 | `docs/einja/steering/db-schema-design.md` を drizzle 化（baseline 登録手順も追記）[`docs-updater`] | sub | A-4 |
| E-2 | `docs/einja/steering/development/database-guidelines.md` を drizzle 化 [`docs-updater`] | sub | A-3 |
| E-3 | `docs/einja/steering/development/backend-architecture.md` を drizzle 化（実装例コード差し替え）[`docs-updater`] | sub | B-1, B-2 |
| E-4 | `docs/einja/steering/development/coding-standards.md` を drizzle import パスに [`docs-updater`] | sub | A-3 |
| E-5 | `docs/einja/steering/development/testing-strategy.md` を drizzle テストパターンに [`docs-updater`] | sub | D-1 |
| E-6 | `.claude/skills/einja-migration-fix/SKILL.md` を drizzle 前提に書き換え（description + 本文 + baseline 登録手順）[`backend-implementer`] | sub | A-4, F-1 |
| E-7 | `.claude/skills/einja-infra-maintenance/category-7-github-actions.md` 等を drizzle migrate 運用に書き換え [`backend-implementer`] | sub | C-1, F-1 |
| E-8 | **`presets/default/` 配下の Prisma 参照確認** — `presets/default/CLAUDE.md.template`、`presets/default/package.json`、および `scripts/copy-presets.mjs` の Prisma 関連変換ロジックを grep し、必要なら更新 [`backend-implementer`] | sub | A-1, E-1〜E-7 |
| **Phase F: Prisma 撤去** | | | |
| F-1 | `prisma/`, `prisma.config.ts`, `src/__generated__/fabbrica/`, `apps/web/src/lib/prisma.ts` 削除 + 依存パッケージ削除（`@prisma/client`, `prisma`, `@quramy/prisma-fabbrica`, `@auth/prisma-adapter`）[`backend-implementer`] | sub | D-2, D-3 |
| **99系: 完了検証** | | | |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | Skill | 全実装後 |
| 99-2 | 動作確認（ローカルmigrate/signup/signin/typecheck/test全パス）[`Bash`/`Playwright`] | 親 | 99-1 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | 親 | 99-2 |
| 99-3 | コミット・プッシュ + PR作成 [`einja-task-commit` + `einja-create-pr`] | Skill | 99-G |

## 並列実行計画

```
Phase A (sequential): A-0 → A-1 → A-2 → A-3 → A-4
                                A-1 → A-5

Phase B (A-3 後、4-5タスク並列可):
  ┌─ B-1 → B-4
  ├─ B-2 → B-6 (B-2/A-3完了で並列)
  ├─ B-3
  └─ B-5

Phase C (A-3 後、独立):
  C-1

Phase D (B完了後、直列):
  D-1 → D-2 → D-3

Phase E (条件付き並列):
  ┌─ E-2, E-4 (A-3完了で可)
  ├─ E-1 (A-4完了で可)
  ├─ E-3 (B-1/B-2完了で可)
  ├─ E-5 (D-1完了で可)
  └─ E-6, E-7 (F-1完了後)
  └─ E-8 (E-1〜E-7完了後)

Phase F (D-2/D-3完了後): F-1

99系: 99-1 → 99-2 → 99-G → 99-3
```

最大並列度: Phase B で 5サブエージェント、Phase E で最大5サブエージェント（独立した docs 書き換え）。E-6/E-7/E-8 は F-1 後段で別途実行。

## リスク・不明点

| # | リスク | 対処 |
|---|-------|------|
| R1 | `drizzle-kit introspect` で生成したスキーマが既存 Prisma migration と完全一致しない（カラム順、デフォルト値表現、enum 表現差） | A-4 で `drizzle-kit check` + 既存 DB に対して `drizzle-kit migrate --dry-run` で差分0を確認。差分があれば schema.ts を手動調整。**baseline 登録手順は §3.5 を参照** |
| R2 | NextAuth スキーマ（Account, Session, VerificationToken, Authenticator）の複合主キー `@@id([...])` の drizzle 表現、および NextAuth/Auth.js の Prisma アダプタ → Drizzle アダプタ切替 | einja-ai-base で同モデル + `@auth/drizzle-adapter` 切替が実証済み。B-6 タスクで対応。複合主キーは `primaryKey({ columns: [table.col1, table.col2] })` パターンを使用 |
| R3 | `Prisma.UserCreateInput` 等の Prisma 型に依存している箇所が他にも残存する可能性 | **A-0 タスクで `rg -n 'prisma\|@prisma\|prisma-fabbrica\|PrismaClient\|PrismaAdapter' .claude/skills docs/einja apps packages scripts presets` を実行**し、Plan のファイルリストとの差分を明示。型のみ import している箇所（`UserStatus`/`UserRole` enum 等）も含めて洗い出す |
| R4 | テンプレートリポジトリのため `presets/default/` 配下にも反映が必要か | CLAUDE.md記載のとおり、`docs/einja/` 等のコピー先は `copy-presets.mjs` が自動同期するため手動操作不要。**ただし** `presets/default/` 直下のCLAUDE.mdテンプレート/package.json が Prisma を参照していないか確認が必要（Phase E に追加チェックタスクとして含める） |
| R5 | `@quramy/prisma-fabbrica` の `defineUserFactory` がプロダクションコードから import されていないか | server-core 内に限定。Phase A 開始時に grep で再確認 |
| R6 | CI の Vercel デプロイで `prisma generate` がビルドコマンドにハードコードされている可能性 | `apps/*/vercel.json` 確認済み（`git.deploymentEnabled: false` のみ）。Turbo の `^generate` 依存経由のため、`db:generate` スクリプトを drizzle 化すれば追従 |
| R7 | `docs/einja/memory/prisma-to-drizzle-grep-20260418.md`（ai-base 側の移行記録）に未対応とされていた dev-cli/template 配布物の差分 | この記録自体が「テンプレート側でやるべき残作業」を示唆している。今回の PR でテンプレ側の対応を完遂する |
| R8 | DB driver を `@neondatabase/serverless` に統一すると、ローカル Docker PostgreSQL でも WebSocket 経由になり挙動が変わる可能性 | einja-ai-base で実証済み（`@neondatabase/serverless` は標準 PostgreSQL 互換）。検証は D-2 で実DB動作確認 |
| R9 | 1 commit に収めると PR が巨大（21+ファイル）でレビューしにくい | worktree 内で論理的に Phase ごとにコミット分割。**特に Phase E（docs/Skill）と Phase F（Prisma 撤去）は別コミット**にして、レビュアーが「Prisma 削除差分」を独立して確認できるようにする。PR は同一 |

## 検証・動作確認方法

| Phase | 検証内容 | 方法 |
|-------|---------|------|
| A-4 | drizzle baseline が既存 Prisma migration と等価 | (a) ローカル Docker DB に Prisma migration 適用 → (b) `drizzle-kit check` で差分0 → (c) `drizzle-kit introspect` 出力と新 schema.ts の diff レビュー |
| B-* | 型エラーなく書き換え完了 | `pnpm typecheck` 全パス |
| D-1 | UserRepository テストが drizzle で通る | `pnpm --filter @repo/server-core test` 全パス |
| D-2 | マイグレーション + seed 動作 | `pnpm db:push`（fresh DB）→ `pnpm db:seed` → `pnpm db:studio` で5モデル× テストユーザー6件確認 |
| D-3 | 認証フロー動作 | `pnpm dev` 起動 → Playwright MCP で `/signup` → email登録 → `/login` → ダッシュボード遷移を確認 |
| 99-1 | コードレビュー | `einja-review-code` Skill（観点別並列レビュー） |
| 99-2 | 統合動作 | `pnpm prepush`（lint + typecheck + test 全パス）+ `.github/actions/migrate/action.yml` を CI 手動トリガーで成功確認（あるいは preview deploy） |

## 補足: PR 戦略

- 単一 PR + 単一ブランチ（worktree 内）で全変更を含める
- worktree 内では論理コミット分割でレビュアビリティ確保:
  1. `chore(db): drizzle基盤新設 (Phase A)`
  2. `refactor(server-core): Prisma → drizzle 書き換え (Phase B)`
  3. `chore(ci): drizzle migrate Action 切替 (Phase C)`
  4. `test: vi.mock 対象を drizzle に変更 + 動作確認 (Phase D)`
  5. `docs: steering を drizzle 化 (Phase E1-E5,E8)`
  6. `chore: Prisma 撤去 (Phase F)` ← レビュアーが削除差分を独立確認できる
  7. `docs: einja-migration-fix / einja-infra-maintenance Skill を drizzle 化 (Phase E6-E7)` ← F-1 後の最終状態に整合
- `changesets` 対象なら `einja-create-pr` Skill が自動で changeset を生成
- マージ後、`einja-inc/create-app` 生成プロジェクトへの反映は `presets/default/` 自動コピー経由（手動操作不要）
