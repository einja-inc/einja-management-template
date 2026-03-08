# Plan: einja-issue-team-exec Skill 新規作成

## Context

現行の `einja-issue-exec`（`.claude/skills/einja-issue-exec/SKILL.md`）は tmux + git worktree + claude CLI起動に依存しており、CLI環境専用。Agent Teams を活用すれば、tmux不要で多環境対応（Desktop含む）が可能。

**設計原則**:
1. **共通3ロール体制**: Manager→Director→Worker の3ロール体制は両方式で共通。ロール定義・責務は `issue-exec-protocol.md` に一元化
2. **共通ルール**: ブランチ運用・タスク進行・ゲートチェック・ステータス遷移は開発組織として共通
3. **差分は実行方式のみ**: tmux+worktree vs Agent Teams（TeamCreate/SendMessage/TaskList）

### 調査結果の要点
- **Agent Teams on Desktop**: 公式ドキュメントはCLI中心の記述だが、settings.json有効化でDesktop Codeタブでも動作するユーザー事例が多数確認
- **サブエージェントのネスト不可**: 公式ドキュメントで明記。3階層はサブエージェントでは実現不可
- **Agent Teams**: Lead→Teammates のフラット構造。shared TaskList + 依存関係 + self-claim で Phase 順序制御が自然に実現

## 共通ルール vs 実行方式固有の整理

### 既存の共通ルール（両Skillが参照）

| ドキュメント | 内容 | 変更要否 |
|------------|------|---------|
| `docs/einja/steering/branch-strategy.md` | ブランチ命名規則・階層・マージ戦略 | **要修正**: `einja-issue-exec実行時のブランチ運用` セクションのtmux/worktree固有記述を分離 |
| `docs/einja/steering/task-management.md` | タスク階層・ATDD原則・依存関係記述 | 変更なし（完全に共通） |
| `docs/einja/steering/development-workflow.md` | 開発ワークフロー全体 | 軽微更新（issue-team-exec への言及追加） |
| `docs/einja/steering/commit-rules.md` | コミットルール | 変更なし |
| `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | AC・QAガイド | 変更なし |

### 実行方式固有（各Skill/Command内に記述）

| 方式 | ファイル | 固有内容 |
|------|---------|---------|
| tmux版 | `.claude/commands/einja/issue-exec.md` + `docs/einja/instructions/issue-exec-workflow.md` | tmuxセッション管理、worktreeパス管理、ステータスファイルポーリング、Manager→Director→Worker 3階層 |
| Agent Teams版 | `.claude/skills/einja-issue-team-exec/SKILL.md`（新規） | TeamCreate/SendMessage、共有TaskList、Director Teammateプール、self-claim回転、ポーリングマージ検知 |

## 体制設計（共通ロール定義）

### 3ロール体制

issue-exec / issue-team-exec ともに同じ3ロール体制を採用する。責務は共通、実行方式のみ異なる。

| ロール | 責務（共通） | 管理単位 |
|--------|-------------|----------|
| **Manager** | Issue全体の管理。Phase管理、ブランチ作成、タスクグループのDirectorへの割り振り、Phase間マージ、質問エスカレーション（対人間）、エラー監視 | Issue全体 |
| **Director** | タスクグループの進行管理。タスクグループ内の各タスクを複数 Worker で協力して進行するよう導く。einja-task-exec 実行、PR作成、完了報告 | タスクグループ（X.Y）1つ |
| **Worker** | 個別タスク（X.Y.Z）の実装。Director内のサブエージェントとして動作（task-executer, task-reviewer, task-qa） | タスク（X.Y.Z）1つ |

**方式別の責務差分**:

| 責務 | tmux版の実行者 | Agent Teams版の実行者 |
|------|--------------|---------------------|
| 成果物ゲートチェック（Fast Gate / Risk Gate） | Director（Phase内の全タスクを一元チェック） | Lead = Manager（Director 完了報告受信時にチェック） |
| spec事前一括チェック | Director | Lead = Manager |
| 依存DAG解析・Layer分け | Director | Lead = Manager（TaskList + addBlockedBy で表現） |
| Worker異常終了リトライ | Director（最大2回） | Lead = Manager（Teammate idle 検知時） |

### 実行方式別のロールマッピング

| ロール | tmux版（issue-exec） | Agent Teams版（issue-team-exec） |
|--------|---------------------|--------------------------------|
| **Manager** | Claude Code カスタムコマンド（メインプロセス） | **Lead**（Agent Teams リーダー） |
| **Director** | tmux window + claude 対話モード（Phase単位で1名、Phase内の全タスクグループを管理） | **Teammate**（タスクグループ単位で1名spawn） |
| **Worker** | tmux window + einja-task-exec（タスクグループ単位で1名） | **Subagent**（Director teammate 内の Agent tool） |

### tmux版の体制図

```
Manager (Claude Code: /einja-issue-exec)
│  メインリポ or Issue worktree
│
├── Director Phase1 (tmux window, claude 対話モード)
│   │  Phase worktree 上で動作
│   │  Phase1内の全タスクグループを管理
│   │
│   ├── Worker 1.1 (tmux window, claude 対話モード)
│   │   Task worktree 上で einja-task-exec 実行
│   │     ├── Subagent: task-executer (Task 1.1.1, 1.1.2...)
│   │     ├── Subagent: task-reviewer
│   │     └── Subagent: task-qa
│   │
│   ├── Worker 1.2 (tmux window)
│   │   └── einja-task-exec 実行
│   │
│   └── (依存タスクグループは先行完了後に起動)
│
└── Director Phase2 (Phase1完了後に起動)
    └── ...
```

**特徴**: Director が Phase 単位で1名。1つのDirectorが Phase 内の複数タスクグループの Worker を管理。

### Agent Teams版の体制図（ワーカープール方式）

```
Lead = Manager (einja-issue-team-exec Skill)
│  Issue全体管理、Phase管理、ブランチ作成
│  固定プール: min(タスクグループ総数, 5) 名の Director Teammate を spawn
│
│  Director Pool（TaskList から self-claim で回転）
│  ┌─────────────────────────────────────────────────┐
│  │                                                 │
│  ├── Director-A: 1.1 claim → 完了 → 1.4 claim → ...
│  │   └── einja-task-exec 実行
│  │       ├── Subagent: task-executer (並列実装)
│  │       ├── Subagent: task-reviewer
│  │       └── Subagent: task-qa
│  │
│  ├── Director-B: 1.2 claim → 完了 → 1.5 claim → ...
│  │   └── einja-task-exec 実行 → Worker サブエージェント
│  │
│  ├── Director-C: 1.3 claim → 完了 → (blocked待ち) → 2.1 claim → ...
│  │   └── einja-task-exec 実行 → Worker サブエージェント
│  │
│  └─────────────────────────────────────────────────┘
│
│  TaskList 依存制御:
│    Task 1.1: [依存なし]           → ✅ claimable
│    Task 1.2: [依存なし]           → ✅ claimable
│    Task 1.3: [blockedBy: 1.1]    → ❌ blocked → 1.1完了で unblock
│    Task 2.1: [blockedBy: Phase1] → ❌ blocked → Lead がPhase完了後に unblock
│
│  Phase 1 全タスク完了 → Lead が Phase マージ → Phase 2 タスク unblock
│  全Phase完了 → 最終PR → TeamDelete
```

**特徴**:
- **ワーカープール**: 固定数（3-5名）の Director Teammate が TaskList から self-claim で回転処理
- **依存制御**: `addBlockedBy` で blocked タスクは claim 不可。Lead がPhase完了時に次Phase タスクを unblock
- **コスト効率**: タスクグループ数に関係なくプールサイズ一定。idle 中はトークン消費なし
- **役割分担**: Director 内で einja-task-exec を実行。内部の Worker サブエージェント（task-executer, task-reviewer, task-qa, frontend-coder, backend-architect 等）が役割を担う
- **Git作業隔離**: 各 Director Teammate は task ブランチ用の worktree を作成して作業。claim 前に `clean tree 確認 + phase branch 再同期 + task branch & worktree 新規作成` を必須化。完了後に worktree を削除

### 体制設計の差異まとめ

| 項目 | tmux版 | Agent Teams版 |
|------|--------|--------------|
| Director の管理単位 | Phase（1 Director = Phase内の全タスクグループ） | タスクグループ（1 Director = 1タスクグループ、完了後に次を claim） |
| Director 数 | Phase数と同数（固定） | min(タスクグループ総数, 5) の固定プール |
| Worker の実体 | 独立 tmux window（claude 対話モード） | Director 内のサブエージェント（Agent tool） |
| タスク割り振り | Director が依存DAGに基づき Worker を順次起動 | Lead が TaskList に登録 + addBlockedBy、Director が self-claim |
| Director間協調 | なし（Phase間は Manager 経由） | SendMessage で直接通信可能 |
| ゲートチェック実行者 | Director（Phase 内の全タスクを一元チェック） | Lead がゲートチェック（Director 完了報告受信時） |
| idle 時の挙動 | tmux window 維持（ポーリング監視） | idle 通知 → 次の claimable タスクを自動探索 |

## アーキテクチャ: Agent Teams ワーカープール方式

```
Lead = Manager (einja-issue-team-exec Skill)
  │
  │ Step 1: Issue読み込み・タスク解析
  │ Step 2: ブランチ作成（branch-strategy.md 準拠）
  │   - issue/{N} ブランチ作成
  │   - issue/{N}-phase1 ブランチ作成
  │ Step 3: 共有TaskList作成（依存関係付き）
  │   - Task 1.1: [依存なし, PR base: issue/{N}-phase1]
  │   - Task 1.2: [依存なし, PR base: issue/{N}-phase1]
  │   - Task 1.3: [blockedBy: 1.1, PR base: issue/{N}-phase1]
  │   - Task 2.1: [blockedBy: Phase1完了, PR base: issue/{N}-phase2]
  │
  │ Step 4: TeamCreate → Director プール spawn
  │   プールサイズ: min(タスクグループ総数, 5)
  │   各 Director Teammate: TaskList から self-claim → einja-task-exec 実行
  │   完了後は次の claimable タスクを自動で claim（回転処理）
  │
  │ Step 5: 監視（通知 + ポーリング）
  │   - Director Teammate が einja-task-exec 完了 → PR作成 → Lead に報告（SendMessage）
  │   - Lead がゲートチェック（Fast Gate / Risk Gate: protocol.md 準拠）
  │   - 通過 → マージモードに応じた処理:
  │     - manual: Lead が `gh pr list --state merged` を30秒間隔ポーリング → 人間マージ検知
  │     - task-group-auto: `gh pr merge --squash --auto` 実行 → CI通過で自動マージ
  │     - auto: CI通過確認後に `gh pr merge --squash` 実行
  │   - マージ検知 → blockedBy 解除 → idle Director が次タスク claim
  │
  │   **ポーリング停止・再開ルール**:
  │   - 1時間ポーリングしても状態変化なし → ポーリング一旦停止、待機モードへ遷移
  │   - 待機モード中:
  │     - 低頻度ハートビート（5分間隔）で `gh pr list --state merged` を確認（取りこぼし防止）
  │     - 以下のトリガーで通常ポーリング（30秒間隔）に即時復帰:
  │       (1) 人間からの報告（「マージしたよ」等のメッセージ入力）
  │       (2) Director Teammate からの SendMessage（新しいPR作成報告等）
  │       (3) ハートビートでマージ検知
  │   - 冪等処理: `processed_pr_numbers` セットで処理済みPRを管理。二重処理を防止
  │   - ゲート不通過 → Director に修正指示（SendMessage, 最大2回）→ 3回目NG → ユーザーエスカレーション
  │
  │ Step 6: Phase 完了処理
  │   Phase完了条件（全3条件を満たすこと）:
  │     (1) 当該Phaseの全task PRが `merged` 状態
  │     (2) 全task状態が `completed`
  │     (3) 処理中（inflight）のタスクがない
  │   - Phase完了条件達成 → Lead が Phase PR 作成（phase → issue）→ マージ
  │   - Phase PR マージ後:
  │     - issue/{N}-phase2 ブランチ作成
  │     - Phase 2 タスクを TaskList で unblock（blockedBy 解除）
  │     - idle Director Teammates が Phase 2 タスクを claim 開始
  │
  │ Step 7: 全Phase完了 → 最終PR作成（einja-create-pr）
  │ Step 8: 全 Director に shutdown_request → TeamDelete → クリーンアップ
```

### 共通ブランチ運用（branch-strategy.md 完全準拠）

```
main
 └── issue/{N}                    ← Lead が作成
      ├── issue/{N}-phase1        ← Lead が作成
      │    ├── task/{N}-1.1       ← Teammate A が作成・作業・PR (base: phase1)
      │    └── task/{N}-1.2       ← Teammate B が作成・作業・PR (base: phase1)
      └── issue/{N}-phase2        ← Lead が Phase 1 完了後に作成
           └── task/{N}-2.1      ← Teammate C が作成・作業・PR (base: phase2)
```

**tmux版と同じブランチ構造**: Phase ブランチを維持。共通ルール完全準拠。

**Agent Teams版での Phase 管理フロー**:
1. Lead が `issue/{N}` + `issue/{N}-phase1` ブランチを作成
2. TaskList に Phase 1 タスクを登録（PR base = `issue/{N}-phase1`）
3. Teammates が claim → `task/{N}-{X.Y}` ブランチ作成 → PR to `issue/{N}-phase1`
4. Phase 1 全タスク完了 → Lead が `issue/{N}-phase1` → `issue/{N}` マージ
5. Lead が `issue/{N}-phase2` ブランチを作成
6. Phase 2 タスクを TaskList で unblock（`addBlockedBy` 解除）
7. Teammates が Phase 2 タスクを claim 開始

### 現行 issue-exec との対応

| 概念 | tmux版（issue-exec） | Agent Teams版（issue-team-exec） | 共通/固有 |
|------|---------------------|--------------------------------|----------|
| 体制 | Manager→Director→Worker（3ロール） | Lead(Manager)→Teammate(Director)→Subagent(Worker)（3ロール） | **共通**（ロール定義）/ **固有**（マッピング） |
| Director管理単位 | Phase（1 Director = Phase内の全タスクグループ） | タスクグループ（1 Director Teammate = 1タスクグループ） | **固有** |
| プロセス管理 | tmux session/window | Agent Teams in-process mode | **固有** |
| ファイル隔離 | git worktree（手動管理） | Agent tool `isolation: "worktree"` または Director が手動 worktree 作成 | **固有** |
| 状態管理 | `~/.einja/sessions/` JSON | 共有TaskList（`~/.claude/tasks/`） | **固有** |
| 通信 | ステータスファイルポーリング | SendMessage + 自動idle通知 | **固有** |
| Phase順序制御 | Director層が管理 | Lead が Phase 完了→マージ→次Phase unblock | **固有** |
| ブランチ構造 | `branch-strategy.md` 準拠 | `branch-strategy.md` 準拠 | **共通** |
| Phase ブランチ | `issue/{N}-phase{M}` 作成・マージ | `issue/{N}-phase{M}` 作成・マージ | **共通** |
| タスク構造 | `task-management.md` 準拠 | `task-management.md` 準拠 | **共通** |
| レビュー | Director Fast Gate / Risk Gate | Lead がレビュー（protocol.md 準拠） | **共通**（基準）/ **固有**（実行者） |
| タスク実行 | einja-task-exec Skill | einja-task-exec Skill | **共通** |
| コミット | einja-task-commit Skill | einja-task-commit Skill | **共通** |
| PR作成 | einja-create-pr Skill | einja-create-pr Skill | **共通** |
| ステータス遷移 | protocol.md 準拠 | protocol.md 準拠 | **共通** |
| ゲートチェック基準 | protocol.md 準拠 | protocol.md 準拠 | **共通** |
| リトライポリシー | protocol.md 準拠 | protocol.md 準拠 | **共通** |

## 作成・変更ファイル

### 新規作成

#### 1. `docs/einja/instructions/issue-exec-protocol.md`（共通プロトコル）

**目的**: 現在 `einja-issue-exec` Skill内にのみ存在する共通ルールを独立ドキュメントに分離。両Skillが参照する Single Source of Truth。

**抽出する共通ルール（意味論レベル）**:
- 体制設計（3ロール定義: Manager/Director/Worker の責務・管理単位 + 方式別の責務差分）
- ステータス遷移定義（pending → in_progress → awaiting_review → completed/failed）
- ゲートチェック仕様（Fast Gate / Risk Gate のチェック項目・通過条件）
- エラーリトライポリシー（最大2回 fixCount、リトライ上限）
- マージモード仕様（manual / task-group-auto / auto の詳細動作）
- PR作成ルール（task→phase / phase→issue / issue→base の base/head 規則）
- Phase完了条件（全task PR merged + 全task completed + no inflight）
- CI待機タイムアウト（30分）
- spec事前一括チェック仕様（full/partial/none の判定基準・対応方針）
- 依存関係解析仕様（DAG構築・Layer分け・循環依存検知）
- 質問エスカレーション意味論（エスカレーション判断基準、回答のドキュメント還元先）
- コンフリクト解消ルール（einja-conflict-resolver 使用）
- ポーリング停止・再開ルール（1時間無変化→停止、再開トリガー、ハートビート、冪等処理）

**各方式側に残すI/O形式**:
- tmux版: ステータスファイル形式（JSON）、質問ファイル形式、events.jsonl
- Agent Teams版: TaskList活用方式、SendMessage通信プロトコル

#### 2. `.claude/skills/einja-issue-team-exec/SKILL.md`（Agent Teams固有）

Agent Teams 固有の実行方式のみ記述。共通ルールは docs 参照。

```yaml
---
name: einja-issue-team-exec
description: "Agent TeamsによるIssue並列実行Skill。Manager(Lead)→Director(Teammate Pool)→Worker(Subagent)の3ロール体制で、共有TaskListとself-claimによるワーカープール方式で並列実行。tmux不要、Desktop対応。"
---
```

**Skill内容**:
- 前提条件チェック（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 有効確認）
- Step 0-8 のフロー（上記アーキテクチャ参照）
- Teammate spawn プロンプトテンプレート
- エラーハンドリング（Agent Teams固有: idle通知、SendMessage等）
- 途中再開サポート（issue ブランチの状態から検出）
- **共通ルール参照**:
  - `docs/einja/instructions/issue-exec-protocol.md`（ステータス遷移、ゲートチェック、リトライ等）
  - `docs/einja/steering/branch-strategy.md`（ブランチ命名・マージ戦略）
  - `docs/einja/steering/task-management.md`（タスク階層・依存関係）

### 既存ファイル更新

#### 3. `.claude/skills/einja-issue-exec/SKILL.md`（tmux版）

- 共通ルール記述を `issue-exec-protocol.md` への参照に置き換え
- tmux/worktree 固有の実行手順のみ残す

#### 4. `docs/einja/steering/branch-strategy.md`

- `einja-issue-exec 実行時のブランチ運用` セクションを以下に再構成:
  - **共通セクション**: ブランチ CRUD タイミング（実行方式に依存しない部分）
  - **tmux版サブセクション**: worktree パス、tmux window との対応
  - **Agent Teams版サブセクション**: TaskList依存関係によるPhase制御、Director worktree管理
- `Worktree ライフサイクル` を `実行方式別のファイル隔離` に改称し、両方式を記述

#### 5. `docs/einja/steering/task-management.md`

- `コマンドリファレンス` セクションに `einja-issue-team-exec` を追加
- 既存の `einja-issue-exec` 記述はそのまま維持

#### 6. `docs/einja/instructions/issue-exec-workflow.md`

- 冒頭に「Agent Teams版は `einja-issue-team-exec` Skill を参照」のリンク追加
- 既存内容（tmux版）はそのまま維持

#### 7. `CLAUDE.md`

- Skill一覧テーブルに `einja-issue-team-exec` を追加
- キーワードトリガーに追加

## エラーハンドリング（Agent Teams固有）

| 障害 | 検知 | 対応 |
|------|------|------|
| Director Teammate 停止（PR作成前） | idle 通知 + タスク状態が in_progress のまま | Lead が新 Teammate spawn してリトライ（最大2回）→ 3回目失敗はユーザーエスカレーション |
| Director Teammate 停止（PR作成済み） | idle 通知 + PR あり | スキップ（PRマージ待ちのまま継続） |
| Director Teammate 停止（修正中: fix_required 対応中） | idle 通知 + fixCount > 0 | Lead が新 Teammate spawn（fixCount 引き継ぎ）→ 超過時はユーザーエスカレーション |
| タスク失敗（einja-task-exec 内部エラー） | Director からの SendMessage | Lead がリトライ判断（最大2回）→ 3回目はユーザーにエスカレーション |
| PR作成失敗 | `gh pr create` エラー | Director が再試行（認証エラーの場合は Lead にエスカレーション） |
| マージコンフリクト | git merge/rebase 失敗 | `einja-conflict-resolver` Skill 呼び出し |
| CI 失敗 | `gh run` status チェック | Director が修正 → 再push → 再CI待機 |
| CI 待機タイムアウト | 30分超過 | Lead がユーザーに AskUserQuestion で通知 |
| GitHub API 認証失敗 | gh コマンドエラー | Lead がユーザーに通知して停止 |
| Lead セッション断絶 | - | session resume 不可（Agent Teams の既知制限）。再実行時に issue ブランチの状態から途中再開 |

## 検証方法

1. **単体テスト**: 小規模 Issue（2-3タスク、単一Phase）で基本フローを確認
2. **依存関係テスト**: 2Phase Issue でタスク依存関係（Phase 2 が Phase 1 完了待ち）を確認
3. **共通ルール準拠確認**: ブランチ命名・タスク構造が branch-strategy.md / task-management.md に準拠していることを確認
4. **tmux版との互換性**: 同じIssueを両方式で実行した場合、ブランチ構造・PR構造が互換であることを確認
5. **Desktop テスト**: Claude Desktop の Code タブから実行可能か確認

## 実装ステップ

### TODO-0: Agent Teams 制約 PoC
- TaskList の原子的 claim 動作確認（複数 Teammate が同時 claim した場合の排他制御）
- Teammate 内で Agent tool（サブエージェント）が正常動作するか確認
- Teammate 内で einja-task-exec Skill が実行可能か確認
- `isolation: "worktree"` パラメータの Teammate 内での動作確認
- 小規模テスト（2タスクグループ、単一Phase）で基本フローを検証

### TODO-1: 共通プロトコル抽出・新設
- `docs/einja/instructions/issue-exec-protocol.md` 新規作成
- **体制設計（3ロール定義）**: Manager/Director/Worker のロール定義・責務・管理単位を共通セクションとして記述
- **実行方式別マッピング**: tmux版・Agent Teams版それぞれのロールマッピングを記述
- `einja-issue-exec` SKILL.md からステータス遷移・ゲートチェック・リトライ等の共通ルールを抽出
- issue-exec-workflow.md との整合確認

### TODO-2: 既存issue-exec SKILL.md のリファクタ
- `.claude/skills/einja-issue-exec/SKILL.md` の共通ルール部分を protocol.md 参照に置き換え
- tmux/worktree 固有の実行手順のみ残す

### TODO-3: branch-strategy.md 更新
- `einja-issue-exec 実行時のブランチ運用` セクションの再構成
- 共通/tmux版/Agent Teams版のサブセクション分離

### TODO-4: SKILL.md 新規作成
- `.claude/skills/einja-issue-team-exec/SKILL.md` を新規作成
- 共通ルール参照（protocol.md, branch-strategy.md, task-management.md）
- Agent Teams 固有フロー（TeamCreate, TaskList, SendMessage, self-claim）

### TODO-5: 関連ドキュメント・設定更新
- `task-management.md` にissue-team-exec参照追加
- `issue-exec-workflow.md` にクロスリファレンス追加
- `CLAUDE.md` Skill一覧・キーワードトリガー更新

### TODO-6: 動作検証
- 実際の Issue で実行テスト
- 共通ルール準拠確認（ブランチ命名、ステータス遷移、ゲートチェック）
- tmux版との互換性確認（同じIssueで両方式実行）
- Desktop/CLI 両環境で確認
