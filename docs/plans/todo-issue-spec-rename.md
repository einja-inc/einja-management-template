# TODO: task-spec → issue-spec リネーム + コマンド→Skill移行

## Phase 1: ファイル移動・作成

- [x] TG-1.1: エージェントディレクトリ移動+ファイルリネーム
- [x] TG-1.2: スキルディレクトリリネーム
- [x] TG-1.3: spec-create → einja-issue-spec-create Skill移行
- [x] TG-1.4: task-exec → einja-task-exec Skill移行
- [x] TG-1.5: update-docs-by-task-specs リネーム

## Phase 2: 参照更新

- [x] TG-2.1: エージェント内部参照更新（10ファイル）
- [x] TG-2.2: スキル内部参照更新（9ファイル）
- [x] TG-2.3: コマンド/設定ファイル参照更新（4ファイル）
- [x] TG-2.4: docs/einja/ 参照更新（5ファイル）
- [x] TG-2.5: CLAUDE.md + README.md 更新

## Phase 3: 検証

- [x] TG-3.1: 参照整合性チェック（旧パス残存ゼロ確認、1箇所修正）
- [x] TG-3.2: pnpm prepush 通過確認
- [x] TG-3.2: .cursor/commands/ 旧ファイル手動削除
- [ ] TG-3.2: sync-cursor-commands 再生成（コミット後に実行推奨）
