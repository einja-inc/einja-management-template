# TODO: direnvハング修正 + 秘密鍵ローテーション自動化

## 進捗

| TODO | 内容 | 担当 | 状態 |
|------|------|------|------|
| TODO-1 | ensure-serena.sh: lsof → nc -z | Agent-A | ✅ 完了 |
| TODO-2 | env-rotate-secrets.ts: 非対話モード追加 | Agent-B | ✅ 完了 |
| TODO-3 | post-setup.ts: 処理順序変更 + 自動ローテーション | Agent-C | ✅ 完了 |
| TODO-4 | .gitignore: .bak パターン追加 | Agent-C | ✅ 完了 |
| 検証 | prepush (lint + typecheck + test) | 親 | ✅ 全パス |
| 検証 | git diff 確認 | 親 | ✅ 意図通り |
