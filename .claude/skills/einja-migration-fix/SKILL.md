---
name: einja-migration-fix
description: 壊れたDrizzleマイグレーションを診断・修復する。migrate失敗、生成SQL破損、schema-snapshot不整合、マージ後のmigration衝突、worktree環境でのDB不一致、`__drizzle_migrations` 履歴の壊れ等を自動検出し、共有環境適用状況に応じた安全な修復を実行する。「マイグレーション修復」「migration fix」「マイグレーション壊れた」「migrate失敗」「migration broken」「drizzle migrate エラー」「drizzle-kit エラー」「__drizzle_migrations 不整合」「snapshot 不整合」「baseline 登録」等で呼び出す。Do NOT use for: schema設計・モデル追加（通常の `drizzle-kit generate`）、DB接続エラー（→ einja-infra-maintenance）、seed失敗
---

<!-- 参考: https://orm.drizzle.team/docs/migrations -->
<!-- 参考: https://orm.drizzle.team/docs/drizzle-kit-generate -->
<!-- 参考: https://orm.drizzle.team/docs/drizzle-kit-migrate -->
<!-- 参考: https://orm.drizzle.team/docs/drizzle-kit-check -->

# einja-migration-fix: Drizzleマイグレーション修復Skill

壊れたDrizzleマイグレーションを診断し、安全に修復する。

## プロジェクト構成

| 項目 | パス / コマンド |
|------|----------------|
| Schema | `packages/server-core/db/schema.ts` |
| Drizzle config | `packages/server-core/drizzle.config.ts` |
| Migrations | `packages/server-core/db/migrations/` |
| Snapshot meta | `packages/server-core/db/migrations/meta/` |
| migrate ランナー | `packages/server-core/db/migrate.ts`（tsx 実行） |
| 生成（generate） | `pnpm --filter @repo/server-core db:generate` |
| 適用（migrate / deploy） | `pnpm --filter @repo/server-core db:migrate` ／ `db:migrate:deploy` |
| 整合性チェック | `pnpm --filter @repo/server-core db:check` |
| Studio | `pnpm --filter @repo/server-core db:studio` |
| baseline 登録 SQL | `scripts/db-baseline.sql` |
| 履歴テーブル | `drizzle.__drizzle_migrations` |
| 接続 URL | `DIRECT_URL` 優先 → fallback `DATABASE_URL`（Neon pooler は migration 不可） |

## 大原則

1. **手動編集しない** — `*.sql` と `meta/_journal.json` / `meta/*_snapshot.json` は手で直さない。壊れたら `drizzle-kit drop` で取り下げて `drizzle-kit generate` で再生成する
2. **共有環境適用済みは不可侵** — main ブランチに存在する migration ファイル・snapshot は絶対に削除・改変しない（fix-forward する）
3. **再生成で解決** — `drizzle-kit generate --name X` で Drizzle に正しい SQL・snapshot を生成させる
4. **`DIRECT_URL` を使う** — Neon の pooler URL は migration 用の advisory lock を壊すため、適用時は必ず `DIRECT_URL`（または非 pooler の `DATABASE_URL`）を使う

---

## Phase 1: 診断

### 1-1. snapshot とローカル schema の整合性チェック

```bash
pnpm --filter @repo/server-core db:check
```

出力から以下を読み取る:
- エラーなし → snapshot 系は正常。問題は DB 側にある可能性が高い
- `collisions detected` / `snapshot mismatch` → 同じバージョンを差す snapshot が複数ある／snapshot がずれている
- `there are schema changes` の指摘 → schema.ts と snapshot に差がある（未生成 migration あり）

### 1-2. DB 側の適用履歴を取得

`drizzle-kit` には Prisma の `migrate status` 相当が無いので、`drizzle.__drizzle_migrations` テーブルを直接見る。

```bash
psql "$DIRECT_URL" -c "
  SELECT id, hash, created_at,
         to_timestamp(created_at/1000) AT TIME ZONE 'UTC' AS applied_at_utc
  FROM drizzle.__drizzle_migrations
  ORDER BY id;
"
```

参照点:
- `_journal.json` の `entries[].tag`（= migration ファイル名 prefix）と `entries[].when`（= ms epoch）
- 適用済み migration の hash は `meta/{idx}_snapshot.json` のハッシュに対応

判定:
- DB の行数 < `_journal.json` の `entries` 数 → 未適用 migration あり
- DB の行数 > `_journal.json` の `entries` 数 → コードで migration が消えている／別ブランチの履歴を引きずっている
- hash がローカルと食い違う → 適用済み migration の SQL を後から書き換えた（ケースD）

### 1-3. 共有環境適用済みかの判定

```bash
git log main -- packages/server-core/db/migrations/ --oneline
git show main:packages/server-core/db/migrations/meta/_journal.json 2>/dev/null | jq '.entries[].tag'
```

判定基準:
- main の `_journal.json` に含まれる tag → **共有環境適用済み**（削除・改変禁止）
- main に存在しない tag → **未適用**（削除＋再生成可能）

### 1-4. 失敗した migrate の痕跡確認

`db:migrate` 実行ログに以下が含まれていたら、SQL 途中失敗の可能性:
- `error: relation "X" already exists` / `does not exist`
- `error: column "X" already exists`
- `advisory lock` 取得失敗 → pooler URL を使ってしまっている

部分適用の有無は psql で直接確認する:

```bash
psql "$DIRECT_URL" -c "\dt" | grep -E '想定テーブル名'
psql "$DIRECT_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = '...'"
```

---

## Phase 2: ケース分類と対応

診断結果から該当ケースを判定し、対応を実行する。

### ケースA: 未適用 migration の SQL 破損・途中失敗

**識別**: `db:migrate` 実行中エラー、または DB に部分適用された痕跡あり

**条件**: 壊れた migration が main の `_journal.json` に存在しない（共有環境未適用）

**対応手順**:
1. 壊れた migration のファイル名（例: `0007_xxx.sql`）と tag を特定する
2. DB に部分適用された痕跡を手動で巻き戻す（必要な範囲のみ）。例:
   ```bash
   psql "$DIRECT_URL" -c "DROP TABLE IF EXISTS \"foo\";"
   ```
   ※ 破壊操作になるため AskUserQuestion で必ず確認
3. drizzle-kit に migration を取り下げさせる（インタラクティブ）:
   ```bash
   cd packages/server-core
   pnpm exec drizzle-kit drop
   ```
   → 取り下げる migration を選択（`_journal.json` と該当 `*.sql` / `meta/{idx}_snapshot.json` が自動更新される）
4. 再生成:
   ```bash
   pnpm --filter @repo/server-core db:generate -- --name <適切な名前>
   ```
5. 生成された SQL を Read で確認（手編集はしない）
6. ローカル適用:
   ```bash
   pnpm --filter @repo/server-core db:migrate
   ```

### ケースB: schema 変更済みだが migration 未生成

**識別**: `db:check` で `there are schema changes` 系警告、または `db/migrations/` に最新変更を反映する `*.sql` が無い

**対応手順**:
1. migration 名を schema 変更内容から推測する（例: `add_voice_call_table`）
2. 生成:
   ```bash
   pnpm --filter @repo/server-core db:generate -- --name <推測した名前>
   ```
3. 生成された `*.sql` と `meta/{idx}_snapshot.json` を Read で確認
4. ローカル適用:
   ```bash
   pnpm --filter @repo/server-core db:migrate
   ```

### ケースC: マージ後の migration 衝突（共有環境未適用）

**識別**: `db:check` で `collisions detected`、`_journal.json` の同じ `idx` が複数ある、または rebase 後に snapshot がずれた

**条件**: 衝突している migration が main に存在しない

**対応手順**:
1. main 側の migration 一覧と `_journal.json` を確認:
   ```bash
   git show main:packages/server-core/db/migrations/meta/_journal.json | jq '.entries[].tag'
   ls packages/server-core/db/migrations/
   ```
2. main に存在しない（＝自ブランチで追加した）migration を特定
3. 自ブランチ分を取り下げる:
   ```bash
   cd packages/server-core
   pnpm exec drizzle-kit drop   # 自ブランチで追加した entries を順次取り下げ
   ```
4. 最新 main を取り込む（`git merge main` or `git rebase main`）
5. 再生成:
   ```bash
   pnpm --filter @repo/server-core db:generate -- --name <適切な名前>
   ```
6. `db:check` でクリーンを確認 → `db:migrate` で検証

### ケースD: 適用済み migration（共有環境）を誤編集してしまった

**識別**: ローカルの `*.sql` / `meta/*_snapshot.json` を編集した後、`__drizzle_migrations.hash` と一致しない／チームメンバーの DB と齟齬

**対応手順**:
1. 共有環境適用済みか確認（Phase 1-3）
2. **適用済みの場合**: git から元に戻す
   ```bash
   git checkout main -- packages/server-core/db/migrations/<該当ファイル>
   git checkout main -- packages/server-core/db/migrations/meta/_journal.json
   git checkout main -- packages/server-core/db/migrations/meta/<該当>_snapshot.json
   ```
   追加変更が必要なら **fix-forward migration として新規** `drizzle-kit generate` する
3. **未適用の場合**: ケースA と同じ（`drizzle-kit drop` + 再生成）

### ケースE: ブランチ間 migration 順序依存

**識別**: `db:migrate` で「テーブル/列が存在しない」エラー、または `_journal.json` の `idx` 連番が壊れている

**対応手順**:
1. 依存先 migration が main にあるか確認（Phase 1-3）
2. 最新 main を取り込む
3. 自ブランチの migration を `drizzle-kit drop` で取り下げ＋再生成（ケースC と同じフロー）

### ケースF: worktree 環境での DATABASE_URL / DIRECT_URL 不一致

**識別**: 想定外の DB 状態、別ブランチのデータが見える、または `db:migrate` が pooler URL で `advisory lock` エラー

**対応手順**:
1. 現在の接続 URL を確認:
   ```bash
   grep -E '^(DATABASE_URL|DIRECT_URL)=' .env
   git branch --show-current
   ```
2. ブランチ名と DB 名の整合性を確認（テスト環境は `ensureTestDatabase` ガードに従う）
3. 不一致なら `.env` を修正、またはセットアップスクリプトで再生成
4. **migration 実行時は必ず `DIRECT_URL`**（Neon は pooler 不可）。`drizzle.config.ts` と `db/migrate.ts` は既に `DIRECT_URL` 優先になっているので、`.env` 側に `DIRECT_URL` を設定する

### ケースG: 既存 Prisma DB への baseline 登録（移行直後のみ）

**識別**: Prisma 時代の DB に対して初めて `db:migrate` すると、`0000_*.sql` が「既に存在するテーブルを CREATE しようとして失敗」

**前提**: drizzle の `0000` が生成する schema と Prisma の最終 schema は等価（`prisma migrate diff` で差分 0 確認済み）

**対応手順**:
1. ローカル DB が Prisma 由来であることを確認（テーブルは存在するが `drizzle.__drizzle_migrations` 行が無い）:
   ```bash
   psql "$DIRECT_URL" -c "\dt"
   psql "$DIRECT_URL" -c "SELECT to_regclass('drizzle.__drizzle_migrations');"
   ```
2. baseline を 1 度だけ登録（冪等。既に同じ hash があれば INSERT されない）:
   ```bash
   psql "$DIRECT_URL" -f scripts/db-baseline.sql
   ```
3. 以降は通常通り:
   ```bash
   pnpm --filter @repo/server-core db:migrate
   ```

**注意**: 本番／Preview 環境にも同じ手順を 1 度だけ実行する必要がある。CI から実行する場合も `DIRECT_URL` を使う。

### ケースH: 共有環境での migrate 失敗（ガイドのみ）

**識別**: 共有 DB（main / Preview / Production）への適用ログでエラー、`__drizzle_migrations` に部分適用の痕跡

**このケースは自動修復しない。** 以下のガイドをユーザーに提示する:

1. `__drizzle_migrations` を確認:
   ```sql
   SELECT id, hash, to_timestamp(created_at/1000) AT TIME ZONE 'UTC' AS applied_at
   FROM drizzle.__drizzle_migrations
   ORDER BY id DESC LIMIT 10;
   ```
2. ローカルの `_journal.json` と突き合わせ、未適用／部分適用範囲を特定
3. 対応方針を選択:
   - **ロールバック扱い**: DB 側で「部分適用された DDL」を手動で巻き戻し、`DELETE FROM drizzle.__drizzle_migrations WHERE hash = '...'` で該当行を削除 → 再度 `db:migrate`
   - **適用済みとしてマーク**: 既に DB 状態が migration 後と等価なら、
     ```sql
     INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
     VALUES ('<該当 snapshot hash>', extract(epoch from now()) * 1000);
     ```
     ※ hash は `meta/{idx}_snapshot.json` の生成ハッシュ
4. AskUserQuestion で方針確認してから実行（破壊操作のため）

### ケースI: 共有環境の手動 hotfix 未反映（ガイドのみ）

**識別**: 後続 migration で重複エラー、共有環境にだけ存在するオブジェクト（手動で SQL 投げた）

**このケースは自動修復しない。** 以下のガイドをユーザーに提示する:

1. `drizzle-kit introspect` で DB の実状態から schema を逆引きし、差分を確認:
   ```bash
   cd packages/server-core
   pnpm exec drizzle-kit introspect
   ```
2. 必要な部分だけ正規の `db/schema.ts` に反映
3. 差分を migration として生成: `pnpm --filter @repo/server-core db:generate -- --name catch_up_hotfix`
4. 共有環境では DB 側に既に存在する DDL を再実行すると失敗するため、生成 SQL の該当部分を見直すか、`__drizzle_migrations` に手動 INSERT して「適用済み」扱いにする（ケースH 参照）

---

## Phase 3: 検証

修復後、以下を実行して正常性を確認する。

```bash
# 1. snapshot 系の整合性
pnpm --filter @repo/server-core db:check

# 2. ローカルへ適用（冪等）
pnpm --filter @repo/server-core db:migrate

# 3. 履歴テーブルが期待通りか
psql "$DIRECT_URL" -c "
  SELECT id, hash, to_timestamp(created_at/1000) AT TIME ZONE 'UTC' AS applied_at
  FROM drizzle.__drizzle_migrations
  ORDER BY id;
"

# 4. schema.ts と DB の差が無いか（任意・差分があれば schema or DB 側に未反映あり）
cd packages/server-core
pnpm exec drizzle-kit introspect --out=/tmp/drizzle-introspect-check
diff -r db/schema.ts /tmp/drizzle-introspect-check/schema.ts || true
```

すべて正常なら修復完了を報告する。

---

## 安全ガード（必須チェック）

以下は修復操作の前に必ず確認する。1 つでも失敗したら操作を中止し、ユーザーに報告する。

| チェック | 確認方法 | 失敗時の対応 |
|---------|---------|-------------|
| 共有環境適用済み migration の保護 | `git show main:packages/server-core/db/migrations/meta/_journal.json` で main 上の存在を確認 | main にある migration / snapshot は削除・改変禁止。ケースD/H/I の手順に切替 |
| 接続 URL の正当性 | `.env` の `DIRECT_URL` が pooler でないこと、ブランチと整合 | 不一致なら修正を提案し、ユーザー確認後に続行 |
| 削除・取り下げ対象の明示 | 取り下げる migration tag を表示 | AskUserQuestion で確認してから `drizzle-kit drop` を実行 |
| schema の整合性 | `pnpm --filter @repo/server-core db:check` で snapshot 整合チェック | エラーがある場合は schema or snapshot 修正を優先 |
| 破壊 SQL の事前確認 | 巻き戻し SQL（`DROP TABLE` 等）はドライランで内容提示 | AskUserQuestion で承認後に実行 |

---

## フロー全体図

```
診断（Phase 1）
  ├─ drizzle-kit check（snapshot 整合）
  ├─ __drizzle_migrations 取得（DB 適用履歴）
  ├─ 共有環境チェック（main の _journal.json）
  └─ 失敗痕跡確認（migrate ログ / 部分適用）
      │
      ▼
ケース分類（Phase 2）
  ├─ 自動修復可能（A / B / C / D未適用 / E / F / G）
  │   ├─ 安全ガードチェック
  │   ├─ ユーザー確認（drop 対象・破壊 SQL の明示）
  │   ├─ drizzle-kit drop で取り下げ（必要に応じ）
  │   ├─ drizzle-kit generate --name X で再生成
  │   └─ db:migrate で検証
  │
  └─ ガイドのみ（D適用済み / H / I）
      ├─ 状況の説明
      ├─ 推奨手順の提示
      └─ AskUserQuestion で方針確認
          │
          ▼
検証（Phase 3）
  ├─ db:check
  ├─ db:migrate（冪等再適用）
  └─ __drizzle_migrations の最終状態確認
```

<!-- @einja:project-private:start id="einja-migration-fix-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
