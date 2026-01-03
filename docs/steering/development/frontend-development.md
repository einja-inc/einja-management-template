# フロントエンド開発ガイド

## 概要

このドキュメントでは、Next.js 14 App Routerを使用したフロントエンド開発のベストプラクティスと実装ガイドラインを説明します。

Tanstack Query、React Hook Form、Hono Clientを活用した型安全で保守性の高いフロントエンド開発を実現します。

### 関連ドキュメント

- **[API開発ガイド](api-development.md)** - Hono API実装、Server Actionsとの使い分け
- **[バックエンドアーキテクチャ](backend-architecture.md)** - 4層アーキテクチャ、Repository/Result型

> **📌 Server Actions vs Hono Client + Tanstack Query の使い分け**
>
> フロントエンドからAPIを呼び出す方法は2パターンあります。使い分けの基準は **[API開発ガイド セクション7](api-development.md#7-フロントエンド統合パターン)** を参照してください。
>
> - **Server Actions**: シンプルなフォーム送信、単発のミューテーション
> - **Hono Client + Tanstack Query**: 複雑なデータフェッチ、キャッシュ管理、リアルタイム更新（本ドキュメントで解説）

---

## 目次

1. [ディレクトリ構造](#1-ディレクトリ構造)
2. [技術スタック](#2-技術スタック)
3. [Hono Client統合（API呼び出し）](#3-hono-client統合api呼び出し)
4. [Server ComponentとClient Component](#4-server-componentとclient-component)
5. [Tanstack Query（サーバー状態管理）](#5-tanstack-queryサーバー状態管理)
6. [React Hook Form（フォーム処理）](#6-react-hook-formフォーム処理)
7. [コンポーネント設計](#7-コンポーネント設計)
8. [App Router構成](#8-app-router構成)
9. [状態管理戦略](#9-状態管理戦略)
10. [エラーハンドリング](#10-エラーハンドリング)
11. [実装例](#11-実装例)

---

## 1. ディレクトリ構造

### Webアプリケーション（apps/web）

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # ルートグループ: 認証関連
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/              # ルートグループ: ダッシュボード
│   │   ├── posts/
│   │   │   ├── page.tsx         # 投稿一覧
│   │   │   ├── new/
│   │   │   │   └── page.tsx     # 投稿作成
│   │   │   └── [id]/
│   │   │       └── page.tsx     # 投稿詳細
│   │   └── profile/
│   │       └── page.tsx
│   ├── api/                      # API Routes
│   │   └── [[...route]]/
│   │       └── route.ts         # Honoエントリーポイント
│   ├── layout.tsx                # ルートレイアウト
│   └── page.tsx                  # トップページ
├── components/                   # UIコンポーネント
│   ├── ui/                       # 基本コンポーネント
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── modal.tsx
│   │   └── ...
│   └── features/                 # 機能別コンポーネント
│       ├── posts/
│       │   ├── PostList.tsx
│       │   ├── PostCard.tsx
│       │   ├── PostCreateForm.tsx
│       │   └── PostDetail.tsx
│       └── auth/
│           ├── LoginForm.tsx
│           └── RegisterForm.tsx
├── lib/                          # ユーティリティ
│   ├── api-client.ts             # Hono Client設定
│   ├── query-client.ts           # Tanstack Query設定
│   └── utils.ts                  # 共通ユーティリティ
├── hooks/                        # カスタムフック
│   ├── use-posts.ts              # Postデータフック
│   └── use-auth.ts               # 認証フック
├── public/                       # 静的ファイル
├── styles/                       # グローバルスタイル
│   └── globals.css
├── next.config.js
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

### 管理画面（apps/admin）

```
apps/admin/
├── app/
│   ├── (protected)/              # ルートグループ: 認証必須
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── posts/
│   │   │   │   └── page.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx
│   ├── api/
│   │   └── [[...route]]/
│   │       └── route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   └── features/
│       └── admin/
│           ├── UserTable.tsx
│           └── PostStatusManager.tsx
├── lib/
├── hooks/
└── ...
```

**設計ポイント**:
- **ルートグループ**: `(auth)`, `(dashboard)`, `(protected)` でルートを論理的にグループ化
- **コロケーション**: 機能別にコンポーネント、フック、ユーティリティを配置
- **共通コンポーネント**: ui/に再利用可能な基本コンポーネント、features/に機能別コンポーネント

---

## 2. 技術スタック

| カテゴリ | ライブラリ | バージョン | 用途 |
|---------|-----------|----------|------|
| フレームワーク | Next.js | 14.x | App Router、SSR/SSG |
| UI | React | 18.x | コンポーネントライブラリ |
| 状態管理 | Tanstack Query | 5.x | サーバー状態管理 |
| フォーム | React Hook Form | 7.x | フォーム処理 |
| バリデーション | Zod | 3.x | スキーマバリデーション |
| API Client | Hono Client | 4.x | 型安全なAPI呼び出し |
| スタイリング | Tailwind CSS | 3.x | ユーティリティファースト |
| 型チェック | TypeScript | 5.x | 静的型付け |

---

## 3. Hono Client統合（API呼び出し）

### セットアップ

**Hono Clientの初期化**:

```typescript
// apps/web/lib/api-client.ts
import { hc } from 'hono/client'
import type { AppType } from '@/app/api/[[...route]]/route'

export const apiClient = hc<AppType>('/api')
```

**型定義のエクスポート**:

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

// 型のエクスポート（フロントエンドで使用）
export type AppType = typeof app
```

### API呼び出しパターン

**GET リクエスト**:

```typescript
// 投稿一覧取得
const response = await apiClient.posts.$get({
  query: { page: '1', limit: '10' }
})
const data = await response.json() // 型推論: { posts: Post[], total: number }
```

**POST リクエスト**:

```typescript
// 投稿作成
const response = await apiClient.posts.$post({
  json: { title: 'New Post', content: 'Content' }
})
const data = await response.json() // 型推論: { post: Post }
```

**GET リクエスト（パスパラメータ）**:

```typescript
// 投稿詳細取得
const response = await apiClient.posts[':id'].$get({
  param: { id: '123' }
})
const data = await response.json() // 型推論: { post: Post }
```

**PUT リクエスト**:

```typescript
// 投稿更新
const response = await apiClient.posts[':id'].$put({
  param: { id: '123' },
  json: { title: 'Updated Title' }
})
const data = await response.json() // 型推論: { post: Post }
```

**DELETE リクエスト**:

```typescript
// 投稿削除
const response = await apiClient.posts[':id'].$delete({
  param: { id: '123' }
})
const data = await response.json() // 型推論: { success: true }
```

**エンドツーエンド型推論のメリット**:
- バックエンドのAPI変更が自動的にフロントエンドに反映
- 型エラーでAPI仕様の不一致を早期発見
- IDEの補完機能でAPI仕様を確認可能

---

## 4. Server ComponentとClient Component

### 🚨 基本原則（最重要）

このプロジェクトでは、以下の原則を**必ず守ってください**：

✅ **可能な限りServer Componentを使用する**
- すべてのコンポーネントはデフォルトでServer Component
- インタラクティブ性が必要な部分のみClient Component化

❌ **page.tsxでの`'use client'`使用は禁止**
- ページコンポーネント（`app/**/page.tsx`）はServer Componentとして実装
- データフェッチ、認証チェックはServer Componentで実行
- インタラクティブな部分は別コンポーネントに分離してClient Component化

### Server ComponentとClient Componentの違い

#### Server Component（デフォルト）

**特徴**:
- サーバー側でのみレンダリング
- JavaScriptバンドルに含まれない
- データベースやAPIに直接アクセス可能
- 機密情報（APIキー、トークン）を安全に扱える

**制限**:
- `useState`, `useEffect`などのReactフックは使用不可
- ブラウザAPI（`window`, `document`）は使用不可
- イベントハンドラー（`onClick`等）は使用不可

**例**:
```typescript
// app/posts/page.tsx (Server Component - デフォルト)
import { PostList } from '@/components/features/posts/PostList'
import { apiClient } from '@/lib/api-client'

export default async function PostsPage() {
  // サーバー側でデータフェッチ
  const response = await apiClient.posts.$get({
    query: { page: '1', limit: '10' }
  })
  const data = await response.json()

  return (
    <div>
      <h1>投稿一覧</h1>
      <PostList initialData={data} />  {/* Client Componentにデータを渡す */}
    </div>
  )
}
```

#### Client Component

**特徴**:
- `'use client'`ディレクティブで明示的に宣言
- サーバー側でプリレンダリング後、クライアント側でハイドレーション
- Reactフック、イベントハンドラー使用可能
- JavaScriptバンドルに含まれる

**用途**:
- インタラクティブ性（ボタンクリック、入力処理）
- ステート管理（`useState`, `useReducer`）
- ライフサイクル（`useEffect`, `useLayoutEffect`）
- カスタムフック（`useQuery`, `useForm`）
- ブラウザAPI（`localStorage`, `window`）

**例**:
```typescript
// components/features/posts/PostList.tsx (Client Component)
'use client'

import { useState } from 'react'
import { PostCard } from './PostCard'
import type { Post } from '@repo/server-core/domain/entities/Post'

interface PostListProps {
  initialData: { posts: Post[], total: number }
}

export function PostList({ initialData }: PostListProps) {
  const [posts, setPosts] = useState(initialData.posts)

  const handleSort = (field: string) => {
    // ソート処理
    const sorted = [...posts].sort(/* ... */)
    setPosts(sorted)
  }

  return (
    <div>
      <button onClick={() => handleSort('title')}>タイトルでソート</button>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
    </div>
  )
}
```

### 判断フローチャート

コンポーネント作成時の判断基準：

```
新しいコンポーネントを作成
    ↓
質問1: page.tsxか？
    YES → Server Component（絶対）
    NO → 質問2へ
    ↓
質問2: イベントハンドラー（onClick等）が必要か？
    YES → Client Component
    NO → 質問3へ
    ↓
質問3: Reactフック（useState, useEffect等）が必要か？
    YES → Client Component
    NO → 質問4へ
    ↓
質問4: ブラウザAPI（window, localStorage等）が必要か？
    YES → Client Component
    NO → 質問5へ
    ↓
質問5: カスタムフック（useQuery, useForm等）が必要か？
    YES → Client Component
    NO → Server Component（デフォルト）
```

### `'use client'`境界の最適化

#### ❌ 非推奨パターン

```typescript
// ❌ page.tsx全体をClient Component化（禁止）
'use client'

import { useState } from 'react'

export default function PostsPage() {
  const [filter, setFilter] = useState('')

  return (
    <div>
      <Header />           {/* 静的 */}
      <Sidebar />          {/* 静的 */}
      <FilterInput value={filter} onChange={setFilter} />  {/* インタラクティブ */}
      <PostList filter={filter} />
    </div>
  )
}
```

**問題点**:
- ページ全体がJavaScriptバンドルに含まれる
- バンドルサイズが肥大化
- First Contentful Paintが遅くなる
- Server Componentのメリットを失う

#### ✅ 推奨パターン

```typescript
// ✅ page.tsxはServer Component（'use client'なし）
import { Header } from '@/components/features/Header'
import { Sidebar } from '@/components/features/Sidebar'
import { PostListContainer } from '@/components/features/posts/PostListContainer'
import { apiClient } from '@/lib/api-client'

export default async function PostsPage() {
  // サーバー側でデータフェッチ
  const response = await apiClient.posts.$get()
  const data = await response.json()

  return (
    <div>
      <Header />                              {/* Server Component */}
      <Sidebar />                             {/* Server Component */}
      <PostListContainer initialData={data} /> {/* Client Component */}
    </div>
  )
}
```

```typescript
// components/features/posts/PostListContainer.tsx
'use client'

import { useState } from 'react'
import { FilterInput } from './FilterInput'
import { PostList } from './PostList'

export function PostListContainer({ initialData }) {
  const [filter, setFilter] = useState('')

  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} />
      <PostList data={initialData} filter={filter} />
    </div>
  )
}
```

**メリット**:
- バンドルサイズの最小化
- 静的コンテンツは即座に表示
- インタラクティブ部分のみハイドレーション
- パフォーマンスの最適化

### コンポーネント間のデータ受け渡しパターン

#### パターン1: Server Component → Client Component（props）

```typescript
// app/posts/[id]/page.tsx (Server Component)
import { PostDetail } from '@/components/features/posts/PostDetail'
import { apiClient } from '@/lib/api-client'

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  // サーバー側でデータフェッチ
  const response = await apiClient.posts[':id'].$get({
    param: { id: params.id }
  })
  const { post } = await response.json()

  // Client Componentにpropsとして渡す
  return <PostDetail post={post} />
}
```

```typescript
// components/features/posts/PostDetail.tsx (Client Component)
'use client'

import { useState } from 'react'
import type { Post } from '@repo/server-core/domain/entities/Post'

interface PostDetailProps {
  post: Post  // Server Componentから受け取ったデータ
}

export function PostDetail({ post }: PostDetailProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <button onClick={() => setIsEditing(true)}>編集</button>
    </div>
  )
}
```

#### パターン2: Server ComponentをClient Componentの子として渡す（children）

```typescript
// app/posts/layout.tsx (Server Component)
import { PostSidebar } from '@/components/features/posts/PostSidebar'
import { PostContainer } from '@/components/features/posts/PostContainer'

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return (
    <PostContainer>
      <PostSidebar />  {/* Server Component */}
      {children}       {/* Server Component */}
    </PostContainer>
  )
}
```

```typescript
// components/features/posts/PostContainer.tsx (Client Component)
'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

interface PostContainerProps {
  children: ReactNode
}

export function PostContainer({ children }: PostContainerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={sidebarOpen ? 'with-sidebar' : 'no-sidebar'}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)}>
        サイドバー切替
      </button>
      {children}  {/* Server Componentが表示される */}
    </div>
  )
}
```

### パフォーマンス考慮事項

#### バンドルサイズへの影響

| コンポーネントタイプ | JavaScriptバンドル | 初期表示速度 | SEO |
|------------------|-----------------|------------|-----|
| Server Component | 含まれない | ⚡ 高速 | ✅ 優秀 |
| Client Component | 含まれる | 🐢 遅い | ⚠️ 要対策 |

#### コードスプリッティング戦略

```typescript
// ✅ 複数のClient Componentエントリーポイントで分割
// components/features/posts/PostCreateForm.tsx
'use client'
export function PostCreateForm() { /* ... */ }

// components/features/posts/PostList.tsx
'use client'
export function PostList() { /* ... */ }

// components/features/posts/PostDetail.tsx
'use client'
export function PostDetail() { /* ... */ }
```

それぞれ独立したバンドルとなり、必要なページでのみロードされます。

#### 動的インポートの活用

大きなClient Componentは動的インポートで遅延ロード：

```typescript
// app/posts/page.tsx
import dynamic from 'next/dynamic'

const PostEditor = dynamic(
  () => import('@/components/features/posts/PostEditor'),
  {
    loading: () => <div>エディタを読み込み中...</div>,
    ssr: false  // クライアント側のみでレンダリング
  }
)

export default function PostsPage() {
  return (
    <div>
      <h1>投稿編集</h1>
      <PostEditor />
    </div>
  )
}
```

### チェックリスト

新しいコンポーネントを作成する際のチェックリスト：

- [ ] **page.tsxか？** → YESなら必ずServer Component
- [ ] **インタラクティブ性が必要か？**（onClick, onChange等）
- [ ] **Reactフックを使用するか？**（useState, useEffect等）
- [ ] **ブラウザAPIを使用するか？**（window, localStorage等）
- [ ] **カスタムフックを使用するか？**（useQuery, useForm等）
- [ ] **バンドルサイズへの影響を考慮したか？**
- [ ] **`'use client'`境界を最小限に抑えたか？**
- [ ] **静的コンテンツをServer Componentとして分離したか？**

すべてNOならServer Component、1つでもYESならClient Componentを検討してください。

---

## 5. Tanstack Query（サーバー状態管理）

> **⚠️ 重要**: Tanstack Query（`useQuery`, `useMutation`等）は**Client Componentでのみ使用できます**。詳細は[4. Server ComponentとClient Component](#4-server-componentとclient-component)を参照してください。

### QueryClientの設定

```typescript
// apps/web/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分間キャッシュを新鮮とみなす
      cacheTime: 1000 * 60 * 10, // 10分間キャッシュを保持
      refetchOnWindowFocus: false, // ウィンドウフォーカス時の再取得を無効化
      retry: 1, // 失敗時1回リトライ
    },
  },
})
```

**Providerの設定**:

```typescript
// apps/web/app/layout.tsx
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

### useQuery - データ取得

**基本パターン**:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function usePostList(page: number, limit: number) {
  return useQuery({
    queryKey: ['posts', page, limit], // キャッシュキー
    queryFn: async () => {
      const response = await apiClient.posts.$get({
        query: { page: String(page), limit: String(limit) }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }
      return response.json()
    },
    enabled: true, // 自動実行を有効化
  })
}
```

**コンポーネントでの使用**:

```typescript
export function PostList() {
  const { data, isLoading, error } = usePostList(1, 10)

  if (isLoading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div>
      {data.posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

### useMutation - データ更新

**基本パターン**:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreatePostInput } from '@repo/server-core/domain/validators/post'

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const response = await apiClient.posts.$post({ json: data })
      if (!response.ok) {
        throw new Error('Failed to create post')
      }
      return response.json()
    },
    onSuccess: () => {
      // 投稿一覧のキャッシュを無効化（再取得をトリガー）
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (error) => {
      console.error('投稿作成エラー:', error)
    },
  })
}
```

**コンポーネントでの使用**:

```typescript
export function PostCreateButton() {
  const createPost = useCreatePost()

  const handleCreate = () => {
    createPost.mutate({
      title: 'New Post',
      content: 'Content',
      status: 'draft',
    })
  }

  return (
    <button onClick={handleCreate} disabled={createPost.isPending}>
      {createPost.isPending ? '作成中...' : '投稿を作成'}
    </button>
  )
}
```

### QueryKeyパターン

**推奨されるキー構造**:

```typescript
// 投稿一覧
['posts'] // すべての投稿
['posts', { page: 1, limit: 10 }] // ページング付き投稿一覧

// 投稿詳細
['posts', postId] // 特定の投稿

// ユーザー関連
['users'] // ユーザー一覧
['users', userId] // 特定のユーザー
['users', userId, 'posts'] // 特定ユーザーの投稿
```

**キャッシュ無効化のパターン**:

```typescript
// 特定のクエリのみ無効化
queryClient.invalidateQueries({ queryKey: ['posts', postId] })

// プレフィックスマッチで無効化
queryClient.invalidateQueries({ queryKey: ['posts'] }) // ['posts', ...] すべて無効化

// 完全一致で無効化
queryClient.invalidateQueries({ queryKey: ['posts'], exact: true })
```

---

## 6. React Hook Form（フォーム処理）

> **⚠️ 重要**: React Hook Form（`useForm`, `Controller`等）は**Client Componentでのみ使用できます**。詳細は[4. Server ComponentとClient Component](#4-server-componentとclient-component)を参照してください。

### Zodスキーマとの統合

**Zodスキーマの定義** (共有スキーマを使用):

```typescript
// @repo/server-core/domain/validators/post.ts
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200, 'タイトルは200文字以内です'),
  content: z.string().min(1, '本文は必須です'),
  status: z.enum(['draft', 'published']).default('draft'),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
```

### フォームの実装

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPostSchema, type CreatePostInput } from '@repo/server-core/domain/validators/post'
import { useCreatePost } from '@/hooks/use-posts'

export function PostCreateForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      status: 'draft',
    },
  })

  const createPost = useCreatePost()

  const onSubmit = async (data: CreatePostInput) => {
    try {
      await createPost.mutateAsync(data)
      alert('投稿を作成しました')
      reset() // フォームをリセット
    } catch (error) {
      console.error('投稿作成エラー:', error)
    }
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

      <button type="submit" disabled={isSubmitting || createPost.isPending}>
        {isSubmitting || createPost.isPending ? '作成中...' : '投稿を作成'}
      </button>
    </form>
  )
}
```

**設計ポイント**:
- **zodResolver**: Zodスキーマとの統合によりバリデーションロジックを一元化
- **型安全性**: `CreatePostInput`型でフォームデータの型を保証
- **エラー表示**: `formState.errors`でリアルタイムエラー表示
- **defaultValues**: デフォルト値の設定
- **reset()**: 送信成功後にフォームをクリア

---

## 7. コンポーネント設計

### UIコンポーネント（components/ui/）

**基本コンポーネントの役割**:
- 再利用可能な汎用UIパーツ
- プロジェクト全体で使用
- ビジネスロジックを含まない

**例**:

```typescript
// components/ui/button.tsx
import type { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ children, onClick, disabled, variant = 'primary' }: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded font-medium'
  const variantStyles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} disabled:opacity-50`}
    >
      {children}
    </button>
  )
}
```

### 機能別コンポーネント（components/features/）

**機能別コンポーネントの役割**:
- 特定の機能に特化したコンポーネント
- ビジネスロジックを含む
- UIコンポーネントを組み合わせて構築

**例**:

```typescript
// components/features/posts/PostCard.tsx
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Post } from '@repo/server-core/domain/entities/Post'

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Card>
      <h3>{post.title}</h3>
      <p>{post.content.substring(0, 100)}...</p>
      <div className="meta">
        <span>{post.status}</span>
        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
      <Link href={`/posts/${post.id}`}>
        <Button variant="primary">詳細を見る</Button>
      </Link>
    </Card>
  )
}
```

### カスタムフック（hooks/）

**カスタムフックの役割**:
- データ取得ロジックの抽象化
- 状態管理ロジックの再利用
- コンポーネントをシンプルに保つ

**例**:

```typescript
// hooks/use-posts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreatePostInput, UpdatePostInput } from '@repo/server-core/domain/validators/post'

// 投稿一覧取得
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

// 投稿詳細取得
export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: async () => {
      const response = await apiClient.posts[':id'].$get({ param: { id } })
      return response.json()
    },
  })
}

// 投稿作成
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const response = await apiClient.posts.$post({ json: data })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

// 投稿更新
export function useUpdatePost(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdatePostInput) => {
      const response = await apiClient.posts[':id'].$put({
        param: { id },
        json: data
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

// 投稿削除
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.posts[':id'].$delete({ param: { id } })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
```

---

## 8. App Router構成

### ルートグループ

**認証グループ** (`(auth)/`):
- 認証関連のページをグループ化
- URLパスに影響しない（`/login`となり、`/(auth)/login`とはならない）
- 共通のレイアウトを適用可能

**ダッシュボードグループ** (`(dashboard)/`):
- ログイン後のページをグループ化
- 認証チェックミドルウェアを適用

### レイアウト

**ルートレイアウト** (`app/layout.tsx`):

```typescript
import type { Metadata } from 'next'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dr.Love Demo App',
  description: 'モノレポデモアプリケーション',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

**グループレイアウト** (`app/(dashboard)/layout.tsx`):

```typescript
import { Header } from '@/components/features/Header'
import { Sidebar } from '@/components/features/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
```

### ページコンポーネント

**一覧ページ** (`app/posts/page.tsx`):

```typescript
// ✅ page.tsxはServer Component（'use client'なし）
import { PostListContainer } from '@/components/features/posts/PostListContainer'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import Link from 'next/link'

export default async function PostsPage() {
  // サーバー側でデータフェッチ
  const response = await apiClient.posts.$get({
    query: { page: '1', limit: '10' }
  })
  const data = await response.json()

  return (
    <div>
      <div className="header">
        <h1>投稿一覧</h1>
        <Link href="/posts/new">
          <Button variant="primary">新規作成</Button>
        </Link>
      </div>

      {/* Client Componentにデータを渡す */}
      <PostListContainer initialData={data} />
    </div>
  )
}
```

```typescript
// components/features/posts/PostListContainer.tsx (Client Component)
'use client'

import { PostCard } from '@/components/features/posts/PostCard'
import type { Post } from '@repo/server-core/domain/entities/Post'

interface PostListContainerProps {
  initialData: { posts: Post[], total: number }
}

export function PostListContainer({ initialData }: PostListContainerProps) {
  return (
    <div className="grid">
      {initialData.posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

**作成ページ** (`app/posts/new/page.tsx`):

```typescript
// ✅ page.tsxはServer Component（'use client'なし）
import { PostCreateForm } from '@/components/features/posts/PostCreateForm'

export default function PostNewPage() {
  return (
    <div>
      <h1>新規投稿作成</h1>
      {/* PostCreateFormはClient Component */}
      <PostCreateForm />
    </div>
  )
}
```

**詳細ページ** (`app/posts/[id]/page.tsx`):

```typescript
// ✅ page.tsxはServer Component（'use client'なし）
import { PostDetail } from '@/components/features/posts/PostDetail'
import { apiClient } from '@/lib/api-client'

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  // サーバー側でデータフェッチ
  const response = await apiClient.posts[':id'].$get({
    param: { id: params.id }
  })
  const { post } = await response.json()

  // Client Componentにデータを渡す
  return <PostDetail post={post} />
}
```

---

## 9. 状態管理戦略

### サーバー状態 vs クライアント状態

**サーバー状態**（Tanstack Queryで管理）:
- APIから取得したデータ
- キャッシュ、再取得、無効化が必要
- 例: 投稿一覧、ユーザー情報

**クライアント状態**（Reactの状態管理で管理）:
- UIの状態（モーダルの開閉、タブの選択など）
- フォームの入力値（未送信）
- 例: サイドバーの開閉状態、テーマ設定

### 状態管理の選択基準

| データの種類 | 管理方法 | ツール |
|-------------|---------|--------|
| サーバーから取得したデータ | Tanstack Query | useQuery, useMutation |
| フォームの入力値 | React Hook Form | useForm |
| UIの状態（ローカル） | useState | useState |
| UIの状態（グローバル） | Context API | useContext, createContext |
| 認証状態 | Context API + Tanstack Query | 組み合わせ |

---

## 10. エラーハンドリング

### API エラーハンドリング

```typescript
export function usePostList(page: number, limit: number) {
  return useQuery({
    queryKey: ['posts', page, limit],
    queryFn: async () => {
      const response = await apiClient.posts.$get({
        query: { page: String(page), limit: String(limit) }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'データの取得に失敗しました')
      }

      return response.json()
    },
    retry: (failureCount, error) => {
      // 4xx エラーはリトライしない
      if (error.message.includes('401') || error.message.includes('404')) {
        return false
      }
      return failureCount < 2
    },
  })
}
```

### エラー境界（Error Boundary）

```typescript
// components/ErrorBoundary.tsx
'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>エラーが発生しました</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            ページを再読み込み
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

## 11. 実装例

### 完全な投稿一覧ページ実装

```typescript
// app/posts/page.tsx
// ✅ page.tsxはServer Component（'use client'なし）
import { PostListWithPagination } from '@/components/features/posts/PostListWithPagination'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import Link from 'next/link'

interface PostsPageProps {
  searchParams: { page?: string }
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const page = Number(searchParams.page) || 1
  const limit = 10

  // サーバー側でデータフェッチ
  const response = await apiClient.posts.$get({
    query: { page: String(page), limit: String(limit) }
  })
  const data = await response.json()

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">投稿一覧</h1>
        <Link href="/posts/new">
          <Button variant="primary">新規作成</Button>
        </Link>
      </div>

      {/* Client Componentにデータを渡す */}
      <PostListWithPagination
        initialData={data}
        currentPage={page}
        limit={limit}
      />
    </div>
  )
}
```

```typescript
// components/features/posts/PostListWithPagination.tsx (Client Component)
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { PostCard } from '@/components/features/posts/PostCard'
import { Button } from '@/components/ui/button'
import type { Post } from '@repo/server-core/domain/entities/Post'

interface PostListWithPaginationProps {
  initialData: { posts: Post[], total: number }
  currentPage: number
  limit: number
}

export function PostListWithPagination({
  initialData,
  currentPage,
  limit
}: PostListWithPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const totalPages = Math.ceil(initialData.total / limit)

  const handlePageChange = (newPage: number) => {
    router.push(`${pathname}?page=${newPage}`)
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialData.posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            前へ
          </Button>
          <span className="px-4 py-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            次へ
          </Button>
        </div>
      )}
    </>
  )
}
```

### 完全な投稿作成フォーム実装

```typescript
// components/features/posts/PostCreateForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useCreatePost } from '@/hooks/use-posts'
import { createPostSchema, type CreatePostInput } from '@repo/server-core/domain/validators/post'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PostCreateForm() {
  const router = useRouter()
  const createPost = useCreatePost()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      status: 'draft',
    },
  })

  const onSubmit = async (data: CreatePostInput) => {
    try {
      await createPost.mutateAsync(data)
      alert('投稿を作成しました')
      router.push('/posts')
    } catch (error) {
      console.error('投稿作成エラー:', error)
      alert('投稿の作成に失敗しました')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">タイトル</label>
        <Input {...register('title')} placeholder="投稿のタイトルを入力" />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">本文</label>
        <textarea
          {...register('content')}
          rows={10}
          className="w-full border rounded px-3 py-2"
          placeholder="投稿の本文を入力"
        />
        {errors.content && (
          <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">ステータス</label>
        <select
          {...register('status')}
          className="w-full border rounded px-3 py-2"
        >
          <option value="draft">下書き</option>
          <option value="published">公開</option>
        </select>
        {errors.status && (
          <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>
        )}
      </div>

      <div className="flex gap-4">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || createPost.isPending}
        >
          {isSubmitting || createPost.isPending ? '作成中...' : '投稿を作成'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          キャンセル
        </Button>
      </div>
    </form>
  )
}
```

---

## まとめ

このフロントエンド開発ガイドに従うことで、以下を実現できます：

1. **型安全性**: Hono Client + Zodによるエンドツーエンドの型推論
2. **パフォーマンス**:
   - Tanstack Queryによる効率的なデータキャッシング
   - Server Componentによる最小限のJavaScriptバンドル
   - 高速な初期表示（First Contentful Paint）
3. **保守性**:
   - コンポーネント分割とカスタムフックによる関心の分離
   - Server/Client Componentの適切な使い分け
4. **開発効率**: React Hook Formによる宣言的なフォーム処理
5. **スケーラビリティ**: App Routerとルートグループによる明確な構造

### 🚨 必須原則

すべてのフロントエンド実装は、以下の原則を**厳守**してください：

✅ **可能な限りServer Componentを使用する**
- すべてのコンポーネントはデフォルトでServer Component
- データフェッチはサーバー側で実行
- インタラクティブ部分のみClient Component化

❌ **page.tsxでの`'use client'`使用は禁止**
- ページコンポーネントは必ずServer Componentとして実装
- インタラクティブな機能は別コンポーネントに分離
- バンドルサイズを最小限に抑える

このガイドラインに従うことで、高速で保守性の高いモダンなWebアプリケーションを構築できます。
