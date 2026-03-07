# einja-issue-spec-create 改善 & Skillリネーム

## Context

`einja-issue-spec-create` Skillの前提確認フェーズ（質問1〜3）にユーザビリティの問題がある。
- 質問1（TDD適用）: 原則TDDで統一すべき。毎回聞く必要なし
- 質問2（要件明確さ）: 不明確前提で都度質問する方針に統一すべき。毎回聞く必要なし
- 質問3（Issueブランチ作成元）: ワークツリーでの作業に切り替えたい

また `einja-issue-spec-generator` / `einja-issue-spec-validator` は「タスク生成/検証」を行うSkillだが、名前に `tasks` が含まれておらず不明瞭。

## 変更内容

### TODO-1: einja-issue-spec-create の前提確認フェーズ改善

**対象ファイル**: `.claude/skills/einja-issue-spec-create/SKILL.md`

#### 1.1 質問1（TDD）を削除し、原則TDD方針に変更
- セクション `0.1 TDD適用判定`（L31-54）を書き換え
- 質問・AskUserQuestion定義を削除
- 「原則TDD（テスト駆動開発）を適用する。タスクグループ・タスク作成時にTDDプロセスを徹底すること」に置き換え

#### 1.2 質問2（要件明確さ）を削除し、不明点は都度質問方針に変更
- セクション `0.2 要件明確さ確認`（L56-82）を書き換え
- 質問・AskUserQuestion定義を削除
- 「要件は不明確な前提で進める。不明点は作業中にAskUserQuestionで都度確認すること」に置き換え

#### 1.3 質問3（Issueブランチ作成元）をワークツリー方式に変更
- セクション `0.3 IssueBranchBaseの選択`（L84-104）を書き換え
- IssueBranchBaseの質問は残す（ブランチ作成元は要確認のため）
- 質問後に `EnterWorktree` でワークツリーを作成する手順を追加:
  1. `EnterWorktree` でワークツリー作成（名前: `issue-{issue番号}`）
     - `.claude/worktrees/` 配下に作成される（issue-execの `~/.einja/worktrees/` とは競合しない）
  2. ワークツリー内でIssueブランチ（`issue/{issue番号}`）を作成・チェックアウト
  3. 以降のPhase 1〜5はすべてワークツリー内で作業

#### 1.4 Phase 1〜5のコミット・プッシュ処理の調整
- 各Phaseの「コミット＆プッシュ」処理はワークツリー内での操作となるが、git操作自体は変更不要（ワークツリー内のgitは元リポジトリと同じリモートを参照）
- L142: ローカルでのチェックアウト処理 → ワークツリー作成後にブランチ作成する手順に変更
- L269-278（Phase 5）: ブランチ作成処理 → 「0.3で既にワークツリー内にブランチ作成済み」に変更し、重複作成を削除

### TODO-2: Skillディレクトリのリネーム

| 現在 | 変更後 |
|------|--------|
| `.claude/skills/einja-issue-spec-generator/` | `.claude/skills/einja-issue-spec-tasks-generator/` |
| `.claude/skills/einja-issue-spec-validator/` | `.claude/skills/einja-issue-spec-tasks-validator/` |

操作: `git mv` でディレクトリをリネーム

### TODO-3: リネームに伴う参照更新

以下のファイル内のSkillパス参照を更新:

| ファイル | 更新内容 |
|---------|---------|
| `.claude/agents/einja/issue-specs/tasks-generator.md` L30 | `einja-issue-spec-generator` → `einja-issue-spec-tasks-generator` |
| `.claude/agents/einja/issue-specs/tasks-validator.md` L18,83,149 | `einja-issue-spec-validator` → `einja-issue-spec-tasks-validator` |
| `.claude/skills/einja-issue-spec-tasks-generator/SKILL.md` L101 | 自己参照パス更新 |
| `.claude/skills/einja-issue-spec-tasks-validator/SKILL.md` L126 | 自己参照パス更新 |

※ `einja-issue-spec-create/SKILL.md` 内の `tasks-generator` / `tasks-validator` はエージェント名での参照であり、Skillパスは含まれていないため変更不要
※ `sync-cursor-commands.md` にリネーム対象への参照なし（確認済み）
※ マーカーID（`@einja:project-private` の `id=`）はビルドに影響しないが、一貫性のためリネームに合わせて更新する

## 並行実行の方針

TODO-1（SKILL.md改善）とTODO-2+3（リネーム＆参照更新）は独立しているため、サブエージェント2つに並行委託可能。

## 対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `.claude/skills/einja-issue-spec-create/SKILL.md` | 編集（質問1-3改善、ワークツリー対応） |
| `.claude/skills/einja-issue-spec-generator/` | `git mv` → `einja-issue-spec-tasks-generator/` |
| `.claude/skills/einja-issue-spec-validator/` | `git mv` → `einja-issue-spec-tasks-validator/` |
| `.claude/skills/einja-issue-spec-tasks-generator/SKILL.md` | 自己参照パス更新 |
| `.claude/skills/einja-issue-spec-tasks-validator/SKILL.md` | 自己参照パス更新 |
| `.claude/agents/einja/issue-specs/tasks-generator.md` | Skillパス参照更新 |
| `.claude/agents/einja/issue-specs/tasks-validator.md` | Skillパス参照更新 |

## 検証

1. `git mv` 後のディレクトリ構成が正しいこと
2. 全参照パスが新しいSkill名に更新されていること（grepで旧名が残っていないか確認）
3. `einja-issue-spec-create/SKILL.md` から質問1・2が削除され、TDD原則・都度質問方針が記述されていること
4. ワークツリー関連の記述が追加されていること
