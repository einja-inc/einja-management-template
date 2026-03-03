# einja sync: 孤児ファイル検出・削除機能

## Context

`einja sync` はテンプレートからプロジェクトへファイルを同期するが、テンプレート側でファイルが削除されても利用者側のファイルはそのまま残る。`.einja-sync.json` に過去の同期記録があるため、「メタデータにあるがテンプレートにないファイル」＝孤児として検出可能。

## 方針

- `sync` 実行時に常に孤児を検出・警告表示
- `--clean` フラグで実際に削除（確認プロンプト + バックアップ付き）
- 既存のUXパターン（dry-run, JSON出力, --yes, --no-backup）に完全準拠

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/types/index.ts` | `SyncOptions` に `clean?: boolean` 追加 |
| `packages/cli/src/types/sync.ts` | `OrphanFile`, `OrphanReport` 型追加、`JsonOutput.summary` に `orphansDetected?`, `orphansDeleted?` 追加、`JsonOutput.orphans?` 追加 |
| `packages/cli/src/lib/sync/orphan-cleaner.ts` | **新規**: 孤児検出・レポート生成クラス |
| `packages/cli/src/lib/sync/metadata-manager.ts` | `removeFiles()` メソッド追加 |
| `packages/cli/src/commands/sync.ts` | 孤児検出→警告表示→`--clean`時の削除処理を統合 |
| `packages/cli/src/cli.ts` | `--clean` オプション追加 |
| `packages/cli/src/lib/sync/orphan-cleaner.test.ts` | **新規**: OrphanCleanerのユニットテスト |
| `packages/cli/src/lib/sync/metadata-manager.test.ts` | `removeFiles` テスト追加 |

## 実装ステップ

### Step 1: 型定義追加

**`types/index.ts`** — `SyncOptions` に追加:
```typescript
clean?: boolean;
```

**`types/sync.ts`** — 型追加:
```typescript
export interface OrphanFile {
  path: string;
  category: string | null;
  exists: boolean;  // ディスク上に実在するか
}

export interface OrphanReport {
  hasOrphans: boolean;
  orphans: OrphanFile[];
  total: number;
  existingCount: number;  // ディスク上に実在する数
}
```

`JsonOutput.summary` に `orphansDetected?`, `orphansDeleted?` を追加。`JsonOutput` に `orphans?: OrphanFile[]` を追加。

### Step 2: OrphanCleaner クラス（新規）

**`lib/sync/orphan-cleaner.ts`** — 既存の `ConflictReporter` と同じ設計パターン:

```typescript
export class OrphanCleaner {
  constructor(private projectRoot: string, private fileFilter: FileFilter) {}

  async detectOrphans(
    metadata: SyncMetadata,
    currentTemplateFiles: string[],
    categories?: string[]
  ): Promise<OrphanFile[]>
  // metadata.files のキー vs currentTemplateFiles を比較
  // カテゴリフィルタ: fileFilter.getCategoryFromPath() で判定
  // fs.pathExists でディスク実在チェック

  createReport(orphans: OrphanFile[]): OrphanReport

  formatReport(report: OrphanReport): string
  // 例: "  🗑️  .claude/skills/einja-old/SKILL.md (存在)"

  formatHelpMessage(): string
  // "💡 削除するには --clean オプションを使用してください"
}
```

### Step 3: MetadataManager 拡張

**`lib/sync/metadata-manager.ts`** に追加:
```typescript
removeFiles(metadata: SyncMetadata, filePaths: string[]): SyncMetadata
// metadata.files から指定パスのエントリを削除して返す
```

### Step 4: CLI オプション追加

**`cli.ts`** の sync コマンドに追加:
```typescript
.option("--clean", "テンプレートから削除されたファイル（孤児）を削除")
```

### Step 5: sync.ts への統合

既存フローへの挿入位置:

```
 1. メタデータ読み込み
 2. 同期対象スキャン (targets)
 3. 差分計算
 4. ★ 孤児検出（常に実行）
 5. dry-run モード
    - 既存の差分表示
    - ★ 孤児レポート表示
 6. 確認プロンプト
 7. バックアップ作成
 8. ファイルマージ処理
 9. ★ 孤児削除処理（--clean 時のみ）
    - 確認プロンプト（デフォルトNo、--yes でスキップ）
    - バックアップ作成
    - ファイル削除
    - メタデータから削除
10. メタデータ保存
11. 結果出力
    - ★ 孤児レポート（--clean 無しでも警告表示）
    - ★ JSON出力に orphans フィールド追加
12. 依存関係チェック
```

### Step 6: テスト

**orphan-cleaner.test.ts（新規）:**
- メタデータにあるがテンプレートにないファイルを検出
- カテゴリフィルタが正しく適用される
- ディスク実在チェックが正しい
- レポートフォーマットが正しい

**metadata-manager.test.ts（追加）:**
- `removeFiles` で複数ファイルが正しく削除される

## UX例

### 通常 sync（孤児あり、--clean なし）
```
✅ 同期完了!
  - 成功: 3ファイル
  - スキップ: 12ファイル

⚠️  孤児ファイルが検出されました:
  🗑️  .claude/skills/einja-old/SKILL.md
  🗑️  docs/einja/deprecated.md

💡 削除するには --clean オプションを使用してください
```

### `--clean` 実行時
```
⚠️  以下の孤児ファイルを削除します:
  🗑️  .claude/skills/einja-old/SKILL.md
  🗑️  docs/einja/deprecated.md

? 2ファイルを削除します。続行しますか? (y/N) y

  - 孤児削除: 2ファイル
```

## 検証方法

1. `pnpm -F @einja/dev-cli test` — 全テスト通過
2. `pnpm -F @einja/dev-cli typecheck` — 型チェック通過
3. `pnpm -F @einja/dev-cli lint` — lint通過
4. 手動テスト: `.einja-sync.json` に存在しないファイルエントリを追加 → `einja sync --dry-run` で孤児検出 → `einja sync --clean --yes` で削除確認
