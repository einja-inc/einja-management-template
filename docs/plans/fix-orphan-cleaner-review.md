# Codexレビュー指摘修正: orphan-cleaner

## 修正対象: High 2件

### Fix 1: パストラバーサル脆弱性
**箇所**: `packages/cli/src/commands/sync.ts` 孤児削除処理部分
**修正**: 孤児ファイル削除前にパス検証関数を追加
- `path.normalize` で正規化
- `..` を含むパスを拒否
- 絶対パスを拒否
- 解決後パスがプロジェクトルート配下か検証
- OrphanCleaner.detectOrphans() 内でも検証（検出段階でフィルタ）

### Fix 2: 変更ファイル0件時に孤児削除に到達しない
**箇所**: `packages/cli/src/commands/sync.ts:161-163`
**修正**: 早期return条件に `orphanReport.hasOrphans` を追加
- 孤児検出を早期returnの前に移動
- `filesToProcess.length === 0 && !orphanReport.hasOrphans` の場合のみreturn
- 変更なし＋孤児ありの場合はレポート表示/削除処理へ進む

## 実装ステップ
1. orphan-cleaner.ts にパス検証を追加（detectOrphans内）
2. sync.ts の早期return修正 + 削除処理にもパス検証ガード追加
3. orphan-cleaner.test.ts にパストラバーサルテスト追加
4. typecheck + test 実行
