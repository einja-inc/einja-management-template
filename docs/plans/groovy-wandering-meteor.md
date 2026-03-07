# ドメインベースRPC分割の導入

## Context

別プロジェクトで発生した課題（全ルートが1つのcatch-all route.tsに集約 → Vercelで巨大Serverless Functionになりコールドスタート2〜5秒）の根本解決策として、**ドメイン/機能ごとにRPCルートを分割する設計**をこのテンプレートプロジェクトに導入する。

現在の設計では全RPCルートが `app/api/rpc/[[...route]]/route.ts` 1ファイルに集約されており、ルートが増えるほどバンドルが肥大化する構造。ドメイン分割により、Vercelが各ドメインを独立Serverless Functionとして自動分割し、コールドスタートの大幅短縮とバンドル独立性を実現する。

**加えて、ドキュメント内の全API設計記述をこの新設計に合わせて修正する。**

---

## 設計概要

### 新旧比較

| 項目 | 旧（現在） | 新（ドメイン分割） |
|------|-----------|------------------|
| エントリーポイント | `app/api/rpc/[[...route]]/route.ts` (1ファイル) | `app/api/rpc/{domain}/[[...route]]/route.ts` (ドメインごと) |
| basePath | `new Hono().basePath("/api/rpc")` | なし（`hc`のbaseURLで指定） |
| クライアント | `apiClient = hc<AppType>("/")` | `rpc = { users: hc<UsersApp>("/api/rpc/users"), ... }` |
| 呼び出し | `apiClient.api.rpc.users.$get()` | `rpc.users.$get()` |
| Vercel Function | 全ルート1 Function | ドメインごとに独立Function |

### ドメイングループ設計

**Web app:**

| グループ | エンドポイント | 主な依存 |
|---------|-------------|---------|
| auth | login, logout, session | Prisma + JWT |
| posts | posts CRUD | Prisma |

**Admin app:**

| グループ | エンドポイント | 主な依存 |
|---------|-------------|---------|
| users | users CRUD | Prisma |
| posts | posts管理 | Prisma |
| analytics | 分析 | Prisma |

**共通（RPC外）:** `/api/health` はドメイン分割対象外。

### 現在実装済みのコード: web app の users のみ
- `apps/web/src/app/api/rpc/[[...route]]/route.ts` → `apps/web/src/app/api/rpc/users/[[...route]]/route.ts` に移行

---

## 変更対象ファイル

### コード変更（6ファイル）

| ファイル | 操作 | 内容 |
|---------|------|------|
| `apps/web/src/app/api/rpc/users/[[...route]]/route.ts` | **新規作成** | usersドメインのエントリーポイント |
| `apps/web/src/app/api/rpc/[[...route]]/route.ts` | **削除** | 旧単一エントリーポイント |
| `apps/web/src/lib/api/rpc.ts` | **新規作成** | ドメインベースRPCクライアント |
| `apps/web/src/lib/api/client.ts` | **削除** | 旧apiClient |
| `apps/web/src/hooks/api/use-users.ts` | **修正** | apiClient → rpc に変更 |
| `apps/web/src/hooks/api/prefetch-users.ts` | **確認** | URL変更なし（/api/rpc/usersのまま） |

### ドキュメント変更（8ファイル）※Codexレビューで2ファイル追加

| ファイル | 影響度 | 主な変更内容 |
|---------|-------|-------------|
| `docs/einja/steering/development/api-development.md` | **大** | セクション1,2,3,7,11の全面改訂 + 新セクション追加 |
| `docs/einja/steering/development/frontend-development.md` | **大** | セクション1,3,**4,5**,7,**10,11**,12の`apiClient`参照を全面改訂 |
| `docs/einja/steering/development/backend-architecture.md` | **中** | Presentation層の実装例・ディレクトリ構造 |
| `docs/einja/steering/development/review-guidelines.md` | **小** | ドメイン分割チェック項目追加 |
| `docs/einja/steering/development/testing-strategy.md` | **小** | 統合テスト例のapiClient→rpc |
| `docs/einja/steering/architecture.md` | **小** | ディレクトリ構造のrpc/配下 |
| `.claude/skills/einja-coding-standards/references/testing-strategy.md` | **小** | apiClient→rpc置換 ※Codex指摘で追加 |
| `.claude/agents/einja/backend-architect.md` | **小** | AppType言及の確認・更新 ※Codex指摘で追加 |

---

## 実装詳細

### Step 1: サーバーサイド — ドメインroute.ts作成

**新規: `apps/web/src/app/api/rpc/users/[[...route]]/route.ts`**

```typescript
import { userRoutes } from "@web/server/presentation/routes/userRoutes";
import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono();
const routes = app.route("/", userRoutes);

export type UsersAppType = typeof routes;

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
```

**ポイント:**
- `basePath` は使わない。`hc`のbaseURLで `/api/rpc/users` を指定する方式
- `app.route("/", userRoutes)` — ドメインパスはディレクトリで表現済み
- `UsersAppType` — ドメインごとに型名を区別

旧 `apps/web/src/app/api/rpc/[[...route]]/route.ts` は削除。

### Step 2: クライアント側 — rpc.ts作成

**新規: `apps/web/src/lib/api/rpc.ts`**

```typescript
import type { UsersAppType } from "@/app/api/rpc/users/[[...route]]/route";
import { hc } from "hono/client";

export const rpc = {
  users: hc<UsersAppType>("/api/rpc/users"),
} as const;
```

旧 `apps/web/src/lib/api/client.ts` は削除。

### Step 3: フック修正

**`apps/web/src/hooks/api/use-users.ts`**

```diff
- import { apiClient } from "@/lib/api/client";
+ import { rpc } from "@/lib/api/rpc";

// 一覧取得
- const response = await apiClient.api.rpc.users.$get({
+ const response = await rpc.users.$get({

// 詳細取得
- const response = await apiClient.api.rpc.users[":id"].$get({
+ const response = await rpc.users[":id"].$get({
```

### Step 4: 動作確認

- `pnpm prepush` (lint + typecheck + test) 通過確認
- 開発サーバーでAPI呼び出し動作確認

### Step 5: ドキュメント全面更新

6ファイルのドキュメントを新設計に合わせて更新。詳細は以下。

---

## ドキュメント変更詳細

### 5-1. `api-development.md` — 最重要

**セクション1: Honoアプリケーション構造**
- エントリーポイントを `app/api/rpc/{domain}/[[...route]]/route.ts` に変更
- basePathの説明を「使用しない」方式に変更
- 各ドメインroute.tsのテンプレートコードを記載
- rpcクライアントのセットアップコードを追加

**セクション2: Web APIエンドポイント一覧**
- 各エンドポイントにRPCグループ情報を追加
- URLを `/api/rpc/{domain}/...` 形式に変更
- auth: `/api/rpc/auth/login`, `/api/rpc/auth/logout`, `/api/rpc/auth/session`
- posts: `/api/rpc/posts`, `/api/rpc/posts/:id`

**セクション3: Admin APIエンドポイント一覧**
- 同様にRPCグループ情報を追加
- users: `/api/rpc/users`, `/api/rpc/users/:id`
- posts: `/api/rpc/posts`, `/api/rpc/posts/:id/status`
- analytics: `/api/rpc/analytics`

**セクション7: フロントエンド統合パターン**
- `apiClient.api.rpc.posts.$get()` → `rpc.posts.$get()` に全置換
- parseResponse例のimportを `rpc` に変更

**セクション11: 実装例**
- エントリーポイント例をドメインベースに書き換え
- rpcクライアント例を追加

**新規セクション: ドメインベースRPC分割の設計原則**
- なぜ分割するか（Vercel Function独立、コールドスタート改善）
- グループ設計の基準（依存の重さ・頻度で分類）
- 新ドメイン追加手順

### 5-2. `frontend-development.md` ※Codexレビューでセクション追加

**セクション1: ディレクトリ構造**
```
├── api/rpc/                  # ドメインベースRPC
│   ├── users/[[...route]]/route.ts
│   ├── auth/[[...route]]/route.ts
│   └── posts/[[...route]]/route.ts
```

**セクション3: Hono Client統合**
- セットアップ: `client.ts` / `apiClient` → `rpc.ts` / `rpc`
- 全API呼び出しパターン: `apiClient.api.rpc.users...` → `rpc.users...`
- parseResponse使用例も同様に修正

**セクション4: Server ComponentとClient Component** ※Codex指摘で追加
- 行420-424, 549, 553, 599, 603の `apiClient.posts.$get()` → `rpc.posts.$get()`

**セクション5: Tanstack Query** ※Codex指摘で追加
- 行800-806 useQuery基本パターンの `apiClient.posts.$get()` → `rpc.posts.$get()`
- 行844-852 useMutationの `apiClient.posts.$post()` → `rpc.posts.$post()`

**セクション7: カスタムフック**
- `apiClient` → `rpc` に全置換
- `apiClient.api.posts.$get()` → `rpc.posts.$get()` 等

**セクション10: 状態管理戦略** ※Codex指摘で追加
- 行1456の `apiClient.posts.$get()` → `rpc.posts.$get()`

**セクション11: エラーハンドリング** ※Codex指摘で追加
- 行1534-1546の完全な実装例の `apiClient.posts.$get()` → `rpc.posts.$get()`

**セクション12: 実装例**
- 行1335-1340, 1405-1409の完全な実装例をドメインベースに更新

### 5-3. `backend-architecture.md`

**Presentation層セクション (行 195-229)**
- 実装例を `app/api/rpc/posts/[[...route]]/route.ts` ベースに変更
- `handle` 関数の使用例を更新

**ディレクトリ構造 (行 35-46)**
- エントリーポイントパスを `/api/rpc/{domain}/` に変更

### 5-4. `review-guidelines.md`

**API開発ガイド準拠確認 (行 64-73)**
- チェック項目追加: 「ドメインベースRPC分割が守られているか」
- 「単一catch-allに全ルートを集約していないか」

**APIクライアント実装ガイド準拠確認 (行 78-85)**
- `rpc`オブジェクト使用の確認項目に変更
- 旧`apiClient`パターンの使用禁止を明記

### 5-5. `testing-strategy.md`

**統合テスト例 (行 431-498)**
- `apiClient.posts.$get()` → `rpc.posts.$get()`
- `apiClient.posts.$post()` → `rpc.posts.$post()`

### 5-6. `architecture.md`

**ディレクトリ構造 (行 87-99)**
- lib/api/ 配下に `rpc.ts` を明示

### 5-7. `.claude/skills/einja-coding-standards/references/testing-strategy.md` ※Codex指摘で追加

- `apiClient` → `rpc` に全置換
- `import { apiClient } from '@/lib/api-client'` → `import { rpc } from '@/lib/api/rpc'`
- `apiClient.posts.$get()` → `rpc.posts.$get()`
- `apiClient.posts.$post()` → `rpc.posts.$post()`

### 5-8. `.claude/agents/einja/backend-architect.md` ※Codex指摘で追加

- `AppType` の言及を確認し、ドメインベース型名（`UsersAppType` 等）に更新
- Hono型推論の説明がドメイン分割後も正確か確認

---

## ミドルウェア適用パターンの変更

**旧:** 単一route.tsで全ドメインにミドルウェア適用
```typescript
const app = new Hono().basePath("/api/rpc");
app.use("/admin/*", adminAuthMiddleware);
app.route("/users", userRoutes);
app.route("/posts", postRoutes);
```

**新:** 各ドメインroute.tsで個別にミドルウェア適用
```typescript
// auth/[[...route]]/route.ts — 認証不要
const app = new Hono();
const routes = app.route("/", authRoutes);

// posts/[[...route]]/route.ts — 認証必要
const app = new Hono();
app.use("/*", authMiddleware);  // ドメイン全体に適用
const routes = app.route("/", postRoutes);
```

**注意:** サブルート内での `.use()` 禁止ルールは変わらない。

---

## 検証方法

1. **型チェック**: `pnpm typecheck` — Hono Client型推論が正常に動作
2. **Lint**: `pnpm lint` — import文の整合性
3. **テスト**: `pnpm test` — 既存テストの通過
4. **統合確認**: `pnpm prepush` — lint + typecheck + test の一括確認
5. **開発サーバー確認**: `pnpm dev` → `/api/rpc/users` にアクセスして動作確認
6. **git diff確認**: 意図しない変更が混入していないこと
