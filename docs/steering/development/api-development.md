# API開発ガイド

## 概要

このドキュメントでは、Honoを使用したAPI開発の実装ガイドラインと、フロントエンドとの統合方法を説明します。

モノレポ全体で統一されたAPI設計パターンを採用し、型安全性とメンテナンス性を確保します。

---

## 目次

1. [Hono API実装ルール](#1-hono-api実装ルール)
2. [Web APIエンドポイント一覧](#2-web-apiエンドポイント一覧)
3. [Admin APIエンドポイント一覧](#3-admin-apiエンドポイント一覧)
4. [Cron Worker CLIコマンド](#4-cron-worker-cliコマンド)
5. [バリデーション戦略](#5-バリデーション戦略)
6. [エラーハンドリング](#6-エラーハンドリング)
7. [Hono Client統合（フロントエンド）](#7-hono-client統合フロントエンド)
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

Honoでは、メソッドチェーンでルートを定義します：

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

## 7. Hono Client統合（フロントエンド）

### Hono RPC Client（hc）の使用

Hono Clientは、エンドツーエンドの型推論を提供します。

**セットアップ**:

```typescript
// apps/web/lib/api-client.ts
import { hc } from 'hono/client'
import type { AppType } from '@/server/routes' // Hono appの型をインポート

export const apiClient = hc<AppType>('/api')
```

**API呼び出し例**:

```typescript
// GET /api/posts
const response = await apiClient.posts.$get({
  query: { page: '1', limit: '10' }
})
const data = await response.json() // 型推論: { posts: Post[], total: number }

// POST /api/posts
const response = await apiClient.posts.$post({
  json: { title: 'New Post', content: 'Content' }
})
const data = await response.json() // 型推論: { post: Post }

// GET /api/posts/:id
const response = await apiClient.posts[':id'].$get({
  param: { id: '123' }
})
const data = await response.json() // 型推論: { post: Post }
```

### Tanstack Queryとの統合

**投稿一覧の取得**:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function usePostList(page: number, limit: number) {
  return useQuery({
    queryKey: ['posts', page, limit],
    queryFn: async () => {
      const response = await apiClient.posts.$get({
        query: { page: String(page), limit: String(limit) }
      })
      return response.json()
    },
  })
}
```

**投稿作成**:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const response = await apiClient.posts.$post({ json: data })
      return response.json()
    },
    onSuccess: () => {
      // 投稿一覧のキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
```

### React Hook Formとの統合

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPostSchema, type CreatePostInput } from '@repo/server-core/domain/validators/post'

export function PostCreateForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
  })

  const createPost = useCreatePost()

  const onSubmit = (data: CreatePostInput) => {
    createPost.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title')} />
      {errors.title && <p>{errors.title.message}</p>}

      <textarea {...register('content')} />
      {errors.content && <p>{errors.content.message}</p>}

      <button type="submit">作成</button>
    </form>
  )
}
```

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

```typescript
// apps/web/components/PostCreateForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { createPostSchema, type CreatePostInput } from '@repo/server-core/domain/validators/post'

export function PostCreateForm() {
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      status: 'draft',
    },
  })

  const createPost = useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const response = await apiClient.posts.$post({ json: data })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      alert('投稿を作成しました')
    },
    onError: (error) => {
      console.error('投稿作成エラー:', error)
      alert('投稿の作成に失敗しました')
    },
  })

  const onSubmit = (data: CreatePostInput) => {
    createPost.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>タイトル</label>
        <input {...register('title')} />
        {errors.title && <p className="error">{errors.title.message}</p>}
      </div>

      <div>
        <label>本文</label>
        <textarea {...register('content')} />
        {errors.content && <p className="error">{errors.content.message}</p>}
      </div>

      <div>
        <label>ステータス</label>
        <select {...register('status')}>
          <option value="draft">下書き</option>
          <option value="published">公開</option>
        </select>
      </div>

      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? '作成中...' : '投稿を作成'}
      </button>
    </form>
  )
}
```

---

## まとめ

このAPI開発ガイドに従うことで、以下を実現できます：

1. **型安全性**: Hono Client + Zod + TypeScriptによるエンドツーエンドの型推論
2. **統一性**: モノレポ全体で統一されたAPI設計パターン
3. **保守性**: Result型パターンとエラーハンドリングによる明確な制御フロー
4. **生産性**: zValidatorとReact Hook Formの統合による高速開発

すべてのAPI実装は、このガイドラインに従って実装してください。
