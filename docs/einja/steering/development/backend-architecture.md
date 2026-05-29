<!-- @einja:managed:start -->
# バックエンドアーキテクチャ

## タスク: Turborepo Next.js モノレポ構築 (20251104)

**反映日時**: 2025-11-17
**ソース**: docs/specs/tasks/monorepo/20251104-monorepo-turborepo-nextjs-setup/
**抽出元**: design/architecture.md, design/implementation.md

---

## 概要

Vercel TurborepoとNext.jsをベースとしたエンタープライズグレードのモノレポアーキテクチャです。

複数のアプリケーション（Web、Admin、Cron Worker）と1つの共有パッケージ（@repo/server-core）を統合し、**4層レイヤードアーキテクチャ**と**Result型パターン**による型安全なバックエンド開発を実現します。

### 主要な技術的課題と解決方針

1. **コードの重複と保守性**
   - 解決策: @repo/server-core による DRY 原則の徹底
   - Repositoryパターンでドメイン層とインフラ層を分離
   - Mapperパターンで Drizzle ⇔ Domain の変換を Infrastructure層に集約

2. **型安全性とエラーハンドリング**
   - 解決策: Result型パターンによる例外を使わないエラーハンドリング
   - Hono + zValidatorによるリクエストバリデーションの型安全性
   - ApplicationErrorクラス階層による構造化されたエラー表現

3. **モジュールエクスポート管理**
   - 解決策: **index.ts完全不使用方針**
   - package.jsonのワイルドカードexports (`"./*": "./src/*.ts"`)
   - ファイル追加時のpackage.json更新不要（自動対応）

---

## 1. ディレクトリ構造

### モノレポ全体構造

```
project-root/
├── apps/
│   ├── web/              # メインWebアプリ（Next.js 14 App Router）
│   ├── admin/            # 管理画面（Next.js 14 App Router）
│   └── cron-worker/      # バッチ処理（CLI型）
│
├── packages/
│   └── server-core/      # 共有バックエンドロジック⭐
│       ├── db/               # Drizzleスキーマ・クライアント⭐
│       │   ├── schema.ts     # Drizzleスキーマ定義（pgTable等）
│       │   ├── client.ts     # DBクライアント（globalThisキャッシュ）
│       │   ├── migrate.ts    # マイグレーション実行
│       │   ├── seed.ts       # シードデータ投入
│       │   └── migrations/   # drizzle-kit生成のマイグレーションSQL
│       │
│       └── src/
│           ├── core/             # アーキテクチャのコア（Result型等）
│           ├── domain/           # Domain層
│           └── infrastructure/   # Infrastructure層
│
├── apps/
│   ├── web/src/application/        # Application層（webアプリ固有）⭐
│   ├── admin/src/application/      # Application層（adminアプリ固有）⭐
│   └── cron-worker/src/application/ # Application層（cron-worker固有）⭐
│
├── biome.json            # ルートLinter設定
├── tsconfig.base.json    # ベースTS設定
├── turbo.json            # Turborepo設定
├── pnpm-workspace.yaml   # ワークスペース定義
└── docker-compose.yml    # PostgreSQL動的ポート設定
```

### apps/ の役割

| アプリ | ポート | 用途 | 技術スタック |
|-------|-------|------|------------|
| **web** | 3000 | メインWebアプリケーション | Next.js 14 App Router + Hono API |
| **admin** | 4000 | 管理画面 | Next.js 14 App Router + Hono API |
| **cron-worker** | 5000 | バッチ処理（CLI型） | Next.js + tsx実行 |

**Worktree環境対応**: ブランチ名のMD5ハッシュから動的にポート番号を計算し、複数ブランチの並行開発をサポート。

---

### @repo/server-core の内部構造（4層アーキテクチャ）

```
packages/server-core/
├── db/                      # 📦 Drizzle DB層（@repo/server-core/db で配布）
│   ├── schema.ts            # pgTable / pgEnum / relations 定義⭐
│   ├── client.ts            # Drizzle DB クライアント（globalThisキャッシュ）⭐
│   ├── migrate.ts           # マイグレーション実行スクリプト
│   ├── seed.ts              # シードデータ投入スクリプト
│   └── migrations/          # drizzle-kit 生成の SQL マイグレーション
│
├── src/
│   ├── domain/              # 📗 Domain層（ビジネスロジック）
│   │   ├── entities/        # エンティティ
│   │   │   ├── User.ts
│   │   │   ├── Post.ts
│   │   │   └── Session.ts
│   │   │
│   │   ├── value-objects/   # 値オブジェクト
│   │   │   ├── Email.ts
│   │   │   └── Password.ts
│   │   │
│   │   ├── repository-interfaces/  # リポジトリインターフェース⭐
│   │   │   ├── IUserRepository.ts
│   │   │   ├── IPostRepository.ts
│   │   │   └── ISessionRepository.ts
│   │   │
│   │   └── validators/      # Zodバリデーター
│   │       ├── user.ts
│   │       ├── post.ts
│   │       └── session.ts
│   │
│   ├── infrastructure/      # 📙 Infrastructure層（実装）
│   │   ├── database/
│   │   │   ├── client.ts    # db/client.ts の re-export⭐
│   │   │   │
│   │   │   ├── repositories/  # リポジトリ実装⭐
│   │   │   │   ├── UserRepository.ts
│   │   │   │   ├── PostRepository.ts
│   │   │   │   └── SessionRepository.ts
│   │   │   │
│   │   │   └── mappers/      # Drizzle Row ⇔ Domain変換⭐
│   │   │       ├── UserMapper.ts
│   │   │       ├── PostMapper.ts
│   │   │       └── SessionMapper.ts
│   │   │
│   │   ├── email/           # メール送信
│   │   │   ├── EmailService.ts
│   │   │   └── ResendEmailService.ts
│   │   │
│   │   └── storage/         # ストレージ
│   │       ├── StorageService.ts
│   │       └── S3StorageService.ts
│   │
│   └── core/                # アーキテクチャのコア
│       └── result.ts        # Result型定義⭐
│
└── package.json
    └── "exports": { "./*": "./src/*.ts" }  # index.ts不使用⭐
```

---

## 2. 4層レイヤードアーキテクチャ

### アーキテクチャ図

```mermaid
graph TD
    subgraph "Frontend (React)"
        UI[UI Components]
        TQ[Tanstack Query]
        HC[Hono Client]
    end

    subgraph "📕 Presentation層 (API Routes)"
        Router[Hono Router]
        Validator[zValidator + Zod]
        Handler[Route Handler]
    end

    subgraph "📘 Application層 (UseCases)"
        UC[UseCase<br/>Object Literal]
        ResultCompose[Result Composition<br/>flatMap / map]
    end

    subgraph "📗 Domain層"
        Entity[Domain Entities]
        VO[Value Objects]
        RepoIF[Repository<br/>Interfaces ⭐]
    end

    subgraph "📙 Infrastructure層"
        Mapper[Mapper Objects<br/>Drizzle Row ⇔ Domain]
        RepoImpl[Repository<br/>Implementation]
        DrizzleDB[Drizzle DB<br/>db/client.ts]
    end

    subgraph "Database"
        DB[(PostgreSQL / Neon)]
    end

    UI --> TQ
    TQ --> HC
    HC --> Router
    Router --> Validator
    Validator --> Handler
    Handler --> UC
    UC --> ResultCompose
    ResultCompose --> RepoIF
    RepoIF -.implements.-> RepoImpl
    RepoImpl --> Mapper
    RepoImpl --> DrizzleDB
    Mapper --> Entity
    UC --> Entity
    DrizzleDB --> DB
```

### 各層の責務と配置

#### 📕 Presentation層（API Routes）

**配置**: `apps/web/src/app/api/rpc/{domain}/`, `apps/admin/src/app/api/rpc/{domain}/`

**責務**:
- HTTPリクエスト/レスポンスの処理
- Zodバリデーション（zValidator）
- UseCaseの呼び出し
- エラーのHTTPステータスコードへのマッピング

**技術**: Hono、zValidator、Zod

**エントリーポイント**: `/api/rpc/{domain}/[[...route]]/route.ts` （ドメインベースRPC分割）

**実装例**:
```typescript
// apps/web/src/app/api/rpc/posts/[[...route]]/route.ts
import { postRoutes } from "@web/server/presentation/routes/postRoutes"
import { Hono } from "hono"
import { handle } from "hono/vercel"

const app = new Hono()
  .basePath("/api/rpc/posts")
  .use("/*", authMiddleware)
const routes = app.route("/", postRoutes)

export type PostsAppType = typeof routes

export const GET = handle(app)
export const POST = handle(app)
```

---

#### 📘 Application層（UseCases）

**配置**: `apps/*/src/application/use-cases/` （各アプリケーション固有）⭐

**重要**: Application層は各アプリケーション（web、admin、cron-worker）に配置します。@repo/server-coreには配置しません。

**責務**:
- ビジネスフロー（複数Repositoryの調整）
- トランザクション管理
- Result型による安全なエラー伝播

**技術**: Result型、UseCase統合パターン

**設計パターン: UseCase統合パターン**

従来のCRUD操作ごとにファイルを分けるのではなく、**リソース単位で1ファイルに統合**します。

```typescript
// ❌ 旧パターン: CRUD操作ごとにファイル分割（過度な細分化）
// - ListPostsUseCase.ts
// - CreatePostUseCase.ts
// - UpdatePostUseCase.ts
// - DeletePostUseCase.ts

// ✅ 新パターン: リソース単位で統合（シンプル）
// apps/web/src/application/use-cases/PostUseCases.ts

// 型定義例
export type PostSearchCriteria = {
  userId?: string
  published?: boolean
  createdAfter?: Date
}

export type CreatePostInput = {
  title: string
  content: string
  userId: string
}

export type UpdatePostInput = {
  title?: string
  content?: string
  published?: boolean
}

export const postUseCases = {
  list: async (criteria: PostSearchCriteria) => {
    // ...
  },

  create: async (data: CreatePostInput) => {
    // ...
  },

  update: async (id: string, data: UpdatePostInput) => {
    // ...
  },

  delete: async (id: string) => {
    // ...
  },
}
```

**メリット**:
- 各ファイル150行程度で十分に可読性が高い
- 関連操作が1箇所にまとまり、変更が容易
- 呼び出しがシンプル: `postUseCases.create()` vs `createPostUseCase(repo).execute()`

---

#### 📗 Domain層（ビジネスロジック）

**配置**: `packages/server-core/src/domain/`

**責務**:
- ビジネスルールの定義
- エンティティと値オブジェクトの管理
- リポジトリインターフェースの定義⭐
- ドメインバリデーション（Zod）

**技術**: TypeScript、Zod

**重要な原則**:
- **インフラ層に依存しない**（Drizzle スキーマや `db` クライアントを知らない）
- リポジトリは**インターフェース**のみ定義
- データベースの実装詳細から独立

**実装例: Entity**

```typescript
// packages/server-core/src/domain/entities/User.ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,  // 値オブジェクト
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}

  // ビジネスロジック
  canDelete(): boolean {
    // 作成後30日以内は削除不可
    const daysSinceCreation = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceCreation > 30
  }
}
```

**実装例: Repository Interface**

```typescript
// packages/server-core/src/domain/repository-interfaces/IUserRepository.ts

// SearchCriteria型: すべてのフィールドはオプショナル
export type UserSearchCriteria = {
  id?: string
  email?: string
  name?: string
  createdAfter?: Date
  createdBefore?: Date
}

export interface IUserRepository {
  find(criteria: UserSearchCriteria): Promise<Result<User | null, DatabaseError>>
  search(criteria: UserSearchCriteria): Promise<Result<User[], DatabaseError>>
  create(user: User): Promise<Result<User, DatabaseError>>
  update(id: string, user: Partial<User>): Promise<Result<User, DatabaseError>>
  delete(id: string): Promise<Result<void, DatabaseError>>
}
```

---

#### 📙 Infrastructure層（実装）

**配置**: `packages/server-core/src/infrastructure/`

**責務**:
- データベースアクセス（Drizzle ORM）
- 外部サービス連携（メール、ストレージ）
- リポジトリインターフェースの**実装**⭐
- Drizzle Row ⇔ Domainエンティティの変換（Mapper）⭐

**技術**: Drizzle ORM、Mapper、外部API

**実装例: Repository Implementation**

```typescript
// packages/server-core/src/infrastructure/database/repositories/UserRepository.ts
import { and, eq } from "drizzle-orm"
import { db } from "../../../../db/client"
import { users } from "../../../../db/schema"
import { failure, type Result, success } from "../../../core/result"
import type {
  CreateUserInput,
  IUserRepository,
  UserSearchCriteria,
} from "../../../domain/repository-interfaces/IUserRepository"
import type { User } from "../../../domain/entities/User"
import { UserMapper } from "../mappers/UserMapper"

/** 検索条件を Drizzle の where 句に変換 */
function buildWhereClause(criteria: UserSearchCriteria) {
  const conditions = []
  if (criteria.id !== undefined) conditions.push(eq(users.id, criteria.id))
  if (criteria.email !== undefined) conditions.push(eq(users.email, criteria.email))
  if (criteria.status !== undefined) conditions.push(eq(users.status, criteria.status))
  return conditions.length > 0 ? and(...conditions) : undefined
}

export const userRepository: IUserRepository = {
  async find(criteria: UserSearchCriteria): Promise<Result<User | null, Error>> {
    try {
      const where = buildWhereClause(criteria)
      const rows = await db.select().from(users).where(where).limit(1)

      if (rows.length === 0) {
        return success(null)
      }

      return success(UserMapper.toDomain(rows[0]))
    } catch (error) {
      return failure(
        error instanceof Error ? error : new Error("Unknown error occurred during user find"),
      )
    }
  },

  async create(input: CreateUserInput): Promise<Result<User, Error>> {
    try {
      const rows = await db
        .insert(users)
        .values({
          id: input.id,
          email: input.email,
          name: input.name,
          // status / role は省略時 DB デフォルト（pending / user）を使用
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
        })
        .returning()

      if (rows.length === 0) {
        return failure(new Error("Failed to create user: no row returned"))
      }

      return success(UserMapper.toDomain(rows[0]))
    } catch (error) {
      return failure(
        error instanceof Error ? error : new Error("Unknown error occurred during user create"),
      )
    }
  },

  // ...
}
```

**実装ポイント**:
- `db.select().from(table).where(...).limit(1)` で単一行検索（`findFirst` 相当）
- `db.insert(table).values(...).returning()` で作成 + 作成行の取得
- すべての操作を `try/catch` で囲み、`Result` 型で返す
- 検索条件は `buildWhereClause` ヘルパーで `and(...)` に集約

**実装例: Mapper**

```typescript
// packages/server-core/src/infrastructure/database/mappers/UserMapper.ts
import { users } from "../../../../db/schema"
import { User, type UserRole, type UserStatus } from "../../../domain/entities/User"

/** Drizzle の $inferSelect で取得した DB 行の型 */
type UserRow = typeof users.$inferSelect

/** Drizzle の $inferInsert による DB 挿入用データの型 */
type UserRowInsert = typeof users.$inferInsert

export const UserMapper = {
  /**
   * Drizzle DB行をドメインの User に変換。
   * enum カラムは Drizzle が pgEnum 定義と一致する値のみ返すため、
   * `satisfies` で型保証しキャストを省く。
   */
  toDomain(row: UserRow): User {
    const status: UserStatus = row.status satisfies UserStatus
    const role: UserRole = row.role satisfies UserRole

    return new User({
      id: row.id,
      email: row.email,
      name: row.name,
      status,
      role,
      createdAt: row.createdAt,
      lastLogin: row.lastLogin,
    })
  },

  /** ドメインの User を DB 挿入用データに変換 */
  toRowInsert(user: User): UserRowInsert {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status satisfies UserRow["status"],
      role: user.role satisfies UserRow["role"],
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }
  },

  /** ドメインの User を DB 更新用データに変換 */
  toRowUpdate(user: User): Partial<UserRowInsert> {
    return {
      name: user.name,
      status: user.status satisfies UserRow["status"],
      role: user.role satisfies UserRow["role"],
      lastLogin: user.lastLogin,
    }
  },
}
```

**Mapper設計のポイント**:
- `class` ではなく **オブジェクトリテラル** で実装（`UserMapper.toDomain(row)` で呼び出し）
- 行型は `typeof users.$inferSelect`、挿入型は `typeof users.$inferInsert` で Drizzle スキーマから自動推論
- `pgEnum` で定義した enum カラムは、ドメインの `UserStatus` / `UserRole` リテラル型と `satisfies` で整合チェック

---

### 層間の依存関係ルール

```
上位層 → 下位層のみ依存可能

Presentation → Application → Domain ← Infrastructure
                                ↑
                        インターフェースに依存
```

**重要な原則**:
1. **Presentation層**: Application層のUseCaseを呼び出す
2. **Application層**: Domain層のエンティティとリポジトリ**インターフェース**を使用
3. **Domain層**: どの層にも依存しない（最も純粋）
4. **Infrastructure層**: Domain層の**インターフェース**を実装

この設計により：
- ✅ テストが容易（モックRepositoryで差し替え可能）
- ✅ データベースの変更がドメイン層に影響しない
- ✅ ビジネスロジックが永続化の詳細から独立

---

## 3. デザインパターン

### 3.1 Repositoryパターン

**目的**: データアクセスロジックの抽象化

**設計の特徴**:
- **検索条件ベース設計**: `find(criteria)`, `search(criteria)` で統一
- **Result型**: すべてのメソッドがResult型を返す
- **SearchCriteria**: 柔軟な検索条件（すべてのフィールドはオプショナル）

**SearchCriteria型の設計原則**:
```typescript
// ✅ すべてのフィールドはオプショナル
export type UserSearchCriteria = {
  id?: string
  email?: string
  name?: string
  createdAfter?: Date
  createdBefore?: Date
}

// ❌ 必須フィールドを設けない
export type UserSearchCriteria = {
  email: string  // NG: 必須にすると柔軟性が失われる
  name?: string
}
```

**重要な原則**:
- すべての検索条件フィールドは**オプショナル**とする
- これにより、同一のRepositoryメソッドで多様な検索パターンに対応可能
- 必須パラメータはメソッドの引数として別途定義する（例: `update(id: string, data)`）

**主要メソッド**:

| メソッド | 説明 | 返り値 |
|---------|------|--------|
| `find(criteria)` | 単一レコード検索 | `Result<T \| null, E>` |
| `search(criteria, options)` | 複数レコード検索 | `Result<T[], E>` |
| `create(entity)` | 作成 | `Result<T, E>` |
| `update(id, data)` | 更新 | `Result<T, E>` |
| `delete(id)` | 削除 | `Result<void, E>` |
| `exists(criteria)` | 存在確認 | `Result<boolean, E>` |
| `count(criteria)` | カウント | `Result<number, E>` |

---

### 3.2 Mapperパターン

**目的**: Drizzle DB 行 ⇔ Domain エンティティの変換

**設計のポイント**:
- Infrastructure層に配置
- 変換ロジックを一箇所に集約
- Domain層を Drizzle スキーマ（`typeof table.$inferSelect`）の実装詳細から保護
- 行型は `$inferSelect`、挿入型は `$inferInsert` から自動推論

**変換方向**:
1. **toDomain**: Drizzle DB 行（`$inferSelect`）から Domain エンティティへ
2. **toRowInsert**: Domain エンティティから DB 挿入用データ（`$inferInsert`）へ
3. **toRowUpdate**: Domain エンティティから DB 更新用データ（`Partial<$inferInsert>`）へ

---

### 3.3 Result型パターン

**目的**: 例外を使わないエラー表現

**型定義**:
```typescript
// packages/server-core/src/core/result.ts
type Success<T> = { isSuccess: true; value: T }
type Failure<E> = { isSuccess: false; error: E }
type Result<T, E> = Success<T> | Failure<E>

// ヘルパー関数
export function success<T>(value: T): Success<T> {
  return { isSuccess: true, value }
}

export function failure<E>(error: E): Failure<E> {
  return { isSuccess: false, error }
}
```

**使用例**:
```typescript
// UseCase
const userResult = await userRepository.find({ email })
if (!userResult.isSuccess) {
  return failure(userResult.error)  // エラーを伝播
}

const user = userResult.value
// 型安全: userResult.isSuccessのチェック後は、user は User型として扱える
```

**メリット**:
- ✅ 型レベルでエラーハンドリングを強制
- ✅ try-catchが不要
- ✅ flatMap/mapでエラーをチェーン可能

---

## 4. パッケージエクスポート戦略

### ⛔ index.ts 完全禁止（絶対厳守）

> **警告**: このプロジェクトでは `index.ts` ファイルの作成を**一切禁止**しています。
> いかなる理由があっても `index.ts` を作成してはいけません。
> 詳細は [CLAUDE.md の index.ts 完全禁止ルール](../../../CLAUDE.md) を参照してください。

従来のindex.tsパターンは、ファイル追加のたびにindex.tsとpackage.jsonの両方を更新する必要があり、メンテナンス負担が大きいため、**完全に禁止**しています。

**package.json設定**:
```json
{
  "exports": {
    "./*": "./src/*.ts"
  }
}
```

**インポート例**:
```typescript
// ✅ 推奨: 直接ファイルパス指定
import { User } from "@repo/server-core/domain/entities/User"
import { userRepository } from "@repo/server-core/infrastructure/database/repositories/UserRepository"
import { postUseCases } from "@/application/use-cases/PostUseCases"  // Application層は各アプリ内

// ❌ 非推奨: index.ts経由（使用不可）
import { User } from "@repo/server-core"
import { User } from "@repo/server-core/domain/entities"  // index.tsなし
```

**メリット**:
- ✅ ファイル追加時にpackage.json更新不要（ワイルドカードで自動対応）
- ✅ index.tsの管理コストゼロ
- ✅ インポート元が明確
- ✅ IDEのジャンプ機能が正確に動作

---

## 5. 技術スタック

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| **モノレポ管理** | Turborepo | 1.x | ビルドオーケストレーション |
| **パッケージマネージャー** | pnpm | 8.x | ワークスペース管理 |
| **フレームワーク** | Next.js | 14.x | Web/Admin/Cron Worker |
| **APIフレームワーク** | Hono | 4.x | 型安全なWebフレームワーク |
| **言語** | TypeScript | 5.x | 型安全性 |
| **環境変数管理** | dotenv-cli | 7.3.0 | 階層的env読み込み |
| **データベース** | Drizzle ORM | 0.x | 型安全な SQL クエリビルダー |
| **DBドライバ（Neon）** | @neondatabase/serverless | 0.x | Vercel/Neon 本番用 WebSocket ドライバ |
| **DBドライバ（ローカル）** | pg (node-postgres) | 8.x | ローカル PostgreSQL 用 TCP ドライバ |
| **マイグレーション** | drizzle-kit | 0.x | スキーマ → SQL マイグレーション生成 |
| **DB本体** | PostgreSQL | 15.x | データストア（ローカル）/ Neon（本番） |
| **Linter & Formatter** | Biome | 1.9.4+ | コード品質・フォーマット |
| **バリデーション** | Zod | 3.x | スキーマ検証 |
| **日付処理** | date-fns | 3.x | 日付ユーティリティ |

---

## 6. Drizzle DB Client設定

### グローバル化パターン（Hot Reload対応 + 環境別ドライバ切替）

**配置**: `packages/server-core/db/client.ts`

**設計の要点**:
- 開発環境での Hot Reload 時に Pool / Drizzle インスタンスの再作成を防ぐ
- `globalThis` に Pool / DB インスタンスをキャッシュ
- 接続文字列を見て **Neon（本番） / node-postgres（ローカル）** を自動切替
  - Neon: `@neondatabase/serverless` の Pool + `drizzle-orm/neon-serverless`
  - ローカル: `pg` の Pool + `drizzle-orm/node-postgres`
  - 理由: ローカル PostgreSQL は Neon serverless が要求する WebSocket 接続をサポートしないため
- Node 環境では `ws` モジュールを `neonConfig.webSocketConstructor` に注入（Edge Runtime では不要）
- スキーマ全体を `drizzle(pool, { schema })` 経由で `db.query.*` の relational query から参照可能にする

```typescript
// packages/server-core/db/client.ts
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// 接続先によってドライバを切り替え
const isNeon =
  connectionString.includes("neon.tech") ||
  connectionString.includes("neon.database");

type AnyPool = import("pg").Pool | import("@neondatabase/serverless").Pool;
type AnyDrizzle =
  | ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>
  | ReturnType<typeof import("drizzle-orm/neon-serverless").drizzle>;

const globalForDb = globalThis as unknown as {
  __einjaDbPool?: AnyPool;
  __einjaDb?: AnyDrizzle;
};

function createDb(): { pool: AnyPool; db: AnyDrizzle } {
  if (isNeon) {
    const { neonConfig, Pool } = require("@neondatabase/serverless") as typeof import("@neondatabase/serverless");
    const { drizzle } = require("drizzle-orm/neon-serverless") as typeof import("drizzle-orm/neon-serverless");
    // Edge Runtime では WebSocket がグローバルにあるので注入不要
    if (typeof (globalThis as Record<string, unknown>).EdgeRuntime === "undefined") {
      const wsModule = require("ws") as typeof import("ws");
      neonConfig.webSocketConstructor = (wsModule.default ?? wsModule) as unknown as typeof WebSocket;
    }
    const pool = new Pool({ connectionString });
    return { pool, db: drizzle(pool, { schema }) };
  } else {
    const { Pool } = require("pg") as typeof import("pg");
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString });
    return { pool, db: drizzle(pool, { schema }) as unknown as AnyDrizzle };
  }
}

const instance = globalForDb.__einjaDb
  ? { pool: globalForDb.__einjaDbPool as AnyPool, db: globalForDb.__einjaDb }
  : createDb();

export const pool = instance.pool;
export const db = instance.db;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__einjaDbPool = pool;
  globalForDb.__einjaDb = db;
}
```

### Schema 定義の要点

**配置**: `packages/server-core/db/schema.ts`

- `pgTable("User", { ... }, (t) => [uniqueIndex(...), foreignKey(...), primaryKey(...)])` の3引数形式で定義
- `pgEnum("UserStatus", ["active", "inactive", "pending"])` で enum を宣言し、テーブルカラムで再利用
- `timestamp("createdAt", { precision: 3 }).notNull().defaultNow()` + `.$onUpdate(() => new Date())` で `updatedAt` 自動更新
- FK / PK / Unique制約には **明示的に名前を付ける**（既存 DB の制約名と合わせて drizzle-kit の差分検出を防ぐ）
- ID は `text("id").primaryKey()` のみ（cuid 等のID生成はアプリケーション層で行う）
- `relations(users, ({ many }) => ({ accounts: many(accounts) }))` で relational query 用のリレーションを定義

### Infrastructure 層からの参照

`packages/server-core/src/infrastructure/database/client.ts` は `db/client.ts` を re-export するだけの薄いラッパー：

```typescript
// packages/server-core/src/infrastructure/database/client.ts
export { db, pool } from "../../../db/client";
```

これにより `@repo/server-core/infrastructure/database/client` 経由でも `@repo/server-core/db/client` 経由でも同一インスタンスにアクセスできる。

### テストファクトリ（@faker-js/faker による手書きパターン）

**配置**: `packages/server-core/src/testing/factories/user.factory.ts`

Prisma 時代の `@quramy/prisma-fabbrica` を置き換え、`@faker-js/faker` で手書きする方針：

```typescript
import { faker } from "@faker-js/faker/locale/ja";
import { db } from "../../../db/client";
import { users } from "../../../db/schema";

type UserRow = typeof users.$inferSelect;
type UserInsert = typeof users.$inferInsert;

export const UserFactory = {
  /** メモリ上の UserRow を生成（DB書き込みなし） */
  async build(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    const now = new Date();
    return {
      id: overrides.id ?? faker.string.nanoid(25),
      name: overrides.name !== undefined ? overrides.name : faker.person.fullName(),
      email: overrides.email ?? faker.internet.email(),
      emailVerified: overrides.emailVerified ?? null,
      image: overrides.image ?? null,
      password: overrides.password ?? null,
      status: overrides.status ?? "active",
      role: overrides.role ?? "user",
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      lastLogin: overrides.lastLogin ?? null,
    };
  },

  /** DB に UserRow を挿入して返す（統合テスト用） */
  async create(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    const props = await UserFactory.build(overrides);
    const [row] = await db.insert(users).values(props).returning();
    return row;
  },

  /** トレイト別ファクトリ（例: アクティブユーザー） */
  async buildActive(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({ status: "active", ...overrides });
  },
};
```

**ファクトリ設計のポイント**:
- `build()` は DB に書き込まず、メモリ上の行を返す（単体テスト向け）
- `create()` は `db.insert().values().returning()` で実際に DB へ書き込む（統合テスト向け）
- `Partial<UserInsert>` で部分オーバーライドを受け、未指定フィールドは faker で生成
- トレイト別（`buildActive` / `buildAdmin` / `buildPending` 等）は `build()` を呼び出して差分のみ指定

---

## 7. 環境変数管理

### 階層的環境変数読み込み

```
ルート.env                    （共通設定、コミット可能）
  ↓
ルート.env.local              （ローカル固有、gitignore）
  ↓
各アプリ.env.local            （アプリ固有、gitignore、オプション）
```

### dotenv-cli による自動読み込み

**ルートpackage.json**:
```json
{
  "scripts": {
    "dev": "dotenv -e .env -e .env.local -- turbo run dev"
  }
}
```

**各アプリのpackage.json**:
```json
{
  "scripts": {
    "dev": "dotenv -e ../../.env -e ../../.env.local -e .env.local -- next dev"
  }
}
```

---

## 8. 参照ドキュメント

### 開発ガイド
- **[API開発ガイド](api-development.md)** - Hono API実装ルール、エンドポイント設計、**Server Actions vs Hono Clientの使い分け**
- **[フロントエンド開発ガイド](frontend-development.md)** - Server/Client Component、Tanstack Query、React Hook Form、Hono Client

### データベース
- **[スキーマ設計](../db-schema-design.md)** - Drizzle スキーマ、テーブル定義、ERD
- **[データベースガイドライン](database-guidelines.md)** - PostgreSQL日付型の使い分け、Drizzle 型マッピング

### インフラ
- **[CI/CDパイプライン](../infrastructure/ci-cd.md)** - GitHub Actions、Turborepoキャッシュ
- **[デプロイメント戦略](../infrastructure/deployment.md)** - Vercel、Docker、環境変数管理

### 品質管理
- **[コードレビューガイドライン](../review-guidelines.md)** - 品質基準とチェックリスト
- **[テスト戦略](../testing-strategy.md)** - テストの書き方

---

## まとめ

このバックエンドアーキテクチャは、以下を実現します：

✅ **4層アーキテクチャ**: 責務の明確化と保守性の向上
✅ **Result型パターン**: 型安全なエラーハンドリング
✅ **Repositoryパターン**: テスト容易性とドメイン独立性
✅ **Mapperパターン**: 永続化層からのドメイン保護
✅ **index.ts不使用**: シンプルで拡張しやすいモジュール管理

すべての開発者は、この設計原則に従ってバックエンド開発を行ってください。
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="backend-architecture-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
