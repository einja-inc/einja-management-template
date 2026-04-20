# Plan: soga-k-project の spec-viewer を management-template に汎用移植

## Context

soga-k-project には `apps/spec-viewer` という開発専用の Next.js アプリがあり、`apps/web/src/app/**/spec.md` をスキャンしてサイドバー付きビューアで表示する仕組みがある。management-template にはこの仕組みがないため、汎用的な形で移植し、テンプレートから生成される全プロジェクトで利用可能にする。

**汎用化のポイント**:
- soga-k-project は `apps/web` のみスキャンだが、management-template は `apps/web` + `apps/admin` の複数アプリ対応が必要
- management-template には `docs/specs/issues/` という既存の Issue ベース仕様書があり、これもビューアに統合する
- テンプレートとして配布されるため、自動検出で設定不要にする

## 現状

### soga-k-project の spec-viewer 構成
- `apps/spec-viewer/` (Next.js, port 3001, dev-only)
- `src/lib/file-scanner.ts` - `apps/web/src/app/` をハードコードでスキャン
- `src/lib/types.ts` - `RouteNode`, `DocFile`, `IntegrationTestFile`, `ScanResult`
- `src/lib/path-utils.ts` - ラベル変換、Markdownタイトル抽出
- `src/components/` - サイドバー、Markdown/Mermaid レンダラ、スプリットビュー
- `src/app/(viewer)/` - pages, docs, integration-tests のルート
- 依存: `@repo/admin-ui`, `react-markdown`, `remark-gfm`, `mermaid`, `react-resizable-panels`, `@tailwindcss/typography`

### management-template の状況
- `apps/web` (port 3000) + `apps/admin` (port 4000) の2アプリ
- `docs/specs/issues/{category}/{issue}/` に requirements.md, design.md, qa-tests/ が存在
- `@repo/admin-ui` で sidebar, command-menu, layout 等を共有済み
- `apps/admin/src/components/providers/theme-provider.tsx` に ThemeProvider あり（再利用可能）

## 変更内容

### 新規作成: `apps/spec-viewer/`

#### 設定ファイル

| ファイル | 内容 |
|---------|------|
| `package.json` | name: `@repo/spec-viewer`, port 5000, soga-k と同じ依存 |
| `next.config.ts` | `transpilePackages: ["@repo/admin-ui"]` |
| `tsconfig.json` | soga-k と同一 |
| `postcss.config.cjs` | `@tailwindcss/postcss` |

#### `src/lib/` - コアロジック（汎用化の核心）

**`types.ts`** - 拡張型定義:
```typescript
// 既存（soga-k と同一）
interface RouteNode { segment, routePath, hasSpecMd, hasPageTsx, hasQATest, children }
interface DocFile { slug, title, section }
interface IntegrationTestFile { slug, title }

// 新規: 複数アプリ対応
interface AppScanTarget { name, label, appDir, qaTestDir? }
interface AppRoutes { appName, label, routes: RouteNode[] }

// 新規: Issue仕様書対応
interface IssueSpec { slug, title, category, hasRequirements, hasDesign, hasQATests }

// 拡張
interface ScanResult { appRoutes: AppRoutes[], issueSpecs: IssueSpec[], integrationTests, docs }
```

**`config.ts`** - アプリ自動検出:
- `apps/` 配下のディレクトリを走査し、`src/app/` を持つものを自動で `AppScanTarget[]` に追加
- `spec-viewer` 自身は除外
- `docs/specs/issues/` の存在も自動検出
- 手動設定不要（テンプレート配布に適する）

**`file-scanner.ts`** - 汎用化リファクタ:
- `getScanResult()`: config.apps をループして各アプリの `buildRouteTree()` を実行 → `AppRoutes[]`
- `scanIssueSpecs()`: `docs/specs/issues/` を走査し `IssueSpec[]` を返す
- `readSpecMd(appName, slugParts)`: アプリ名を引数に追加（ハードコード排除）
- `readQATestMd(appName, slugParts)`: 同上
- `readIssueSpecFile(slugParts)`: Issue仕様書のファイル読み込み
- その他 (`buildRouteTree`, `resolveSegment`, `resolveSlugToFsPath`, `scanDocs`, `scanIntegrationTests`, `readDocFile`, `readIntegrationTestFile`, `sanitizePath`) は soga-k からほぼそのまま移植

**`path-utils.ts`** - soga-k からそのまま移植（`docSectionToTitle` のマッピングはプロジェクトに合わせて調整可能に）

#### `src/components/` - UIコンポーネント

| ファイル | 変更点 |
|---------|--------|
| `providers/theme-provider.tsx` | soga-k と同一（admin app にもあるが spec-viewer 内に配置） |
| `markdown/markdown-renderer.tsx` | soga-k からそのまま移植 |
| `markdown/mermaid-diagram.tsx` | soga-k からそのまま移植 |
| `spec-page-content.tsx` | soga-k からそのまま移植 |
| `layout/spec-viewer-layout.tsx` | **拡張**: `flattenRoutes` を `appRoutes[]` 対応に。各アプリのルートを CommandMenu に登録 |
| `layout/app-sidebar.tsx` | **拡張**: アプリごとのルートツリーセクション + Issue仕様書セクションを追加 |

**app-sidebar.tsx の主な変更**:
```
サイドバー構成:
├── [アプリ名1] 画面仕様   ← appRoutes[0] のルートツリー（アイコン: Globe）
├── [アプリ名2] 画面仕様   ← appRoutes[1] のルートツリー（アイコン: Shield）
├── Issue 仕様書           ← issueSpecs をカテゴリ別にグルーピング（新規）
├── 統合テスト             ← 既存と同一
└── ドキュメント           ← 既存と同一
```

#### `src/app/` - ルーティング

```
src/app/
├── layout.tsx                              # ルートレイアウト（soga-k と同一）
├── globals.css                             # soga-k と同一
├── page.tsx                                # redirect → /apps/{最初のアプリ名}
└── (viewer)/
    ├── layout.tsx                          # getScanResult() → SpecViewerLayout
    ├── apps/
    │   └── [app]/
    │       ├── page.tsx                    # アプリ別ルート一覧（カバレッジ表示）
    │       └── [...slug]/
    │           └── page.tsx               # spec.md 表示（appName をパスから取得）
    ├── issues/
    │   ├── page.tsx                        # Issue仕様書一覧（新規）
    │   └── [...slug]/
    │       └── page.tsx                    # Issue仕様書ファイル表示（新規）
    ├── docs/
    │   └── [...slug]/
    │       └── page.tsx                    # soga-k と同一
    └── integration-tests/
        ├── page.tsx                        # soga-k と同一
        └── [...slug]/
            └── page.tsx                    # soga-k と同一
```

**`/apps/[app]/[...slug]/page.tsx`** の変更点:
- `readSpecMd(slug)` → `readSpecMd(app, slug)` にアプリ名を渡す
- spec.md 未存在時のパス表示を `apps/{app}/src/app/{slug}/spec.md` に動的変更

**`/issues/[...slug]/page.tsx`** (新規):
- `readIssueSpecFile(slug)` でファイル読み込み
- MarkdownRenderer で表示

### 既存ファイルの変更

| ファイル | 変更 |
|---------|------|
| `pnpm-workspace.yaml` | 変更不要（`apps/*` で自動包含） |
| `turbo.json` | 変更不要（`dev`/`build` タスクが自動適用） |

## タスク概要

| # | タスク | 使用 Skill/Agent | 依存 |
|---|--------|-----------------|------|
| 0-0 | TaskCreate でタスク登録 | - | - |
| 0-1 | Plan ファイルを `docs/specs/issues/` に配置 | [Bash] | - |
| 1 | `apps/spec-viewer/` スキャフォールド作成（package.json, next.config.ts, tsconfig.json, postcss.config.cjs） | [frontend-coder] | - |
| 2 | `src/lib/` コアロジック実装（types.ts, config.ts, file-scanner.ts, path-utils.ts） | [frontend-coder] | 1 |
| 3 | `src/components/` 移植（theme-provider, markdown-renderer, mermaid-diagram, spec-page-content） | [frontend-coder] | 1 |
| 4 | `src/components/layout/` 拡張実装（spec-viewer-layout.tsx, app-sidebar.tsx） | [frontend-coder] | 2, 3 |
| 5 | `src/app/` ルーティング実装（全ページコンポーネント） | [frontend-coder] | 2, 3, 4 |
| 6 | `pnpm install` + 動作確認 | [Bash] | 5 |
| 99-1 | コードレビュー | [einja-review-code] | 6 |
| 99-2 | 動作確認（`pnpm --filter @repo/spec-viewer dev` で起動、ブラウザ確認） | [Bash / Playwright MCP] | 6 |
| 99-G | コミット承認ゲート | [AskUserQuestion] | 99-1, 99-2 |
| 99-3 | コミット・プッシュ | [einja-task-commit] | 99-G |

### 並列実行計画

- タスク 1, 2（の types.ts/config.ts 部分）は独立して開始可能だが、file-scanner は types に依存
- タスク 3 は タスク 1 完了後に並列開始可能（lib/ とは独立）
- タスク 4 は 2, 3 両方の完了を待つ
- 99-1, 99-2 は並列実行可能

## リスク・不明点

1. **management-template にまだ spec.md が存在しない**: ビューアは空のカバレッジを表示する。これはインフラ整備として期待される動作
2. **QA テストディレクトリの規約**: management-template に `docs/qa-tests/` がまだない場合、`qaTestDir` は `undefined` として処理（hasQATest は常に false）
3. **`@source` パス**: globals.css の `@source "../../../../packages/admin-ui/src"` は `apps/spec-viewer/` の階層に合わせて調整が必要

## 検証・動作確認方法

1. `pnpm install` が正常完了すること
2. `pnpm --filter @repo/spec-viewer dev` でポート 5000 で起動すること
3. ブラウザで `http://localhost:5000` にアクセスし、自動的に `/apps/web` にリダイレクトされること
4. サイドバーに Web App と Admin のルートツリーが表示されること（spec.md がなくてもルート構造は表示される）
5. Issue 仕様書セクションに `docs/specs/issues/` の内容が表示されること
6. ドキュメントセクションに `docs/` 配下のファイルが表示されること
7. Mermaid 図が正しくレンダリングされること
8. ダーク/ライトテーマの切り替えが動作すること
