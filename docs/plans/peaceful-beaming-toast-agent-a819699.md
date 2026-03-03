# プランレビュー結果: peaceful-beaming-toast.md

## 📋 レビュー概要

プランファイル `/Users/kzp/code/GitHub/einja-inc/einja-management-template/docs/plans/peaceful-beaming-toast.md` の技術的正確性、実装可能性、および改善点を検証しました。

---

## ✅ 全体評価

| 項目 | 評価 | 備考 |
|------|------|------|
| Part 1: ドキュメント追記 | **合格** | mermaidシーケンス図は技術的に正確 |
| Part 2: init/syncギャップ修正 | **要修正** | 複数の技術的課題あり |
| 対象ファイル一覧 | **不足あり** | 新規作成ファイルが不足 |
| 検証計画 | **妥当** | 適切な検証手順 |

---

## 🔍 詳細レビュー

### Part 1: ドキュメント追記（mermaidシーケンス図）

#### ✅ 正確性

**シーケンス図の技術的正確性**: 合格

各シナリオのシーケンス図は以下の点で正確です：

1. **シナリオ1（ゼロから新規プロジェクト作成）**
   - create-einja-app → dev-cli init の委譲フローは正確
   - `--force --no-backup` フラグの使用は妥当（create-einja-app内部で初回init）
   - コピー対象（.claude/, docs/einja/, CLAUDE.md, .mcp.json, symlinks, 依存関係）は網羅的

2. **シナリオ2（テンプレート更新の取り込み）**
   - create-einja-app sync と dev-cli sync の独立性が明確
   - 管轄分離（アプリ設定 vs AI環境）が正確

3. **シナリオ3（既存プロジェクトに新規導入）**
   - dev-cli init → create-einja-app sync --categories の順序は実用的
   - 部分導入のユースケースは正確

#### ⚠️ 懸念点

**追記位置の妥当性**: 要確認

プランでは「31行目の `> **ポイント**: ...` の直後」に追記とありますが、README.mdの構造上、以下の配置も検討すべきです：

```markdown
### init vs sync vs create-einja-app の違い
[既存のテーブル]

> **ポイント**: 設定を更新したいだけなら`sync`を使ってください。

### 利用シーンのフロー  ← **新規セクション**
[mermaid図4つ]

## インストール  ← 既存セクション
```

**推奨**: セクション追加が適切か、それとも別ドキュメントへのリンクにすべきか検討する。

---

### Part 2: init/syncギャップ修正

#### ❌ 重大な問題

##### 2-1. `init.ts` への不足コピーステップ追加

**問題1: `merger.ts` の関数設計が不適切**

プランでは `copyPresetSubdir(targetDir, subPath)` と `copyPresetFile(targetDir, subPath)` を追加するとありますが、現在の `merger.ts` の設計と整合しません：

- `merger.ts` は **presetName** を引数に取る設計（例: `generateClaudeDirectory(targetPath, presetConfig)`）
- `getPresetPath()` はファイルシステム層（`file-system.ts`）の関数
- 提案されている関数は **プリセット名を受け取らない** ため、プリセットパスの解決ができない

**正しいシグネチャ（推奨）**:

```typescript
// merger.ts に追加
export async function copyPresetDirectory(
  targetDir: string,
  presetRelativePath: string,
  presetName: string = "default"
): Promise<void> {
  const presetPath = getPresetPath(presetName);
  const srcPath = path.join(presetPath, presetRelativePath);
  const destPath = path.join(targetDir, presetRelativePath);

  if (await fs.pathExists(srcPath)) {
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(srcPath, destPath);
  }
}

export async function copyPresetFile(
  targetFilePath: string,
  presetRelativePath: string,
  presetName: string = "default"
): Promise<void> {
  const presetPath = getPresetPath(presetName);
  const srcPath = path.join(presetPath, presetRelativePath);

  if (await fs.pathExists(srcPath)) {
    await fs.ensureDir(path.dirname(targetFilePath));
    await fs.copy(srcPath, targetFilePath);
  }
}
```

**問題2: init.ts でのコピー順序**

プランには「どのステップ番号の後にコピーを追加するか」の記載がありません。現在の `init.ts` の構造は以下です：

```
1-3: プリセット読み込み・ドライラン・既存確認
4: .claude 生成
5: ドキュメントテンプレート（templates/）
6: ステアリングドキュメント（steering/）
7: CLAUDE.md 生成
8: シンボリックリンク
9: .mcp.json
10: 依存関係
```

**推奨追加位置**:

- **scripts/**: ステップ5.5（docs/einja/ と .claude/ の後）
- **instructions/, example/**: ステップ6.5（steering/ の直後）
- **.envrc**: ステップ9.5（.mcp.json の直後）
- **.vscode/**: ステップ9.6（.envrc の直後）

##### 2-2. `file-filter.ts` への scripts カテゴリ追加

**⚠️ 影響範囲の分析不足**

`CATEGORY_MAPPING` への `scripts: "scripts"` 追加は、以下の影響があります：

1. **sync コマンドでの同期対象化**: `einja sync --only scripts` が動作可能になる
2. **einja-prefix フィルタリング**: `EINJA_PREFIX_CATEGORIES` に追加しないため、scripts/ 配下すべてが対象
3. **orphan cleaner への影響**: scripts/ 配下の孤立ファイル削除ロジックが適用される

**検証必要事項**:

- scripts/ には einja-prefix 以外のファイル（worktree/, lib/）が含まれるが、すべて同期対象でよいか？
- テンプレート側に存在しないローカルのスクリプト（プロジェクト固有）は削除されるべきか？

**推奨**: scripts/ を同期対象にする場合、以下のルールを明示すべき：

```typescript
// scripts/lib/, scripts/worktree/ はプリセット管理対象
// それ以外のscripts/ 直下のプロジェクト固有ファイルはorphan cleanerの除外対象
```

##### 2-3. `scripts/worktree/dev.ts` の packages/config 依存除去

**❌ 重大な設計ミス**

プランでは「`scripts/lib/worktree-config.ts` を新規作成し、型定義+ローダーをインライン化（zod非依存）」とありますが、以下の問題があります：

**問題1: packages/config の役割の誤解**

`packages/config` は **zodベースのバリデーション** を提供するために存在します：

```typescript
// packages/config/src/worktree-config.ts
export const appConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  portRangeStart: z.number().int().min(1024).max(65535),
  rangeSize: z.number().int().min(1).max(10000).default(1000),
});
```

**zod非依存のローダー** では以下の機能が失われます：

- IDフォーマット検証（正規表現）
- ポート番号範囲チェック
- デフォルト値の自動適用
- 型安全性

**問題2: 重複コードの発生**

`scripts/lib/worktree-config.ts` に型定義をインライン化すると、`packages/config` との二重管理になります：

| ファイル | 役割 | バリデーション |
|---------|------|-------------|
| `packages/config/src/worktree-config.ts` | 型定義+zodスキーマ | あり |
| `scripts/lib/worktree-config.ts` | 型定義のみ | **なし**（zod非依存） |

今後の変更（例: 新規アプリ追加、設定項目追加）時に **両方のファイルを修正** する必要が生じます。

**問題3: scripts/ は init/sync でコピーされる = packages/config も必要**

プラン 2-1 で scripts/ を init/sync でコピーする方針なのに、scripts/worktree/dev.ts から packages/config 依存を除去するのは矛盾しています。

**理由**: プリセットテンプレートから scripts/ をコピーする場合、scripts/worktree/dev.ts も含まれる。しかし、ターゲットプロジェクトに packages/config が存在しない（モノレポではない）場合、import エラーになる。

**正しい解決策（3択）**:

#### ✅ 推奨案A: packages/config を peer dependencies にする

```json
// packages/cli/package.json
{
  "peerDependencies": {
    "@your-org/config": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@your-org/config": {
      "optional": true
    }
  }
}
```

- scripts/worktree/dev.ts 内で `packages/config` の存在を動的チェック
- 存在しない場合はデフォルト設定で動作

```typescript
// scripts/worktree/dev.ts
let loadWorktreeConfig: typeof import("../../packages/config/src/worktree-config-loader.js").loadWorktreeConfig;

try {
  const module = await import("../../packages/config/src/worktree-config-loader.js");
  loadWorktreeConfig = module.loadWorktreeConfig;
} catch {
  // fallback: JSONを直接読む（バリデーションなし）
  loadWorktreeConfig = () => defaultWorktreeConfig;
}
```

#### 案B: scripts/lib/ に最小限のローダーを配置（バリデーション放棄）

- zod依存を除去し、JSONを素直に読むだけ
- **デメリット**: 設定ミス時のエラー検出が不可能

#### 案C: scripts/ を init/sync のコピー対象から除外

- scripts/ はプロジェクト固有のツールと割り切る
- **デメリット**: worktree開発フローが新規プロジェクトで使えない

**推奨**: **案A**（packages/config を optional peer dependency にして、動的読み込み+fallback）

---

#### 📝 対象ファイル一覧の不足

プランの「対象ファイル」セクションに以下が不足しています：

| 不足ファイル | 理由 |
|------------|------|
| `packages/cli/src/lib/file-system.ts` | `getPresetPath()` が既に存在するか確認が必要 |
| `scripts/lib/worktree-config.ts` | **新規** として明記されているが、実装の詳細仕様が不明 |
| `.claude/skills/*/SKILL.md` | scripts/ の同期影響を受ける可能性 |

---

#### ✅ 検証計画の妥当性

プランの検証項目は網羅的です：

1. ビルド成功 → 型チェック・lint
2. mermaid レンダリング → GitHub UI確認
3. init コマンド動作確認 → 実環境テスト
4. sync --only scripts 動作確認 → カテゴリフィルタリング
5. worktree dev.ts 動作確認 → packages/config なしでの動作
6. テスト通過 → 既存機能の非破壊確認

**追加推奨**:

- `einja sync --only scripts` 実行後に、プロジェクト固有の scripts/ ファイルが削除されないことを確認
- init 後の .envrc の内容が正しいことを確認（direnv でロード可能か）
- .vscode/settings.json が既存設定とマージされることを確認（上書きされない）

---

## 📌 修正推奨事項まとめ

### 🔴 必須修正

| 項目 | 問題 | 推奨対応 |
|------|------|---------|
| 1 | `merger.ts` の関数シグネチャ不足 | `presetName` 引数を追加し、`getPresetPath()` を使用する設計に変更 |
| 2 | init.ts へのコピー追加位置が不明 | ステップ番号を明示（例: 5.5, 6.5, 9.5, 9.6） |
| 3 | packages/config 依存除去の方針が矛盾 | **案A**: optional peer dependency + 動的読み込み を採用 |
| 4 | scripts/ の同期ルールが曖昧 | プロジェクト固有ファイルの扱いを明示 |

### 🟡 推奨修正

| 項目 | 問題 | 推奨対応 |
|------|------|---------|
| 5 | README.md へのmermaid図追加位置 | 新規セクションとして追加すべきか確認 |
| 6 | 対象ファイル一覧の不足 | `packages/cli/src/lib/file-system.ts` を追加 |
| 7 | .vscode/settings.json のマージ方法 | JSON merge の仕様を明示（深いマージか、シャローマージか） |

### 🟢 補足検証

| 項目 | 検証内容 |
|------|---------|
| 8 | scripts/ の einja-prefix フィルタリング不要性 | worktree/, lib/ が sync 対象になる影響 |
| 9 | .envrc のコピータイミング | .mcp.json の後で妥当か（依存関係なし） |

---

## 🎯 次のアクション

1. **ユーザーに確認**:
   - packages/config 依存の解消方針（案A/B/C）
   - scripts/ の同期対象範囲（全体 or einja-prefix のみ）
   - README.md への mermaid 図の追加位置

2. **プラン修正**:
   - merger.ts の関数仕様を詳細化
   - init.ts のステップ番号を明示
   - worktree-config.ts の実装仕様を追加
   - 対象ファイル一覧を補完

3. **実装開始条件**:
   - 上記の必須修正（1-4）がすべて解決
   - ユーザー確認事項（1）への回答完了

---

## 📚 参考情報

### 現在の file-filter.ts のカテゴリ一覧

```typescript
const CATEGORY_MAPPING: Record<string, string> = {
  commands: ".claude/commands/einja",
  agents: ".claude/agents/einja",
  skills: ".claude/skills",      // einja-prefix フィルタリングあり
  hooks: ".claude/hooks",
  docs: "docs/einja",
  env: ".",                        // .envrc のみ
  tools: ".vscode",                // .vscode/settings.json のみ
  // scripts: "scripts",           // ← 追加予定
};
```

### presets/default/ の構造

```
presets/default/
├── .claude/
├── .envrc                    ← init で未コピー
├── .mcp.json
├── .vscode/settings.json     ← init で未コピー
├── CLAUDE.md.template
├── docs/einja/
│   ├── instructions/         ← init で未コピー
│   ├── example/              ← init で未コピー
│   ├── steering/
│   └── templates/
├── preset.yaml
├── scripts/                  ← init で未コピー
│   ├── lib/
│   └── worktree/
└── symlinks.json
```

---

**レビュー完了**: 上記の修正を反映後、実装可能と判断します。
