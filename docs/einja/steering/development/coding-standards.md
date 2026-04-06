<!-- @einja:managed -->
# コーディング規約

## 概要

このドキュメントは、プロジェクトのコーディング規約を提供します。一貫性のある高品質なコードを維持し、チーム全体の開発効率を向上させることを目的とします。

## 基本原則

### 1. 可読性の重視
- コードは書くよりも読まれることが多い
- 明確で理解しやすいコードを書く
- 適切な命名と構造化を心がける

### 2. 一貫性の保持
- プロジェクト全体で統一されたスタイルを維持
- 既存のコードパターンに従う
- ツールによる自動化を活用

### 3. 保守性の向上
- 変更に強いコード設計
- 適切な分離と抽象化
- テスタブルなコード構造

## クイックリファレンス

### 必須チェック項目

- [ ] **any型を使用していない**（最重要）
- [ ] 適切な型定義がされている
- [ ] 命名規約に従っている
- [ ] early return パターンを使用している
- [ ] エラーハンドリングが適切に実装されている
- [ ] 禁止事項に該当するコードがない

### インポート順序

```typescript
// 1. Node.js標準ライブラリ
import { readFile } from 'fs/promises';

// 2. 外部ライブラリ
import React from 'react';
import { NextRequest } from 'next/server';

// 3. 内部ライブラリ（@/から始まる）
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

// 4. 相対インポート
import './styles.css';
import { localUtil } from '../utils';
```

### スタイリング（Tailwind CSS）

```typescript
// ✅ Tailwind CSSユーティリティクラスの使用
export function Card({ children }: CardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-md hover:shadow-lg transition-shadow">
      {children}
    </div>
  );
}

// ✅ cva によるバリアント管理
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
```

## ツール設定

### 必須ツール
1. **Biome**: linting と formatting
2. **TypeScript**: 型チェック
3. **Husky**: Git hooks
4. **lint-staged**: ステージングファイルのチェック

### VS Code 推奨設定

```json
{
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll": true
  },
  "editor.formatOnSave": true,
  "typescript.preferences.noSemicolons": false,
  "typescript.preferences.quoteStyle": "double"
}
```

## TypeScript 規約

### 型安全性

#### ❌ any型の使用禁止

```typescript
// ❌ 禁止
function processData(data: any) {
  return data.someProperty;
}

const user: any = getUser();

// ✅ 推奨
interface User {
  id: string;
  name: string;
  email: string;
}

function processData(data: User) {
  return data.name;
}

const user: User = getUser();
```

**any型が絶対に禁止される理由:**
- TypeScriptの型チェック機能を無効化
- ランタイムエラーの原因となる
- IDEの自動補完・リファクタリング機能が働かない
- コードの可読性・保守性が著しく低下

#### 型定義のベストプラクティス

```typescript
// ✅ 明確な型定義
interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

// ✅ Union型の活用
type ButtonVariant = 'primary' | 'secondary' | 'danger';

// ✅ Generic型の活用
function createApiCall<T>(endpoint: string): Promise<ApiResponse<T>> {
  // 実装
}

// ✅ 型ガードの使用
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as User).id === 'string'
  );
}
```

#### unknown型の活用

```typescript
// ✅ anyの代わりにunknownを使用
function parseJson(json: string): unknown {
  return JSON.parse(json);
}

// ✅ 型ガードと組み合わせて安全に使用
const data = parseJson(jsonString);
if (isUser(data)) {
  console.log(data.name); // 型安全
}
```

### 厳格な型チェック設定

`tsconfig.json`で以下の設定を必須とする：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### React / Next.js での型安全性

#### Props型定義

```typescript
// ✅ 明確なProps型定義（any型禁止）
interface ComponentProps {
  data: UserData; // 具体的な型を指定
  onAction: (id: string) => void; // 関数型も明確に
}

// ❌ any型の使用禁止
interface BadProps {
  data: any; // 絶対禁止
  callback: any; // 絶対禁止
}
```

### コード構造・パターン

#### エクスポート規約

```typescript
// ✅ 名前付きエクスポート（推奨）
export function Button() { }
export { Button };

// ✅ デフォルトエクスポート（Pageコンポーネントのみ）
export default function HomePage() { }

// ❌ 混在は避ける
export function Button() { }
export default Button; // 避ける
```

#### 条件分岐

##### 早期リターン

```typescript
// ✅ 早期リターンパターン
function processUser(user: User | null): string {
  if (!user) {
    return 'User not found';
  }

  if (!user.isActive) {
    return 'User is inactive';
  }

  return `Welcome, ${user.name}!`;
}

// ❌ ネストの深い条件分岐
function processUser(user: User | null): string {
  if (user) {
    if (user.isActive) {
      return `Welcome, ${user.name}!`;
    } else {
      return 'User is inactive';
    }
  } else {
    return 'User not found';
  }
}
```

##### Optional Chaining の活用

```typescript
// ✅ Optional Chaining
const userName = user?.profile?.name ?? 'Anonymous';
const hasAdminRole = user?.roles?.includes('admin') ?? false;

// ✅ Nullish Coalescing
const config = userConfig ?? defaultConfig;
const port = process.env.PORT ?? 3000;
```

### エラーハンドリング

#### エラー型の定義

```typescript
// ✅ カスタムエラークラス
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ✅ Result型パターン
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function safeApiCall<T>(fn: () => Promise<T>): Promise<Result<T>> {
  return fn()
    .then(data => ({ success: true as const, data }))
    .catch(error => ({ success: false as const, error }));
}
```

#### エラーハンドリングパターン

```typescript
// ✅ try-catch の適切な使用
async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error; // 予期しないエラーは再スロー
  }
}

// ✅ Error Boundary での エラーキャッチ
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryComponent
      fallback={<ErrorFallback />}
      onError={(error, errorInfo) => {
        console.error('Error caught by boundary:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundaryComponent>
  );
}
```

### テストでの型安全性

```typescript
// ✅ テストでもany型禁止
interface MockUser {
  id: string;
  name: string;
}

const mockUser: MockUser = { id: '1', name: 'Test User' };

// ❌ テストでもany型は使用禁止
const badMockData: any = { /* データ */ }; // 禁止
```

## 命名規則

### ファイル・ディレクトリ命名

#### 基本的な命名原則

- **Reactコンポーネント**: PascalCase（例: `UserProfile.tsx`）
- **ユーティリティファイル**: camelCase（例: `authConfig.ts`）
- **Next.jsファイル**: lowercase（例: `page.tsx`, `layout.tsx`）

**注意**: shadcn/uiで生成されたコンポーネントはkebab-caseファイル名（例: `button.tsx`, `input.tsx`）を使用しており、この命名規則の例外となります。

### 変数・関数命名

#### 変数名

```typescript
// ✅ camelCase
const userName = 'john';
const isLoggedIn = true;
const userList = [];

// ✅ boolean値は is/has/can などで開始
const isVisible = true;
const hasPermission = false;
const canEdit = true;

// ✅ 定数はSCREAMING_SNAKE_CASE
const API_ENDPOINT = 'https://api.example.com';
const MAX_RETRY_COUNT = 3;
```

#### 関数名

```typescript
// ✅ 動詞で開始
function getUserById(id: string): User | null { }
function validateEmail(email: string): boolean { }
function handleSubmit(): void { }

// ✅ イベントハンドラーは "handle" または "on" で開始
function handleClick(): void { }
function onUserSelect(user: User): void { }

// ✅ 戻り値がbooleanの場合は is/has/can で開始
function isValidUser(user: User): boolean { }
function hasPermission(user: User, action: string): boolean { }
```

#### 型定義（type vs interface）

**`type` を使用すること。`interface` は使用しない。**

```typescript
// ✅ type を使用
type User = {
  id: string;
  name: string;
};

// ✅ Props は "Props" サフィックス
type UserCardProps = {
  user: User;
  onEdit?: () => void;
};

// ✅ 型は Type サフィックス（必要に応じて）
type ApiResponseType<T> = {
  data: T;
  status: string;
};

// ✅ Union型は具体的な名前
type ButtonVariant = 'primary' | 'secondary' | 'danger';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// ❌ interface は使用しない
// interface User { id: string; name: string; }
```

#### フィールド名

```typescript
// ✅ フィールド名は camelCase
type SessionData = {
  sessionId: string;
  repoPath: string;
  createdAt: Date;
};

// ❌ snake_case は禁止
// type SessionData = {
//   session_id: string;
//   repo_path: string;
// };
```

### コメント規約

#### JSDoc の使用

```typescript
/**
 * ユーザー情報を取得する
 * @param id - ユーザーID
 * @returns ユーザー情報、見つからない場合はnull
 * @throws {ApiError} API呼び出しが失敗した場合
 */
async function getUserById(id: string): Promise<User | null> {
  // 実装
}
```

#### インラインコメント

```typescript
// ✅ 「なぜ」を説明するコメント
// Safari では transform-origin が正しく動作しないため、明示的に設定
element.style.transformOrigin = 'center center';

// ✅ 複雑なビジネスロジックの説明
// 管理者は全てのデータにアクセス可能、
// 一般ユーザーは自分のデータのみアクセス可能
const hasAccess = user.role === 'admin' || user.id === resourceOwnerId;

// ❌ 「何を」するかのコメント（不要）
// ユーザー名を取得
const userName = user.name;
```

## 禁止事項

### 絶対に使用禁止

#### 1. any型の使用

```typescript
// ❌ 絶対禁止
const data: any = response;
function process(input: any): any { }
```

**理由:**
- TypeScriptの型チェック機能を完全に無効化
- ランタイムエラーの主要な原因
- IDEの補完・リファクタリング機能が働かない
- コードの可読性・保守性が著しく低下

**代替策:**
- `unknown`型を使用し、型ガードで絞り込む
- 適切なinterface/typeを定義する
- Generic型を活用する

#### 2. eval()関数の使用

```typescript
// ❌ セキュリティリスクのため禁止
eval(userInput);
```

**理由:**
- XSS攻撃の主要な原因
- コードインジェクションのリスク
- パフォーマンスへの悪影響
- デバッグが困難

#### 3. console.log の本番環境への残留

```typescript
// ❌ 本番環境では禁止（開発時は可）
console.log('debug info');
```

**理由:**
- パフォーマンスへの影響
- 機密情報の漏洩リスク
- ログの乱雑化

**対策:**
- 開発時のみ使用し、コミット前に削除
- 必要な場合はロギングライブラリを使用

#### 4. var キーワードの使用

```typescript
// ❌ letまたはconstを使用
var userName = 'john';

// ✅ 推奨
const userName = 'john';
let counter = 0;
```

**理由:**
- 関数スコープによる予期しない動作
- ホイスティングによるバグ
- `let`/`const`はブロックスコープで安全

#### 5. == 比較演算子の使用

```typescript
// ❌ 型強制が発生するため禁止
if (value == null) { }

// ✅ 厳密等価演算子を使用
if (value === null) { }
if (value == null) { } // nullとundefinedの両方をチェックする場合のみ例外
```

**理由:**
- 暗黙の型変換による予期しない動作
- デバッグが困難
- TypeScriptの型安全性を損なう

**唯一の例外:**
- `value == null` は `value === null || value === undefined` と等価で、これのみ許容

### 推奨されない書き方

#### ネストの深い条件分岐

```typescript
// ❌ 避ける
if (condition1) {
  if (condition2) {
    if (condition3) {
      // 処理
    }
  }
}

// ✅ 早期リターンを使用
if (!condition1) return;
if (!condition2) return;
if (!condition3) return;
// 処理
```

#### マジックナンバー

```typescript
// ❌ 避ける
if (user.age >= 18) { }
setTimeout(callback, 3000);

// ✅ 定数を定義
const LEGAL_AGE = 18;
const ANIMATION_DELAY_MS = 3000;

if (user.age >= LEGAL_AGE) { }
setTimeout(callback, ANIMATION_DELAY_MS);
```

#### 命名付きエクスポートとデフォルトエクスポートの混在

```typescript
// ❌ 避ける
export function Button() { }
export default Button;

// ✅ どちらか一方を使用
export function Button() { }
// または
export default function Button() { }
```

### セキュリティ関連の禁止事項

#### 機密情報のハードコーディング

```typescript
// ❌ 絶対禁止
const API_KEY = 'sk-1234567890abcdef';
const PASSWORD = 'secret123';

// ✅ 環境変数を使用
const API_KEY = process.env.API_KEY;
```

#### ユーザー入力の直接利用

```typescript
// ❌ SQLインジェクションのリスク
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ パラメータ化クエリを使用
const query = 'SELECT * FROM users WHERE id = $1';
await db.query(query, [userId]);
```

#### 未検証データの表示

```typescript
// ❌ XSSのリスク
element.innerHTML = userInput;

// ✅ サニタイズまたはテキストとして扱う
element.textContent = userInput;
```

## インポートパス規約

### パッケージ間のインポート

```typescript
// 認証機能（共通設定）
import { baseAuthOptions, mergeAuthOptions } from "@repo/front-core/auth";

// 認証機能（アプリローカル）
import { auth, signIn, signOut } from "@/lib/auth";
import { requireAuth, withAuth } from "@/lib/auth/guard";

// データベース
import { prisma } from "@repo/server-core";

// UIコンポーネント
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { cn } from "@repo/ui/utils";

// 型定義
import type { Session } from "next-auth"; // 型拡張はfront-coreで定義済み
```

### アプリ内のインポート

```typescript
// apps/web内では従来通り@/を使用
import { Component } from "@/components/...";
import { helper } from "@/lib/...";
```

### 認証設定のパターン

アプリ固有の認証設定は `@/lib/auth/index.ts` で `baseAuthOptions` を拡張します：

```typescript
import { baseAuthOptions, mergeAuthOptions } from "@repo/front-core/auth";
import NextAuth from "next-auth";

const authOptions = mergeAuthOptions(baseAuthOptions, {
  pages: { signIn: "/signin" },  // アプリ固有
  callbacks: {
    async redirect({ url, baseUrl }) {
      // アプリ固有のリダイレクトロジック
    },
  },
});

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);
```

### インポート順序

インポート文は以下の順序で記述してください：

1. **Node.js標準ライブラリ**
2. **外部ライブラリ**
3. **内部パッケージ** (`@repo/*`)
4. **アプリ内インポート** (`@/`, `@web/`, `@admin/` 等)
5. **相対インポート**

各グループ間には空行を入れてください。

### 禁止事項

- **相対パスの使用禁止**: import文で `../` や `./` を使用しない（CSS importやindex.tsからの同階層re-exportを除く）
- 必ずアプリ固有エイリアス（`@web/*`, `@admin/*` 等）またはパッケージ名（`@repo/server-core` 等）を使用すること
- **packages層でも `@/` エイリアスを使用すること**: 各パッケージの `tsconfig.json` に `"@/*": ["./src/*"]` が設定済み
  - `packages/server-core`: `@/` → `src/`（例: `@/domain/entities/User`, `@/core/result`）
  - `packages/cli`: `@/` → `src/`（例: `@/lib/sync/diff-engine.js`, `@/types/sync.js`）
  - `packages/create-app`: `@/` → `src/`（例: `@/utils/merger.js`, `@/types/index.js`）
- **index.ts不使用**: パッケージエクスポートにindex.tsは使わず、直接ファイルパスを指定する（`@repo/server-core/infrastructure/database/client` 等）

## 関連ドキュメント

- `docs/einja/steering/development/component-design.md` - コンポーネント設計ガイドライン
- `docs/einja/steering/development/testing-strategy.md` - テスト戦略
- `docs/einja/steering/development/review-guidelines.md` - コードレビューガイドライン
- `docs/einja/steering/commit-rules.md` - コミットルール

<!-- @einja:project-private:start id="coding-standards-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
