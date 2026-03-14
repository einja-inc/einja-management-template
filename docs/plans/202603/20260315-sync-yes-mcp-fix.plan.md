# create-app sync: --yesでapps混入バグ修正 + MCP設定破損バグ修正

## Context

`create-app sync`で2つのバグが発生している:
1. `--yes`オプション使用時に`apps`/`packages`カテゴリが意図せず同期され、デモUIコードが下流リポジトリに混入する
2. `.mcp.json`のsync時にサーバー設定がフィールド単位でdeep mergeされ、stdio方式とHTTP方式のフィールドが混在する不正な設定が生成される

## 現状

### バグ1: `--yes`でapps混入

`packages/create-app/src/commands/sync.ts:173`:
```typescript
} else if (options.all || options.yes) {
  categories = getAllSyncCategories();  // apps含む全12カテゴリ
```

`--yes`と`--all`が同一分岐で、`defaultChecked: false`の`apps`/`packages`も含まれる。
`einja-dev-sync` Skillは`--categories`を常に指定するため影響しないが、直接CLI使用時に問題が起きる。

`getDefaultSyncCategories()`は既に存在するが`env`+`tools`のみ（狭すぎる）。
`CATEGORY_CONFIGS`で`apps`と`packages`のみが`requiresDetailSelection: true`を持つことを確認済み。

### バグ2: MCP設定破損

`packages/create-app/src/utils/merger.ts:202-218`で`.mcp.json`の`mcpServers`がdeep mergeされる。テンプレート(HTTP方式)とローカル(stdio方式)でserenaの設定方式が異なる場合、`command`+`args`+`type`+`url`が全て混在する。

`jsonPaths`に`.mcp.json`の設定がないため、managedでもproject-privateでもなく、汎用deep mergeが適用される。

## 変更内容

### 修正1: `--yes`と`--all`の分離

**対象ファイル:**
- `packages/create-app/src/prompts/sync.ts` — 新関数追加
- `packages/create-app/src/commands/sync.ts` — 分岐分割+import追加

**方針:** `--yes`は「確認スキップ + 安全なデフォルト」、`--all`は「全カテゴリ明示指定」として分離する。

`prompts/sync.ts`に`getSafeSyncCategories()`を新設:
```typescript
export function getSafeSyncCategories(): SyncCategory[] {
  return Object.entries(CATEGORY_CONFIGS)
    .filter(([_key, config]) => !config.requiresDetailSelection)
    .map(([key, _config]) => key as SyncCategory);
}
// → apps, packages を除く10カテゴリ
```

`commands/sync.ts`の分岐を分割:
```typescript
} else if (options.all) {
  categories = getAllSyncCategories();     // 全12カテゴリ
  ...
} else if (options.yes) {
  categories = getSafeSyncCategories();   // apps,packages除く10カテゴリ
  ...
}
```

| オプション | 動作（修正後） |
|-----------|-------------|
| `--all` | 全12カテゴリ（apps含む） |
| `--yes` | 10カテゴリ（apps,packages除外） |
| `--categories X` | 指定カテゴリのみ（変更なし） |
| 対話式 | プロンプトで選択（変更なし） |

### 修正2: MCP設定のサーバー単位置換

**対象ファイル:**
- `packages/create-app/src/commands/sync.ts` — `jsonPaths`に`.mcp.json`の`mcpServers`各サーバーをmanaged登録

**方針:** テンプレートの`.mcp.json`からサーバー名を読み取り、各サーバーをmanaged pathとして登録する。これによりテンプレートにあるサーバーはフィールド混在なく完全置換され、ユーザー独自のサーバーは保持される。

`commands/sync.ts`のsyncMetadata初期化（L310付近）を修正。`templatePath`はL300付近で確定済み:
```typescript
// テンプレートの.mcp.jsonからサーバー名を取得してmanaged登録
const templateMcpPath = join(templatePath, ".mcp.json");
const mcpManagedPaths: string[] = [];
if (existsSync(templateMcpPath)) {
  const mcpJson = JSON.parse(readFileSync(templateMcpPath, "utf-8"));
  if (mcpJson.mcpServers) {
    for (const serverName of Object.keys(mcpJson.mcpServers)) {
      mcpManagedPaths.push(`mcpServers.${serverName}`);
    }
  }
}

const syncMetadata: SyncMetadata = {
  version: "1.0.0",
  lastSync: new Date().toISOString(),
  templateVersion: "0.2.9",
  files: {},
  jsonPaths: {
    managed: {
      ".mcp.json": mcpManagedPaths,  // サーバー単位でmanaged
    },
    "project-private": {},
  },
};
```

## タスク概要

| ID | タスク | 依存 | Skill/ツール |
|----|-------|------|-------------|
| 0-0 | タスク登録 | - | [TaskCreate] |
| 0-1 | Planファイルリネーム | - | [Bash] |
| 1 | `prompts/sync.ts`に`getSafeSyncCategories()`追加 + `commands/sync.ts`のimport追加・分岐分割 | 0-1 | [general-purpose] |
| 2 | `commands/sync.ts`のsyncMetadata初期化にMCP managed paths動的登録を追加 | 1 | [general-purpose] |
| 3 | テスト: 既存テスト実行 + 修正箇所の動作確認 | 1,2 | [Bash] |
| 99-1 | コードレビュー | 3 | [einja-review-code] |
| 99-2 | ビルド検証 | 3 | [Bash] |
| 99-G | コミット承認ゲート | 99-1,99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

- タスク1 → 2: 順次実行（2は`commands/sync.ts`を編集し、1で追加した`getSafeSyncCategories`のimportも必要なため）
- タスク3: 2完了後
- 99系: 順次実行

## オプション優先順位

`--yes --all`同時指定時は`--all`が優先（`else if`の評価順序による）。これは意図的な仕様：`--all`は「全カテゴリ同期」の明示指定であり、`--yes`の安全デフォルトより優先される。

## リスク・不明点

- dev-cli側の`.mcp.json`マージ: 今回はcreate-app側のみ修正。dev-cliの`root-config`カテゴリでも`.mcp.json`が同期されるが、dev-cli側は`json-processor.ts`の3方向マージで別ロジック。同様の問題が起きる可能性はあるが、スコープ外として別対応とする

## 検証・動作確認方法

1. `pnpm --filter @einja-inc/create-app build` でビルド成功
2. 既存テスト実行: `pnpm --filter @einja-inc/create-app test`
3. コード確認: `--yes`時に`apps`/`packages`が含まれないこと
4. コード確認: `.mcp.json`マージで`mcpServers`の各サーバーがmanaged扱いになること
