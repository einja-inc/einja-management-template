# Next.js アップデート計画

## Context

Next.js 15.3.9 → 16.1.6（latest）へのメジャーアップデート。
コードベースを調査した結果、16.xのbreaking changesの影響を受ける箇所がほぼなく、安全にアップデート可能と判断。
動作確認（typecheck、build、dev起動＋画面確認）まで実施する。
また、Planレビューが自動実行されなかった問題を防止するため、CLAUDE.mdのStep 6.5の文言を強化する。

## 現状

| 項目 | 現在 | 更新先 |
|------|------|--------|
| next | 15.3.9（固定） | 16.1.6 |
| next（admin-ui） | ^15.3.9 | ^16.1.6 |
| next-auth | ^5.0.0-beta.28 | ^5.0.0-beta.30 |
| next-themes | ^0.4.6 | 変更なし |
| react / react-dom | ^19.0.0 | 変更なし |

### 16.x Breaking Changes 影響分析

| Breaking Change | 影響 | 理由 |
|----------------|------|------|
| async `cookies()`/`headers()` 必須 | **なし** | 既に`await`使用済み（prefetch-users.ts） |
| async `params`/`searchParams` 必須 | **なし** | ページコンポーネントでpropsとして未使用 |
| `middleware.ts` → `proxy.ts` 推奨 | **軽微** | 非推奨警告のみ、動作は継続。next-authとの互換確認後に対応 |
| `next lint` 削除 | **なし** | Biome使用 |
| `legacyBehavior` for `next/link` 削除 | **なし** | 未使用 |
| Parallel routes に `default.js` 必須 | **なし** | parallel routes未使用 |
| `next/image` デフォルト変更 | **なし** | `next/image` 未使用 |
| Node.js 20.9+ 必須 | **なし** | 22.16.0使用中 |
| Turbopackがデフォルトバンドラー | **軽微** | dev時は既に使用中。build時は初適用 |
| `eslint` config option 削除の可能性 | **要確認** | 16.xで`next lint`が削除されたため、`eslint.ignoreDuringBuilds`が型エラーになる可能性。typecheckで判明する |

## 変更内容

### 対象ファイル

**メインコードベース:**

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/package.json` | next: 15.3.9→16.1.6, next-auth: beta.28→beta.30 |
| `apps/admin/package.json` | next: 15.3.9→16.1.6, next-auth: beta.28→beta.30 |
| `packages/admin-ui/package.json` | next: ^15.3.9→^16.1.6 |
| `packages/front-core/package.json` | next-auth: beta.28→beta.30 |
| `apps/web/next.config.ts` | typecheckでeslintオプションがエラーなら削除 |
| `apps/admin/next.config.ts` | 同上 |
| `pnpm-lock.yaml` | 自動更新 |

**create-appテンプレート（同時更新必須）:**

| ファイル | 変更内容 |
|---------|---------|
| `packages/create-app/templates/default/apps/web/package.json` | next: 15.3.9→16.1.6, next-auth: beta.28→beta.30 |
| `packages/create-app/templates/default/apps/admin/package.json` | next: 15.3.9→16.1.6, next-auth: beta.28→beta.30 |
| `packages/create-app/templates/default/packages/admin-ui/package.json` | next: ^15.3.9→^16.1.6 |
| `packages/create-app/templates/default/packages/front-core/package.json` | next-auth: beta.28→beta.30 |
| `packages/create-app/templates/default/apps/web/next.config.ts` | eslint削除が必要な場合は同期 |
| `packages/create-app/templates/default/apps/admin/next.config.ts` | 同上 |

**CLAUDE.md修正:**

| ファイル | 変更内容 |
|---------|---------|
| `CLAUDE.md` | Step 6.5のPlanレビュー必須化の文言強化 |

### next.config.ts
`output: "standalone"`, `transpilePackages` は16.xでも引き続きサポート。
`eslint.ignoreDuringBuilds` は16.xで型エラーになる可能性があるため、typecheckで確認し、エラーなら削除する。

### middleware.ts
現時点では変更しない（非推奨警告のみで動作継続）。next-authのproxy.ts対応状況を確認後、別タスクで対応。

## タスク概要

| ID | タスク | Skill/ツール | 依存 |
|----|--------|-------------|------|
| 0-0 | TaskCreate一括登録 | TaskCreate | - |
| 0-1 | Planファイルリネーム | Bash | 0-0 |
| 0-2 | CLAUDE.md Step 6.5 文言強化（Planレビュー必須化） [`Edit`] | Edit | 0-0 |
| 1-1 | メインコードベースのpackage.jsonバージョン更新 + pnpm install [`frontend-coder`] | frontend-coder | 0-1 |
| 1-2 | create-appテンプレートのpackage.jsonバージョン更新 [`frontend-coder`] | frontend-coder | 0-1 |
| 2-1 | typecheck確認 → eslintオプション型エラー時はnext.config.ts修正 [`Bash` + `Edit`] | Bash | 1-1 |
| 2-2 | build確認（`pnpm build:local`） [`Bash`] | Bash | 2-1 |
| 2-3 | dev起動 + 画面表示確認 [`Playwright MCP`] | Playwright MCP | 2-2 |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | einja-review-code | 2-3 |
| 99-2 | 動作確認（prepush） [`Bash`] | Bash | 99-1 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | AskUserQuestion | 99-2 |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | einja-task-commit | 99-G |

## 並列実行計画

```
0-0 → 0-1 + 0-2（並列）
     → 1-1 + 1-2（並列、0-1完了後）
     → 2-1 → 2-2 → 2-3（順次、1-1完了後）
     → 99-1 → 99-2 → 99-G → 99-3
```

## リスク・不明点

1. **eslint config option**: 16.xで`NextConfig`型から`eslint`が除外されている場合、typecheckで型エラーになる。その場合はnext.config.tsからeslintブロックを削除する（Biome使用のため影響なし）
2. **Turbopack build**: 16.xではbuild時もTurbopackがデフォルト。`output: "standalone"`の動作を確認する。問題があれば`next build --webpack`でフォールバック可能
3. **next-auth beta互換**: beta.30はNext.js 16.xをpeerDepsに含むため互換性あり。beta.30にはセキュリティ修正（GHSA-47hc-4j47-3jp4）も含まれるため更新推奨
4. **middleware.ts 非推奨警告**: 動作には影響なし。proxy.tsへの移行はnext-authの対応状況確認後に別途対応

## 検証・動作確認方法

1. `pnpm install` — 依存関係解決成功
2. `pnpm typecheck` — 型エラーなし（eslintオプション型エラー時は修正後に再実行）
3. `pnpm build:local` — web/admin両アプリのビルド成功（Turbopack + standalone出力を確認）
4. `pnpm dev` + Playwright MCP — web(3000)/admin(4000)の画面表示確認
   - トップページ表示
   - ログイン画面表示
   - dev起動時のdeprecation warning確認（middleware.ts等）
5. `pnpm prepush` — lint + typecheck + test 全通過

## Planレビュー結果サマリ

- **レビュアー1（Planレビュー）**: MINOR — 画面確認の具体化、next-auth CHANGELOG確認、eslint互換性確認を指摘
- **レビュアー2（codex-agent）**: MAJOR — テンプレート更新漏れ、eslint config削除の必要性を指摘
- **対応**: 全指摘をplanに反映済み（テンプレート追加、eslint確認ステップ追加、画面確認項目具体化）
