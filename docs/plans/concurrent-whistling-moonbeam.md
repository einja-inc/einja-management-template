# Plan: 完了レビューの自動化ルール追加

## Context

タスク完了時に完了レビューが未実施の場合、汎用レビューSkillとcodex-agentを並行で呼び出してレビューするルールを追加する。現状の「完了判定の基準」セクションには必須チェック項目はあるが、サブエージェントによるレビュープロセスが定義されていない。

既存の `task-reviewer` は `task-exec` フローに強く依存しているため、汎用的な `einja-review-code` Skillを新規作成し、task-exec外でも利用可能にする。

## 変更内容

### 1. 新規Skill作成: `einja-review-code`

**ファイル**: `.claude/skills/einja-review-code/SKILL.md`

**役割**: コード変更の品質レビューを実施する汎用Skill

**設計方針**: レビュー観点・チェックリストをSkill内で定義し、無名サブエージェントにプロンプトとして渡す。codex-agentは既存エージェント定義を活用。2つのレビュアーで多角的レビューを実施する。

**処理フロー**:
1. 変更内容の把握（`git diff --stat` + `git diff` で変更ファイル・差分を取得）
2. サブエージェントを**並行で**呼び出し:
   - **無名レビューサブエージェント（Agent general-purpose）**【必須】: Skill内で定義されたレビュー観点に基づくレビュー
     - 観点A: プロジェクト規約準拠（`docs/einja/steering/development/coding-standards.md` 参照）
     - 観点B: 設計パターン整合性・型安全性
     - 観点C: 影響範囲・副作用の確認
     - 観点D: セキュリティ・パフォーマンス
   - **codex-agent**【Codex MCP有効時のみ】: Codex MCPを活用したレビュー（レビューモード）
     - コード品質・ベストプラクティス・潜在的問題の検出
     - Codex MCP（`mcp__codex__codex`）が利用可能か確認してから呼び出す
     - 利用不可の場合はスキップ（無名サブエージェントのみでレビュー）
3. レビュー結果を統合し、判定を返却:
   - **PASS**: 指摘なし → 完了判定に進む
   - **MINOR**: 軽微な指摘あり → 修正後、再レビュー不要
   - **MAJOR**: 設計レベルの問題 → ユーザーに報告、再計画
   - **統合ルール**: いずれかのレビューでMAJOR判定 → 全体MAJOR

**スキップ条件**（呼び出し元の親エージェントが判断）:
- task-exec経由での実行（task-reviewerが既に担当）
- 読み取り専用の作業（コード変更なし）

**依存関係**:
- `codex-agent` エージェント定義（`.claude/agents/einja/codex-agent.md`）— Codex MCP有効時のみ使用
- Codex MCP（`mcp__codex__codex`）— オプショナル。利用不可時はcodex-agentの呼び出しをスキップ

**参考にする既存ファイル**:
- `.claude/agents/einja/codex-agent.md` - codex-agentのエージェント定義
- `.claude/skills/einja-task-exec/SKILL.md` L198-202 - task-reviewerの既存フロー（参考）
- `.claude/skills/einja-task-qa/SKILL.md` - QA Skillの構造（参考）

### 2. CLAUDE.md 更新

**ファイル**: `CLAUDE.md`

#### 2a. 「完了判定の基準」セクション（L216付近）に「完了レビュー」追加

「必須チェック」の前に追加:

```markdown
### 完了レビュー

コード変更を伴うタスクが完了した時点で、以下のいずれにも該当しない場合は `einja-review-code` Skillを呼び出してレビューを実施する。

- **スキップ条件**: task-exec経由での実行（task-reviewerが既に担当）
- **スキップ条件**: 読み取り専用の作業（コード変更なし）

Skill内でレビュー用サブエージェントを呼び出す（Codex MCP有効時は `codex-agent` も並行で呼び出す）。MAJOR判定の場合はユーザーに報告し、修正方針を確認する。
```

#### 2b. 「Skill・コマンド（直接呼び出し）」テーブル（L36-47）に追加

```markdown
| `einja-review-code` | コード変更の完了レビュー（レビューサブエージェント + codex-agent並行） |
```

## 検証方法

- CLAUDE.md の該当セクションを Read で確認し、構造・記述が正しいことを検証
- 新規Skill SKILL.md の内容を Read で確認
- `pnpm prepush` でlint/typecheck通過を確認（mdファイルのみの変更なので影響なし）
