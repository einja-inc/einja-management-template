<!-- @einja:managed:start -->
# ブランチ運用戦略

## 概要

このドキュメントでは、タスク実行時のブランチ運用戦略を定義します。

※ **IssueBranchBase**: Issue ブランチの作成元ブランチ（main, develop など）

## ブランチ階層構造

```
IssueBranchBase（main, develop など）
  └─ issue/{issue番号} (Issueブランチ)
       ├─ issue/{issue番号}-phase1 (フェーズ1ブランチ)
       ├─ issue/{issue番号}-phase2 (フェーズ2ブランチ)
       └─ issue/{issue番号}-phase3 (フェーズ3ブランチ)
```

**注意**: Git の制約により、`issue/25` と `issue/25/phase1` は共存できません。
そのため、Phase ブランチはハイフン区切り（`issue/25-phase1`）を使用します。

### ブランチと Worktree の関係

```mermaid
graph TB
    subgraph "Gitブランチ階層"
        MAIN[IssueBranchBase] --> ISSUE[issue/123]
        ISSUE --> PHASE1[issue/123-phase1]
        ISSUE --> PHASE2[issue/123-phase2]
    end

    subgraph "Worktree（einja:issue-exec管理）"
        PHASE1 -.->|base_branch| WT1[worktree: task-1.1]
        PHASE1 -.->|base_branch| WT2[worktree: task-1.2]
        PHASE2 -.->|base_branch| WT3[worktree: task-2.1]
    end
```

## ブランチ命名規則

### 1. Issueブランチ

**命名規則**: `issue/{issue番号}`

**例**:
- `issue/123`
- `issue/456`
- `issue/789`

**作成元**: IssueBranchBase（`--branch` オプションで指定、デフォルトは main）

**目的**:
- GitHub Issue全体の作業を統合する親ブランチ
- すべてのフェーズブランチはこのブランチから派生

### 2. フェーズごとのブランチ

**命名規則**: `issue/{issue番号}-phase{N}`

**例**:
- `issue/123-phase1`
- `issue/456-phase2`
- `issue/789-phase1`

**作成元**: Issueブランチ

**目的**:
- フェーズ単位での作業を分離
- einja:issue-exec の Worker 実行ベースブランチとして使用（原則）
- フェーズ完了後、親ブランチにマージ

## ブランチ命名例

| 仕様書ディレクトリパス | Issueブランチ | Phase 1ブランチ | Phase 2ブランチ |
|------------------|---------------|----------------|----------------|
| `docs/specs/issues/monorepo/issue123-turborepo-setup/` | `issue/123` | `issue/123-phase1` | `issue/123-phase2` |
| `docs/specs/issues/auth/issue456-magic-link/` | `issue/456` | `issue/456-phase1` | `issue/456-phase2` |
| `docs/specs/issues/user/issue789-profile/` | `issue/789` | `issue/789-phase1` | `issue/789-phase2` |

---

## einja:issue-exec 実行時のブランチ運用

### タスク実行シーケンス

```mermaid
sequenceDiagram
    participant User as 開発者
    participant Mgr as Manager
    participant Git as Git
    participant Dir as Director
    participant Wkr as Worker

    User->>Mgr: /einja:issue-exec #123

    rect rgb(230,240,255)
        Note over Mgr,Git: 初期化フェーズ（Issue & Phase ブランチ + worktree）
        Mgr->>Git: git fetch origin
        Mgr->>Git: git branch issue/123 origin/{IssueBranchBase}
        Mgr->>Git: git push -u origin issue/123
        Mgr->>Git: git branch issue/123-phase1 issue/123
        Mgr->>Git: git worktree add ~/.einja/worktrees/issue-123/phase1 issue/123-phase1
    end

    rect rgb(255,245,230)
        Note over Mgr,Wkr: タスク実行フェーズ（tmux + worktree）
        Mgr->>Dir: tmux window で Director 起動（Phase worktree）
        Dir->>Git: git branch task/123-1.1 issue/123-phase1
        Dir->>Git: git worktree add ~/.einja/worktrees/issue-123/task-1.1 task/123-1.1
        Dir->>Wkr: tmux window で Worker 起動（Task worktree）
        Wkr->>Git: 実装 & コミット & push
        Wkr->>Git: gh pr create --base issue/123-phase1 --head task/123-1.1
        Wkr->>Dir: ステータスファイルで完了報告
    end

    rect rgb(230,255,230)
        Note over Dir,Git: 完了検知フェーズ（ステータスファイル監視）
        Dir->>Git: PR マージ処理（マージモードに応じて）
        Dir->>Git: worktree 削除 & tmux window kill
        Dir->>Dir: 依存タスク起動判定 → 新 Worker 起動
        Dir->>Git: GitHub Issue チェックボックス更新
    end

    rect rgb(255,245,230)
        Note over Dir,Wkr: 次タスク開始時
        Dir->>Git: git branch task/123-1.2 issue/123-phase1
        Dir->>Git: git worktree add ~/.einja/worktrees/issue-123/task-1.2 task/123-1.2
        Dir->>Wkr: tmux window で Worker 起動
        Note over Git: 前タスクの変更がマージ済みの Phase ブランチから派生
    end
```

### ブランチ CRUD タイミング

| 操作 | タイミング | 実行者 | 備考 |
|-----|----------|--------|------|
| **Create** Issue ブランチ | コマンド起動時 | Manager | IssueBranchBase から作成 |
| **Create** Phase ブランチ + worktree | コマンド起動時 | Manager | Issue ブランチから作成、`~/.einja/worktrees/issue-{N}/` に配置 |
| **Create** Task ブランチ + worktree | タスク開始時 | Director | Phase ブランチから作成、`~/.einja/worktrees/issue-{N}/` に配置 |
| **Update** Phase ブランチ | タスク PR マージ時 | GitHub | タスク完了後のマージで更新 |
| **Merge** Phase → Issue | Phase 全タスク完了時 | Manager | Phase PR 作成 → マージモードに応じた処理 |
| **Delete** Task worktree | タスク完了後 | Director | タスク完了後に即削除 |
| **Delete** Phase worktree | Phase 完了後 | Manager | Phase マージ後に即削除 |
| **Delete** Phase ブランチ | Issue 完了後 | Manager | Issue ブランチにマージ後 |

### Worktree ライフサイクル

```mermaid
stateDiagram-v2
    [*] --> Created: Director が worktree 作成
    Created --> Running: Worker（claude 対話モード）起動
    Running --> Completed: タスク完了 & PR 作成
    Completed --> Merged: PR マージ
    Merged --> [*]: 即削除（Director が worktree remove）
```

### ブランチ同期の動作

タスク着手時、Director は Phase ブランチの最新状態から Task ブランチを作成します。
先行タスクの PR がマージされた Phase ブランチから派生するため、変更が自動的に引き継がれます。

```mermaid
sequenceDiagram
    participant Main as main<br/>(base)
    participant Issue as issue/123
    participant Phase as issue/123-phase1
    participant Task as task/123-1.2

    Note over Main,Task: タスク着手時のブランチ派生

    rect rgb(240, 248, 255)
        Note over Main,Issue: Step 1: Issue ブランチの同期（Manager）
        Issue->>Issue: fetch origin/issue/123
        Issue->>Issue: merge origin/issue/123 (pull)
        Main->>Issue: merge main (base変更の取り込み)
        Issue->>Issue: push origin
    end

    rect rgb(255, 248, 240)
        Note over Issue,Phase: Step 2: Phase ブランチの同期（Director）
        Phase->>Phase: fetch origin/issue/123-phase1
        Phase->>Phase: merge origin/issue/123-phase1 (pull)
        Issue->>Phase: merge issue/123 (他Phaseの変更取り込み)
        Phase->>Phase: push origin
    end

    rect rgb(240, 255, 240)
        Note over Phase,Task: Step 3: Task ブランチ & worktree 作成（Director）
        Phase-->>Task: Phase ブランチから Task ブランチを作成
        Note over Task: Worker（claude 対話モード）がタスク実行
    end
```

**同期の原則**:
- 先行タスクの PR マージにより Phase ブランチが更新される
- 後続タスクは更新済み Phase ブランチから派生するため変更を引き継ぐ
- コンフリクト発生時は conflict-resolver で解消

### 変更の取り込み対象

| 取り込み元 | 取り込み先 | 取り込み内容 |
|-----------|-----------|-------------|
| IssueBranchBase | Issue ブランチ | 他の Issue やホットフィックスがマージした変更 |
| リモートの Issue ブランチ | ローカル Issue ブランチ | 他の Phase がマージした変更 |
| リモートの Phase ブランチ | ローカル Phase ブランチ | 同じ Phase の先行タスクがマージした変更 |
| Issue ブランチ | Phase ブランチ | 他の Phase がマージした変更（Phase 間の変更共有） |

### 変更の伝播フロー

```
IssueBranchBase（main, develop など）
    ↓ マージ
issue/123
    ↓ マージ
issue/123-phase1
    ↓ Task ブランチとして派生
task/123-1.1（Worker が worktree 上で実行）
```

これにより：
- IssueBranchBase の最新変更が全タスクに反映される
- 同じ Phase 内の先行タスクの変更が後続タスクに反映される
- 他の Phase の完了した変更も全ての Phase に伝播される

---

## 手動ブランチ操作

### 初回実行時

```bash
# 0. IssueBranchBase を決定（デフォルトブランチを取得する場合）
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')

# 1. Issueブランチを作成（IssueBranchBase から）
git checkout $DEFAULT_BRANCH
git pull origin $DEFAULT_BRANCH
git checkout -b issue/123

# 2. フェーズ1ブランチを作成（Issueブランチから）
git checkout -b issue/123-phase1

# 3. リモートにプッシュ
git push -u origin issue/123-phase1
```

### 次のフェーズへ移行時

```bash
# 1. 親ブランチに戻る
git checkout issue/123

# 2. 前フェーズの完了内容をマージ
git merge issue/123-phase1

# 3. 次のフェーズブランチを作成
git checkout -b issue/123-phase2

# 4. リモートにプッシュ
git push -u origin issue/123-phase2
```

### 全フェーズ完了後

```bash
# 1. Issueブランチに最終フェーズをマージ
git checkout issue/123
git merge issue/123-phase3

# 2. IssueBranchBase にPRを作成
gh pr create --base main --head issue/123 \
  --title "feat: Monorepo Turborepoセットアップ完了" \
  --body "全フェーズ完了。Phase 1-3の統合PR。"
```

---

## ブランチマージ戦略

### フェーズ完了時

```bash
# フェーズブランチを親ブランチにマージ
git checkout issue/123
git merge --no-ff issue/123-phase1
git push origin issue/123
```

### タスク完了時

```bash
# IssueブランチをIssueBranchBaseにPRとしてマージ
gh pr create --base main --head issue/123 \
  --title "feat: Monorepo Turborepoセットアップ" \
  --body "..."
```

---

## ブランチ削除ポリシー

### フェーズブランチ

- 親ブランチにマージ後、削除可能
- ただし、トレーサビリティのため残しておくことを推奨

### Issueブランチ

- IssueBranchBase にマージ後、PRクローズと同時に削除

---

## 注意事項

1. **ブランチ名の一貫性**: すべてのブランチは命名規則に従うこと
2. **フェーズ番号の明示**: フェーズ番号は必ず数字で明示（phase1, phase2, ...）
3. **親ブランチの更新**: フェーズ完了時は必ず親ブランチにマージすること
4. **リモート同期**: ブランチ作成後は必ずリモートにプッシュすること

---

## トラブルシューティング

### ブランチが存在しない場合

```bash
# リモートから最新情報を取得
git fetch origin

# ブランチ一覧を確認
git branch -a
```

### ブランチ名を間違えた場合

```bash
# ブランチ名を変更
git branch -m 旧ブランチ名 新ブランチ名

# リモートのブランチ名も更新
git push origin :旧ブランチ名 新ブランチ名
git push origin -u 新ブランチ名
```

### マージコンフリクト発生時

```bash
# コンフリクトを解決後、マージを完了
git add .
git commit -m "Merge phase1 into task branch"
git push origin タスクブランチ名
```

---

## 関連ドキュメント

- [einja:issue-exec ワークフロー](../instructions/issue-exec-workflow.md) - コマンドの使用方法と3階層プロセスの詳細
- [タスク管理](task-management.md) - タスク階層と粒度基準
- [開発ワークフロー](development-workflow.md) - 仕様書作成からタスク実行までの全体フロー
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="branch-strategy-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
