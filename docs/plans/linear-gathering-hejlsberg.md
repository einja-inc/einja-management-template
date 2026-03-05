# package.json scripts 配布メカニズムの実装

## Context

テンプレートリポジトリのルート `package.json` に追加した npm scripts が配布先リポジトリに反映されない。

- `copy-presets.mjs` の配布対象に `package.json` が含まれていない
- `einja sync` の `FileFilter` カテゴリにルート `package.json` が含まれていない
- `create-einja-app/templates/default/package.json` は手動で同期されている（二重管理）

## 配布タイミング

```
ルート package.json（Single Source of Truth）
  │
  ├─【ビルド時】copy-presets.mjs
  │   ├─→ presets/default/package.json     （einja sync 用）
  │   └─→ templates/default/package.json   （create-einja-app 用: scripts セクション同期）
  │
  ├─【einja sync 実行時】JsonProcessor tracked マージ
  │   └─→ 配布先の package.json の scripts をマージ（ユーザー追加分は保持）
  │
  └─【create-einja-app 実行時】テンプレートからコピー
      └─→ 新規プロジェクトの package.json
```

## マージ戦略（einja sync）

### 新規マージモード `tracked`（3方向マージ）の導入

テキストファイルの3方向マージと同じ考え方をJSONのキー単位に適用する。
base（前回sync時のテンプレート）・local・template の3つを比較し、**誰が何を変えたか**でキー別に判定する。

```
キー別判定ルール:
  base→local 変更なし + base→template 変更あり → テンプレート適用（自動更新）
  base→local 変更あり + base→template 変更なし → ローカル保持（利用者変更を尊重）
  両方変更 + 同じ値                            → どちらでもOK（コンフリクトなし）
  両方変更 + 異なる値                          → コンフリクト ⚠️
  ローカルで削除 + テンプレート変更なし          → 削除を維持
  ローカルで削除 + テンプレート変更あり          → コンフリクト ⚠️
  テンプレートで新キー追加                      → 追加
  ローカルで新キー追加                          → 保持
```

```
例1: テンプレート更新、利用者は未変更
  base:     { dev: "旧", prepush: "旧" }
  local:    { dev: "旧", my-cmd: "追加" }
  template: { dev: "新", prepush: "新" }
  → 結果:   { dev: "新", prepush: "新", my-cmd: "追加" }  ← 全て自動解決 ✅

例2: 利用者がスクリプトを削除、テンプレートは未変更
  base:     { dev: "旧", prepush: "旧" }
  local:    { dev: "旧" }                  ← prepush を削除
  template: { dev: "旧", prepush: "旧" }
  → 結果:   { dev: "旧" }                  ← 削除が維持される ✅

例3: 両方が同じキーを変更（コンフリクト）
  base:     { dev: "旧" }
  local:    { dev: "利用者版" }
  template: { dev: "テンプレート版" }
  → 結果:   { dev: "利用者版" } + コンフリクト警告 ⚠️
```

### コンフリクト時の動作

- **ローカル値を保持**（安全側にデフォルト）
- コンフリクト情報をコンソールに警告出力
- `mergeJson` の戻り値に `conflicts` 配列を追加し、呼び出し元（sync.ts）でハンドリング

### presets/default/package.json: フルコピー + ワイルドカード保護

`copy-presets.mjs` ではルート `package.json` を**そのままコピー**（抽出ロジック不要）。

テンプレート固有セクション（`dependencies`, `workspaces` 等）のリーク防止は、
JsonProcessor の `project-private: ["*"]` **ワイルドカード**で実現する。

```
jsonPaths設定:
  tracked:         { "package.json": ["scripts", "lint-staged"] }  → 3方向マージ
  project-private: { "package.json": ["*"] }                       → 未指定セクション全てローカル保持
```

`*` ワイルドカードにより、`managed` / `tracked` に明示されていないセクションは
自動的に `project-private`（ローカル保持）扱いになり、テンプレートから追加されない。

**メンテナンス性**: 新しい配布対象セクションを追加する場合、`tracked` の jsonPaths を1箇所更新するだけでOK。

### セクション別マージ戦略

| package.json セクション | jsonPaths設定 | 動作 |
|----------------------|------|------|
| `scripts` | `tracked` | 3方向マージ（base/local/template比較、コンフリクト検出） |
| `lint-staged` | `tracked` | 同上 |
| `name`, `version`, `dependencies` 等 | `*` (project-private) | ローカル値を保持、テンプレートから追加しない |

## 実装ステップ

### Step 1: `JsonProcessor` に `tracked` モード（3方向マージ）+ `*` ワイルドカード対応を追加

**ファイル**: `packages/cli/src/lib/sync/json-processor.ts`

#### 1a. 戻り値の型を追加

```typescript
/** JSONマージのコンフリクト情報 */
export interface JsonConflict {
  keyPath: string;
  baseValue: unknown;
  localValue: unknown;
  templateValue: unknown;
}

/** JSONマージの結果 */
export interface JsonMergeResult {
  result: Record<string, unknown>;
  conflicts: JsonConflict[];
}
```

#### 1b. `mergeJson` に base 引数を追加（後方互換: オプショナル）

```typescript
mergeJson(
  templateJson: Record<string, unknown>,
  localJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  baseJson?: Record<string, unknown> | null  // NEW
): JsonMergeResult
```

#### 1c. `deepMergeWithPaths` に `tracked` セクションの3方向マージロジックを追加

`tracked` パスの場合:
1. base/local/template の3値をキー別に比較
2. 片方だけ変更 → 変更を適用
3. 両方変更 → ローカル保持 + コンフリクト記録

```typescript
if (this.isPathTracked(filePath, keyPath, jsonPaths)) {
  // tracked: 3方向マージ（base が必要）
  if (this.isObject(templateValue) && baseJson) {
    const baseSection = this.getValueAtPath(baseJson, keyPath);
    const localSection = existing[key];
    result[key] = this.merge3WaySection(
      baseSection, localSection, templateValue, keyPath, conflicts
    );
  } else if (!baseJson) {
    // base がない（初回sync）: テンプレートをそのまま使用
    result[key] = this.deepClone(templateValue);
  }
}
```

#### 1d. `merge3WaySection` メソッド（キー別3方向マージ）

```typescript
private merge3WaySection(
  base: unknown, local: unknown, template: unknown,
  parentPath: string, conflicts: JsonConflict[]
): unknown {
  if (!this.isObject(base) || !this.isObject(local) || !this.isObject(template)) {
    // オブジェクトでない場合は値レベルの3方向比較
    return this.resolve3Way(base, local, template, parentPath, conflicts);
  }

  const result: Record<string, unknown> = {};
  const allKeys = new Set([
    ...Object.keys(base), ...Object.keys(local), ...Object.keys(template)
  ]);

  for (const key of allKeys) {
    const keyPath = `${parentPath}.${key}`;
    const b = base[key], l = local[key], t = template[key];

    if (JSON.stringify(l) === JSON.stringify(b)) {
      // ローカル未変更 → テンプレートの値を採用（追加/更新/削除）
      if (t !== undefined) result[key] = this.deepClone(t);
      // t が undefined ならテンプレートで削除 → 結果からも除外
    } else if (JSON.stringify(t) === JSON.stringify(b)) {
      // テンプレート未変更 → ローカルの値を採用
      if (l !== undefined) result[key] = this.deepClone(l);
    } else if (JSON.stringify(l) === JSON.stringify(t)) {
      // 同じ値に変更 → コンフリクトなし
      if (l !== undefined) result[key] = this.deepClone(l);
    } else {
      // 両方変更、異なる値 → コンフリクト（ローカル保持）
      if (l !== undefined) result[key] = this.deepClone(l);
      conflicts.push({ keyPath, baseValue: b, localValue: l, templateValue: t });
    }
  }
  return result;
}
```

#### 1e. `isPathProjectPrivate` に `*` ワイルドカード対応を追加

```typescript
private isPathProjectPrivate(filePath: string, keyPath: string, jsonPaths: JsonPathsConfig): boolean {
  const projectPrivatePaths = jsonPaths["project-private"][filePath] || [];
  // "*" ワイルドカード: managed / tracked 以外は全て project-private
  if (projectPrivatePaths.includes("*")) {
    if (!this.isPathManaged(filePath, keyPath, jsonPaths) &&
        !this.isPathTracked(filePath, keyPath, jsonPaths)) {
      return true;
    }
  }
  return projectPrivatePaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
}
```

#### 1f. `isPathTracked` メソッドを追加（`isPathManaged` と同じパターン）

### Step 2: 型定義の更新

**ファイル**: `packages/cli/src/types/sync.ts`

```typescript
export const JsonPathsConfigSchema = z.object({
  managed: z.record(z.string(), z.array(z.string())),
  tracked: z.record(z.string(), z.array(z.string())).optional(),
  "project-private": z.record(z.string(), z.array(z.string())),
});
```

### Step 3: `copy-presets.mjs` に package.json フルコピー + テンプレート同期を追加

**ファイル**: `packages/cli/scripts/copy-presets.mjs`

#### 3a. `fileMappings` に package.json を追加（フルコピー、抽出ロジックなし）:

```js
{
  src: path.join(projectRoot, "package.json"),
  dest: path.join(cliDir, "presets/default/package.json"),
  basePath: "package.json",
},
```

#### 3b. `create-einja-app` テンプレートの scripts 同期関数を追加:

```js
function syncTemplatePackageJsonScripts() {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
  const templatePkgPath = path.join(projectRoot, "packages/create-einja-app/templates/default/package.json");
  const templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, "utf-8"));

  templatePkg.scripts = rootPkg.scripts;
  if (rootPkg["lint-staged"]) {
    templatePkg["lint-staged"] = rootPkg["lint-staged"];
  }

  fs.writeFileSync(templatePkgPath, JSON.stringify(templatePkg, null, 2) + "\n");
  console.log("  ✓ templates/default/package.json の scripts を同期");
}
```

### Step 4: `file-filter.ts` に `root-config` カテゴリを追加

**ファイル**: `packages/cli/src/lib/sync/file-filter.ts`

`CATEGORY_MAPPING` に `"root-config": "."` を追加し、`scanSyncTargets` と `getCategoryFromPath` に `package.json` のみを対象とする特別処理を追加（`env` カテゴリの `.envrc` と同じパターン）。

### Step 5: `metadata-manager.ts` のデフォルト jsonPaths を設定

**ファイル**: `packages/cli/src/lib/sync/metadata-manager.ts`

```typescript
private getDefaultMetadata(): SyncMetadata {
  return {
    version: "1.0.0",
    lastSync: new Date().toISOString(),
    templateVersion: "0.1.0",
    files: {},
    jsonPaths: {
      managed: {},
      tracked: {
        "package.json": ["scripts", "lint-staged"],
      },
      "project-private": {
        "package.json": ["*"],  // ワイルドカード: managed/tracked 以外は全てローカル保持
      },
    },
  };
}
```

**ポイント**: `["*"]` により個別セクション列挙が不要。`tracked` に追加するだけで配布対象を拡張できる。

### Step 6: ドキュメント更新

#### 6a. `docs/einja/instructions/setup-flow.md`

**現状**: L193-204 の dev-cli sync カテゴリ一覧に `root-config` がない。L206-214 のマージ方式テーブルに `tracked` がない。

**追加内容**:
1. L204 の後に `root-config` カテゴリ行を追加:
   ```
   | `root-config` | `package.json` | ルート設定ファイル |
   ```

2. L213 の JSON マージ行を拡充し、`tracked` モードと `*` ワイルドカードの説明を追加:
   ```
   | JSON マージ | `.json` 拡張子のファイル | jsonPaths 設定に基づくセクション別マージ。`managed`=テンプレートで上書き、`tracked`=base/local/templateの3方向マージ（コンフリクト検出）、`project-private`=ローカル優先。`"*"` ワイルドカードで未指定セクションを一括 project-private 化可能 |
   ```

3. 利用者向けの動作説明を追加（マージ方式テーブルの下に新セクション）:
   ```markdown
   #### package.json の同期動作

   | 操作 | 結果 |
   |------|------|
   | テンプレートに新スクリプトが追加された | sync 時に利用者の package.json に追加される |
   | 利用者が独自スクリプトを追加した | 保持される（テンプレートにないキーは維持） |
   | 利用者がテンプレート由来のスクリプトを削除した（テンプレート側は未変更） | 削除が維持される（利用者の変更を尊重） |
   | 利用者がテンプレート由来のスクリプトを削除した（テンプレート側も変更） | コンフリクト警告（ローカル=削除 を保持） |
   | 利用者がテンプレート由来のスクリプトを書き換えた（テンプレート側は未変更） | 利用者の書き換えが保持される |
   | 利用者がテンプレート由来のスクリプトを書き換えた（テンプレート側も変更） | コンフリクト警告（利用者の値を保持） |
   | テンプレートがスクリプトを更新した（利用者側は未変更） | テンプレートの更新が自動適用される |
   | 利用者が dependencies を変更した | 影響なし（`*` ワイルドカードで保護） |
   ```

#### 6b. `.claude/skills/cli-package-specs/SKILL.md`

**現状**: JSON マージ仕様（`tracked`、`*` ワイルドカード、`jsonPaths` の設定例）の記述が**一切ない**。

**追加内容**: セクション 4 と 5 の間に新セクション「4.5 JSON マージ仕様」を追加:

```markdown
### 4.5 JSON マージ仕様

**実装**: `packages/cli/src/lib/sync/json-processor.ts`
**設定**: `.einja-sync.json` の `jsonPaths` フィールド

#### マージモード

| モード | 動作 | 用途 |
|--------|------|------|
| `managed` | テンプレート値で完全上書き | テンプレートが完全管理するセクション |
| `tracked` | base/local/templateの3方向マージ（キー単位でコンフリクト検出） | テンプレートと利用者が両方変更しうるセクション |
| `project-private` | ローカル優先（キーがない場合のみテンプレートから追加） | 利用者が自由に編集するセクション |
| デフォルト | ディープマージ（テンプレートの新規キーのみ追加） | 上記いずれにも該当しないパス |

#### `*` ワイルドカード

`project-private` に `["*"]` を指定すると、`managed` / `tracked` に
明示されていない全パスが `project-private` 扱いになる。

#### 設定例（package.json）

jsonPaths:
  tracked: { "package.json": ["scripts", "lint-staged"] }
  project-private: { "package.json": ["*"] }

→ scripts と lint-staged はテンプレート同期、それ以外はローカル保持
```

また、セクション 2.1 の単一ファイルマッピングテーブルに追加:
```
| `package.json`（ルート） | `package.json` | Yes |
```

セクション 2.2 の `FileCopier` 単一ファイルマッピングに追加:
```
| `package.json` | `package.json` | root-config |
```

#### 6c. `CLAUDE.md`

二重管理禁止テーブルに追加:
```
| `package.json`（ルート） | `presets/default/package.json` | フルコピー |
```

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/lib/sync/json-processor.ts` | `tracked` モード + `*` ワイルドカード対応 |
| `packages/cli/src/types/sync.ts` | `JsonPathsConfigSchema` に `tracked` フィールド追加 |
| `packages/cli/scripts/copy-presets.mjs` | fileMappings に package.json フルコピー追加 + テンプレート scripts 同期関数 |
| `packages/cli/src/lib/sync/file-filter.ts` | `root-config` カテゴリ追加 |
| `packages/cli/src/lib/sync/metadata-manager.ts` | デフォルト jsonPaths に package.json 設定追加 |
| `docs/einja/instructions/setup-flow.md` | カテゴリテーブルに `root-config` 追加、マージ方式に `tracked` 追記、package.json 同期動作テーブル追加 |
| `.claude/skills/cli-package-specs/SKILL.md` | 「4.5 JSON マージ仕様」新セクション追加、ファイルマッピングテーブル更新 |
| `CLAUDE.md` | 二重管理禁止テーブルに `package.json` 追加 |

## 検証方法

1. **ビルド検証**: `pnpm --filter @einja/dev-cli build` → `presets/default/package.json` が生成されること
2. **テンプレート同期検証**: ビルド後に `templates/default/package.json` の scripts がルートと一致
3. **JsonProcessor テスト**: `tracked` モード（3方向マージ）のユニットテスト追加
   - base→template 変更のみ → テンプレート値が自動適用されること
   - base→local 変更のみ → ローカル値が保持されること
   - 両方変更（異なる値） → コンフリクトが検出され、ローカル値が保持されること
   - ローカルでキー削除 + テンプレート未変更 → 削除が維持されること
   - ローカルで新キー追加 → 保持されること
   - テンプレートで新キー追加 → 追加されること
   - base がない場合（初回sync） → テンプレートがそのまま使用されること
   - `*` ワイルドカード: tracked/managed 以外のキーが project-private 扱いになること
4. **file-filter テスト**: `root-config` カテゴリのスキャンテスト追加
5. **既存テスト**: `pnpm --filter @einja/dev-cli test` が全パス
6. **品質チェック**: `pnpm prepush` が全パス
