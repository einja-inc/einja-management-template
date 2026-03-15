# einja-issue-exec 構造簡素化・フォールバック追加

## Context

`einja-issue-exec`の構造を改修する:
- 3階層→2階層に簡素化 + tmuxなし時Agent toolフォールバック

**動機**: Director層は不要（ManagerがPhase管理+Worker並列起動を直接行える）。tmux未使用時の「停止して案内」は不便なのでAgent toolで自動フォールバック。

**スコープ外**: einja-issue-team-exec は今回の改修対象外。

## 現状

### einja-issue-exec
- 3階層: Manager → Director(Phase単位) → Worker(tmux window + claude)
- tmux必須。未インストール/セッション外 → 停止
- Director責務: spec事前チェック、DAG解析、ゲートチェック、Workerリトライ、質問対応
- worktree: `~/.einja/worktrees/issue-{N}/`（manager/, phase{M}/, task-{X.Y}/）

### 改修後の実行モード

| 環境 | einja-issue-exec |
|------|-----------------|
| tmuxセッション内 | tmux window Worker（可視性あり） |
| tmuxセッション外 | Agent tool Worker（自動フォールバック） |

## 変更内容

### 1. einja-issue-exec SKILL.md

#### 1.1 3階層→2階層
- Director層を廃止。Managerに以下を吸収:
  - spec事前一括チェック → Phase開始前にManager実施
  - 依存DAG解析 → Issueパース時にManager実施
  - ゲートチェック（Fast/Risk Gate） → Worker完了検知時にManager直接実施
  - Workerリトライ → Manager直接実施
  - 質問対応 → Worker→Manager→Human（1段階エスカレーション）
- Phase worktree（旧Director用）を廃止
- Step 4-5をWorker直接起動に変更
- Step 6の監視対象をDirector→Workerに変更

#### 1.2 tmuxなしフォールバック
- Step 0での判定:
  1. `echo $TMUX` → tmuxセッション内 → tmuxモード
  2. セッション外 → Agent toolモード（現在の「停止」→自動フォールバック）
- tmuxモード: 現行通りtmux windowでWorker起動（Managerから直接）
- Agent toolモード: Agent tool（`isolation: "worktree"`）でWorker起動
  - 並列起動は1メッセージ内で複数Agent tool呼び出し
  - **並列度上限**: `poolSize = min(同一Layer内タスクグループ数, 5)`（Agent Teams版と同じ制御）

##### Agent toolモード時の詳細設計

**ブランチ作成**: Managerが Agent tool 起動**前に**明示的にブランチを作成する
```bash
git branch task/{N}-{X.Y} issue/{N}-phase{M}  # ブランチ契約を維持
```
Agent tool の `isolation: "worktree"` は worktree 作成のみを担い、ブランチは Manager が事前作成したものを使用。

**監視・完了検知**: Agent tool は完了時に結果を返すため、tmuxのようなポーリング不要。
- 成功: Agent tool 戻り値からWorker結果を取得
- 失敗: Agent tool エラー応答 → Managerがリトライ判定（上限はprotocol.mdに従う）
- 質問: PENDING_QUESTIONS が戻り値に含まれる → Managerが処理

**Step 6（監視ループ）のモード別動作**:
| 観点 | tmuxモード | Agent toolモード |
|------|-----------|-----------------|
| Worker起動 | tmux new-window + claude + send-keys | Agent tool（isolation: "worktree"） |
| 完了検知 | ステータスファイル + tmux list-windows（30秒ポーリング） | Agent tool 戻り値（同期的） |
| 異常検知 | tmux window消失 | Agent tool エラー応答 |
| リトライ | tmux new-window で再起動 | Agent tool 再呼び出し |
| 質問処理 | ステータスファイル questions/ | PENDING_QUESTIONS in 戻り値 |

#### 1.3 worktree構造変更
```
旧: ~/.einja/worktrees/issue-{N}/manager/, phase{M}/, task-{X.Y}/
新: ~/.einja/worktrees/issue-{N}/manager/, task-{X.Y}/
```
- tmuxモード: Managerが明示的にworktree作成（`git worktree add`）
- Agent toolモード: `isolation: "worktree"` に委譲。ただしブランチはManager事前作成

#### 1.4 description更新
```
旧: "Manager→Director→Workerの3階層でtmux+worktreeを使用"
新: "Manager→Workerの2階層でIssueの全タスクを並列実行。tmux環境ではtmux windowで可視化、tmuxなし環境ではAgent toolで自動フォールバック"
```

### 2. issue-exec-protocol.md

- セクション1.2: ロールマッピング更新（einja-issue-execのDirector廃止を反映）
- セクション1.3: 責務差分テーブル更新（einja-issue-execのDirector→Manager直接）
- セクション11.1: エスカレーションチェーン更新
  - einja-issue-exec: `Worker → Director → Manager → Human` → `Worker → Manager → Human`
  - einja-issue-team-execは今回変更なし
- ステータス定義: `awaiting_review`の説明にeinja-issue-exec 2階層化を反映
- **注意**: `directorVerdict`フィールド名は変更しない（einja-task-exec Step 8がこのフィールド名をポーリングしており、書き込み元がDirectorかManagerかは区別しないため後方互換）

### 3. branch-strategy.md

- Phase worktree廃止を反映
- タスクブランチ作成の実行者: Director→Manager

### 4. task-management.md

- コマンドリファレンスのeinja-issue-exec説明文を2階層に更新

## 対象ファイル

| ファイル | 変更規模 |
|---------|---------|
| `.claude/skills/einja-issue-exec/SKILL.md` | 大 |
| `docs/einja/instructions/issue-exec-protocol.md` | 小 |
| `docs/einja/steering/branch-strategy.md` | 小 |
| `docs/einja/steering/task-management.md` | 軽微 |

## タスク概要

| ID | 内容 | 依存 | サブエージェント |
|----|------|------|----------------|
| 0-0 | TaskCreateでタスク登録 | - | - |
| 0-1 | Planファイルリネーム → `docs/plans/202603/20260316-issue-exec-simplify.plan.md` [Bash] | - | - |
| 1-1 | einja-issue-exec SKILL.md 改修（2階層化+フォールバック） [general-purpose] | 0-1 | general-purpose |
| 2-1 | issue-exec-protocol.md 更新 [general-purpose] | 1-1 | general-purpose |
| 2-2 | branch-strategy.md 更新 [general-purpose] | 1-1 | general-purpose |
| 2-3 | task-management.md 更新 [general-purpose] | 1-1 | general-purpose |
| 99-1 | 観点別並列コードレビュー [einja-review-code] | 2-1, 2-2, 2-3 | einja-review-code |
| 99-G | コミット承認ゲート [AskUserQuestion] | 99-1 | - |
| 99-3 | コミット・プッシュ [einja-task-commit] | 99-G | einja-task-commit |

## 並列実行計画

```
Phase 1: 1-1（einja-issue-exec SKILL.md改修）
Phase 2（1-1完了後、並列）: 2-1 ←→ 2-2 ←→ 2-3
Phase 3（順次）: 99-1 → 99-G → 99-3
```

## リスク・不明点

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Agent toolフォールバック時の並列Worker起動 | 中 | 1メッセージ内複数Agent tool呼び出しで並列化。poolSize上限5で制御 |
| einja-task-exec Step 8（Director承認待ち）が2階層化で影響 | 中 | ManagerがdirectorVerdictフィールドに書き込みを直接実施。task-exec側はフィールド名のポーリングのみで書き込み元を区別しないため変更不要 |
| session.json構造変更による既存セッション復旧への影響 | 低 | executionModeフィールド追加のみ。未指定時は"tmux"デフォルト。旧セッション読み込み時はexecutionMode欠落を"tmux"として扱う |
| Agent tool `isolation: "worktree"` の動作制約 | 中 | worktree自動作成はAgent toolに委譲するが、ブランチはManager事前作成で契約を維持。isolation: "worktree"が利用不可の場合、手動worktree作成+通常Agent toolにフォールバック |
| protocol.md のDirector参照箇所が広範 | 中 | タスク2-1でprotocol.md全体をgrepし、Director責務記述を網羅的に更新。directorVerdictフィールド名は維持（後方互換） |

## 検証・動作確認方法

1. **YAML frontmatter検証**: 各SKILL.mdのname/description/allowed-toolsが正しいこと
2. **整合性検証**: protocol.md/branch-strategy.md/task-management.mdがSKILL.mdと矛盾しないこと
3. **フォールバック判定ロジック**: Step 0が全環境パターンをカバーしていること
4. **旧Director責務の移行漏れチェック**: 5責務全てがManagerに記述されていること
5. **grep検証**: 全対象ファイルから旧3階層表現（"Director"の責務記述、"3階層"等）が適切に更新されていること
