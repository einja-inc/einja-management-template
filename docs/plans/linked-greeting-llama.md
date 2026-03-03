# Plan: issue:exec を Vibe-Kanban から脱却し、階層的 Claude Code プロセスに移行

## Context

現在の `pnpm task:loop`（TypeScript CLI）は Vibe-Kanban MCP に依存して Claude Code セッションの起動・PR管理・タスク状態管理を行っている。これを廃止し、Claude Code カスタムコマンド `einja:issue-exec` に移行する。tmux, claude 対話モード, git worktree で同等以上の機能を実現する。

**目的**: Manager → Director → Worker の3階層プロセスで、Issue 全体のタスクを並列実行する仕組みを構築する。

---

## Agent Teams 評価結果（不採用）

| 項目 | 評価 |
|---|---|
| Split panes（tmux/iTerm2） | ✅ 各 Teammate が独立ペインで表示。監視に最適 |
| 共有タスクリスト + 依存関係 | ✅ pending → in_progress → completed、依存自動解除 |
| Teammate 間メッセージング | ✅ message / broadcast |
| TaskCompleted / TeammateIdle フック | ✅ 品質ゲートに活用可能 |
| **ネスト（Teammate が自チーム作成）** | ❌ **不可**。3階層は Agent Teams 単独で実現不可 |
| **Teammate 別 worktree（cwd指定）** | ❌ **公式未サポート**。だがWorker内部では同一worktreeのため問題なし |
| **セッション再開（/resume）** | ❌ in-process teammates は復元不可 |
| **安定性** | ⚠️ 実験的機能。タスク状態遅延等の既知問題あり |

### 結論: Agent Teams は不採用。Worker 内部はサブエージェント（Task ツール）で実装

調査の結果、Agent Teams は実験的機能であり制約が多い（`-p` モード不可、ネスト不可、復元不可）。
Worker 内部のタスク並列実行は、既存の **Task ツール（サブエージェント）** で十分に実現可能。
現在の `task-exec` が既にサブエージェント並列実行を行っているため、そのまま活用する。

| 項目 | Agent Teams | サブエージェント（Task ツール）✅ 採用 |
|---|---|---|
| 並列実行 | Teammate で並列 | `run_in_background: true` で並列 |
| 依存管理 | 共有タスクリスト | TaskCreate + blockedBy |
| 実行モード | 対話モード必須 | `-p` でも対話でも動作 |
| 安定性 | ⚠️ 実験的 | ✅ 安定（本番利用実績あり） |
| 復元性 | ❌ 不可 | ✅ セッション再開可能 |

**Manager → Director → Worker 間は tmux + claude 対話モード**（質問エスカレーション対応）

---

## 推奨アーキテクチャ: tmux + サブエージェント

### 全体構成

```
Manager (Claude Code: einja:issue-exec)
│  Issue worktree: issue/123
│
├─ tmux window → Director Phase1 (claude 対話モード)
│  │  Phase worktree: worktrees/issue-123-phase1
│  │
│  ├─ tmux window → Worker 1.1 (claude 対話モード)
│  │   Task worktree: worktrees/issue-123-task-1.1
│  │   → task-exec #123 1.1
│  │     ├─ サブエージェント: Task 1.1.1 実装（run_in_background）
│  │     ├─ サブエージェント: Task 1.1.2 実装（run_in_background）
│  │     └─ reviewer → QA → commit
│  │
│  ├─ tmux window → Worker 1.2 (claude 対話モード)
│  │   Task worktree: worktrees/issue-123-task-1.2
│  │   → task-exec #123 1.2 ...
│  │
│  └─ (依存タスクグループは先行完了後に起動)
│
├─ tmux window → Director Phase2 (claude 対話モード, Phase1完了後 or 並列)
│  │  Phase worktree: worktrees/issue-123-phase2
│  └─ ...
│
└─ 全Phase完了 → PR: issue/123 → main
```

### 各階層の通信方式

| 階層 | 方式 | 理由 |
|---|---|---|
| Manager → Director | tmux + ステータスファイル + 質問エスカレーション | TypeScript CLI からの制御。別 worktree が必要 |
| Director → Worker | tmux + ステータスファイル + 質問エスカレーション | 別 worktree が必要 |
| Worker 内部（タスク間） | サブエージェント（Task ツール） | 既存 task-exec のフローをそのまま活用。`run_in_background` で並列化 |

**重要**: 全プロセスは**対話モード**（`claude`、非 `-p`）で起動。子プロセスからの質問を受け取り、回答またはさらに上位へエスカレーションする。

### 質問エスカレーションチェーン

```
Worker（task-exec 実行中に疑問発生）
  ↓ ステータスファイル（質問キュー）
Director（spec/design/issue で回答可能？）
  ├─ Yes → 回答をステータスファイルに書き込み
  └─ No ↓ ステータスファイル（質問キュー）
Manager（Claude Code カスタムコマンド）
  ↓ AskUserQuestion で人間に質問
Human（回答入力）
  ↓ 回答をステータスファイルに書き込み → 逆順で伝播
```

### 質問ステータスファイル形式

パス: `~/.einja/sessions/issue-123/questions/`

```json
{
  "id": "q-001",
  "from": "worker-1.1",
  "question": "ユーザー認証にJWTとセッションのどちらを使うべきか？",
  "context": "design.md にはどちらの記載もない",
  "status": "pending",  // pending → escalated → answered
  "escalatedTo": "director-phase1",
  "answer": null,
  "answeredBy": null
}
```

### 回答権限

| 回答者 | 回答可能な範囲 |
|---|---|
| Worker | spec（requirements.md, design.md）に明記されている内容（task-exec 内で自己解決） |
| Director | spec + Issue 本文 + Phase 全体のコンテキスト |
| Manager → Human | 上記で回答不可能な要件・方針の判断 |

---

## 各レイヤーの責務

### Manager (Claude Code カスタムコマンド)

**実装方法**: `.claude/commands/einja/issue-exec.md` として新規作成。Bash ツールで tmux/worktree/gh CLI を制御。

| 責務 | 詳細 |
|---|---|
| Issue パース | `gh issue view` + Claude Code による Markdown 直接パース |
| 依存関係解析 | Issue 本文から Phase/タスクグループの依存関係を直接分析 |
| ブランチ管理 | Bash ツールで `git branch`, `git push` 等を実行 |
| worktree 管理 | Bash ツールで `git worktree add/remove` を実行 |
| tmux 管理 | Bash ツールで `tmux new-session/new-window/send-keys` 等を実行 |
| Director 起動 | Phase 毎に tmux window で `claude` を起動 |
| マージモード制御 | manual / task-group-auto / auto |
| Phase マージ | `gh pr create/merge` で Phase → Issue ブランチの PR 管理 |
| 変更伝播 | Phase マージ後、ステータスファイルで他 active Phase に通知 |
| 最終 PR | `gh pr create` で Issue → base ブランチの PR 作成 |
| **質問エスカレーション** | Director から回答不可な質問を受け取り、AskUserQuestion で人間に表示 → 回答を伝播 |
| エラー監視 | tmux pane 消失 + ステータスファイル未更新を監視 |

### Director (claude 対話モード in tmux window)

**実装方法**: `claude` （対話モード）で Phase worktree の cwd で起動。初期プロンプトで Phase 情報を渡す。

| 責務 | 詳細 |
|---|---|
| タスクグループ管理 | Phase 内のタスクグループを依存順に処理 |
| Worker 起動 | 各タスクグループに対して tmux window + `claude`（対話モード）で Worker 起動 |
| Task worktree 作成 | `git worktree add` でタスクブランチ用 worktree 作成 |
| 並列制御 | 依存のないタスクグループは並列 Worker 起動 |
| PR マージ検知 | `gh pr list --state merged` ポーリングで Worker PR のマージ検知 |
| 変更伝播通知 | マージ後、他の active Worker にステータスファイルで sync 通知 |
| **質問対応** | Worker からの質問に spec/design/issue ベースで回答。回答不可なら Manager にエスカレーション |
| worktree クリーンアップ | Worker 完了・マージ後にタスク worktree 削除 |
| Phase 完了報告 | 全タスクグループ完了時にステータスファイルで Manager に報告 |
| GitHub Issue 更新 | タスクグループ完了時にチェックボックス更新 |

### Worker (claude 対話モード in tmux window)

**実装方法**: `claude` 対話モードでタスク worktree 内で起動。`einja:task-exec` を実行（既存フローをそのまま活用）。

| 責務 | 詳細 |
|---|---|
| task-exec 実行 | `einja:task-exec #{issue} {taskGroupId}` 実行（executer→reviewer→qa→commit） |
| **タスク並列実装** | task-exec 内部で Task ツール（`run_in_background`）を使い並列実装（既存機能） |
| **品質管理** | 全タスク完了後、reviewer → QA → commit を統括（既存 task-exec フロー） |
| Phase 変更取り込み | 作業開始前 / sync 通知時 / PR 作成前に `git rebase origin/{phaseBranch}` |
| CI 待機 | push 後、`gh run list` で CI 完了を確認 |
| PR 作成 | `gh pr create --base {phaseBranch} --head {taskBranch}` |
| 完了報告 | ステータスファイルに PR 番号・完了状態を書き込み |
| コンフリクト解消 | rebase 時のコンフリクトを conflict-resolver で自力解消 |

### Worker 起動コマンド（Director が Worker を起動する際）

```bash
cd ~/.einja/worktrees/issue-123/task-1.1
claude "/einja:task-exec #123 1.1"
```

task-exec 内部は既存フローをそのまま活用（変更なし）：
- Task ツール + `run_in_background` で並列実装
- TaskCreate + blockedBy で依存管理
- executer → reviewer → qa → commit の品質保証ループ

---

## タスク完了フロー

```
Worker-1.1 作業中
 │
 ├─ 0. git rebase origin/issue/123-phase1（最新取り込み）
 ├─ 1. task-exec 完了 → task/123-1.1 に commit & push
 ├─ 2. CI 完了待機（gh run list ポーリング）
 ├─ 3. gh pr create --base issue/123-phase1 --head task/123-1.1
 ├─ 4. ステータスファイル: { status: "pr_created", pr: 456 }
 └─ 5. claude プロセス終了

Director 検知（ステータスファイル + プロセス監視）
 │
 ├─ manual モード: gh pr list --state merged ポーリング → マージ検知まで待機
 ├─ task-group-auto: gh pr merge --squash --auto 実行
 ├─ auto: gh pr merge --squash 即実行
 │
 ├─ マージ検知後:
 │   ├─ 他 active Worker にステータスで sync_required 通知
 │   │   → Worker 自身が git rebase で取り込み
 │   ├─ タスク worktree 削除 + tmux window kill
 │   ├─ GitHub Issue チェックボックス更新
 │   └─ 依存タスク起動判定 → 新 Worker 起動
 │
 └─ Phase 全タスク完了 → ステータスで Manager に報告

Manager 検知
 │
 ├─ Phase PR 作成: issue/123-phase1 → issue/123
 ├─ マージモードに応じた処理（manual: 待機 / auto: 自動マージ）
 ├─ マージ後: Phase worktree 削除
 ├─ 他 active Phase に変更伝播（Director にリベース指示）
 └─ 次 Phase 起動 or 全完了 → 最終 PR 作成
```

---

## マージモード

```
einja:issue-exec #123                                    # デフォルト: manual
einja:issue-exec #123 --merge-mode task-group-auto       # タスクPR自動マージ
einja:issue-exec #123 --merge-mode auto                  # 全自動
einja:issue-exec #123 --max-phase 2                      # Phase 2 まで
einja:issue-exec #123 --base develop                     # ベースブランチ指定
```

| モード | タスクPR (task→phase) | Phase PR (phase→issue) | 最終PR (issue→base) |
|---|---|---|---|
| `manual` | 人間マージ待ち | 人間マージ待ち | 人間マージ待ち |
| `task-group-auto` | CI通過後に自動マージ | 人間マージ待ち | 人間マージ待ち |
| `auto` | CI通過後に自動マージ | CI通過後に自動マージ | 人間マージ待ち（常に手動） |

---

## ブランチ & worktree 構成

```
main
 └── issue/123                        Manager管理、メインリポまたはworktree
      ├── issue/123-phase1             Director1 worktree
      │    ├── task/123-1.1            Worker1.1 worktree
      │    ├── task/123-1.2            Worker1.2 worktree
      │    └── task/123-1.3            Worker1.3 worktree（1.1完了後に作成）
      └── issue/123-phase2             Director2 worktree（Phase1完了後 or 並列）
           └── task/123-2.1            Worker2.1 worktree
```

worktree 物理パス:
```
~/.einja/worktrees/issue-123/
├── phase1/                     ← Director1 cwd
├── task-1.1/                   ← Worker1.1 cwd
├── task-1.2/                   ← Worker1.2 cwd
└── phase2/                     ← Director2 cwd
```

---

## ステータスファイル

パス: `~/.einja/sessions/issue-123/`

```
session.json                    # セッション全体（Manager PID、開始時刻、マージモード等）
phase-1/
  status.json                   # Phase状態 + Director PID
  task-1.1.json                 # { status, prNumber, branch }
  task-1.2.json
phase-2/
  status.json
questions/
  q-{uuid}.json                 # 質問ファイル（1ファイル1質問）
events.jsonl                    # JSON Lines 形式の追記型イベントログ（タイムスタンプ + PID 付き）
```

### ステータスファイル永続化

- `~/.einja/sessions/` に配置し、システム再起動後も `--resume` で復元可能
- 完了時に Manager が自動クリーンアップ（ディレクトリ削除）
- `status.json` の更新は `flock` による排他制御を使用（複数プロセスの同時更新を防止）
- git push 対象外（純粋にローカル実行状態管理）

---

## tmux セッション構成

```
tmux session: einja-123
  window 0: Manager (メインプロセスのログ表示)
  window 1: Director-Phase1 (claude 対話モード)
  window 2: Worker-1.1 (claude 対話モード → task-exec #123 1.1)
  window 3: Worker-1.2 (claude 対話モード → task-exec #123 1.2)
  window 4: Director-Phase2 (claude 対話モード)
  window 5: Worker-2.1 (claude 対話モード → task-exec #123 2.1)
```

- ユーザーは `tmux attach -t einja-123` で全プロセスを監視可能
- 全プロセスが対話モード（`claude`）のため、質問エスカレーションが可能
- Worker 内部のサブエージェント並列実行は tmux には表示されない（Claude Code 内部処理）

---

## ファイル変更一覧

### 新規作成

| ファイル | 役割 |
|---|---|
| `.claude/commands/einja/issue-exec.md` | **Manager**: Issue 全体のオーケストレーション（カスタムコマンド） |

### 変更なし（そのまま活用）

| ファイル | 用途 |
|---|---|
| `.claude/commands/einja/task-exec.md` | Worker が実行するタスクグループ処理 |
| `.claude/agents/einja/task/task-executer.md` | 実装サブエージェント |
| `.claude/agents/einja/task/task-reviewer.md` | レビューサブエージェント |
| `.claude/skills/einja-task-qa/` | QA サブエージェント |
| `.claude/skills/einja-task-commit/` | コミット・プッシュ |

### 削除

| ファイル/ディレクトリ | 理由 |
|---|---|
| `packages/cli/src/commands/issue-exec/` | **ディレクトリごと削除**。TypeScript CLI → Claude Code カスタムコマンドに移行 |
| `docs/einja/instructions/task-vibe-kanban-loop.md` | Vibe-Kanban ドキュメント（マネージドなので削除は dev-cli 側で対応） |

### 注意

TypeScript モジュール（`issue-parser.ts`, `dependency-resolver.ts`, `branch-manager.ts` 等）は**再利用しない**。
Manager（カスタムコマンド）が Claude Code の Bash ツール + gh CLI で直接 Issue パース・ブランチ管理・PR 操作を行う。

---

## エラーリカバリ

| 障害 | 検知 | リカバリ |
|---|---|---|
| Worker 異常終了（PR作成前） | Director: tmux window 消失 + ステータス未更新 | Director: リトライ（最大2回）→ 失敗時は Manager に報告 → 人間判断 |
| Worker 異常終了（PR作成済み） | Director: tmux window 消失 + ステータスに PR 番号あり | Director: スキップ（PR マージ待ちのまま継続） |
| Director 異常終了 | Manager: tmux window 消失 + ステータス未更新 | Manager: 各 Worker のステータスを確認 → 未完了 Worker のみ再実行する形で Director 再起動 |
| Manager 異常終了 | ユーザー手動 | `einja:issue-exec #123 --resume` でステータスファイルから全体状態を復元 → 未完了 Phase の Director を再起動 |
| rebase コンフリクト | Worker: git rebase 失敗 | Worker: conflict-resolver で自力解消 |
| CI 失敗 | Worker: gh run status | Worker: 修正 → 再push → 再CI待機 |

---

## ドキュメント変更

`docs/einja/` はマネージドディレクトリのため、原本は `packages/cli/` 側で編集 → `einja sync` で同期。

### 書き換え対象

| ファイル | 変更内容 | 優先度 |
|---|---|---|
| `docs/einja/instructions/task-vibe-kanban-loop.md` | **リネーム + 全面書き換え** → `issue-exec-workflow.md`。Manager→Director→Worker の3階層フロー、tmux 構成、ステータスファイル、マージモード、質問エスカレーションを記載 | ⭐⭐⭐ |
| `docs/einja/steering/development-workflow.md` | **フェーズB 書き換え**。Vibe-Kanban → `einja:issue-exec` + `einja:task-exec` に変更。`einja:task-simple` も追記 | ⭐⭐⭐ |
| `docs/einja/steering/task-management.md` | **部分書き換え**。「親Issue/サブIssue階層」セクション、コマンドリファレンスの `pnpm task:loop` → `einja:issue-exec` | ⭐⭐⭐ |
| `docs/einja/instructions/task-execute.md` | **整理**。`development-workflow.md` と重複内容を統合・整理 | ⭐⭐ |

### 書き換え不要

| ファイル | 理由 |
|---|---|
| `.claude/commands/einja/task-exec.md` | Worker が使用。変更なし |
| `.claude/agents/einja/task/*.md` | エージェント定義は呼び出し元に依存しない |
| `.claude/skills/einja-*/SKILL.md` | Skill 実装は変わらない |
| `CLAUDE.md` | `einja:issue-exec` を Skill・コマンド表に追加（ビルド時に自動反映） |

---

## 質問回答のドキュメント還元

質問エスカレーションで得られた回答のうち、既存ドキュメント（requirements.md, design.md, Issue 本文）に記載がなかったものは、適切なドキュメントに追記する。これにより同じ質問が繰り返されるのを防ぐ。

### フロー

```
質問発生 → 回答取得
  ↓
回答者が「ドキュメント未記載」と判断
  ↓
回答ステータスファイルに追記先を記録:
{
  "answer": "JWT を使用する",
  "answeredBy": "human",
  "docUpdate": {
    "target": "design.md",
    "section": "認証方式",
    "content": "認証方式は JWT を採用する。理由: ..."
  }
}
  ↓
Worker / Director が回答を受け取った際に、指定されたドキュメントに追記
  ↓
追記内容は modifications/ にも記録
```

### 追記先の判定基準

| 回答の種類 | 追記先 |
|-----------|--------|
| **要件・仕様に関する判断** | `requirements.md`（該当 AC やストーリーに追記） |
| **技術的な設計判断** | `design.md`（該当セクションに追記） |
| **プロジェクト横断の方針** | `docs/einja/memory/decisions.md`（判断の「なぜ」を記録） |
| **再利用可能なパターン** | `docs/einja/memory/patterns.md` |

### 注意事項

- 追記は**回答を受け取ったプロセス**（Worker または Director）が実行
- 追記内容には「質問ID」「回答者」「日付」をメタデータとして含める
- Issue 本文への追記は行わない（GitHub Issue は読み取り専用として扱う）

---

## スコープ外: 小規模 Issue

Phase=1 かつ タスクグループ=1 の小規模 Issue は、本プランの3階層アーキテクチャではオーバーヘッドが大きい。
別 Skill `einja:task-simple` として実装する（別プランで対応）。

| 項目 | issue:exec（本プラン） | task-simple（別プラン） |
|---|---|---|
| 対象 | 複数 Phase / 複数タスクグループ | Phase=1, TaskGroup=1 |
| 階層 | Manager → Director → Worker | Manager → Worker 直接 |
| 入力 | `einja:issue-exec #123` | `einja:task-simple #123` |
| タスク並列化 | サブエージェント（Task ツール） | サブエージェント（Task ツール） |
| ベース | issue-exec index.ts | task-exec.md 拡張 |

---

## 補完事項（Codex レビュー反映）

| 項目 | 対策 |
|---|---|
| **CI 待機タイムアウト** | デフォルト 30分。超過時は Manager に通知 → 人間判断 |
| **worktree ディスク容量** | `~/.einja/worktrees/` に作成。完了後即削除 |
| **Worker 復元** | Manager --resume 時、未完了 Worker は task-exec を再実行（サブエージェントは再 spawn） |
| **質問ファイル競合** | UUID ベースの ID 生成。1ファイル1質問でアトミック書き込み |
| **ステータスファイル排他制御** | `status.json` の更新には `flock` を使用。質問ファイルは 1ファイル1質問のためロック不要 |
| **変更伝播タイミング** | Worker は各タスク完了毎 + PR 作成前にステータスファイルをチェック。sync_required 検知時は次タスク開始前に rebase |
| **セッションクリーンアップ** | Issue 完了時に Manager が `~/.einja/sessions/issue-{N}/` と `~/.einja/worktrees/issue-{N}/` を自動削除 |
| **イベントログ形式** | JSON Lines（`.jsonl`）形式。各行に `timestamp`, `pid`, `event_type`, `data` を含む |

---

## 検証方法

1. **ユニットテスト**: tmux-manager, status-file-manager, merge-mode-handler, question-escalation-manager の各モジュール
2. **統合テスト**: Issue（Phase 1つ、タスクグループ 2つ）で E2E 実行
3. **マージモード検証**: manual / task-group-auto / auto 各モードで動作確認
4. **エラーリカバリ検証**: Worker/Director を意図的に kill して復旧確認
5. **並列実行検証**: 依存のない2タスクグループが実際に並列実行されることを確認
6. **サブエージェント並列検証**: Worker 内で Task ツール（run_in_background）による並列実装を確認
7. **質問エスカレーション検証**: Worker → Director → Manager → Human の質問伝播を確認
8. **既存テスト**: `pnpm test` で既存テスト全体が通ること（task-loop 削除による影響なし確認）
