<!-- @einja:managed:start -->
# データベース設計ガイドライン

## 概要

このドキュメントでは、PostgreSQLを使用したデータベース設計のベストプラクティスとDrizzle ORMスキーマの実装ガイドラインを説明します。

---

## 目次

1. [PostgreSQL日付型の使い分け](#1-postgresql日付型の使い分け)
2. [PostgreSQL型とDrizzle column typesのマッピング](#2-postgresql型とdrizzle-column-typesのマッピング)
3. [推奨Drizzleテンプレート](#3-推奨drizzleテンプレート)
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

## 2. PostgreSQL型とDrizzle column typesのマッピング

### 型マッピング表

| Drizzle定義 | PostgreSQL型 | 推奨度 |
|------------|-------------|-------|
| `timestamp("col", { precision: 3 })` | `timestamp(3)` タイムゾーンなし | ❌ 非推奨 |
| `timestamp("col", { withTimezone: true, precision: 6 })` | `timestamptz(6)` | ✅ 推奨 |
| `date("col")` | `date` | ✅ 推奨（日付のみの場合） |
| `time("col")` | `time` | ✅ 推奨（時刻のみの場合） |
| `time("col", { withTimezone: true })` | `timetz` | ✅ 推奨（タイムゾーン付き時刻） |

### よく使う型のマッピング

| Drizzle定義 | PostgreSQL型 | 用途 |
|------------|-------------|------|
| `text("col")` | `text` | 可変長文字列（推奨） |
| `varchar("col", { length: 255 })` | `varchar(255)` | 長さ制限が必要な文字列 |
| `integer("col")` | `integer` | 32bit整数 |
| `bigint("col", { mode: "number" })` | `bigint` | 64bit整数（jsの`number`として扱う） |
| `boolean("col")` | `boolean` | 真偽値 |
| `jsonb("col")` | `jsonb` | JSONバイナリ（推奨、検索可能） |
| `json("col")` | `json` | JSON文字列 |
| `uuid("col")` | `uuid` | UUID |

### 重要な注意点

- **Drizzleの `timestamp()` 型のデフォルトは `withTimezone: false`**（タイムゾーンなし）です
- **必ず `{ withTimezone: true }` を明示的に指定する**ことで、タイムゾーン対応になります
- 既存のスキーマで `withTimezone: true` が省略されている場合、タイムゾーンなし（`timestamp`）で動作しています
- `precision` はミリ秒精度を指定（`3` = ミリ秒、`6` = マイクロ秒）。デフォルトはDBドライバ依存のため明示推奨
- ID生成（cuid/uuid等）は**アプリ層**で行う方針（Drizzle schemaに `.default()` を置かない）

---

## 3. 推奨Drizzleテンプレート

### 基本パターン

```typescript
import { relations } from "drizzle-orm";
import { date, pgTable, text, time, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),

    // 日時（タイムゾーン付き）- 推奨
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // 日付のみ
    birthDate: date("birth_date"),

    // 時刻のみ（必要に応じて）
    preferredTime: time("preferred_time"),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);
```

#### ID生成の補足

```typescript
// アプリ層（Repository / Service）でID採番
import { createId } from "@paralleldrive/cuid2";

await db.insert(users).values({
  id: createId(),
  email: "foo@example.com",
  name: "Foo",
});
```

UUIDが必要な場合は `crypto.randomUUID()` または `uuid()` カラム + DB側 `defaultRandom()` を選択。

### ログテーブルのパターン

```typescript
import { relations } from "drizzle-orm";
import { foreignKey, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),

    // ログはタイムゾーン付きで記録（必須）
    occurredAt: timestamp("occurred_at", { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "activity_logs_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));
```

### イベント管理のパターン

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),

  // イベント開始日時（タイムゾーン付き）
  startAt: timestamp("start_at", { withTimezone: true, precision: 6 }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, precision: 6 }).notNull(),

  // 登録日時
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
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

- **必ず `timestamp("col", { withTimezone: true })` を使用する**
- タイムゾーンなし（`withTimezone: false` / 省略）は使用禁止

---

## 5. 既存スキーマとの整合性に関する注意

### 既存カラムの変更はスコープ外

このガイドラインは**新規カラム追加時に適用**します。

- **既存の `createdAt` / `updatedAt` カラムが `withTimezone: true` なしで定義されている場合**:
  - 既存カラムの変更は別タスクで実施（マイグレーションリスクあり）
  - 新規追加カラムのみ `{ withTimezone: true }` を使用する

### 移行手順（既存カラムを変更する場合）

既存の `timestamp(3)` を `timestamptz` に変更する場合の手順:

```typescript
// Before
export const users = pgTable("users", {
  createdAt: timestamp("created_at", { precision: 3 }).notNull().defaultNow(),
});

// After
export const users = pgTable("users", {
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
    .notNull()
    .defaultNow(),
});
```

**マイグレーション実行**:

```bash
pnpm db:generate
pnpm db:migrate
```

**注意**: 既存データは自動的にタイムゾーン付きに変換されます（PostgreSQLが現在のタイムゾーン設定でUTCに変換）。

### 新規テーブル作成時

新規テーブルを作成する場合は、**必ず `{ withTimezone: true }` を使用**してください。

```typescript
export const newFeatures = pgTable("new_features", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),

  // 必ず withTimezone: true を明示
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

---

## まとめ

### チェックリスト

新規カラム追加時の確認事項:

- [ ] 日時カラムは `timestamp("col", { withTimezone: true })` を使用しているか
- [ ] 日付のみのカラムは `date("col")` を使用しているか
- [ ] タイムゾーンなし（`withTimezone: false` / 省略）を使用していないか
- [ ] ログやイベント日時は必ず `withTimezone: true` を指定しているか
- [ ] `updatedAt` は `$onUpdate(() => new Date())` を付けているか
- [ ] ID採番はアプリ層で行う方針になっているか（schemaに `.default()` を置かない）

### 参考資料

- [PostgreSQL 公式ドキュメント - Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [Drizzle ORM 公式ドキュメント](https://orm.drizzle.team/docs/overview)
- [Drizzle ORM - PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg)
<!-- @einja:managed:end -->

---

<!-- @einja:project-private:start id="database-guidelines-project" -->
## プロジェクト固有: Drizzleスキーマ編集ルール

### テーブル名の命名規則

- pgTable第1引数（DB上のテーブル名）は**スネークケース**（例: `user_profiles`, `order_items`）
- TypeScriptのexport変数名は**キャメルケース複数形**（例: `userProfiles`, `orderItems`）

```typescript
export const userProfiles = pgTable("user_profiles", {
  // ...
});
```

> 注: 既存スキーマでNextAuth互換のためPascalCaseテーブル名（`User`, `Account` 等）を採用している箇所は、Prismaデフォルトとの互換を維持するために残してある。新規テーブルはスネークケースで定義すること。

### カラム名の命名規則

- TypeScriptのプロパティ名は**キャメルケース**（例: `customerId`, `firstName`）
- カラム定義の第1引数（DB上のカラム名）は**スネークケース**を指定する

```typescript
customerId: text("customer_id").notNull(),
firstName: text("first_name").notNull(),
```

### 必須・非必須の判定

- 指示されている、自明である、または他データソースによって確実に判定できる場合のみ `.notNull()` を設定する
- **推測で決定しない**。不明な場合は必ずユーザーに確認すること

### IDの採番

- `id` は **cuid** で自動採番を原則とする
- 採番は**アプリ層**（Repository等）で行い、Drizzle schemaには `.default()` を置かない

```typescript
// schema
id: text("id").primaryKey(),

// repository
import { createId } from "@paralleldrive/cuid2";
await db.insert(users).values({ id: createId(), ... });
```

### createdAt / updatedAt

- 原則としてすべてのテーブルに適用する
- `{ withTimezone: true, precision: 6 }` を必ず明示する（PostgreSQL公式推奨）
- `updatedAt` は `$onUpdate(() => new Date())` でDrizzle側自動更新を有効化する

```typescript
createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
  .notNull()
  .defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date()),
```

### 外部キーの削除ポリシー

- 外部キーを持つリレーションは、基本的に `onDelete: "cascade"` の適用を検討する
- 制約名は **明示的に指定** することを推奨（drizzle-kitが生成する自動命名を避け、差分検出ノイズを減らす）

```typescript
import { foreignKey, pgTable, text } from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    // ...
  },
  (t) => [
    foreignKey({
      name: "posts_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);
```

### relations の定義

- クエリビルダーで `with` を使う場合は `relations()` を必ず定義する
- relationsはschemaファイル末尾にまとめて記述する

```typescript
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));
```
<!-- @einja:project-private:end -->
