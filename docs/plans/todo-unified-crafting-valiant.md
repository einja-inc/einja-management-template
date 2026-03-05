# TODO: Skill命名規則の文書化 + 配布制御のプレフィックスベース化

## 進捗

| # | タスク | 担当 | 状態 |
|---|--------|------|------|
| 1 | einja-skill-creator/SKILL.md に命名規則セクション追加 | Agent-1 | ✅ |
| 2 | CLAUDE.md 更新（命名規則追加 + L139参照パス + L252注釈更新） | Agent-2 | ✅ |
| 3 | Skill name フィールド統一 + ディレクトリリネーム + 参照パス更新 | Agent-3 | ✅ |
| 4 | copy-presets.mjs + file-copier.ts のプレフィックスベース改修 | Agent-4 | ✅ |
| 5 | ビルド検証（`pnpm --filter @einja/dev-cli build`） | 親 | ✅ |
| 6 | 全体検証（`pnpm prepush`） | 親 | ✅ |
| + | 既存バグ修正: setup-flow.md マーカーバリデーションエラー | 親 | ✅ |
| 7 | Codexレビュー | codex-agent | ⏳ |

## 検証結果

- ビルド成功（`pnpm --filter @einja/dev-cli build`）
- `presets/default/.claude/skills/` に `_einja-*` 4個 + `einja-*` 15個が配布 ✅
- `cli-package-specs` は配布されていない ✅
- 旧ディレクトリ名の残留なし ✅
- `pnpm prepush` 全パス（lint + typecheck + test: 7 tasks successful）✅
- 参照パスの漏れなし ✅
