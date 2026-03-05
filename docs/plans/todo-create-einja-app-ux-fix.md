# TODO: create-einja-app 利用者体験の改善

## 進捗

| # | タスク | 状態 | 担当 |
|---|--------|------|------|
| 1 | template.ts に `.sh` ファイルの実行権限付与処理を追加 | ✅ 完了 | sub-agent-1 |
| 2 | init.sh から `pnpm install` を削除（2ファイル） | ✅ 完了 | sub-agent-2 |
| 3 | README にトラブルシューティング項目を追加 | ✅ 完了 | sub-agent-3 |
| 4 | テストのモック順修正 | ✅ 完了 | sub-agent-4 |
| 5 | 検証（テスト・lint・typecheck） | ✅ 完了 | 親エージェント |

## 検証結果
- `pnpm -F create-einja-app test`: 108テスト全パス
- `pnpm prepush`: lint + typecheck + test 全7タスク成功
- テンプレート `templates/default/` は `.gitignore` 管理。ビルド時に `scripts/init.sh` から自動生成
