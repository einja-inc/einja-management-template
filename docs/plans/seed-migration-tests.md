# Plan: seed → project-private 変換テスト追加

## 目的
`@einja:seed` → `@einja:project-private` 変換が正しく動作することを単体テストで保証する。

## テスト一覧

### Group A: marker-processor.test.ts（#1, #2, #9）

| # | テスト | ケース |
|---|--------|--------|
| 1 | `parseMarkers()` legacy seed認識 | Markdown legacy seed → type: "project-private" で返る |
| 1 | `parseMarkers()` legacy seed認識 | YAML legacy seed → type: "project-private" で返る |
| 1 | `parseMarkers()` legacy seed認識 | legacy seed + managed混在 → 両方正しくパース |
| 1 | `parseMarkers()` legacy seed認識 | legacy seed ID属性保持 |
| 2 | `migrateLegacySeedMarkers()` 詳細 | managed + seed混在 → seedのみ変換、managedはそのまま |
| 2 | `migrateLegacySeedMarkers()` 詳細 | YAML形式のseed → 変換 |
| 2 | `migrateLegacySeedMarkers()` 詳細 | 空seedセクション（マーカーペアのみ） |
| 2 | `migrateLegacySeedMarkers()` 詳細 | 複数seedマーカー → すべて変換 |
| 2 | `migrateLegacySeedMarkers()` 詳細 | ID属性を含むseed → ID保持して変換 |
| 9 | `validateMarkers()` legacy seed | legacy seedでID欠落 → エラー検出 |
| 9 | `validateMarkers()` legacy seed | legacy seedのネスト → エラー検出 |

### Group B: project-private-synchronizer.test.ts（#3, #4）

| # | テスト | ケース |
|---|--------|--------|
| 3 | `syncProjectPrivateSections()` legacy | ローカルがlegacy seed → ID認識して重複追加しない |
| 3 | `syncProjectPrivateSections()` legacy | ローカルがlegacy seed + テンプレートが新規PP → 新規のみ追加 |
| 4 | `syncProjectPrivateOnlyFile()` legacy | legacy seedファイル → PP抽出・本文マージ・PP再付加が動く |
| 4 | `syncProjectPrivateOnlyFile()` legacy | legacy seedの空セクション → 存在扱い（テンプレートでseedしない） |

### Group C: integration.test.ts（#6, #7, #8）

| # | テスト | ケース |
|---|--------|--------|
| 6 | E2Eマイグレーション | legacy seed入力 → migrateLegacySeedMarkers → parseMarkers → replaceManaged → 正常出力 |
| 6 | E2Eマイグレーション | legacy seed + managed混在 → マイグレーション後にmanaged置換 + PP保持 |
| 6 | E2Eマイグレーション | legacy seed（managedなし）→ マイグレーション後に3方向マージ + PP保持 |
| 7 | hasMarkers() | `@einja:seed:start` を含む → true |
| 7 | hasMarkers() | `@einja:project-private:start` を含む → true |
| 7 | hasMarkers() | マーカーなし → false |
| 8 | validateMarkers() + migration | legacy seed → マイグレーション → バリデーション通過 |

## 実装方針
- 既存テストファイルにdescribeブロックを追加（新規ファイルは作らない）
- Group A, B, Cを並行で実装可能（ファイルが異なる）
