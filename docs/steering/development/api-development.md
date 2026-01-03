# API開発ガイド

## 概要

このドキュメントでは、Honoを使用したAPI開発の実装ガイドラインと、フロントエンドとの統合方法を説明します。

モノレポ全体で統一されたAPI設計パターンを採用し、型安全性とメンテナンス性を確保します。

---

## 目次

1. [Hono API実装ルール](#1-hono-api実装ルール)
   - [メソッドチェーンパターン](#メソッドチェーンパターン)
   - [ミドルウェアと型推論の注意点](#ミドルウェアと型推論の注意点) ⚠️
   - [basePathとHono Clientの関係](#basepathとhono-clientの関係) ⚠️
2. [Web APIエンドポイント一覧](#2-web-apiエンドポイント一覧)
3. [Admin APIエンドポイント一覧](#3-admin-apiエンドポイント一覧)
4. [Cron Worker CLIコマンド](#4-cron-worker-cliコマンド)
5. [バリデーション戦略](#5-バリデーション戦略)
6. [エラーハンドリング](#6-エラーハンドリング)
7. [フロントエンド統合パターン](#7-フロントエンド統合パターン)
8. [認証とミドルウェア](#8-認証とミドルウェア)
9. [レスポンス設計](#9-レスポンス設計)
10. [環境変数管理](#10-環境変数管理)
11. [実装例](#11-実装例)

---

## 1. Hono API実装ルール

### Honoアプリケーション構造

Honoは型安全なWebフレームワークで、すべてのNext.js APIルートで使用します。

**エントリーポイント**:
```
apps/web/app/api/[[...route]]/route.ts  # Web API
apps/admin/app/api/[[...route]]/route.ts # Admin API
```

**ルート定義の配置**:
```
apps/web/server/routes/          # Webアプリ用ルート定義
apps/admin/server/routes/        # 管理画面用ルート定義
```

### メソッドチェーンパターン

Honoでは、**必ずメソッドチェーン形式**でルートを定義します。

**重要: メソッドチェーンを使用する理由**

Hono Clientの型推論は `typeof app` から型情報を抽出します。メソッドチェーンを使用しない場合、TypeScriptが各ルート定義の返り値型を追跡できず、`AppType`に完全なルート情報が含まれません。

```typescript
// ❌ NG: 個別呼び出し - 型推論が損なわれる
const app = new Hono()
app.get('/posts', handler1)  // 返り値が破棄される
app.post('/posts', handler2) // 返り値が破棄される
export type AppType = typeof app // ルート情報が不完全

// ✅ OK: メソッドチェーン - 完全な型推論
const app = new Hono()
  .get('/posts', handler1)
  .post('/posts', handler2)
export type AppType = typeof app // 全ルート情報を含む
```

メソッドチェーンにより、Hono Client (`hc<AppType>`) でエンドツーエンドの型安全なAPI呼び出しが実現できます。

### ミドルウェアと型推論の注意点

**サブルート内で`.use()`を使うと型推論が壊れる。メインアプリ側で適用すること。**

```typescript
// ❌ NG: サブルート内で.use() → 型が ClientRequest<{}> になる
export const adminUserRoutes = new Hono()
  .use("*", adminAuthMiddleware)
  .delete("/:id", handler)

// ✅ OK: メインアプリ側で.use()を適用
const app = new Hono()
  .basePath("/api")
  .use("/admin/*", adminAuthMiddleware)  // ← ここで適用
  .route("/admin", adminApp)
```

### basePathとHono Clientの関係

`basePath("/api")` を使用する場合、クライアント側も `api` を含めてアクセスする。

```typescript
// サーバー: basePath("/api") を設定
const app = new Hono().basePath("/api").route("/posts", postRoutes)

// クライアント: api を含める
apiClient.api.posts.$get()  // ✅ OK
apiClient.posts.$get()      // ❌ NG（型エラー）
```

**使用例**:

```typescript
// apps/web/server/routes/postRoutes.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createPostSchema } from '@repo/server-core/domain/validators/post'

const app = new Hono()

app
  .get('/posts', async (c) => {
    // GET /api/posts - 投稿一覧取得
    const page = Number(c.req.query('page') || '1')
    const limit = Number(c.req.query('limit') || '10')
    // UseCase呼び出し...
    return c.json({ posts, total })
  })
  .post('/posts', zValidator('json', createPostSchema), async (c) => {
    // POST /api/posts - 投稿作成
    const data = c.req.valid('json')
    // UseCase呼び出し...
    return c.json({ post }, 201)
  })

export default app
```

### zValidatorの統合

**必須**: すべてのリクエストボディとクエリパラメータは、zValidatorでバリデーションを行う。

```typescript
import { zValidator } from '@hono/zod-validator'
import { createPostSchema } from '@repo/server-core/domain/validators/post'

app.post('/posts', zValidator('json', createPostSchema), async (c) => {
  const data = c.req.valid('json') // 型安全にバリデート済みデータを取得
  // data は CreatePostInput 型として推論される
})
```

### ルートハンドラの構造

すべてのルートハンドラは、以下のパターンに従います：

```typescript
async (c) => {
  // 1. リクエストパラメータ取得（クエリ、パス、ボディ）
  const data = c.req.valid('json')
  const id = c.req.param('id')

  // 2. UseCaseの呼び出し
  const result = await postUseCases.create(data)

  // 3. Result型の処理
  if (!result.isSuccess) {
    // エラーハンドリング（後述）
    return c.json({ error: result.error.message }, 400)
  }

  // 4. レスポンス返却
  return c.json({ post: result.value }, 201)
}
```

---

## 2. Web APIエンドポイント一覧

### ヘルスチェック

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| GET | `/api/health` | システム稼働確認 | - | `{status: "ok"}` | 不要 |

### 認証エンドポイント

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| POST | `/api/auth/login` | ユーザーログイン | `{email, password}` | `{token, user}` | 不要 |
| POST | `/api/auth/logout` | ログアウト | - | `{success: true}` | 必要 |
| GET | `/api/auth/session` | セッション確認 | - | `{user}` | 必要 |

### 投稿エンドポイント

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| GET | `/api/posts` | 投稿一覧取得 | `?page=1&limit=10` | `{posts[], total}` | オプション |
| POST | `/api/posts` | 投稿作成 | `{title, content, status?}` | `{post}` | 必要 |
| GET | `/api/posts/:id` | 投稿詳細取得 | - | `{post}` | オプション |
| PUT | `/api/posts/:id` | 投稿更新 | `{title?, content?, status?}` | `{post}` | 必要 |
| DELETE | `/api/posts/:id` | 投稿削除 | - | `{success: true}` | 必要 |

**ページネーション設計**:
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 10、最大: 100）
- レスポンス: `{ posts: Post[], total: number }` - totalは全件数

**認証制御**:
- 投稿一覧・詳細: 認証不要（公開投稿のみ取得）
- 投稿作成・更新・削除: 認証必須
- 更新・削除: 投稿の所有者チェック（`post.isOwnedBy(userId)`）

---

## 3. Admin APIエンドポイント一覧

### ヘルスチェック

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| GET | `/api/health` | システム稼働確認 | - | `{status: "ok"}` | 不要 |

### ユーザー管理

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| GET | `/api/admin/users` | ユーザー一覧取得 | `?page=1&limit=20` | `{users[], total}` | 管理者 |
| GET | `/api/admin/users/:id` | ユーザー詳細取得 | - | `{user}` | 管理者 |
| PUT | `/api/admin/users/:id` | ユーザー情報更新 | `{name?, email?}` | `{user}` | 管理者 |
| DELETE | `/api/admin/users/:id` | ユーザー削除 | - | `{success: true}` | 管理者 |

### 投稿管理

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| GET | `/api/admin/posts` | 全投稿一覧取得 | `?status=all&page=1` | `{posts[], total}` | 管理者 |
| PUT | `/api/admin/posts/:id/status` | 投稿ステータス変更 | `{status}` | `{post}` | 管理者 |

### 分析

| メソッド | エンドポイント | 説明 | リクエスト | レスポンス | 認証 |
|---------|---------------|------|-----------|-----------|------|
| GET | `/api/admin/analytics` | システム統計取得 | `?from=&to=` | `{stats}` | 管理者 |

**管理者認証**:
- すべてのAdmin APIは、管理者権限（`role='admin'`）のチェックが必要
- ミドルウェアで JWT検証 + role チェックを実施

---

## 4. Cron Worker CLIコマンド

cron-workerは、HTTP APIではなく**CLIコマンド**として実装されます。

Railway CronまたはVercel Cronなどの外部スケジューラーから直接実行されます。

### コマンド一覧

| コマンド | 説明 | 実行方法 | 実装ファイル |
|---------|------|---------|------------|
| `pnpm job:cleanup` | 期限切れセッションのクリーンアップ | `tsx src/jobs/cleanup.ts` | `apps/cron-worker/src/jobs/cleanup.ts` |
| `pnpm job:email-digest` | メールダイジェスト送信 | `tsx src/jobs/email-digest.ts` | `apps/cron-worker/src/jobs/email-digest.ts` |
| `pnpm job:health-check` | ジョブシステムの稼働確認 | `tsx src/jobs/health-check.ts` | `apps/cron-worker/src/jobs/health-check.ts` |

### 実装方針

- **tsxによるTypeScript直接実行**: ビルド不要で実行可能
- **Repositoryパターン使用**: `@repo/server-core`の Repository と UseCase を活用
- **JobCoordinator機構**: 重複実行防止とエラーハンドリング
- **ログ出力**: すべてのジョブで実行結果をログ出力
- **終了コード**: 成功時は0、失敗時は非0を返却

### package.json設定例

```json
{
  "scripts": {
    "job:cleanup": "dotenv -e ../../.env -e .env.local -- tsx src/jobs/cleanup.ts",
    "job:email-digest": "dotenv -e ../../.env -e .env.local -- tsx src/jobs/email-digest.ts",
    "job:health-check": "dotenv -e ../../.env -e .env.local -- tsx src/jobs/health-check.ts"
  }
}
```

---

## 5. バリデーション戦略

### Zodスキーマ定義

すべてのリクエストボディとレスポンスは、Zodスキーマで定義します。

**配置場所**: `packages/server-core/src/domain/validators/`

**スキーマ例**:

```typescript
// packages/server-core/src/domain/validators/post.ts
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  status: z.enum(['draft', 'published']).default('draft'),
})

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
```

### zValidatorの使用

**リクエストボディのバリデーション**:

```typescript
import { zValidator } from '@hono/zod-validator'
import { createPostSchema } from '@repo/server-core/domain/validators/post'

app.post('/posts', zValidator('json', createPostSchema), async (c) => {
  const data = c.req.valid('json') // バリデート済みデータを型安全に取得
  // data は CreatePostInput 型として推論される
})
```

**クエリパラメータのバリデーション**:

```typescript
const querySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
})

app.get('/posts', zValidator('query', querySchema), async (c) => {
  const { page, limit } = c.req.valid('query')
})
```

### 型の自動生成

Zodスキーマから型を自動生成することで、型の重複を防ぎます：

```typescript
export type CreatePostInput = z.infer<typeof createPostSchema>
```

この型は、フロントエンドとバックエンドで共有されます。

---

## 6. エラーハンドリング

### ApplicationError階層

`@repo/server-core/utils/errors.ts`で定義されたエラークラス階層を使用します。

```typescript
// ApplicationError 基底クラス
class ApplicationError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
  }
}

// 派生エラークラス
class ValidationError extends ApplicationError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400)
  }
}

class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404)
  }
}

class UnauthorizedError extends ApplicationError {
  constructor(message: string) {
    super('UNAUTHORIZED', message, 401)
  }
}

class ForbiddenError extends ApplicationError {
  constructor(message: string) {
    super('FORBIDDEN', message, 403)
  }
}

class DatabaseError extends ApplicationError {
  constructor(message: string) {
    super('DATABASE_ERROR', message, 500)
  }
}
```

### Result型からApiResponseへの変換

UseCaseは`Result<T, E>`型を返却しますが、APIレスポンスは`ApiResponse`形式に変換します。

```typescript
// ApiResponse型定義
type ApiResponse<T> = {
  data?: T
  error?: {
    code: string
    message: string
  }
}

// Result → ApiResponse 変換パターン
app.post('/posts', zValidator('json', createPostSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await postUseCases.create(data)

  if (!result.isSuccess) {
    const error = result.error
    return c.json(
      { error: { code: error.code, message: error.message } },
      error.statusCode
    )
  }

  return c.json({ data: result.value }, 201)
})
```

### HTTPステータスコードマッピング

| エラー種別 | HTTPステータス | 説明 |
|----------|--------------|------|
| ValidationError | 400 | リクエストデータが不正 |
| UnauthorizedError | 401 | 認証が必要 |
| ForbiddenError | 403 | 権限不足 |
| NotFoundError | 404 | リソースが存在しない |
| DatabaseError | 500 | データベースエラー |
| ApplicationError | 500 | その他のサーバーエラー |

---

## 7. フロントエンド統合パターン

フロントエンドからAPIを呼び出す方法には、**Server Actions**と**Hono Client + Tanstack Query**の2つのパターンがあります。

### パターン比較

| 観点 | Server Actions | Hono Client + Tanstack Query |
|------|---------------|------------------------------|
| **複雑さ** | シンプル | やや複雑 |
| **キャッシュ** | Next.jsのrevalidate | Tanstack Queryの高度なキャッシュ |
| **楽観的更新** | 手動実装 | 組み込みサポート |
| **ローディング状態** | useFormStatus/useTransition | isPending/isLoading |
| **エラーハンドリング** | try-catch | onError コールバック |
| **リアルタイム更新** | 不向き | refetchInterval等で対応可 |
| **型安全性** | 高い | 高い（RPC型推論） |

### 使い分け基準

#### ✅ Server Actionsを使う場合

- **シンプルなフォーム送信**（お問い合わせ、ログイン等）
- **単発のミューテーション**（いいね、フォロー等）
- **SEOが重要なページ**でのデータ更新
- **Progressive Enhancement**が必要な場合（JS無効でも動作）
- **キャッシュ管理が単純**な場合

```typescript
// app/actions/post.ts
'use server'

import { revalidatePath } from 'next/cache'
import { postUseCases } from '@/application/use-cases/PostUseCases'
import { createPostSchema } from '@repo/server-core/domain/validators/post'

export async function createPost(formData: FormData) {
  const rawData = {
    title: formData.get('title'),
    content: formData.get('content'),
    status: formData.get('status') || 'draft',
  }

  // バリデーション
  const parsed = createPostSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // UseCase呼び出し
  const result = await postUseCases.create(parsed.data)

  if (!result.isSuccess) {
    return { error: { _form: [result.error.message] } }
  }

  // キャッシュ無効化
  revalidatePath('/posts')

  return { success: true, post: result.value }
}
```

```typescript
// components/features/posts/PostCreateForm.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions/post'

export function PostCreateForm() {
  const [state, formAction, isPending] = useActionState(createPost, null)

  return (
    <form action={formAction}>
      <input name="title" required />
      {state?.error?.title && <p className="error">{state.error.title}</p>}

      <textarea name="content" required />
      {state?.error?.content && <p className="error">{state.error.content}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? '作成中...' : '投稿を作成'}
      </button>

      {state?.error?._form && <p className="error">{state.error._form}</p>}
    </form>
  )
}
```

#### ✅ Hono Client + Tanstack Queryを使う場合

- **複数コンポーネントでデータ共有**が必要
- **高度なキャッシュ管理**（staleTime、cacheTime、条件付きrefetch）
- **楽観的更新**が必要（即座にUIに反映）
- **ポーリング・リアルタイム更新**が必要
- **複雑なデータフェッチ**（依存クエリ、並列クエリ）
- **ページネーション・無限スクロール**

詳細な実装方法は **[フロントエンド開発ガイド](frontend-development.md)** を参照してください：
- セクション3: Hono Client統合
- セクション5: Tanstack Query
- セクション6: React Hook Form

### 推奨パターン早見表

| ユースケース | 推奨パターン |
|------------|-------------|
| ログインフォーム | Server Actions |
| お問い合わせフォーム | Server Actions |
| いいねボタン | Server Actions |
| 投稿一覧（ページネーション付き） | Hono Client + Tanstack Query |
| コメント機能（リアルタイム更新） | Hono Client + Tanstack Query |
| 管理画面のCRUD | Hono Client + Tanstack Query |
| 検索機能（デバウンス付き） | Hono Client + Tanstack Query |
| ファイルアップロード | Server Actions |

---

## 8. 認証とミドルウェア

### 認証ミドルウェア

```typescript
// apps/web/server/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'jsonwebtoken'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = verify(token, process.env.JWT_SECRET!)
    c.set('user', payload) // コンテキストにユーザー情報を設定
    await next()
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
```

### 管理者権限チェックミドルウェア

```typescript
// apps/admin/server/middleware/admin.ts
import { createMiddleware } from 'hono/factory'
import { authMiddleware } from './auth'

export const adminMiddleware = createMiddleware(async (c, next) => {
  await authMiddleware(c, async () => {
    const user = c.get('user')

    if (user.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
})
```

### ミドルウェアの適用

```typescript
import { Hono } from 'hono'
import { authMiddleware } from '@/server/middleware/auth'

const app = new Hono()

// 認証不要なルート
app.get('/health', (c) => c.json({ status: 'ok' }))

// 認証が必要なルート
app.use('/posts/*', authMiddleware)
app.post('/posts', async (c) => {
  const user = c.get('user') // ミドルウェアで設定されたユーザー情報
  // ...
})
```

**⚠️ 重要**: サブルート内で`.use()`を使用するとHono RPC型推論が壊れます。
詳細は[ミドルウェアと型推論の注意点](#ミドルウェアと型推論の注意点)を参照してください。

---

## 9. レスポンス設計

### 統一レスポンス形式

すべてのAPIレスポンスは、以下の形式に従います：

**成功時**:
```typescript
{
  data: T // 実際のデータ
}
```

**エラー時**:
```typescript
{
  error: {
    code: string    // エラーコード（例: "VALIDATION_ERROR"）
    message: string // エラーメッセージ
  }
}
```

### ページネーションレスポンス

```typescript
{
  data: {
    items: T[]    // データ配列
    total: number // 全件数
  }
}
```

---

## 10. 環境変数管理

### dotenv-cliの使用

環境変数は、dotenv-cliを使用して階層的にロードされます。

**ロード順序**（後勝ち）:
1. `root/.env` - モノレポ全体の共通設定
2. `root/.env.local` - ローカル環境でのオーバーライド
3. `apps/*/​.env.local` - アプリケーション固有のオーバーライド

**package.jsonでの設定**:

```json
{
  "scripts": {
    "dev": "dotenv -e ../../.env -e ../../.env.local -e .env.local -- next dev",
    "build": "dotenv -e ../../.env -e .env.local -- next build"
  }
}
```

### Worktree対応の動的ポート割り当て

Worktreeごとに異なるポートを使用するため、MD5ハッシュベースの動的ポート割り当てを実装します。

詳細は`deployment.md`を参照してください。

---

## 11. 実装例

### 完全なPOST /api/posts実装

**ルート定義**:

```typescript
// apps/web/server/routes/postRoutes.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createPostSchema } from '@repo/server-core/domain/validators/post'
import { postUseCases } from '@repo/server-core/application/use-cases/postUseCases'
import { authMiddleware } from '@/server/middleware/auth'

const app = new Hono()

app.post(
  '/posts',
  authMiddleware, // 認証ミドルウェア
  zValidator('json', createPostSchema), // バリデーション
  async (c) => {
    // 1. バリデート済みデータの取得
    const data = c.req.valid('json')
    const user = c.get('user') // 認証ユーザー情報

    // 2. UseCaseの呼び出し
    const result = await postUseCases.create({
      ...data,
      userId: user.id,
    })

    // 3. Result型の処理
    if (!result.isSuccess) {
      const error = result.error
      return c.json(
        { error: { code: error.code, message: error.message } },
        error.statusCode
      )
    }

    // 4. 成功レスポンス
    return c.json({ data: result.value }, 201)
  }
)

export default app
```

**エントリーポイント**:

```typescript
// apps/web/app/api/[[...route]]/route.ts
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import postRoutes from '@/server/routes/postRoutes'

const app = new Hono().basePath('/api')

app.route('/', postRoutes)

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)

export type AppType = typeof app
```

**フロントエンドでの使用**:

フロントエンドからこのAPIを呼び出す実装例は **[フロントエンド開発ガイド](frontend-development.md)** を参照してください：

- **Server Actionsパターン**: セクション7「フロントエンド統合パターン」（本ドキュメント）
- **Hono Client + Tanstack Queryパターン**: [フロントエンド開発ガイド](frontend-development.md) セクション11

---

## まとめ

このAPI開発ガイドに従うことで、以下を実現できます：

1. **型安全性**: Hono + Zod + TypeScriptによるエンドツーエンドの型推論
2. **統一性**: モノレポ全体で統一されたAPI設計パターン
3. **保守性**: Result型パターンとエラーハンドリングによる明確な制御フロー
4. **柔軟性**: Server ActionsとHono Client + Tanstack Queryの使い分け

すべてのAPI実装は、このガイドラインに従って実装してください。
