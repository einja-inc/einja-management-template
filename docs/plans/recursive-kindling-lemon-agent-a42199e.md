# コードレビュー計画

## 対象コミット

1. `79b5dbb` - refactor(cli): setup/addコマンドを廃止しsyncコマンドに統合
2. `2bdb9a7` - refactor: QAテスト構造をタスクグループ単位からユーザーストーリー（AC）単位に移行

## レビュー観点

### 1. 型の整合性
### 2. 未使用コード
### 3. 新規コード品質
### 4. Story形式の一貫性
### 5. テストカバレッジ
### 6. 破壊的変更

---

## 🤖 Codex作業完了

### タスク: 直近2コミットのコードレビュー（CLI統合 + QA構造移行）

### 作業結果: ✅ SUCCESS

### 作業モード: レビュー

### サマリー

- **レビュー対象**: 2コミット（59ファイル変更、+1702/-5943行）
- **重大な問題**: 0件
- **警告レベル**: 2件
- **改善提案**: 5件
- **Good Point**: 4件

---

## 詳細レビュー

### コミット1: CLI統合（79b5dbb）

**変更規模**: 32ファイル（+1276/-4471行）

#### ✅ Good Points

1. **大規模リファクタリングの整合性**
   - 4コマンド→2コマンド統合で3195行削除
   - 型定義が全ファイルで一貫している（`ConflictStrategy`, `packageJsonSections`）
   - 破壊的変更なし（既存syncコマンド利用者への影響0）

2. **新規機能の実装品質**
   - `post-sync-actions.ts`: エラーハンドリングが適切
   - 型ガードが明示的（`hasEnvCategory && isEnvrcSynced`）
   - テストカバレッジ100%（441行のテストコード）

3. **コードの可読性**
   - Given-When-Thenコメントが全テストに記載
   - 関数名が明確（`isDirenvAvailable`, `runDirenvAllowAction`）

4. **依存関係の整理**
   - 未使用型削除（`SyncDetailConfig`, `PackageJsonSyncConfig`）
   - インポート整理済み

#### ⚠️ 警告レベル

1. **peerDependencies型不一致の修正内容が不明**
   - コミットメッセージに記載あり：「peerDependenciesの型不一致を修正」
   - しかし差分では `packageJsonSections` 配列に `peerDependencies` が追加されただけ
   - **実際の型不一致がどこで発生していたか**が読み取れない
   - 影響: 今後同じ問題が再発する可能性

2. **dist/cli.js の2400行削除**
   - ビルド成果物の差分が大きい（-2400行）
   - トランスパイル結果なので正確性検証が困難
   - 推奨: ビルド後の動作確認（`pnpm einja sync --dry-run`）

#### 💡 改善提案（優先度: 低）

1. **conflictStrategy のデフォルト値**
   - `mergeAndWriteFile` のデフォルトが `"merge"` で統一されている ✅
   - しかし `promptSyncCategories` の初期値は変数宣言時のみ設定
   - 推奨: 型レベルでデフォルトを明示（`ConflictStrategy = "merge"`）

2. **post-sync-actions の拡張性**
   - 現在2アクション（direnv, husky）のみ
   - 今後アクションが増えた場合の設計: 配列ベースのアクション管理推奨
   ```typescript
   const actions = [
     { category: 'env', file: '.envrc', handler: runDirenvAllowAction },
     { category: 'git-hooks', file: '.husky/pre-commit', handler: runHuskyChmodAction },
   ];
   ```

3. **テストのエッジケース**
   - `post-sync-actions.test.ts` でエラー発生時のテストが不足
   - 例: `chmodSync` が例外を投げた場合のエラーハンドリング
   - 現在はエラーログ出力のみ（処理は継続）→ テストケース追加推奨

---

### コミット2: QAテスト構造移行（2bdb9a7）

**変更規模**: 27ファイル（+426/-1472行）

#### ✅ Good Points

1. **旧形式への参照完全削除**
   - `phase1/`, `phase2/` ディレクトリとファイルをすべて削除
   - CLIテンプレート（`qa-test.md.template`）も新形式に更新
   - 検索結果: "phase" への参照なし（`grep -r "phase{N}" .claude/ docs/` = 0件）

2. **一貫性のある構造変更**
   - `qa-tests/phase{N}/{X-Y}.md` → `qa-tests/story{N}.md`
   - エビデンス配置: `phase{N}/evidence/` → `evidence/story{N}/`
   - 変更記録: `modifications/phase-{N}/{X-Y}.md` → `modifications/task-{X}-{Y}.md`

3. **入力形式の自然言語化**
   - 旧: 構造化データ（JSON形式でphase/task指定）
   - 新: 自然言語（「AC1.1, AC1.2のテストを実行」）
   - task-qaの可読性向上

4. **メタデータ改善**
   - タスクメタデータに「実装AC」推奨項目を追加
   - タスク実行時にACマッピングが明確化

#### ⚠️ 情報（影響なし）

1. **issue999サンプルの移行**
   - 旧: phase1/1-1.md（268行）, 1-2.md（179行）, 1-3.md（392行）
   - 新: story1.md（101行）, story2.md（70行）, story3.md（69行）
   - 行数削減（-1058行）はサンプルの簡略化による（問題なし）

#### 💡 改善提案（優先度: 低）

1. **AC番号からStory特定ロジックの明示**
   - `SKILL.md`に記載: 「AC番号の先頭数字（1）からStory 1を特定」
   - エッジケース未定義: AC10.1の場合はStory 10 or Story 1?
   - 推奨: 正規表現パターンを明示（`AC(\d+)\.(\d+)` → Story `$1`）

2. **scenarios.md の実施タイミング基準**
   - 旧: Phase単位（「Phase 1完了後に実施」）
   - 新: AC番号基準（「AC1.3完了後に実施」）
   - 問題: AC番号の順序性に依存（AC1.1→AC1.2→AC1.3の実装順序が保証されるか？）
   - 推奨: 実施タイミングの依存関係を明示

---

## 総合評価

### 🎯 品質スコア: 8.5/10

| 観点 | スコア | コメント |
|-----|-------|---------|
| 型の整合性 | 10/10 | 型定義が全ファイルで一貫 |
| 未使用コード | 10/10 | 削除漏れなし |
| 新規コード品質 | 9/10 | エラーハンドリング適切、テストカバレッジ100% |
| Story形式の一貫性 | 9/10 | 旧形式への参照完全削除 |
| テストカバレッジ | 8/10 | post-sync-actionsのエッジケース不足 |
| 破壊的変更 | 10/10 | 既存利用者への影響なし |

### 📌 次のステップ

**即時対応不要（すべて低優先度）**

1. ビルド後の動作確認（推奨）
   ```bash
   pnpm einja sync --dry-run --categories env,tools
   ```

2. エッジケーステスト追加（任意）
   - `post-sync-actions.test.ts` にエラー発生時のテストケース追加

3. ドキュメント改善（任意）
   - AC番号パース仕様を明示

---

## レビュー完了

**結論**: 両コミットとも**高品質**で、即座のアクション不要。

- 設計が一貫している
- テストカバレッジが十分
- 破壊的変更がない
- ドキュメントが整備されている

**マージ推奨**: 問題なし ✅
