# 開発サーバーポート設定の下流リポジトリ対応

## Context

テンプレートリポジトリから `@einja-inc/create-app` で下流リポジトリを生成した際、`pnpm dev` のポート設定が下流の `apps/` 構成に対応していない。下流で `apps/market-trend-search-tool/` のような独自アプリ名を使うと、ポート変数名の不整合でポート指定が機能しない。

## スコープ

**本Planのスコープ:**
1. `turbo.json` の `passThroughEnv` ワイルドカード化（任意の `PORT_*` を透過）
2. `create-app` init 時に収集した `worktreeConfig` を `worktree.config.json` に正しく書き出す
3. ポート計算にプロジェクト名を混ぜて別プロジェクト間のポート衝突を回避

**スコープ外（別Issue）:**
- `apps/*/package.json` の `--port ${PORT_WEB:-3000}` 動的置換: `create-app init` ではアプリディレクトリのリネームを行わないため、init 直後は `apps/web/` + `PORT_WEB` で正しく動作する。下流で後からアプリ名を変更する場合は `worktree.config.json` + `package.json` の dev スクリプト + ディレクトリ名の3点を手動で変更する必要がある
- プロンプトの複数アプリ収集対応: 現在は1アプリのみ収集。複数アプリ対応は別途検討

## 現状

### 動作フロー
```
pnpm dev → scripts/worktree/dev.ts
  → worktree.config.json 読み込み（apps: [{id: "web", ...}, {id: "admin", ...}]）
  → calculatePorts() でブランチ名からポート計算
  → PORT_WEB=3273, PORT_ADMIN=4273 を環境変数に設定
  → turbo run dev に環境変数を渡す
  → turbo.json の passThroughEnv でフィルタリング
  → apps/web の next dev --port ${PORT_WEB:-3000} でポート受け取り
```

### 問題箇所

| # | 箇所 | 問題 | 本Plan対応 |
|---|------|------|-----------|
| 1 | `turbo.json` L13 の `passThroughEnv` | `PORT_WEB`, `PORT_ADMIN` がハードコード。新アプリの `PORT_XXX` が turbo で遮断される | **対応する** |
| 2 | `create-app` init | `worktreeConfig` を対話で収集するが `generateTemplate()` で**値を捨てている** | **対応する** |
| 3 | `apps/*/package.json` | `--port ${PORT_WEB:-3000}` がハードコード。アプリリネーム時に手動変更が必要 | スコープ外 |
| 4 | `calculatePorts()` L123 | ブランチ名のみでハッシュ計算。同一ブランチ名の別プロジェクトでポートが衝突する | **対応する** |

### 正常動作している箇所（変更不要）
- `scripts/worktree/dev.ts` — `calculatePorts()` は `worktree.config.json` の apps 配列から動的に `PORT_${id.toUpperCase()}` を生成（ただしハッシュソルトは追加する）
- `.github/actions/discover-apps/action.yml` — `apps/*/package.json` を動的スキャン

## 変更内容

### タスク1: `turbo.json` の `passThroughEnv` ワイルドカード化

**対象ファイル:**
- `/turbo.json`（ルート）
- `/packages/create-app/templates/default/turbo.json`

**変更:**
```
Before: ["PORT", "PORT_WEB", "PORT_ADMIN", "DATABASE_URL", "NEXTAUTH_URL", "AUTH_SECRET"]
After:  ["PORT", "PORT_*", "DATABASE_URL", "NEXTAUTH_URL", "AUTH_SECRET"]
```

Turbo v2.5.8（`package.json` で `"turbo": "^2.5.8"` を確認済み）は `passThroughEnv` で `EnvWildcard` 型をサポート。`PORT_*` で全アプリの `PORT_XXX` が透過される。

後方互換性: `PORT_*` は `PORT_WEB`, `PORT_ADMIN` のスーパーセットなので既存環境に影響なし。

**注意:** `writeFileSync`, `join` は `template.ts` L2, L6 で既にインポート済み。追加インポート不要。

### タスク2: `create-app` の `worktreeConfig` 書き出し修正

**対象ファイル:**
- `/packages/create-app/src/generators/template.ts`

**変更:** `generateTemplate()` の末尾（L319 `logger.success` の直前）に、`config.worktreeConfig` が存在する場合に `worktree.config.json` を上書き生成するロジックを追加。

```typescript
// worktreeConfig が指定されている場合、worktree.config.json を上書き
if (config.worktreeConfig) {
  const worktreeConfigPath = join(targetPath, "worktree.config.json");
  const worktreeConfigContent = {
    schemaVersion: 1,
    postgres: config.worktreeConfig.postgres,
    apps: config.worktreeConfig.apps,
  };
  writeFileSync(
    worktreeConfigPath,
    JSON.stringify(worktreeConfigContent, null, "\t") + "\n",
    "utf-8"
  );
  logger.info("worktree.config.json をカスタム設定で上書きしました");
}
```

**注意:** `--yes` オプション時は `worktreeConfig: undefined` のためスキップされ、テンプレートのデフォルト（web+admin）がそのまま使われる。これは正しい動作。

### タスク3: `calculatePorts()` にプロジェクト名ソルトを追加

**対象ファイル:**
- `/scripts/worktree/dev.ts`

**問題:** `calculatePorts()` L123 がブランチ名のみでハッシュ計算するため、同じブランチ名（特に `main`）の別プロジェクトで同一ポートが割り当てられ、先に起動した方がポートを占有して後発プロジェクトが起動できない。

**変更:** `calculatePorts()` のシグネチャにオプショナルな `projectName` パラメータを追加し、ハッシュ計算時にソルトとして混入。

```typescript
export function calculatePorts(
  branchName: string,
  apps: AppConfig[],
  projectName?: string,
): Record<string, number> {
  // プロジェクト名をソルトとして混入し、別プロジェクト間のポート衝突を回避
  const input = projectName ? `${projectName}:${branchName}` : branchName;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  // ...（以降同じ）
}
```

**呼び出し元の変更（2箇所）:**

プロジェクト名の取得を共通ヘルパーとして `dev.ts` のトップレベルに追加:

```typescript
/**
 * ルートpackage.jsonからプロジェクト名を取得
 */
function getProjectName(): string | undefined {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).name;
    }
  } catch {
    // 読み取り失敗時はundefined
  }
  return undefined;
}
```

1. `main()` L837: `calculatePorts(branch, cfg.apps)` → `calculatePorts(branch, cfg.apps, getProjectName())`
2. `showDevStatus()` L949: `calculatePorts(branch, cfg.apps)` → `calculatePorts(branch, cfg.apps, getProjectName())`

**後方互換性:** `projectName` はオプショナルなので、既存のテスト（`calculatePorts(branch, apps)` の2引数呼び出し）はそのまま動作する。ただしソルトなし→あり変更で、既存プロジェクトのポート番号が変わる（main ブランチの web が 3273 → 別の値になる可能性あり）。これは意図的な改善であり、`.env` は `pnpm dev` 実行時に自動再生成されるため影響なし。

**テンプレート側の変更:** `scripts/` は `copy-presets.mjs` (L68-71) でビルド時に `presets/default/scripts/` へ自動コピーされる（`pnpm -C packages/cli prebuild` 実行時）。テンプレート側の `dev.ts` は手動変更不要。

## タスク概要

| ID | タスク | 並列 | 使用Skill/Agent |
|----|--------|------|-----------------|
| 0-0 | タスク登録 [`TaskCreate`] | - | - |
| 0-1 | Planファイルを `docs/plans/202603/20260315-dev-port-downstream.plan.md` にリネーム | - | `Bash` |
| 1 | `turbo.json`（ルート＋テンプレート）の `passThroughEnv` 修正 + `template.ts` に `worktreeConfig` 書き出しロジック追加 + `dev.ts` の `calculatePorts()` にプロジェクト名ソルト追加 | - | `general-purpose` |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | - | `einja-review-code` |
| 99-2 | 動作確認 [`Bash`] | - | `Bash` |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | - | - |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | - | `einja-task-commit` |

## 並列実行計画

変更量が少ない（4ファイル・各1箇所）ため、タスク1は1つのサブエージェントで順次実行する。

## リスク・不明点

| リスク | 影響 | 対策 |
|--------|------|------|
| `PORT_*` ワイルドカードで意図しない環境変数が透過 | 低（`passThroughEnv` はキャッシュキー制御のみ） | `PORT_` プレフィックスの環境変数は通常ポート関連のみ |
| テンプレートの `apps/admin/` と `worktree.config.json` の不整合（カスタマイズ時に admin が消える） | 中 | カスタマイズ時はユーザーが意図的に設定するため問題なし。`--yes` 時はデフォルト維持 |
| Turbo `passThroughEnv` でのワイルドカード動作 | 低 | 実装後に `pnpm turbo run --dry dev` で透過確認する（99-2で実施） |
| ポート番号の変更（ソルト追加による） | 低 | `.env` は `pnpm dev` 実行時に自動再生成されるため影響なし。既存の開発サーバーは再起動が必要 |

## 検証・動作確認方法

1. `pnpm -F create-app build` でビルド成功を確認
2. `pnpm -F create-app test` で既存テスト通過を確認
3. `PORT_CUSTOM=9999 pnpm turbo run --dry dev` でワイルドカードが正しく透過されることを確認
4. `turbo.json` の JSON 構文が有効であることを確認

## Planレビュー結果

### Round 1
- レビュアー1（general-purpose）: MINOR — タスク統合、スコープ明確化、検証強化
- レビュアー2（codex-agent）: MAJOR — `apps/*/package.json` 未対応、複数アプリ未対応
- 対応: スコープを明確化（A案採用）し、MAJOR指摘を「スコープ外」として整理。タスク統合・検証強化も反映済み

### Round 2（タスク3追加後）
- 批判的レビュアー: MAJOR — `showDevStatus()` L949 の `calculatePorts` 呼び出しソルト未対応
- Codex: MAJOR — 同上 + テスト不在の指摘 + copy-presetsタイミング明記
- 対応: `showDevStatus()` のソルト対応を追加。`getProjectName()` ヘルパーで共通化。テンプレートコピーの前提条件を明記
