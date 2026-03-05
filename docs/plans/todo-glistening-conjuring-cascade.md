# TODO: JSON 配布メカニズムの統一実装

## Phase 1（並列実行）

- [x] **TG-A**: コアSync Engine（Steps 0+2+4: 型定義 + JsonProcessor全面改修 + MetadataManager更新）
- [x] **TG-B**: copy-presets.mjs（Step 5: package.jsonフルコピー + テンプレートscripts同期）
- [x] **TG-C**: file-filter.ts（Step 6: root-config + claude-configカテゴリ追加）

## Phase 2（TG-A完了後）

- [x] **TG-D**: sync.ts変更（Steps 1+3: fileName→フルパス + JSON処理フロー変更）

## Phase 3（コード変更完了後、並列）

- [x] **TG-E**: ドキュメント更新（Step 7: setup-flow.md, SKILL.md, CLAUDE.md）
- [x] **TG-F**: JsonProcessorユニットテスト作成（バグ修正含む）

## Phase 4

- [x] **検証**: ビルド・テスト・prepush（全パス: 607 tests, 29 files, 7 turbo tasks）
