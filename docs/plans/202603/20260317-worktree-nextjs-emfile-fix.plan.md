# fix: worktree環境でのNext.js EMFILE / 404問題の根本修正

## Context

worktree環境（`.claude/worktrees/xxx/`）でNext.js dev serverを起動すると:
1. `Watchpack Error: EMFILE: too many open files` が大量発生
2. `app-paths-manifest.json` に `/_not-found/page` しか入らず、全ルートが404

**根本原因**: Next.jsの `find-root.js` がworktree内の `pnpm-lock.yaml` と親リポジトリの `pnpm-lock.yaml` の両方を検出し、`rootPath` を親リポジトリのルートに設定する。Turbopackが親リポジトリ全体（node_modules含む数万ファイル）をwatch対象にし、FDを使い果たす。

**参照**: `apps/web/node_modules/next/dist/lib/find-root.js` L108, L115

## 現状

- `apps/web/next.config.ts` / `apps/admin/next.config.ts` に `outputFileTracingRoot` も `turbopack.root` も未設定
- `scripts/worktree/dev.ts` の `startDevServer()` に `ulimit -n` 引き上げ済み（前回コミット）
- macOSデフォルト `ulimit -n 256` は低すぎるが、65536でも親リポジトリ全体watchでは不足

## 変更内容

### `apps/web/next.config.ts` / `apps/admin/next.config.ts`

`outputFileTracingRoot` を monorepo root に設定する。これにより:
- `find-root.js` の lockfile 検索がバイパスされる
- `rootPath` がworktreeのmonorepoルートに固定される
- Turbopackのwatch範囲がworktree内に限定される

```ts
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@repo/ui"],
};

export default nextConfig;
```

**`outputFileTracingRoot` を選ぶ理由**:
- Next.js公式ドキュメントでmonorepo推奨設定として記載されている
- Turbopack/Webpack両モードで `rootPath` 決定に使われる（`config.js` L707 で `turbopack.root` にも自動伝播されるため、別途設定不要）
- `output: "standalone"` と組み合わせてdeploymentでも正しく動く

## タスク概要

| ID | 内容 | 依存 |
|----|------|------|
| 0-0 | タスク登録 | - |
| 0-1 | Planファイルリネーム `docs/plans/202603/20260317-worktree-nextjs-emfile-fix.plan.md` | - |
| 1-1 | `apps/web/next.config.ts` に `outputFileTracingRoot` 追加 | - |
| 1-2 | `apps/admin/next.config.ts` に `outputFileTracingRoot` 追加 | - |
| 99-1 | コードレビュー [`einja-review-code`] | 1-1, 1-2 |
| 99-2 | 動作確認: `pnpm dev` 起動 → `app-paths-manifest.json` にルートが正しく登録されるか確認 [`Bash`] | 1-1, 1-2 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | 99-1, 99-2 |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | 99-G |

## 並列実行計画

- 1-1 と 1-2 は並列実行可能（独立したファイル）
- 99-1 と 99-2 は 1-1, 1-2 完了後に並列実行可能

## リスク・不明点

- `__dirname` はNext.js config（TypeScript）で正しく動作するか → Next.jsが内部でCommonJS変換するため動作する
- standalone buildへの影響 → `outputFileTracingRoot` はstandalone build時のファイル収集にも使われるため、むしろ正しく設定すべき

## 検証・動作確認方法

1. `pnpm dev` で起動
2. `cat apps/web/.next/dev/server/app-paths-manifest.json` で `/chat/page` 等が含まれることを確認
3. `curl -I http://localhost:PORT/` で 200 が返ることを確認
