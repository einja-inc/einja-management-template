# einja sync コマンド動作調査レポート

## 調査概要

作業ディレクトリ: `/Users/kzp/code/GitHub/einja-inc/einja-management-template`

別プロジェクトでinit/syncを実行した際に想定通り動作しない可能性がある処理を特定するため、`einja sync`コマンドの処理フローとファイルフィルタリング・マーカー処理の詳細を調査しました。

---

## 1. sync コマンド処理フロー

### ファイルパス
`packages/cli/src/commands/sync.ts` (76-759行)

### 主要処理ステップ

1. **初期化・カテゴリ検証** (76-109行)
   - `--only` オプションで指定されたカテゴリを `validateCategories()` で検証
   - 無効なカテゴリがあればエラーメッセージを表示して終了

2. **マネージャークラスのインスタンス化** (109-117行)
   ```typescript
   const metadataManager = new MetadataManager(cwd);
   const fileFilter = new FileFilter(cwd, templateRoot);
   const diffEngine = new DiffEngine();
   const conflictReporter = new ConflictReporter();
   const backupManager = new BackupManager(cwd);
   const batchProcessor = new BatchProcessor(10);
   const markerProcessor = new MarkerProcessor();
   const projectPrivateSynchronizer = new ProjectPrivateSynchronizer();
   const jsonProcessor = new JsonProcessor();
   const orphanCleaner = new OrphanCleaner(cwd, fileFilter);
   ```

3. **メタデータ読み込み** (119-123行)
   - `.einja/sync-metadata.json` を読み込み
   - ファイルハッシュ・最終同期日時等を取得

4. **同期対象ファイルスキャン** (125-133行)
   - `FileFilter.scanSyncTargets({ categories })` で対象ファイルを列挙
   - カテゴリフィルタが適用される

5. **差分計算（並列処理）** (135-160行)
   - `batchProcessor.processBatch()` でファイルハッシュを計算
   - メタデータと比較して変更があるファイルを抽出

6. **孤児検出** (162-165行)
   - `orphanCleaner.detectOrphans()` でメタデータに存在するがテンプレートに存在しないファイルを検出
   - `--only` で指定されたカテゴリのみ対象

7. **dry-runモード分岐** (196-345行)
   - `--dry-run` 時はマージシミュレーションのみ実行
   - コンフリクト検出結果を表示

8. **確認プロンプト** (347-368行)
   - `--yes` 指定時はスキップ
   - `--force` 時は特別な警告メッセージ

9. **バックアップ作成** (370-376行)
   - `--backup=false` 以外は自動バックアップ

10. **ファイルマージ処理（並列計算→順次書き込み）** (378-589行)
    - **マージ計算は並列実行**（`batchProcessor.processBatch()`）
    - **ファイル書き込みは順次実行**（ファイルシステム競合を回避）

11. **孤児削除処理** (591-644行)
    - `--clean` オプション指定時のみ実行
    - 確認プロンプト（`--yes` でスキップ可能）

12. **メタデータ保存** (646行)
    - 更新されたハッシュ・タイムスタンプを保存

13. **結果出力** (648-714行)
    - `--json` オプション時は標準出力にJSON形式で出力
    - 通常時は人間が読みやすい形式で表示

14. **依存関係チェック＋インストール** (716-735行)
    - `--skip-deps` 以外は `checkAndInstallDependencies()` を実行

---

## 2. ファイルフィルタ処理

### ファイルパス
`packages/cli/src/lib/sync/file-filter.ts` (28-275行)

### カテゴリマッピング（CATEGORY_MAPPING）

```typescript
const CATEGORY_MAPPING = {
  agents: ".claude/agents/einja",
  commands: ".claude/commands/einja",
  docs: "docs/einja",
  env: ".envrc",        // 特殊処理: ファイル単位
  hooks: ".claude/hooks/einja",
  skills: ".claude/skills/einja",
  tools: ".vscode/settings.json"  // 特殊処理: ファイル単位
}
```

### einja-プレフィックスフィルタリング（EINJA_PREFIX_CATEGORIES）

```typescript
const EINJA_PREFIX_CATEGORIES = ["agents", "commands", "skills", "hooks"];
```

これらのカテゴリでは `einja-*` で始まるディレクトリのみを対象にする。

### scanSyncTargets() の処理ロジック（41-134行）

1. `.gitignore` を読み込み（`loadGitignore()`）
2. 各カテゴリごとにスキャン:
   - **env/toolsカテゴリ**: 特定ファイルのみ対象（`.envrc` / `.vscode/settings.json`）
   - **einja-プレフィックス必須カテゴリ**: `{categoryPath}/einja-*/**/*` パターンでスキャン
   - **その他**: `{categoryPath}/**/*` パターンでスキャン
3. 除外判定（`shouldExclude()`）:
   - `_` プレフィックスで始まるファイル
   - `.gitignore` パターンに一致
   - バイナリファイル（画像・動画・PDF・圧縮ファイル等）
   - 追加の除外パターン（オプション）

### ⚠️ 潜在的問題点

#### 問題1: カテゴリパス不一致
別プロジェクトで以下のディレクトリ構造が異なる場合、スキャンに失敗する可能性がある:
- `.claude/agents/einja` → プロジェクトによっては `.claude/agents` のみの場合あり
- `docs/einja` → `docs/` 直下にドキュメントを配置している場合あり

#### 問題2: einja-プレフィックス制約
`agents`, `commands`, `skills`, `hooks` カテゴリでは `einja-` で始まらないディレクトリは **完全に無視される**。
- 例: `.claude/skills/my-custom-skill/` → スキャン対象外

#### 問題3: シンボリックリンクの扱い
`fs.pathExists()` で存在確認しているが、シンボリックリンクが切れている場合の処理が未定義。

---

## 3. マーカー処理

### ファイルパス
`packages/cli/src/lib/sync/marker-processor.ts` (11-458行)

### サポートされるマーカー種別

| マーカー | 用途 | ID属性 | sync時の動作 |
|---------|------|--------|-------------|
| `@einja:managed` | 共通ルール（常に最新を維持） | オプション | **常に上書き** |
| `@einja:project-private` | プロジェクト固有テンプレート | **必須** | 初回のみ追加、以降は保持 |
| `@einja:seed` (レガシー) | 旧project-private | オプション | 自動的に `@einja:project-private` にマイグレーション |

### マーカーフォーマット

**Markdown形式:**
```markdown
<!-- @einja:managed:start -->
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="xxx" -->
<!-- @einja:project-private:end -->
```

**YAML/JSON形式（コメント）:**
```yaml
# @einja:managed:start
# @einja:managed:end

# @einja:project-private:start id="xxx"
# @einja:project-private:end
```

### マーカー検証ロジック（validateMarkers: 149-237行）

検証エラー種別:
- `nested`: マーカーの入れ子（managed内にproject-private等）
- `project_private_without_id`: project-privateマーカーにID属性がない
- `duplicate_id`: ID重複
- `unpaired_start`: 対応する `:end` がない
- `unpaired_end`: 対応する `:start` がない

### マーカーパース処理（parseMarkers: 60-141行）

1. ファイルを行単位で分割
2. マーカー開始/終了を検出してセクションに分離
3. 各セクションに以下の情報を付与:
   - `type`: "managed" | "project-private" | "unmanaged"
   - `startLine`, `endLine`: 行番号範囲
   - `content`: セクション内容（マーカー行を含む）
   - `id`: ID属性（あれば）

### レガシーマーカー自動マイグレーション（migrateLegacySeedMarkers: 453-457行）

sync.ts の 493-498行で自動実行:
```typescript
if (localContent.includes("@einja:seed:")) {
  const migratedContent = markerProcessor.migrateLegacySeedMarkers(localContent);
  await fs.writeFile(projectPath, migratedContent, "utf-8");
  localContent = migratedContent;
}
```

### ⚠️ 潜在的問題点

#### 問題4: マーカーバリデーション失敗時のフォールバック
マーカーが不正な場合、3方向マージにフォールバック（sync.ts: 639-652行）。
- エラーメッセージがユーザーに通知されない
- 意図しない上書きが発生する可能性

#### 問題5: ID属性の厳格性
`@einja:project-private` にID属性が必須だが、テンプレート側でIDが付与されていない場合、検証エラーとなる。
- 初期セットアップ時の混乱を招く可能性

#### 問題6: マーカーの正規表現パターン
以下のパターンはマーカーとして認識されない:
```markdown
<!--@einja:managed:start-->  ← スペースなし（エラー）
<!-- @einja:managed:start--> ← 末尾のスペースなし（エラー）
```

---

## 4. project-private-synchronizer

### ファイルパス
`packages/cli/src/lib/sync/project-private-synchronizer.ts` (9-125行)

### 主要メソッド

#### syncProjectPrivateSections（19-61行）
1. ローカルとテンプレートをパース
2. ローカルに存在する project-private の ID を収集
3. テンプレートの project-private で **ローカルに存在しない** ものを抽出
4. ローカルの末尾に追加

#### syncUnmarkedFile（70-79行）
マーカーなしファイルの処理:
- ローカルに存在しない → テンプレートをそのまま追加
- ローカルに存在する → 何もしない（null返却）

#### syncProjectPrivateOnlyFile（95-124行）
managedなしファイル（project-privateのみ）の処理:
1. project-privateセクションを抽出
2. 本文を3方向マージ
3. ローカルの project-private を保持、なければテンプレートのものをseed

### ⚠️ 潜在的問題点

#### 問題7: ID衝突時の動作
テンプレート側で新しいproject-privateセクションを追加したが、IDが既存のものと衝突した場合:
- `validateMarkers()` でエラーになる
- 3方向マージにフォールバックし、意図しない上書きの可能性

#### 問題8: project-privateセクションの削除
テンプレート側でproject-privateセクションを削除した場合、ローカル側には残り続ける。
- 意図的な削除なのか、リファクタリングなのか判別不能

---

## 5. orphan-cleaner

### ファイルパス
`packages/cli/src/lib/sync/orphan-cleaner.ts` (9-104行)

### detectOrphans（22-63行）

孤児検出ロジック:
1. メタデータに存在するファイルをループ
2. 現在のテンプレートファイルセットに存在しないものを孤児と判定
3. 以下のフィルタリングを適用:
   - パストラバーサル防御（`..` や絶対パスを除外）
   - カテゴリ判定（`fileFilter.getCategoryFromPath()`）
   - `--only` オプションで指定されたカテゴリのみ
   - カテゴリがnull（どのカテゴリにも属さない）の場合はスキップ

### ⚠️ 潜在的問題点

#### 問題9: カテゴリ推測の失敗
`getCategoryFromPath()` がnullを返すファイルは孤児として検出されない。
- カテゴリマッピングが変更された場合、古いファイルが残り続ける

#### 問題10: 孤児削除の確認プロンプト
`--clean` オプション時、確認プロンプトが表示されるが、`--yes` で自動承認可能。
- 誤削除のリスク（特にCI/CD環境で `--yes --clean` を使用する場合）

---

## 6. symlinks.json の処理

### ファイルパス
`packages/cli/src/lib/merger.ts` (128-229行)

### createSymlinks() の処理フロー

1. `symlinks.json` の存在確認（なければスキップ）
2. JSONパース・バージョンチェック
3. 各シンボリックリンクを作成:
   ```typescript
   const linkPath = path.join(targetDir, link);
   const absoluteTarget = path.join(targetDir, target);
   const relativeTarget = path.relative(linkDir, absoluteTarget);
   await fs.symlink(relativeTarget, linkPath);
   ```
4. エラーハンドリング:
   - リンク先が存在しない → スキップ
   - リンク元にディレクトリが存在 → エラー（手動削除を促す）
   - Windows権限エラー（EPERM） → 実体ファイルコピーにフォールバック

### ⚠️ 潜在的問題点

#### 問題11: symlinks.json のパス計算
`symlinks.json` の `target` フィールドはルートからの相対パスとして扱われる。
- 例: `{ "link": "docs/einja/steering/commit-rules.md", "target": "docs/einja/steering/commit-rules.md" }`
- 別プロジェクトでディレクトリ構造が異なる場合、リンク切れが発生

#### 問題12: Windows環境での制約
Windows環境ではシンボリックリンク作成に管理者権限が必要。
- フォールバックで実体ファイルをコピーするが、以降の同期で更新されない
- ユーザーへの明確な警告が不足

#### 問題13: 既存ファイル/ディレクトリの扱い
リンク元にファイルがある場合は削除するが、ディレクトリがある場合はエラーで停止。
- 初回init時に衝突する可能性

---

## 7. @einja:excluded マーカー

### 調査結果
コードベース内で `@einja:excluded` マーカーの処理実装は **見つかりませんでした**。

ただし、以下の箇所で使用されている形跡があります:
- `CLAUDE.md` (217-227行): `<!-- @einja:excluded:start -->` ... `<!-- @einja:excluded:end -->`
- MARKER_SPECIFICATION.md には記載なし

### ⚠️ 潜在的問題点

#### 問題14: @einja:excludedマーカーの未実装
`@einja:excluded` マーカーが CLAUDE.md で使用されているが、sync処理では認識・処理されていない。
- 意図としては「このセクションはテンプレート生成時に除外される」と推測されるが、実装がない
- テンプレート生成処理（`generateClaudeMd()`）でも処理されていない可能性

---

## 8. init コマンドとの関連

### ファイルパス
`packages/cli/src/commands/init.ts` (20-240行)

### init処理フロー

1. プリセット読み込み
2. 既存 `.claude` ディレクトリのバックアップ・削除
3. `.claude` ディレクトリ生成（`generateClaudeDirectory()`）
4. ドキュメントテンプレートコピー（`copyDocTemplates()`）
5. ステアリングドキュメントコピー（`copySteeringDocs()`）
6. CLAUDE.md生成（`generateClaudeMd()`）
7. **シンボリックリンク作成**（`createSymlinks()`）
8. `.mcp.json` セットアップ（`setupMcpConfig()`）
9. 依存関係チェック＋インストール

### ⚠️ 潜在的問題点

#### 問題15: init後の初回sync
`einja init` で生成されたファイルには `.einja/sync-metadata.json` が存在しない。
- 初回 `einja sync` 実行時にメタデータがないため、全ファイルが「新規」扱いになる
- ハッシュ不一致による意図しない上書きの可能性

#### 問題16: シンボリックリンクのメタデータ管理
シンボリックリンクで配置されたファイルは `sync` 時にどう扱われるか不明確。
- メタデータにリンク先のハッシュが記録されるのか、リンク元のハッシュが記録されるのか
- リンク先が更新された場合、syncで検出されるのか

---

## 想定通り動作しない可能性がある処理（優先度順）

### 🔴 高優先度（必ず確認すべき）

1. **カテゴリパス不一致** (問題1)
   - 別プロジェクトで `.claude/agents/einja` が存在しない場合、agents カテゴリが完全にスキップされる
   - **影響**: 必要なエージェント設定が同期されない

2. **einja-プレフィックス制約** (問題2)
   - カスタムスキル/エージェントが `einja-` プレフィックスなしの場合、スキャン対象外
   - **影響**: プロジェクト固有の設定が同期されない

3. **@einja:excludedマーカーの未実装** (問題14)
   - CLAUDE.md で使用されているが処理実装がない
   - **影響**: 意図しないセクションがテンプレートに含まれる可能性

4. **init後の初回sync** (問題15)
   - メタデータ未初期化のため、全ファイルが新規扱い
   - **影響**: ローカル変更が上書きされる可能性

5. **symlinks.json のパス計算** (問題11)
   - ディレクトリ構造が異なるプロジェクトでリンク切れ
   - **影響**: 必要なドキュメントが参照できない

### 🟡 中優先度（状況によって影響あり）

6. **マーカーバリデーション失敗時のフォールバック** (問題4)
   - エラー通知なしで3方向マージにフォールバック
   - **影響**: 意図しない上書き、デバッグ困難

7. **ID属性の厳格性** (問題5)
   - テンプレート側でID未付与の場合、検証エラー
   - **影響**: 初期セットアップの混乱

8. **孤児検出のカテゴリ推測失敗** (問題9)
   - カテゴリマッピング変更後、古いファイルが残り続ける
   - **影響**: ディスク容量の浪費、混乱

9. **Windows環境でのシンボリックリンク制約** (問題12)
   - 実体ファイルコピーにフォールバックするが、以降の同期で更新されない
   - **影響**: ドキュメントが古いまま

### 🟢 低優先度（稀なケース）

10. **project-privateセクションのID衝突** (問題7)
11. **project-privateセクションの削除** (問題8)
12. **孤児削除の確認プロンプト** (問題10)
13. **シンボリックリンクのメタデータ管理** (問題16)
14. **マーカー正規表現パターン** (問題6)
15. **シンボリックリンクの扱い** (問題3)
16. **既存ファイル/ディレクトリの衝突** (問題13)

---

## 推奨される対策

### 即座に対応すべき項目

1. **カテゴリパス検証機能の追加**
   - `FileFilter.scanSyncTargets()` 実行前に、カテゴリパスの存在確認
   - 存在しない場合は警告メッセージを表示

2. **@einja:excluded マーカーの実装確認**
   - `generateClaudeMd()` でマーカー処理が実装されているか確認
   - 未実装の場合は実装するか、マーカーを削除

3. **init コマンドでのメタデータ初期化**
   - `einja init` 完了時に `.einja/sync-metadata.json` を初期生成
   - ハッシュ値を記録して初回syncでの不一致を回避

4. **マーカーバリデーションエラーの通知**
   - `validateMarkers()` でエラーが発生した場合、ユーザーに明示的に通知
   - 3方向マージにフォールバックする前に警告を表示

### 中長期的に対応すべき項目

5. **einja-プレフィックス制約の緩和**
   - カテゴリごとにプレフィックスフィルタの有無を設定可能にする
   - プロジェクト固有のカテゴリ設定を `.einja/config.json` で管理

6. **Windows環境でのシンボリックリンク処理改善**
   - 実体ファイルコピー後も `sync` で更新を検出する仕組み
   - または、ディレクトリジャンクション（管理者権限不要）への切り替え

7. **孤児検出の改善**
   - カテゴリ推測失敗時も検出できるよう、メタデータにカテゴリ情報を保存

---

## まとめ

`einja sync` コマンドは堅牢なマーカーベースのマージシステムを持っていますが、以下の前提条件があります:

- テンプレートとプロジェクトのディレクトリ構造が一致している
- `einja-` プレフィックス規約に従っている
- マーカーが正しく設定されている

別プロジェクトで init/sync を実行する際は、これらの前提が満たされているか事前に確認する必要があります。

特に **カテゴリパス不一致**、**einja-プレフィックス制約**、**init後の初回sync** は高確率で問題になるため、優先的に対策することを推奨します。
