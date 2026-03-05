# JSON 配布メカニズムの統一実装（ブラックリスト方式 + 3方向マージ）

## Context

テンプレートリポジトリの JSON ファイル変更が配布先に反映されない。
全JSONファイルでテンプレート側と配布先側の双方向変更が発生しうるが、適切なマージ戦略が設定されていない。

### 現状の問題

| JSONファイル | copy-presetsコピー | einja syncカテゴリ | jsonPaths設定 |
|---|---|---|---|
| `package.json` | **No** | **なし** | なし |
| `.claude/settings.json` | Yes | **なし** | なし |
| `.vscode/settings.json` | Yes | `tools` | なし |
| `.mcp.json` | Yes (optional) | **なし** | なし |

- `sync.ts:435` の `fileName` がファイル名のみ（`.split("/").pop()`）で、フルパスの jsonPaths キーとマッチしない
- 全JSONの `jsonPaths` が空 → デフォルトのディープマージ（新規キー追加のみ、既存キー保持）
- 現在の `project-private` とデフォルトの動作が実質同じ（`json-processor.ts:131-160`）→ 除外が効いていない
- 現在のマージは template vs local の2点比較で、true な3方向マージ（base比較）がない

### 変更後の状態

| JSONファイル | copy-presetsコピー | einja syncカテゴリ | jsonPaths設定 |
|---|---|---|---|
| `package.json` | **Yes** (Step 5) | **root-config** (Step 6) | project-private: name, version, private, workspaces, packageManager, volta |
| `.claude/settings.json` | Yes | **claude-config** (Step 6) | managed: plansDirectory, includeCoAuthoredBy |
| `.vscode/settings.json` | Yes | `tools` (既存) | managed: editor.*, eslint.*, prettier.*, [json], [jsonc] |
| `.mcp.json` | Yes | **root-config** (Step 6) | デフォルト（全キー3方向マージ） |

## 設計方針: ブラックリスト方式

### 旧設計（ホワイトリスト）の問題

```
tracked: ["scripts", "lint-staged"]   ← これだけsync
project-private: ["*"]                ← 残り全部除外
```
→ `devDependencies`（husky, turbo 等の共通ツール依存）がsync対象外
→ 新セクション追加時に tracked リスト更新が必要

### 新設計（ブラックリスト）

```
managed:         { ... }              ← テンプレート強制上書き
project-private: { ... }              ← ブラックリスト（完全除外）
デフォルト:       3方向マージ            ← 上記以外は全て3方向マージ
```

- `tracked` モードは廃止。デフォルト動作が3方向マージ
- `project-private` = **完全除外**（テンプレートにあっても追加しない。初回syncでも追加しない）
- `*` ワイルドカードは不要（ブラックリストなので除外対象を個別指定）

### jsonPaths 設定

```
jsonPaths:
  managed: {
    ".claude/settings.json": ["plansDirectory", "includeCoAuthoredBy"],
    ".vscode/settings.json": [
      "editor.codeActionsOnSave", "editor.defaultFormatter", "editor.formatOnSave",
      "eslint.enable", "prettier.enable", "prettier.useEditorConfig", "[json]", "[jsonc]"
    ],
  },
  "project-private": {
    "package.json": ["name", "version", "private", "workspaces", "packageManager", "volta"],
  }
```

### セクション別マージ戦略（ファイル別）

#### package.json

| セクション | モード | 動作 |
|-----------|--------|------|
| `name`, `version`, `private`, `workspaces`, `packageManager`, `volta` | project-private | 完全除外（テンプレートから追加しない） |
| `scripts`, `lint-staged`, `devDependencies`, `dependencies` 等 | デフォルト | 3方向マージ |

#### .claude/settings.json

| セクション | モード | 動作 |
|-----------|--------|------|
| `plansDirectory`, `includeCoAuthoredBy` | managed | テンプレート強制上書き |
| `permissions`, `hooks`, `env`, `enabledPlugins` 等 | デフォルト | 3方向マージ |

#### .vscode/settings.json

| セクション | モード | 動作 |
|-----------|--------|------|
| `editor.*`, `eslint.*`, `prettier.*`, `[json]`, `[jsonc]` | managed | テンプレート強制上書き |
| ユーザー追加の拡張設定 | デフォルト | 3方向マージ |

#### .mcp.json

| セクション | モード | 動作 |
|-----------|--------|------|
| 全セクション | デフォルト | 3方向マージ（テンプレートが新MCP追加、ユーザーが独自MCP追加・ポート変更等） |

## 3方向マージのルール

base（前回sync時のテンプレート）・local・template の3つを比較し、キー別に判定:

```
キー別判定:
  base→local 変更なし + base→template 変更あり → テンプレート適用
  base→local 変更あり + base→template 変更なし → ローカル保持
  両方変更 + 同じ値                            → コンフリクトなし
  両方変更 + 異なる値                          → コンフリクト ⚠️（ローカル保持）
  ローカルで削除 + テンプレート変更なし          → 削除を維持
  ローカルで削除 + テンプレート変更あり          → コンフリクト ⚠️
  テンプレートで新キー追加                      → 追加
  ローカルで新キー追加                          → 保持
```

### 配列値のマージ

配列は**値として丸ごと扱う**（要素単位のマージは対象外）。
base/local/template の値全体を `deepEqual` で比較し、コンフリクト判定する。

### 初回sync（base なし）の動作

base がない場合は **ローカル優先 + テンプレートの新規キーのみ追加**:
- ローカルに既存のキー → ローカル値を保持
- テンプレートにしかないキー → 追加
- `project-private` のキー → 追加しない（完全除外）

### コンフリクト時の動作

- **ローカル値を保持**（安全側にデフォルト）
- コンソールに警告出力
- `mergeJson` の戻り値に `conflicts` 配列を追加

## 配布タイミング

```
ルート JSONファイル群（Single Source of Truth）
  │
  ├─【ビルド時】copy-presets.mjs
  │   ├─→ presets/default/package.json         （新規: フルコピー）
  │   ├─→ presets/default/.claude/settings.json （既存: フルコピー）
  │   ├─→ presets/default/.vscode/settings.json （既存: フルコピー）
  │   ├─→ presets/default/.mcp.json             （既存: フルコピー）
  │   └─→ templates/default/package.json        （create-einja-app 用: scripts同期）
  │
  ├─【einja sync】JsonProcessor 3方向マージ
  │   └─→ 配布先の各JSONを managed/project-private/デフォルト(3way) でマージ
  │
  └─【create-einja-app】テンプレートからコピー
      └─→ 新規プロジェクトの各JSONファイル
```

## 実装ステップ

### Step 0: 型定義の更新

**ファイル**: `packages/cli/src/types/sync.ts`

1. `FileMetadataSchema` に `baseContent` フィールド追加（前回sync時のテンプレートコンテンツ保存用）
2. `JsonPathsConfigSchema` から `tracked` を**削除**（ブラックリスト方式では不要）

```typescript
export const FileMetadataSchema = z.object({
  hash: z.string(),
  syncedAt: z.string(),
  conflicts: z.array(z.string()).optional(),
  baseContent: z.string().optional(),  // 前回sync時のテンプレートコンテンツ（3方向マージ用）
});

export const JsonPathsConfigSchema = z.object({
  managed: z.record(z.string(), z.array(z.string())),
  "project-private": z.record(z.string(), z.array(z.string())),
});
```

### Step 1: `sync.ts` の `fileName` → フルパス修正

**ファイル**: `packages/cli/src/commands/sync.ts`

`sync.ts:435` と dry-run パス（`sync.ts:287`付近）の両方を修正:

```typescript
// 変更前
const fileName = target.path.split("/").pop() || target.path;

// 変更後
const filePath = target.path;
```

### Step 2: `JsonProcessor` の全面改修

**ファイル**: `packages/cli/src/lib/sync/json-processor.ts`

#### 2a. 戻り値の型を追加

```typescript
export interface JsonConflict {
  keyPath: string;
  baseValue: unknown;
  localValue: unknown;
  templateValue: unknown;
}

export interface JsonMergeResult {
  result: Record<string, unknown>;
  conflicts: JsonConflict[];
}
```

#### 2b. `mergeJson` シグネチャ変更

```typescript
mergeJson(
  templateJson: Record<string, unknown>,
  localJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  baseJson?: Record<string, unknown> | null
): JsonMergeResult
```

- `localJson === null`（ファイル未存在）: project-private 以外のテンプレートキーを採用
- `baseJson` なし（初回sync）: ローカル優先 + テンプレート新規キーのみ追加

#### 2c. `deepMergeWithPaths` に3方向マージを統合

`merge3WaySection` は廃止。`deepMergeWithPaths` 自体が base を受け取り、各キーで:
1. managed チェック → テンプレート強制上書き
2. project-private チェック → ローカル保持（テンプレートから追加しない）
3. デフォルト → 3方向マージ（base があれば）/ 新規キー追加（base なし）

```typescript
private deepMergeWithPaths(
  template: Record<string, unknown>,
  existing: Record<string, unknown>,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  currentPath: string,
  conflicts: JsonConflict[],
  base?: Record<string, unknown> | null
): Record<string, unknown> {
  const result = { ...existing };  // ローカルをベースに開始

  // テンプレート側のキーを処理
  for (const [key, templateValue] of Object.entries(template)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;

    if (this.isPathManaged(filePath, keyPath, jsonPaths)) {
      // managed: テンプレート強制上書き
      result[key] = this.deepClone(templateValue);

    } else if (this.isPathProjectPrivate(filePath, keyPath, jsonPaths)) {
      // project-private: ローカル保持、テンプレートから追加しない
      // existing に key があればそのまま（result = { ...existing } で既に含まれる）
      // existing に key がなければ何もしない（追加しない = 完全除外）
      continue;

    } else if (base) {
      // デフォルト（base あり）: 3方向マージ
      const baseValue = base[key];
      const localValue = existing[key];

      if (this.deepEqual(localValue, baseValue)) {
        // ローカル未変更 → テンプレートの値を採用
        if (templateValue !== undefined) {
          result[key] = this.isObject(templateValue) && this.isObject(localValue)
            ? this.deepMergeWithPaths(
                templateValue as Record<string, unknown>,
                localValue as Record<string, unknown>,
                jsonPaths, filePath, keyPath, conflicts,
                baseValue as Record<string, unknown> | null
              )
            : this.deepClone(templateValue);
        } else {
          delete result[key];  // テンプレートで削除
        }
      } else if (this.deepEqual(templateValue, baseValue)) {
        // テンプレート未変更 → ローカルの値を保持（何もしない）
      } else if (this.deepEqual(localValue, templateValue)) {
        // 同じ値に変更 → コンフリクトなし
      } else {
        // 両方変更、異なる値 → コンフリクト（ローカル保持）
        conflicts.push({ keyPath, baseValue, localValue, templateValue });
      }

    } else {
      // デフォルト（base なし = 初回sync）: ローカル優先 + テンプレート新規キーのみ追加
      if (!(key in existing)) {
        result[key] = this.deepClone(templateValue);
      } else if (this.isObject(existing[key]) && this.isObject(templateValue)) {
        // オブジェクト型: 再帰（新規キーのみ追加）
        result[key] = this.deepMergeWithPaths(
          templateValue as Record<string, unknown>,
          existing[key] as Record<string, unknown>,
          jsonPaths, filePath, keyPath, conflicts, null
        );
      }
      // プリミティブ型で既存あり: ローカル保持（何もしない）
    }
  }

  // base にあってテンプレートから削除されたキーの処理（base あり時のみ）
  if (base) {
    for (const key of Object.keys(base)) {
      if (!(key in template) && key in existing) {
        const keyPath = currentPath ? `${currentPath}.${key}` : key;
        if (this.isPathProjectPrivate(filePath, keyPath, jsonPaths)) continue;
        const baseValue = base[key];
        const localValue = existing[key];
        if (this.deepEqual(localValue, baseValue)) {
          // ローカル未変更 + テンプレート削除 → 削除
          delete result[key];
        } else {
          // ローカル変更あり + テンプレート削除 → コンフリクト（ローカル保持）
          conflicts.push({ keyPath, baseValue, localValue, templateValue: undefined });
        }
      }
    }
  }

  return result;
}
```

**ネスト指定サポート**: `deepMergeWithPaths` が再帰するため、`devDependencies.@types/node` のようなネスト指定の project-private が自然に動く。

#### 2d. `isPathProjectPrivate` の動作修正

現在の実装は「既存にない場合はテンプレートから追加」でデフォルトと同じ（`json-processor.ts:131-146`）。
ブラックリスト方式では**完全除外**に修正:
- テンプレートに存在してもローカルに追加しない
- 初回syncでも追加しない
- `deepMergeWithPaths` 内で `continue` するだけ（上記 2c 参照）

#### 2e. `isPathTracked` を削除（不要）

#### 2f. `deepEqual` ユーティリティ（キー順序非依存の深い比較）

```typescript
private deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => this.deepEqual(item, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as Record<string, unknown>).sort();
    const keysB = Object.keys(b as Record<string, unknown>).sort();
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key, i) =>
      key === keysB[i] && this.deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }
  return false;
}
```

### Step 3: `sync.ts` の JSON 処理フロー変更

**ファイル**: `packages/cli/src/commands/sync.ts`

本処理パス + dry-run パスの**両方**:

1. `mergeJson` に base を渡す
2. 戻り値を `JsonMergeResult` に変更
3. コンフリクト警告出力

```typescript
const fileMetadata = metadata.files[target.path];
const baseJson = fileMetadata?.baseContent
  ? JSON.parse(fileMetadata.baseContent) as Record<string, unknown>
  : null;
const mergeResult = jsonProcessor.mergeJson(templateJson, localJson, jsonPaths, filePath, baseJson);
const mergedContent = `${JSON.stringify(mergeResult.result, null, 2)}\n`;

if (mergeResult.conflicts.length > 0) {
  for (const conflict of mergeResult.conflicts) {
    console.warn(`   ⚠️ JSON コンフリクト: ${target.path} → ${conflict.keyPath}`);
    console.warn(`      ローカル値を保持（テンプレート値: ${JSON.stringify(conflict.templateValue)}）`);
  }
}
```

### Step 4: `MetadataManager` の更新

**ファイル**: `packages/cli/src/lib/sync/metadata-manager.ts`

1. `updateFileHash` に `baseContent` パラメータ追加（一元管理）
2. デフォルト jsonPaths を設定（ブラックリスト方式）

```typescript
updateFileHash(filePath: string, hash: string, conflicts?: string[], baseContent?: string): void {
  this.metadata.files[filePath] = {
    hash,
    syncedAt: new Date().toISOString(),
    ...(conflicts && { conflicts }),
    ...(baseContent && { baseContent }),
  };
}

private getDefaultMetadata(): SyncMetadata {
  return {
    // ...
    jsonPaths: {
      managed: {
        ".claude/settings.json": ["plansDirectory", "includeCoAuthoredBy"],
        ".vscode/settings.json": [
          "editor.codeActionsOnSave", "editor.defaultFormatter", "editor.formatOnSave",
          "eslint.enable", "prettier.enable", "prettier.useEditorConfig", "[json]", "[jsonc]"
        ],
      },
      "project-private": {
        "package.json": ["name", "version", "private", "workspaces", "packageManager", "volta"],
      },
    },
  };
}
```

### Step 5: `copy-presets.mjs` に package.json コピー + テンプレート同期

**ファイル**: `packages/cli/scripts/copy-presets.mjs`

1. `fileMappings` に package.json フルコピーを追加
2. `create-einja-app` テンプレートの scripts 同期関数を追加（scripts + lint-staged をルートから同期）

### Step 6: `file-filter.ts` にカテゴリ追加

**ファイル**: `packages/cli/src/lib/sync/file-filter.ts`

`CATEGORY_MAPPING` に追加:

```typescript
"root-config": ".",         // package.json, .mcp.json
"claude-config": ".claude", // .claude/settings.json
```

各カテゴリの特別処理（`env` / `tools` と同じパターンで、対象ファイルをフィルタ）。

### Step 7: ドキュメント更新

#### 7a. `docs/einja/instructions/setup-flow.md`

1. sync カテゴリ一覧に追加:
   ```
   | `root-config` | `package.json`, `.mcp.json` | ルート設定ファイル |
   | `claude-config` | `.claude/settings.json` | Claude Code設定 |
   ```

2. JSON マージ方式テーブルを更新（3モード構成に書き換え）:
   ```
   | モード | 動作 | 設定方法 |
   |--------|------|---------|
   | `managed` | テンプレート値で強制上書き | jsonPaths.managed にパス指定 |
   | `project-private` | 完全除外（テンプレートから追加しない） | jsonPaths["project-private"] にパス指定 |
   | デフォルト | 3方向マージ（base/local/template比較、コンフリクト検出） | 上記以外の全パス |
   ```

3. JSON同期動作テーブルを追加:
   ```
   #### JSON ファイルの同期動作（3方向マージ）

   | 操作 | 結果 |
   |------|------|
   | テンプレートに新キーが追加された（利用者は未変更） | sync時に利用者のファイルに追加される |
   | 利用者が独自キーを追加した | 保持される |
   | 利用者がテンプレート由来のキーを削除（テンプレート側は未変更） | 削除が維持される |
   | 利用者がテンプレート由来のキーを変更（テンプレート側は未変更） | 利用者の変更が保持される |
   | テンプレートがキーを更新（利用者側は未変更） | テンプレートの更新が自動適用される |
   | 両方が同じキーを異なる値に変更 | コンフリクト警告（利用者の値を保持） |
   | project-private 指定のキー | テンプレートから一切追加・変更されない |
   | managed 指定のキー | テンプレート値で常に上書き |
   ```

4. ファイル別の jsonPaths 設定テーブルを追加:
   ```
   #### ファイル別 jsonPaths 設定

   | ファイル | managed | project-private | 残り |
   |---------|---------|----------------|------|
   | `package.json` | — | name, version, private, workspaces, packageManager, volta | 3方向マージ |
   | `.claude/settings.json` | plansDirectory, includeCoAuthoredBy | — | 3方向マージ |
   | `.vscode/settings.json` | editor.*, eslint.*, prettier.*, [json], [jsonc] | — | 3方向マージ |
   | `.mcp.json` | — | — | 3方向マージ |
   ```

5. 初回sync・base保存の仕組みを説明:
   ```
   #### base スナップショット

   3方向マージには「前回sync時のテンプレート内容」（base）が必要。
   `.einja-sync.json` の `baseContent` フィールドに保存される。

   - 初回sync（baseなし）: ローカル優先 + テンプレートの新規キーのみ追加
   - 2回目以降: base/local/template の3方向比較でマージ
   ```

#### 7b. `.claude/skills/cli-package-specs/SKILL.md`

セクション 4 と 5 の間に「4.5 JSON マージ仕様」を追加:

```markdown
### 4.5 JSON マージ仕様

**実装**: `packages/cli/src/lib/sync/json-processor.ts`
**設定**: `.einja-sync.json` の `jsonPaths` フィールド

#### マージモード（ブラックリスト方式）

| モード | 動作 | 用途 |
|--------|------|------|
| `managed` | テンプレート値で強制上書き | テンプレートが完全管理するセクション |
| `project-private` | 完全除外（テンプレートから追加・更新しない） | プロジェクト固有のセクション |
| デフォルト | base/local/templateの3方向マージ | 上記以外の全パス |

#### ネスト指定

パスはドット区切りでネスト指定可能。`deepMergeWithPaths` の再帰により
各レベルで jsonPaths チェックが行われる。

例: `"project-private": { "package.json": ["devDependencies.@types/node"] }`
→ devDependencies 全体は3方向マージ、@types/node のみ除外

#### 設定例

jsonPaths:
  managed: { ".claude/settings.json": ["plansDirectory"] }
  project-private: { "package.json": ["name", "version", "private", "workspaces"] }

→ plansDirectory はテンプレート強制上書き
→ name, version 等は完全除外
→ scripts, devDependencies 等は3方向マージ

#### base スナップショット

3方向マージには前回sync時のテンプレート内容（base）が必要。
`.einja-sync.json` の各ファイルメタデータに `baseContent` として保存。
初回sync（base なし）はローカル優先 + テンプレート新規キーのみ追加。

#### コンフリクト

両方が同じキーを異なる値に変更した場合:
- ローカル値を保持（安全側）
- コンソールに警告出力
- `mergeJson` の戻り値 `conflicts` 配列で呼び出し元にも通知
```

ファイルマッピングテーブルに追加:
```
| `package.json`（ルート） | `package.json` | root-config |
```

#### 7c. `CLAUDE.md`

二重管理禁止テーブルに追加:
```
| `package.json`（ルート） | `presets/default/package.json` | フルコピー |
```

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/types/sync.ts` | `tracked` 削除、`baseContent` 追加 |
| `packages/cli/src/commands/sync.ts` | fileName→フルパス、base渡し（本処理+dry-run両方）、戻り値型変更、コンフリクト出力 |
| `packages/cli/src/lib/sync/json-processor.ts` | `deepMergeWithPaths` に3方向マージ統合、`project-private` を完全除外に修正、`deepEqual` 追加、`isPathTracked` 削除 |
| `packages/cli/src/lib/sync/metadata-manager.ts` | `updateFileHash` に baseContent追加、デフォルト jsonPaths をブラックリスト方式に |
| `packages/cli/scripts/copy-presets.mjs` | package.json フルコピー + テンプレート scripts 同期 |
| `packages/cli/src/lib/sync/file-filter.ts` | `root-config` + `claude-config` カテゴリ追加 |
| `docs/einja/instructions/setup-flow.md` | カテゴリ・マージ方式ドキュメント更新 |
| `.claude/skills/cli-package-specs/SKILL.md` | JSON マージ仕様セクション追加 |
| `CLAUDE.md` | 二重管理禁止テーブルに package.json 追加 |

## 検証方法

1. **ビルド検証**: `pnpm --filter @einja/dev-cli build` → `presets/default/package.json` 生成
2. **テンプレート同期検証**: ビルド後に `templates/default/package.json` の scripts がルートと一致
3. **JsonProcessor ユニットテスト**:
   - 3方向マージ: base→template変更のみ→テンプレート適用
   - 3方向マージ: base→local変更のみ→ローカル保持
   - 3方向マージ: 両方変更（異なる値）→コンフリクト検出、ローカル保持
   - 3方向マージ: ローカル削除+テンプレート未変更→削除維持
   - 3方向マージ: テンプレート新キー追加→追加
   - 3方向マージ: ローカル新キー追加→保持
   - 初回sync（baseなし）+ローカルにユーザー変更あり→ローカル保持
   - project-private: テンプレートにあってもローカルに追加しない（完全除外）
   - project-private ネスト指定: `devDependencies.@types/node` が除外される
   - managed: テンプレート値で強制上書き
   - フルパスでの jsonPaths ルックアップ: `.claude/settings.json` 等が正しくマッチ
4. **file-filter テスト**: `root-config` + `claude-config` カテゴリのスキャン
5. **全JSONファイル統合テスト**: 各ファイルのマージ動作
6. **既存テスト**: `pnpm --filter @einja/dev-cli test` 全パス
7. **品質チェック**: `pnpm prepush` 全パス
