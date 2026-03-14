# 調査報告: create-app sync で MCP設定（.mcp.json）が破損する問題

## Context

`create-app sync` 実行時に、serenaのMCP設定（`.mcp.json`）が破損する問題をユーザーが報告。
具体的には、stdioとHTTP方式のフィールドが混在した不正な設定が生成された。

```json
"serena": {
  "command": "uvx",
  "args": ["--from", "git+https://github.com/oraios/serena", "serena-mcp-server", "--context", "ide-assistant", ".", "--enable-web-dashboard=false"],
  "type": "http",
  "url": "http://127.0.0.1:${SERENA_PORT:-9850}/mcp"
}
```

---

## 調査結果

### 1. テンプレートの `.mcp.json` の内容

- `/Users/kzp/code/GitHub/einja-inc/einja-management-template/.mcp.json`（プロジェクトルート）
- `/Users/kzp/code/GitHub/einja-inc/einja-management-template/packages/create-app/templates/default/.mcp.json`

どちらも同一内容で、serena はHTTP方式:

```json
"serena": {
  "type": "http",
  "url": "http://127.0.0.1:${SERENA_PORT:-9850}/mcp"
}
```

### 2. dev-cli presets の `.mcp.json`

`packages/cli/presets/default/` に `.mcp.json` は**存在しない**。
dev-cli の sync は `.mcp.json` を `root-config` カテゴリの JSONファイルとして `JsonProcessor` で処理する（`file-filter.ts` 行91-93参照）。

### 3. 問題の根本原因

**create-app の `merger.ts` における `deepMergeWithPaths` のバグ**

`packages/create-app/src/utils/merger.ts` の `deepMergeWithPaths` 関数（行 158-229）は以下の動作をする:

1. `result = deepCopy(existing)` でローカルのオブジェクト全体をコピー
2. テンプレートのキーを走査し、**ローカルに存在しないキーのみ追加**
3. 両方がオブジェクトの場合は**再帰マージ**

**問題のシナリオ**:

| 段階 | 処理 |
|------|------|
| ローカル serena | `{ "command": "uvx", "args": [...] }` (stdio方式) |
| テンプレート serena | `{ "type": "http", "url": "..." }` (HTTP方式) |
| `deepMergeWithPaths` 呼び出し | `mcpServers.serena` は両方オブジェクト → **再帰マージ** |
| `result` 初期値 | `deepCopy(existing)` = `{ "command": "uvx", "args": [...] }` |
| `type` キー | ローカルに存在しない → 追加: `"type": "http"` |
| `url` キー | ローカルに存在しない → 追加: `"url": "..."` |
| **最終結果** | `{ "command": "uvx", "args": [...], "type": "http", "url": "..." }` |

これが stdio と HTTP フィールドが混在した不正な設定を生成する原因。

**dev-cli の `JsonProcessor` でも同じ問題が発生する**:

`packages/cli/src/lib/sync/json-processor.ts` の `deepMergeWithPaths` も同様のロジックで、`mcpServers` が `managed` パスに登録されていない場合（デフォルト: `jsonPaths = { managed: {}, "project-private": {} }`）、同じフィールド混在が発生する。

### 4. なぜ serena だけ問題になるか

テンプレートのサーバー設定が **stdio方式 → HTTP方式に変更された** サーバーのみ問題になる。
両方同じ方式なら「ローカルに存在するキーは保持、テンプレート新規キーのみ追加」なので実害が出ない。
`serena` はかつて stdio 方式で配布されており、ユーザーが古い設定を持っている場合に発生する。

### 5. `init` コマンドは問題なし

`packages/cli/src/lib/mcp-config.ts` の `mergeMcpConfigs` は `init` コマンドでのみ使われ、**サーバー単位で完全置換**（テンプレートのサーバーが存在する場合はローカルを `overwritten`）するため、この問題は発生しない。

---

## 修正方針

### 方針A（推奨）: `mcpServers` を `managed` パスに登録する

**dev-cli** (`packages/cli/src/lib/sync/metadata-manager.ts`):
デフォルトの `jsonPaths.managed` に `.mcp.json` の `mcpServers` を追加:

```ts
".mcp.json": ["mcpServers"],
```

これにより `.mcp.json` の `mcpServers` はテンプレートで強制上書きされ、混在が防止される。

**create-app** (`packages/create-app/src/commands/sync.ts`):
`syncMetadata.jsonPaths.managed` に `.mcp.json` の `mcpServers` を追加:

```ts
jsonPaths: {
  managed: {
    ".mcp.json": ["mcpServers"],  // ← 追加
  },
  "project-private": {},
},
```

### 方針B: MCP設定はサーバー単位でフィールド全体を置換する

`deepMergeWithPaths` において `mcpServers` の子オブジェクト（個々のサーバー設定）は、両方がオブジェクトでも再帰マージではなくサーバー単位でテンプレート値を優先置換するように特別処理を追加。

**課題**: `init` コマンドの `mergeMcpConfigs` と一貫性を保つ必要がある。

### 方針C: `.mcp.json` 全体を `managed` にする

`.mcp.json` ファイル全体を管理対象（テンプレートで強制上書き）にする。

**課題**: ユーザーが追加したカスタムMCPサーバーが毎回上書きされてしまう。不適切。

---

## 推奨修正

**方針A** を採用。`mcpServers` を managed パスに登録することで:
- 各サーバー設定はテンプレートで管理される（混在防止）
- ユーザーが追加したカスタムサーバーは保持される（`mcpServers` 以外のキーは維持）

ただし、`mcpServers` を managed にすると、ユーザーが追加した独自MCPサーバー（テンプレートにないもの）が削除される点に注意。

より適切な修正は `init` の `mergeMcpConfigs` と同様のロジックを `sync` でも使う（方針B相当の専用処理）。

---

## 対象ファイル

| ファイル | 修正内容 |
|---------|---------|
| `packages/cli/src/lib/sync/metadata-manager.ts` | デフォルト `jsonPaths.managed` に `.mcp.json: ["mcpServers"]` を追加（方針A）、またはdev-cli syncで `.mcp.json` を `mcp-config.ts` の `mergeMcpConfigs` で処理するよう変更（方針B） |
| `packages/create-app/src/commands/sync.ts` | `syncMetadata.jsonPaths.managed` に `.mcp.json: ["mcpServers"]` を追加（方針A）、またはJSON merge前に `.mcp.json` を専用処理（方針B） |

---

## タスク概要（実装フェーズ用）

- **タスク0-0**: TaskCreate で一括登録
- **タスク0-1**: Planファイルを `docs/plans/202603/20260314-mcp-json-merge-corruption.plan.md` にリネーム
- **タスク1**: dev-cli の `metadata-manager.ts` 修正 [frontend-coder]
- **タスク2**: create-app の `sync.ts` 修正 [frontend-coder]（タスク1と並行可）
- **タスク3**: テスト追加 [frontend-coder]（タスク1・2完了後）
- **99-1**: コードレビュー [einja-review-code]
- **99-2**: 動作確認
- **99-G**: コミット承認ゲート
- **99-3**: コミット・プッシュ [einja-task-commit]

---

## リスク・不明点

1. **方針A の副作用**: `mcpServers` が `managed` になると、ユーザーが `mcpServers` 配下に独自追加したサーバーはsync毎にテンプレートで上書きされる。これが許容されるか確認が必要。
2. **方針Bの複雑性**: `mcpServers` の子オブジェクトを「フィールド混在を防ぎつつ既存サーバーを保持」するロジックは、`init` の `mergeMcpConfigs` と一致させる必要がある。
3. **dev-cli のsync は `.mcp.json` を root-config として処理**するが、今回のユーザー報告は `create-app sync` によるもの。両方を修正する必要がある。

---

## 検証方法

1. 古いstdio方式のserena設定を持つ `.mcp.json` を用意
2. create-app sync を実行
3. 結果の `.mcp.json` が HTTP 方式のみになっていることを確認（フィールド混在なし）
4. テンプレートにない独自MCPサーバーが保持されていることを確認
