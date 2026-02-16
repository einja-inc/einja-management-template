<!-- @einja:managed:start -->
# データベース設計ガイドライン

## 概要

このドキュメントでは、PostgreSQLを使用したデータベース設計のベストプラクティスとPrismaスキーマの実装ガイドラインを説明します。

---

## 目次

1. [PostgreSQL日付型の使い分け](#1-postgresql日付型の使い分け)
2. [PrismaのDateTimeとPostgreSQL型のマッピング](#2-prismaのdatetimeとpostgresql型のマッピング)
3. [推奨Prismaテンプレート](#3-推奨prismaテンプレート)
4. [timestamp（タイムゾーンなし）を避ける理由](#4-timestampタイムゾーンなしを避ける理由)
5. [既存スキーマとの整合性に関する注意](#5-既存スキーマとの整合性に関する注意)

---

## 1. PostgreSQL日付型の使い分け

### 用途別の型選択表

| PostgreSQL型 | 用途例 | 保存される情報 |
|-------------|-------|--------------|
| `date` | 誕生日、締日、予約日（日付のみ） | 日付のみ（例: `2025-01-15`） |
| `timestamptz`（**推奨**） | created_at、updated_at、ログ、イベント日時 | タイムスタンプ + タイムゾーン |
| `time` / `timetz` | 営業時間、定期実行時刻 | 時刻のみ |
| `timestamp`（**非推奨**） | 使用禁止 | タイムゾーンなしタイムスタンプ |

### 選択基準

- **日付のみが重要な場合**: `date`
  - 例: ユーザーの誕生日、契約締日
- **日時が重要で、タイムゾーンを考慮する必要がある場合**: `timestamptz`（推奨）
  - 例: ログ、イベント発生日時、created_at/updated_at
- **時刻のみが重要な場合**: `time` / `timetz`
  - 例: 店舗の営業時間、定期バッチ実行時刻

---

## 2. PrismaのDateTimeとPostgreSQL型のマッピング

### 型マッピング表

| Prisma定義 | PostgreSQL型 | 推奨度 |
|-----------|-------------|-------|
| `DateTime`（デフォルト） | `timestamp(3)` タイムゾーンなし | ❌ 非推奨 |
| `DateTime @db.Timestamptz` | `timestamptz` | ✅ 推奨 |
| `DateTime @db.Date` | `date` | ✅ 推奨（日付のみの場合） |
| `DateTime @db.Time` | `time` | ✅ 推奨（時刻のみの場合） |

### 重要な注意点

- **Prismaの `DateTime` 型のデフォルトは `timestamp(3)`**（タイムゾーンなし）です
- **必ず `@db.Timestamptz` を明示的に指定する**ことで、タイムゾーン対応になります
- 既存のスキーマで `@db.Timestamptz` が省略されている場合、タイムゾーンなしで動作しています

---

## 3. 推奨Prismaテンプレート

### 基本パターン

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String

  // 日時（タイムゾーン付き）- 推奨
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  // 日付のみ
  birthDate DateTime @db.Date

  // 時刻のみ（必要に応じて）
  preferredTime DateTime? @db.Time

  @@map("users")
}
```

### ログテーブルのパターン

```prisma
model ActivityLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  metadata  Json?

  // ログはタイムゾーン付きで記録（必須）
  occurredAt DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("activity_logs")
}
```

### イベント管理のパターン

```prisma
model Event {
  id          String   @id @default(cuid())
  title       String
  description String?

  // イベント開始日時（タイムゾーン付き）
  startAt DateTime @db.Timestamptz
  endAt   DateTime @db.Timestamptz

  // 登録日時
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  @@map("events")
}
```

---

## 4. timestamp（タイムゾーンなし）を避ける理由

### 問題1: サーバーのタイムゾーン設定に依存

```sql
-- タイムゾーンなし（timestamp）の場合
INSERT INTO users (created_at) VALUES ('2025-01-15 10:00:00');
-- サーバーのTZ設定が Asia/Tokyo なら JST として解釈
-- サーバーのTZ設定が UTC なら UTC として解釈
-- 同じデータが環境によって異なる意味になる
```

```sql
-- タイムゾーン付き（timestamptz）の場合
INSERT INTO users (created_at) VALUES ('2025-01-15 10:00:00+09:00');
-- 常に UTC に変換して保存（内部的に 2025-01-15 01:00:00 UTC）
-- 取得時にクライアントのTZに変換して返却
-- 環境に依存せず一貫した動作
```

### 問題2: マルチリージョン展開で不整合が発生

- **タイムゾーンなし**: 日本リージョンとUSリージョンで同じタイムスタンプが異なる意味になる
- **タイムゾーン付き**: すべてUTCで保存され、表示時のみ各リージョンのTZで変換される

### 問題3: サマータイム（DST）の扱いが曖昧

- **タイムゾーンなし**: サマータイム切り替え時に同じ時刻が2回存在する可能性（曖昧性）
- **タイムゾーン付き**: UTCで保存されるため曖昧性がない

### 結論

- **必ず `@db.Timestamptz` を使用する**
- タイムゾーンなし（`timestamp`）は使用禁止

---

## 5. 既存スキーマとの整合性に関する注意

### 既存カラムの変更はスコープ外

このガイドラインは**新規カラム追加時に適用**します。

- **既存の `createdAt` / `updatedAt` カラムが `@db.Timestamptz` なしで定義されている場合**:
  - 既存カラムの変更は別タスクで実施（マイグレーションリスクあり）
  - 新規追加カラムのみ `@db.Timestamptz` を使用する

### 移行手順（既存カラムを変更する場合）

既存の `timestamp(3)` を `timestamptz` に変更する場合の手順:

```prisma
// Before
model User {
  createdAt DateTime @default(now())
}

// After
model User {
  createdAt DateTime @default(now()) @db.Timestamptz
}
```

**マイグレーション実行**:

```bash
pnpm prisma migrate dev --name change_timestamp_to_timestamptz
```

**注意**: 既存データは自動的にタイムゾーン付きに変換されます（PostgreSQLが現在のタイムゾーン設定でUTCに変換）。

### 新規テーブル作成時

新規テーブルを作成する場合は、**必ず `@db.Timestamptz` を使用**してください。

```prisma
model NewFeature {
  id        String   @id @default(cuid())
  name      String

  // 必ず @db.Timestamptz を明示
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  @@map("new_features")
}
```

---

## まとめ

### チェックリスト

新規カラム追加時の確認事項:

- [ ] 日時カラムは `@db.Timestamptz` を使用しているか
- [ ] 日付のみのカラムは `@db.Date` を使用しているか
- [ ] タイムゾーンなし（`timestamp`）を使用していないか
- [ ] ログやイベント日時は必ず `timestamptz` を使用しているか

### 参考資料

- [PostgreSQL 公式ドキュメント - Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [Prisma 公式ドキュメント - PostgreSQL connector](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#postgresql)
<!-- @einja:managed:end -->

---

<!-- @einja:seed:start id="database-guidelines-project" -->
## プロジェクト固有の設定

<!-- このセクションはプロジェクト固有の内容を追記する場所です -->
<!-- einja syncで上書きされません -->
<!-- @einja:seed:end -->
