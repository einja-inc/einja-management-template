# packages層の相対パスインポート禁止を強制する

## Context

import-conventions.md で「`../` や `./` を使用しない」と規定されているが、packages層では強制手段がなく、29ファイルで `../../` 形式の相対パスが使われている。TSConfig paths エイリアス（`@/`）を追加し、既存の相対パスインポートを書き換える。

## 対象ファイル数

| パッケージ | 違反ファイル数 | 備考 |
|-----------|-------------|------|
| packages/server-core | 8件 | vitest.config.ts に `@/` alias 定義済み |
| packages/cli | 13件 | vitest alias 追加必要 |
| packages/create-einja-app | 8件 | テストファイル中心 |

## 実施内容

### Step 1: TSConfig paths 追加（3ファイル）

各パッケージの `tsconfig.json` に `paths` を追加。IDEの補完・型チェックで `@/` が使えるようになる。

```json
"compilerOptions": {
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

対象:
- `packages/server-core/tsconfig.json`
- `packages/cli/tsconfig.json`
- `packages/create-einja-app/tsconfig.json`（テスト用に `tests/` へのalias も検討）

### Step 2: vitest.config.ts の alias 追加（2ファイル）

server-core は既に定義済み。cli と create-einja-app に追加。

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
},
```

対象:
- `packages/cli/vitest.config.ts`（存在確認要）
- `packages/create-einja-app/vitest.config.ts`（存在確認要）

### Step 3: 相対パスインポートを `@/` に書き換え（29ファイル）

例:
```typescript
// Before
import type { User } from "../../../domain/entities/User";
import { type Result, failure, success } from "../../../core/result";

// After
import type { User } from "@/domain/entities/User";
import { type Result, failure, success } from "@/core/result";
```

### Step 4: ドキュメント更新（1ファイル）

`.claude/skills/einja-coding-standards/references/import-conventions.md` の禁止事項セクションを更新:
- packages層でも `@/` エイリアスを使用する旨を明記
- 各パッケージの `@/` が何を指すか記載

### Step 5: 検証

- `pnpm typecheck` — 型チェック通過
- `pnpm test` — テスト通過（server-core, cli, create-einja-app）
- `pnpm build` — ビルド通過
- `grep` で `../../` が残っていないことを確認

## Lint強制について

Biomeの `noRestrictedImports` は完全一致のみでパターンマッチ不可。自動検出は不可のため、コードレビュー + ドキュメントで担保する。
