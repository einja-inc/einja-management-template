<!-- @einja:managed:start -->
# `einja:issue-exec` コマンド

## 概要

GitHub Issue のタスクを Manager → Director → Worker の3階層プロセスで並列実行する Claude Code カスタムコマンド。tmux セッション、git worktree、ステータスファイルで全プロセスを管理する。

**⚠️ 重要**: Vibe-Kanban（`pnpm task:loop`）は廃止され、`/einja:issue-exec` に移行しました。

---

## 使用方法

### コマンド実行

```bash
# 基本
/einja:issue-exec #123

# オプション指定
/einja:issue-exec #123 --merge-mode task-group-auto   # タスクPR自動マージ
/einja:issue-exec #123 --merge-mode auto               # 全自動
/einja:issue-exec #123 --max-phase 2                   # Phase 2 まで
/einja:issue-exec #123 --base develop                  # ベースブランチ指定
/einja:issue-exec #123 --resume                        # セッション復旧
```

### 事前準備

- tmux がインストールされていること
- GitHub CLI（`gh`）がインストール・認証済みであること
- Docker が起動していること（必要な場合）

---

## アーキテクチャ

### 3階層プロセス

```
Manager (Claude Code: /einja:issue-exec)
│  メインリポ or Issue worktree
│
├─ tmux window → Director Phase1 (claude 対話モード)
│  │  Phase worktree: ~/.einja/worktrees/issue-123/phase1/
│  │
│  ├─ tmux window → Worker 1.1 (claude 対話モード)
│  │   Task worktree: ~/.einja/worktrees/issue-123/task-1.1/
│  │   → /einja:task-exec #123 1.1
│  │     ├─ サブエージェント: Task 1.1.1 実装（run_in_background）
│  │     ├─ サブエージェント: Task 1.1.2 実装（run_in_background）
│  │     └─ reviewer → QA → commit
│  │
│  ├─ tmux window → Worker 1.2 (claude 対話モード)
│  │   → /einja:task-exec #123 1.2
│  │
│  └─ (依存タスクグループは先行完了後に起動)
│
├─ tmux window → Director Phase2 (Phase1完了後 or 並列)
│  └─ ...
│
└─ 全Phase完了 → PR: issue/123 → main
```

### 各階層の責務

| 階層 | 責務 | 実行方式 |
|------|------|---------|
| **Manager** | Issue パース、ブランチ管理、worktree 管理、tmux 管理、Director 起動、Phase マージ、質問エスカレーション、エラー監視 | Claude Code カスタムコマンド |
| **Director** | Phase 内のタスクグループ管理、Worker 起動、並列制御、PR マージ検知、変更伝播、質問対応、worktree クリーンアップ | claude 対話モード（tmux window） |
| **Worker** | task-exec 実行（executer→reviewer→qa→commit）、Phase 変更取り込み、PR 作成、完了報告 | claude 対話モード（tmux window） |

### 各階層の通信方式

| 階層間 | 方式 | 理由 |
|--------|------|------|
| Manager → Director | tmux + ステータスファイル + 質問エスカレーション | 別 worktree が必要 |
| Director → Worker | tmux + ステータスファイル + 質問エスカレーション | 別 worktree が必要 |
| Worker 内部（タスク間） | サブエージェント（Task ツール） | 既存 task-exec フローを活用 |

---

## ブランチ & worktree 構成

### ブランチ階層

```
main (デフォルト)
 └── issue/123                        Manager管理
      ├── issue/123-phase1             Director1 worktree
      │    ├── task/123-1.1            Worker1.1 worktree
      │    ├── task/123-1.2            Worker1.2 worktree
      │    └── task/123-1.3            Worker1.3 worktree（1.1完了後に作成）
      └── issue/123-phase2             Director2 worktree
           └── task/123-2.1            Worker2.1 worktree
```

### worktree 物理パス

```
~/.einja/worktrees/issue-123/
├── phase1/                     ← Director1 cwd
├── task-1.1/                   ← Worker1.1 cwd
├── task-1.2/                   ← Worker1.2 cwd
└── phase2/                     ← Director2 cwd
```

---

## マージモード

| モード | タスクPR (task→phase) | Phase PR (phase→issue) | 最終PR (issue→base) |
|---|---|---|---|
| `manual` | 人間マージ待ち | 人間マージ待ち | 人間マージ待ち |
| `task-group-auto` | CI通過後に自動マージ | 人間マージ待ち | 人間マージ待ち |
| `auto` | CI通過後に自動マージ | CI通過後に自動マージ | 人間マージ待ち（常に手動） |

---

## tmux セッション構成

```
tmux session: einja-123
  window 0: Manager (メインプロセスのログ表示)
  window 1: Director-Phase1 (claude 対話モード)
  window 2: Worker-1.1 (claude 対話モード → /einja:task-exec #123 1.1)
  window 3: Worker-1.2 (claude 対話モード → /einja:task-exec #123 1.2)
  window 4: Director-Phase2 (claude 対話モード)
  window 5: Worker-2.1 (claude 対話モード → /einja:task-exec #123 2.1)
```

ユーザーは `tmux attach -t einja-123` で全プロセスを監視可能。

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
events.jsonl                    # JSON Lines 形式の追記型イベントログ
```

### ステータスファイル永続化

- `~/.einja/sessions/` に配置し、システム再起動後も `--resume` で復元可能
- 完了時に Manager が自動クリーンアップ
- `status.json` の更新は `flock` による排他制御を使用
- git push 対象外（純粋にローカル実行状態管理）

---

## 質問エスカレーション

### チェーン

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

### 質問ファイル形式

```json
{
  "id": "q-001",
  "from": "worker-1.1",
  "question": "ユーザー認証にJWTとセッションのどちらを使うべきか？",
  "context": "design.md にはどちらの記載もない",
  "status": "pending",
  "escalatedTo": null,
  "answer": null,
  "answeredBy": null
}
```

### 回答のドキュメント還元

回答のうちドキュメント未記載のものは適切なドキュメントに追記:

| 回答の種類 | 追記先 |
|-----------|--------|
| 要件・仕様に関する判断 | requirements.md |
| 技術的な設計判断 | design.md |
| プロジェクト横断の方針 | docs/einja/memory/decisions.md |
| 再利用可能なパターン | docs/einja/memory/patterns.md |

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
 ├─ auto: CI通過確認後に gh pr merge --squash 実行
 │
 ├─ マージ検知後:
 │   ├─ 他 active Worker にステータスで sync_required 通知
 │   ├─ タスク worktree 削除 + tmux window kill
 │   ├─ GitHub Issue チェックボックス更新
 │   └─ 依存タスク起動判定 → 新 Worker 起動
 │
 └─ Phase 全タスク完了 → ステータスで Manager に報告

Manager 検知
 │
 ├─ Phase PR 作成: issue/123-phase1 → issue/123
 ├─ マージモードに応じた処理
 ├─ マージ後: Phase worktree 削除
 ├─ 他 active Phase に変更伝播
 └─ 次 Phase 起動 or 全完了 → 最終 PR 作成
```

---

## エラーリカバリ

| 障害 | 検知 | リカバリ |
|---|---|---|
| Worker 異常終了（PR作成前） | tmux window 消失 + ステータス未更新 | リトライ（最大2回）→ 失敗時は Manager に報告 → 人間判断 |
| Worker 異常終了（PR作成済み） | tmux window 消失 + PR あり | スキップ（PR マージ待ちのまま継続） |
| Director 異常終了 | tmux window 消失 + ステータス未更新 | 各 Worker のステータスを確認 → 未完了 Worker のみ再実行 |
| Manager 異常終了 | ユーザー手動 | `--resume` でステータスファイルから復元 |
| rebase コンフリクト | git rebase 失敗 | conflict-resolver で自力解消 |
| CI 失敗 | gh run status | 修正 → 再push → 再CI待機 |
| CI 待機タイムアウト | 30分超過 | Manager に通知 → 人間判断 |

---

## `/einja:task-exec` との使い分け

| コマンド | 用途 | 対象 | 推奨シーン |
|---------|------|------|----------|
| **`/einja:issue-exec`** | Issue全体の並列実行 | 複数Phase・複数タスクグループ | 大規模機能実装 |
| **`/einja:task-exec`** | 単一タスクグループの実行 | 1つのタスクグループ | 品質重視、複雑な実装 |

---

## 関連ドキュメント

- [タスク実行ワークフロー](./task-execute.md)
- [タスク管理ガイドライン](../steering/task-management.md)
- [仕様書作成ワークフロー](./einja:spec-create.md)
- [ブランチ運用戦略](../steering/branch-strategy.md)
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="issue-exec-workflow-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
