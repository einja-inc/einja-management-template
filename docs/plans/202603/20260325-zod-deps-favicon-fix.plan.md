# テンプレートのZod依存関係修正 & favicon.ico整合性修正

## Context

下流リポジトリ（einja-lp-labo）でテンプレートから生成したプロジェクトをビルドした際に2つの問題が発生:
1. **Zod v4 + @hono/zod-validator 型互換性エラー**: TypeScript型深度エラーでビルド失敗
2. **favicon.ico破損**: Turbopackで処理できないエラー

## 現状

### Zodバージョン混在

| パッケージ | zodバージョン | hono | @hono/zod-validator |
|-----------|-------------|------|---------------------|
| ルート `package.json` | `^4.3.5` | `^4.11.3` | `^0.7.6` |
| `apps/web/package.json` | `^3.25.67` | なし | なし |
| `apps/admin/package.json` | `^3.25.67` | - | - |
| `packages/server-core` | `^3.25.67` | - | - |
| `packages/config` | `^3.24.2` | - | - |
| `packages/front-core` | `^3.25.76` | - | - |
| `packages/cli` | `^4.3.5` | - | - |

- `hono` と `@hono/zod-validator` はルートにのみ宣言されているが、**実際の使用箇所は `apps/web` のみ**:
  - `apps/web/server/presentation/routes/userRoutes.ts`
  - `apps/web/src/app/api/rpc/users/[[...route]]/route.ts`
  - `apps/web/src/lib/api/rpc.ts`（`hono/client`）
- `@hono/zod-validator@0.7.6` のpeerDeps: `zod: "^3.25.0 || ^4.0.0"` — v3/v4両対応
- pnpm lockfile上: `zod@3.25.76` と `zod@4.3.5` の2バージョンが並存
- **根本原因**: ルートのzod v4に`@hono/zod-validator`がリンクされ、apps/webのzod v3スキーマとの型不整合が発生

### favicon.ico

| ファイル | サイズ | MD5 |
|---------|--------|-----|
| `apps/web/src/app/favicon.ico` | 25,931 bytes | `c30c7d42707a47a3f` |
| `templates/default/.../favicon.ico` | 39,535 bytes | `b7e5d143f696329db` |

- 両方とも `file` コマンドでは有効なICO（4 icons, 16x16, 32x32, 32bit）
- create-appのコピー処理はバイナリ除外リストに `.ico` が含まれており正しくコピーされる
- テンプレート側と本リポジトリ側で**別ファイル**になっている（更新漏れ）

## 変更内容

### 1. Zod + Hono 依存関係の正規化

**方針**: `hono`, `@hono/zod-validator` をルートから `apps/web/package.json` に移動。zodは各パッケージのv3をそのまま維持。

| ファイル | 変更 |
|---------|------|
| `/package.json` | `dependencies` セクション丸ごと削除（現在 `hono`, `@hono/zod-validator`, `zod` の3キーのみのため、セクション自体を削除） |
| `/apps/web/package.json` | `dependencies` に `"hono": "^4.11.3"`, `"@hono/zod-validator": "^0.7.6"` を追加 |
| `/packages/create-app/templates/default/apps/web/package.json` | 同上（自動コピー対象外のため手動） |

> `packages/cli` の `zod@^4.3.5` はCLI独自の依存でスコープ外。タスク3-2のtypecheckでCLIも検証対象に含まれるため影響なしを確認可能。
> テンプレートのルート `packages/create-app/templates/default/package.json` はビルド時にルート `package.json` からフルコピーされるため追加タスク不要（CLAUDE.md二重管理禁止ルール）

### 2. favicon.ico の整合性修正

| ファイル | 変更 |
|---------|------|
| `packages/create-app/templates/default/apps/web/src/app/favicon.ico` | 本リポジトリの `apps/web/src/app/favicon.ico` で上書き |

## タスク概要

| ID | タスク | Skill/ツール | 依存 |
|----|--------|-------------|------|
| 0-0 | タスク登録 [TaskCreate] | TaskCreate | - |
| 0-1 | Planファイルを `docs/plans/` に配置 [Bash] | Bash | - |
| 1-1 | ルート `package.json` から dependencies セクション削除 [Edit] | サブエージェント | 0-1 |
| 1-2 | `apps/web/package.json` に hono, @hono/zod-validator 追加 [Edit] | サブエージェント | 0-1 |
| 1-3 | テンプレート `apps/web/package.json` に hono, @hono/zod-validator 追加 [Edit] | サブエージェント | 0-1 |
| 2-1 | favicon.ico をテンプレート側に上書きコピー [Bash] | Bash | 0-1 |
| 3-1 | `pnpm install` + lockfile検証（zod v4がpackages/cli由来のみであること確認）[Bash] | Bash | 1-1, 1-2, 1-3, 2-1 |
| 3-2 | `pnpm typecheck` [Bash] | Bash | 3-1 |
| 3-3 | `pnpm turbo build` [Bash] | Bash | 3-2 |
| 99-1 | 観点別並列コードレビュー [einja-review-code] | einja-review-code | 3-3 |
| 99-G | コミット承認ゲート [AskUserQuestion] | AskUserQuestion | 99-1 |
| 99-3 | コミット・プッシュ [einja-task-commit] | einja-task-commit | 99-G |

## 並列実行計画

```
0-1 (Plan配置)
 ├──> 1-1 (ルートpackage.json) ──┐
 ├──> 1-2 (web package.json)    ├──> 3-1 (install) → 3-2 (typecheck) → 3-3 (build)
 ├──> 1-3 (テンプレート修正)    ──┘         │
 └──> 2-1 (favicon.icoコピー) ──────────────┘
```

タスク1-1, 1-2, 1-3, 2-1 は異なるファイルを対象としているため**並列実行可能**。

## リスク・不明点

| リスク | 影響度 | 対策 |
|--------|--------|------|
| テンプレート `apps/web/package.json` が自動コピー対象外 | 中 | 手動で同じ変更を適用。将来的にコピー対象に含めるか要検討 |
| favicon.icoの下流エラーがファイル差異以外の原因の場合 | 中 | ファイル統一後に下流で再検証が必要。タスク3-3のビルド検証でfavicon関連エラー解消を確認 |
| worktree不要判断 | - | 4ファイル・30行未満の軽微修正のため不要 |

## 検証・動作確認方法

1. `pnpm install` — lockfile更新、ルートからzod v4が消えたことを確認
2. `pnpm typecheck` — TypeScriptエラーなし
3. `pnpm turbo build` — ビルド成功
4. `git diff --stat` — 変更ファイルが想定通り
5. pnpm lockfileでzod v4が `packages/cli` の依存としてのみ残っていることをgrep確認
