-- =============================================================================
-- Drizzle baseline marker for databases already migrated by Prisma.
--
-- Purpose:
--   既に Prisma の migration が適用された開発者のローカル DB / Neon 環境に対し、
--   drizzle-kit が 0000 ベースラインを「再実行」しないように `drizzle.__drizzle_migrations`
--   テーブルに「適用済み」エントリを 1 度だけ挿入する。
--
--   drizzle 0000 が生成する schema と Prisma migration の最終形は等価
--   (`prisma migrate diff` で差分 0 を確認済み) のため、DDL 自体は実行せず、
--   migration 履歴テーブルに記録するだけで OK。
--
-- Usage:
--   既存 Prisma DB に対して 1 度だけ実行:
--     psql "$DATABASE_URL" -f scripts/db-baseline.sql
--   その後は通常通り:
--     pnpm --filter @repo/server-core db:migrate
--
-- 安全性:
--   - 冪等: 既に同じ hash の行があれば INSERT は実行されない (ON CONFLICT 相当を WHERE で実現)
--   - 破壊操作なし: CREATE / INSERT のみ
--
-- 参照:
--   - hash: db/migrations/meta/_journal.json の entries[0] に紐づく snapshot ハッシュ
--   - drizzle-orm/node-postgres migrator が参照するテーブル構造に準拠
-- =============================================================================

-- 1. drizzle スキーマ確保
CREATE SCHEMA IF NOT EXISTS drizzle;

-- 2. drizzle migrator が利用する履歴テーブル (drizzle-orm が初回 migrate で作るのと同形)
CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
);

-- 3. ベースライン (0000_lowly_george_stacy) を「適用済み」としてマーク
--    既に存在する場合はスキップ (冪等)
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
SELECT
    'f128b0c44ff5589d434a8f1b8c00200cc5142337d56f369ddd662c2e7f07267a',
    (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
WHERE NOT EXISTS (
    SELECT 1 FROM drizzle."__drizzle_migrations"
    WHERE hash = 'f128b0c44ff5589d434a8f1b8c00200cc5142337d56f369ddd662c2e7f07267a'
);
