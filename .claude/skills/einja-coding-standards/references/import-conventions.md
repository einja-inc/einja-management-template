# インポートパスの規約

## パッケージ間のインポート

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

## アプリ内のインポート

```typescript
// apps/web内では従来通り@/を使用
import { Component } from "@/components/...";
import { helper } from "@/lib/...";
```

## 認証設定のパターン

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

## インポート順序

インポート文は以下の順序で記述してください：

1. **Node.js標準ライブラリ**
2. **外部ライブラリ**
3. **内部パッケージ** (`@repo/*`)
4. **アプリ内インポート** (`@/`, `@web/`, `@admin/` 等)
5. **相対インポート**

各グループ間には空行を入れてください。

## 禁止事項

- **相対パスの使用禁止**: import文で `../` や `./` を使用しない（CSS importやindex.tsからの同階層re-exportを除く）
- 必ずアプリ固有エイリアス（`@web/*`, `@admin/*` 等）またはパッケージ名（`@repo/server-core` 等）を使用すること
- **index.ts不使用**: パッケージエクスポートにindex.tsは使わず、直接ファイルパスを指定する（`@repo/server-core/infrastructure/database/client` 等）
