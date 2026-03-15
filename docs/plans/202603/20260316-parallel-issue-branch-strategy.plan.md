# 複数Issue並行実行時のブランチ戦略設計

## Context

複数のClaude Codeセッションが同一リポジトリで並行作業するユースケースに対応する。現在のSkill設計には、メインリポジトリのHEAD/working tree競合の問題があり、並行実行時に破壊的な干渉が発生する。

### 想定ユースケース
```
同一マシン、同一gitリポジトリ
├── Claude Code #1: /einja-issue-exec #100       ← tmux+worktree方式
├── Claude Code #2: /einja-issue-team-exec #200  ← Agent Teams方式
├── Claude Code #3: /einja-issue-exec #300       ← 別Issue
└── Claude Code #4: 手作業（別ブランチで作業）     ← 手動チェックアウト
```

## 現状

### 各Skillのメインリポジトリへの依存度

| Skill | 初期化時のメインリポ操作 | 実行中のメインリポ操作 | 危険度 |
|-------|----------------------|---------------------|--------|
| einja-issue-exec | `git branch` + `git worktree add`（HEADは変更しない） | なし（Manager worktree内で完結） | **低** |
| einja-issue-team-exec | **`git checkout`でHEADを変更** | **Phase完了時に`git checkout`でHEADを変更** | **高** |

### einja-issue-team-exec の問題箇所

**Step 2（初期化）**:
```bash
git checkout ${baseBranch}           # ← メインリポのHEADを変更
git pull origin ${baseBranch}
git checkout -b issue/${N}           # ← メインリポのHEADを変更
git checkout -b issue/${N}-phase1    # ← メインリポのHEADを変更
```

**Step 6（次Phase準備）**:
```bash
git checkout issue/${N}              # ← メインリポのHEADを変更
git checkout -b issue/${N}-phase{M+1}  # ← メインリポのHEADを変更
```

これらの`git checkout`は、同時に動作する他のClaude Codeセッション（#1, #3, #4）のメインリポ作業ディレクトリを破壊する。

### git共有リソースの競合リスク

| リソース | 共有 | 競合シナリオ |
|---------|------|------------|
| HEAD / index / working tree | **非共有**（worktreeごとに独立） | メインリポのHEADを複数セッションが`checkout`すると競合 |
| `refs/`（ブランチ） | **共有** | どのworktreeからでも同じブランチ一覧が見える（正常動作） |
| `packed-refs` | **共有** | 同時`git branch`/`git fetch`で`packed-refs.lock`競合エラー（低頻度） |
| `objects/` | **共有** | コミットオブジェクトは共有（正常動作） |

### 既存の同期メカニズム（branch-strategy.md）
branch-strategy.mdの「ブランチ同期の動作」セクションに以下が**既に定義済み**:
- Step 1: `IssueBranchBase → Issueブランチ` への merge 取り込み
- Step 2: `Issueブランチ → Phaseブランチ` への merge 取り込み
- ただし自動トリガーは未定義（手動、タスク着手時のみ）

## 変更内容

### 原則: メインリポのHEAD/working treeに触らない

**全Skillの操作をworktree内で完結させ、メインリポのHEADを変更する`git checkout`を排除する。**

ブランチ作成は `git branch`（HEADを変えない）で行い、作業は `git worktree add` で分離した環境で行う。

### 1. einja-issue-team-exec SKILL.md の `git checkout` 排除

**対象**: `.claude/skills/einja-issue-team-exec/SKILL.md`

#### Step 2（初期化）の修正

Before:
```bash
git checkout ${baseBranch}
git pull origin ${baseBranch}
git checkout -b issue/${N}
git push -u origin issue/${N}
git checkout -b issue/${N}-phase1
git push -u origin issue/${N}-phase1
```

After:
```bash
git fetch origin
git branch issue/${N} origin/${baseBranch} 2>/dev/null || true
git push -u origin issue/${N}
git branch issue/${N}-phase1 issue/${N} 2>/dev/null || true
git push -u origin issue/${N}-phase1
# メインリポのHEADは一切変更しない
# lock系エラー時は1-2秒待機→再試行（最大3回）
```

#### Step 6（次Phase準備）の修正

Before:
```bash
git checkout issue/${N}
git pull origin issue/${N}
git checkout -b issue/${N}-phase{M+1}
```

After:
```bash
git fetch origin
git branch issue/${N}-phase{M+1} origin/issue/${N} 2>/dev/null || true
git push -u origin issue/${N}-phase{M+1}
# メインリポのHEADは一切変更しない
# lock系エラー時は1-2秒待機→再試行（最大3回）
```

### 2. einja-issue-exec SKILL.md の確認・微修正

**対象**: `.claude/skills/einja-issue-exec/SKILL.md`

einja-issue-execは既にStep 2で`git branch` + `git worktree add`を使用しておりHEADを変更しない設計。ただし以下を確認・明記:
- Step 2の`git branch`がHEADを変えないことを注釈で明示
- lock系エラー全般（`packed-refs.lock`, `FETCH_HEAD.lock`, `cannot lock ref`等）のリトライ（jitter付き1〜2秒、最大3回）を追加

### 3. branch-strategy.md に「複数Issue並行実行」セクションを追加

**対象**: `docs/einja/steering/branch-strategy.md`（managed区画内）

追加内容:

#### 3-1. 並行実行の前提ルール
- **メインリポのHEADに依存しない**: 全Skillはブランチ作成に`git branch`を使い、`git checkout`は自身のworktree内でのみ使用
- **各Claude Codeセッションの分離**: Issue実行Skillは自前worktreeで分離。手作業セッションはEnterWorktreeまたは手動worktreeで分離を推奨
- **lock系エラー全般のリトライ**: `git fetch`/`git branch`/`git push`でlock系エラー（`packed-refs.lock`, `FETCH_HEAD.lock`, `cannot lock ref`等）が出た場合、jitter付き1〜2秒待機→再試行（最大3回、失敗時はabort）
- **ブランチ作成の冪等性**: resume/再試行時に`branch already exists`で失敗しないよう`git branch ... 2>/dev/null || true`でガード

#### 3-2. 複数Issue並行時のブランチ図
```
main
 ├── issue/100                   Claude Code #1 (issue-exec)
 │    ├── issue/100-phase1
 │    └── issue/100-phase2
 ├── issue/200                   Claude Code #2 (issue-team-exec)
 │    └── issue/200-phase1
 └── issue/300                   Claude Code #3 (issue-exec)
      └── issue/300-phase1
```

#### 3-3. ブランチ操作安全ルール

| 対象ブランチ | 許可操作 | 理由 |
|------------|---------|------|
| `issue/{N}` | **merge-only** | 複数エージェントが参照する共有ブランチ |
| `issue/{N}-phase{M}` | **merge-only** | DirectorとWorkerが参照 |
| `task/{N}-{X.Y}` | rebase可 | 単独Worker所有 |

#### 3-4. マージ戦略: 楽観的並行マージ
- 先にmainにマージしたIssueが勝ち
- 後続Issueはmainの最新をmerge取り込みしてからPR更新
- Issue間依存がある場合: `--base-branch`でIssueブランチを指定するか、人間が実行順序を制御

#### 3-5. IssueBranchBase自動同期
- Managerの監視ループでIssueBranchBaseの進行を検知
- 進行検知時: `issue/{N}` ブランチで `git merge origin/{IssueBranchBase}` 実行
- merge成功 → `sync_required` 通知のみ発行（Phaseブランチは直接更新しない）
- Directorは安全ポイント（タスク開始前・マージ直後）でPhaseブランチを同期
- merge失敗 → einja-conflict-resolver → 解消不可ならエスカレーション

### 4. issue-exec-protocol.md に「IssueBranchBase自動同期プロトコル」追加

**対象**: `docs/einja/instructions/issue-exec-protocol.md`

追加内容:
- 同期プロトコルの詳細手順（上記3-5のSSOT）
- packed-refs.lockリトライポリシー
- 複数Issue並行時のマージ順序ルール

### 5. issue-exec-workflow.md に複数Issue並行の概要追記

**対象**: `docs/einja/instructions/issue-exec-workflow.md`

追加内容:
- 「複数Issue並行実行」の概要とbranch-strategy.md、issue-exec-protocol.mdへの参照

## タスク概要

※ 本Planはドキュメント変更のみのためworktree不要
※ ファイル宣言機構（active-issues.json）は今回スコープ外（別Issue）
※ Agent Teams版の`${project-name}`未定義問題は今回スコープ外（別Issue）

| ID | タスク | 使用Skill/サブエージェント | 依存 |
|----|--------|--------------------------|------|
| 0-0 | タスク登録 | TaskCreate | - |
| 0-1 | Planファイルリネーム | Bash | 0-0 |
| 1-1 | **einja-issue-team-exec SKILL.md の `git checkout` 排除** | `general-purpose` サブエージェント | 0-1 |
| 1-2 | **einja-issue-exec SKILL.md の注釈追加・リトライ追加** | `general-purpose` サブエージェント | 0-1 |
| 1-3 | branch-strategy.md に「複数Issue並行実行」セクション追加 | `general-purpose` サブエージェント | 1-1 |
| 1-4 | issue-exec-protocol.md に「IssueBranchBase自動同期プロトコル」追加 | `general-purpose` サブエージェント | 1-3 |
| 1-5 | issue-exec-workflow.md に複数Issue並行の概要追記 | `general-purpose` サブエージェント | 1-3 |
| 99-1 | 観点別並列コードレビュー | `einja-review-code` | 1-1〜1-5 |
| 99-2 | 動作確認（ドキュメント整合性チェック） | Grep/Read | 99-1 |
| 99-G | コミット承認ゲート | AskUserQuestion | 99-2 |
| 99-3 | コミット・プッシュ | `einja-task-commit` | 99-G |

## 並列実行計画

```
Phase 0: 0-0 → 0-1
Phase 1: [1-1, 1-2] 並列（Skill修正は独立）
Phase 2: 1-3（branch-strategy.md — 戦略定義）
Phase 3: [1-4, 1-5] 並列（protocol/workflowは独立）
Phase 4: 99系（順次）
```

## リスク・不明点

1. **docs/einja/ 編集可否**: テンプレートリポジトリ（原本）なので編集可能。CLAUDE.md明記済み
2. **追加セクションはmanaged区画内**: 全プロジェクト共通仕様として配布
3. **packed-refs.lockリトライの実効性**: 低頻度イベントのためリトライ3回で十分と判断。深刻な場合はgit gc --auto相当が必要だが今回はスコープ外
4. **einja-issue-team-exec の`git checkout`排除による副作用**: `git branch`はHEADを変えないため、Leadが「今どのブランチにいるか」を追跡する必要がなくなる。これは設計上のメリット

## 検証・動作確認方法

- 両SKILL.mdで`git checkout`がworktree外で使われていないことをGrep確認
- branch-strategy.mdの新セクションが既存の「ブランチ同期の動作」と矛盾しないこと確認
- 全ドキュメント間の相互参照が壊れていないことをGrep確認
- merge-only方針が全ドキュメントで統一されていることを確認
- 新セクションがmanaged区画内に正しく配置されていることを確認

## レビュー履歴

### レビュー1回目（MAJOR）
- レビュアー1: MAJOR — 現状分析の誤認、タスク依存関係逆転、managed tag未検討
- レビュアー2（codex-agent）: MAJOR — 共有ブランチへのrebase危険、force-push副作用未管理
- **対応**: rebase→merge-only、現状分析正確化、タスク依存関係修正

### ユーザーフィードバック1回目
- 「親プロセスのworktree戦略が抜けている」→ 親プロセス戦略セクション追加

### レビュー2回目（MINOR）
- レビュアー1: PASS — 全観点OK
- レビュアー2（codex-agent）: MINOR — lock系リトライ対象拡張、ブランチ作成冪等性ガード
- **対応**: 両指摘をPlanに反映（リトライ対象拡張、`2>/dev/null || true`追加）

### ユーザーフィードバック2回目
- 「複数Claude Codeセッションが同一リポジトリで並行作業するユースケース」を明示
- issue-team-execの`git checkout`がメインリポHEADを変更する根本問題を特定
- **対応**: Plan全体を「メインリポのHEADに触らない」原則で再設計。issue-team-execのgit checkout排除をタスク最優先に変更
