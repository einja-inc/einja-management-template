---
name: einja-migration-fix
description: 壊れたPrismaマイグレーションを診断・修復する。migrate失敗、migration.sql破損、schema不整合、マージ後のmigration衝突、worktree環境でのDB不一致を自動検出し、共有環境適用状況に応じた安全な修復を実行する。「マイグレーション修復」「migration fix」「マイグレーション壊れた」「migrate失敗」「migration broken」「prisma migrate エラー」「P3006」「P3009」等で呼び出す。Do NOT use for: schema設計・モデル追加（通常のmigrate dev）、DB接続エラー（→ einja-infra-maintenance）、seed失敗
---

<!-- 参考: https://www.prisma.io/docs/orm/prisma-migrate -->
<!-- 参考: https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-status -->

# einja-migration-fix: Prismaマイグレーション修復Skill

壊れたPrismaマイグレーションを診断し、安全に修復する。

## プロジェクト構成

| 項目 | パス / コマンド |
|------|----------------|
| Schema | `packages/server-core/prisma/schema.prisma` |
| Migrations | `packages/server-core/prisma/migrations/` |
| migrate dev | `pnpm --filter @repo/server-core db:migrate` |
| migrate deploy | `pnpm --filter @repo/server-core db:migrate:deploy` |
| migrate status | `pnpm --filter @repo/server-core exec prisma migrate status` |
| db push（ローカル） | `pnpm --filter @repo/server-core db:push` |

## 大原則

1. **手動編集しない** — migration.sqlは手で直さない。壊れたら削除して再生成する
2. **共有環境適用済みは不可侵** — mainブランチに存在するmigrationは絶対に削除しない
3. **再生成で解決** — `prisma migrate dev --create-only` でPrismaに正しいSQLを生成させる

---

## Phase 1: 診断

### 1-1. 現在の状態を取得

```bash
cd packages/server-core
pnpm exec prisma migrate status
```

出力から以下を読み取る:
- `Database schema is up to date` → 正常。migrationの問題ではない可能性
- `Following migration(s) have not yet been applied` → 未適用migrationあり
- `The following migration(s) are failed` → 失敗したmigrationあり
- `Migration history diverged` → 履歴分岐

### 1-2. 共有環境適用済みかの判定

```bash
git log main -- packages/server-core/prisma/migrations/ --oneline
```

mainブランチのmigration一覧と、現在のブランチのmigrationを比較する。

**判定基準**:
- mainに存在するmigrationディレクトリ → **共有環境適用済み**（削除禁止）
- mainに存在しないmigrationディレクトリ → **未適用**（削除＋再生成可能）

### 1-3. schema diffの確認

```bash
cd packages/server-core
pnpm exec prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
```

出力がある場合、schemaとmigration履歴に差分がある。

---

## Phase 2: ケース分類と対応

診断結果から該当ケースを判定し、対応を実行する。

### ケースA: 未適用migrationのSQL破損・途中失敗

**識別**: `migrate status` で失敗migrationがある、または `migrate dev` でP3006エラー

**条件**: 壊れたmigrationがmainに存在しない（共有環境未適用）

**対応手順**:
1. 壊れたmigrationディレクトリを特定する
2. ディレクトリを削除する
   ```bash
   rm -rf packages/server-core/prisma/migrations/<壊れたmigration名>/
   ```
3. 再生成する
   ```bash
   cd packages/server-core
   pnpm exec prisma migrate dev --create-only --name <適切な名前>
   ```
4. 生成されたSQLを確認（Readで読む、手編集はしない）
5. ローカルDBで検証
   ```bash
   pnpm exec prisma migrate deploy
   ```

### ケースB: schema変更済みだがmigration未生成

**識別**: `migrate diff` で差分がある、かつ新しいmigrationディレクトリがない

**対応手順**:
1. migration名をschema変更内容から推測する（例: `add_voice_call_table`）
2. 生成する
   ```bash
   cd packages/server-core
   pnpm exec prisma migrate dev --create-only --name <推測した名前>
   ```
3. 生成されたSQLを確認
4. ローカルDBで検証

### ケースC: マージ後のmigration衝突（共有環境未適用）

**識別**: `migrate status` で履歴分岐、または `migrate dev` でreset要求

**条件**: 衝突しているmigrationがmainに存在しない

**対応手順**:
1. mainのmigration一覧を確認
   ```bash
   ls packages/server-core/prisma/migrations/
   git show main:packages/server-core/prisma/migrations/ 2>/dev/null || echo "mainにmigrations未確認"
   ```
2. mainに存在しない（＝自ブランチで追加した）migrationを特定
3. それらを削除
4. 最新mainのmigrationを取り込む（必要なら `git merge main` or `git rebase main`）
5. 再生成
   ```bash
   cd packages/server-core
   pnpm exec prisma migrate dev --create-only --name <適切な名前>
   ```
6. ローカルDBで検証

### ケースD: 適用済みmigrationを誤編集してしまった

**識別**: `migrate deploy` で「modified since applied」警告

**対応手順**:
1. 共有環境適用済みか確認（Phase 1-2）
2. **適用済みの場合**: gitから元に戻す
   ```bash
   git checkout main -- packages/server-core/prisma/migrations/<該当migration>/migration.sql
   ```
   追加の変更が必要なら追補migrationとして新規作成
3. **未適用の場合**: ケースAと同じ（削除＋再生成）

### ケースE: ブランチ間migration順序依存

**識別**: `migrate deploy` で「テーブル/列がない」エラー

**対応手順**:
1. 依存先のmigrationがmainにあるか確認
2. 最新mainを取り込む
3. 自ブランチのmigrationを削除＋再生成（ケースCと同じフロー）

### ケースF: worktree環境でのDATABASE_URL不一致

**識別**: 想定外のDB状態、別ブランチのデータが見える

**対応手順**:
1. 現在のDATABASE_URLを確認
   ```bash
   grep DATABASE_URL .env
   ```
2. ブランチ名から期待されるDB名を確認
   ```bash
   git branch --show-current
   ```
3. 不一致の場合、正しいDB名で `.env` を更新するか、`pnpm dev` で再生成

### ケースG: 共有環境でのmigrate deploy失敗（ガイドのみ）

**識別**: P3009/P3018エラー、CI/CDログで失敗確認

**このケースは自動修復しない。** 以下のガイドをユーザーに提示する:

1. `_prisma_migrations` テーブルで失敗状態を確認
   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at, logs
   FROM "_prisma_migrations"
   ORDER BY started_at DESC LIMIT 5;
   ```
2. 部分適用の範囲を特定
3. 対応方針を選択:
   - **ロールバック**: `prisma migrate resolve --rolled-back <migration_name>`
   - **適用済みとしてマーク**: `prisma migrate resolve --applied <migration_name>`
4. AskUserQuestionで方針を確認してから実行

### ケースH: 共有環境の手動hotfix未反映（ガイドのみ）

**識別**: 後続migrationで重複エラー、共有環境にのみ存在するオブジェクト

**このケースは自動修復しない。** 以下のガイドをユーザーに提示する:

1. `prisma db pull` でDBの実状態をschemaに反映
2. 差分をmigrationとして生成: `prisma migrate dev --create-only`
3. 共有環境では `prisma migrate resolve --applied <migration_name>` で履歴に登録

---

## Phase 3: 検証

修復後、以下を実行して正常性を確認する:

```bash
cd packages/server-core

# 1. migrate statusが正常か
pnpm exec prisma migrate status

# 2. schema diffがないか
pnpm exec prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma

# 3. Prisma Clientが生成できるか
pnpm exec prisma generate
```

すべて正常なら修復完了を報告する。

---

## 安全ガード（必須チェック）

以下は修復操作の前に必ず確認する。1つでも失敗したら操作を中止し、ユーザーに報告する。

| チェック | 確認方法 | 失敗時の対応 |
|---------|---------|-------------|
| 共有環境適用済みmigrationの保護 | `git log main -- prisma/migrations/` でmain上の存在を確認 | mainに存在するmigrationは削除禁止。ケースD/G/Hの手順に切替 |
| DATABASE_URLの正当性 | `.env` のDB名とブランチ名の整合性 | 不一致なら修正を提案し、ユーザー確認後に続行 |
| 削除対象の明示 | 削除するmigrationディレクトリ名を表示 | ユーザーに確認（AskUserQuestion）してから削除 |
| schemaの整合性 | `prisma validate` でschema構文チェック | schemaエラーがある場合はmigration修復の前にschema修正を優先 |

---

## フロー全体図

```
診断（Phase 1）
  ├─ migrate status
  ├─ 共有環境チェック
  └─ schema diff
      │
      ▼
ケース分類（Phase 2）
  ├─ 自動修復可能（A/B/C/D未適用/E/F）
  │   ├─ 安全ガードチェック
  │   ├─ ユーザー確認（削除対象の明示）
  │   ├─ 壊れたmigration削除
  │   ├─ prisma migrate dev --create-only で再生成
  │   └─ migrate deploy で検証
  │
  └─ ガイドのみ（D適用済み/G/H）
      ├─ 状況の説明
      ├─ 推奨手順の提示
      └─ AskUserQuestionで方針確認
          │
          ▼
検証（Phase 3）
  ├─ migrate status
  ├─ schema diff
  └─ prisma generate
```

<!-- @einja:project-private:start id="einja-migration-fix-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
