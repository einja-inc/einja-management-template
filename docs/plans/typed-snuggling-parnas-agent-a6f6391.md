# task-loop 関連の調査レポート

## 調査概要
リポジトリ全体で `task-loop` / `vibe-kanban` への参照を検索し、削除・変更されたドキュメントの内容を確認しました。

---

## 1. リポジトリ全体の参照状況

### task-loop / taskLoop 系の検索結果（15ファイル）

| ファイルパス | 状況 |
|-------------|------|
| `docs/einja/instructions/issue-exec-workflow.md` | ✅ 新規 - issue-exec への移行説明あり |
| `docs/plans/linked-greeting-llama.md` | ✅ 計画書 - issue-exec 移行プラン |
| `packages/cli/README.md` | ❌ 残存 - `task:loop` コマンド説明が残っている |
| `README.md` | ❌ 残存 - `pnpm task:loop` の記述あり |
| `docs/specs/issues/cli/issue101-vibe-kanban-mcp-update/*` | ⚠️ 旧Issue仕様書 - 参照のみ（削除不要） |

### vibe-kanban / vibeKanban 系の検索結果（29ファイル）

| カテゴリ | ファイル数 | 内容 |
|---------|-----------|------|
| **Plans** | 3件 | 計画書（`linked-greeting-llama.md`, `effervescent-munching-kite-agent-ac08baf.md` 等） |
| **設定ファイル** | 4件 | `.mcp.json`, `.claude/settings.json`, `.cursor/mcp.json`, `.gitignore` |
| **QA Tests** | 15件 | `docs/specs/issues/cli/issue101-vibe-kanban-mcp-update/qa-tests/**/*.md` |
| **パッケージ** | 2件 | `packages/cli/src/lib/mcp-config.test.ts`, `packages/create-einja-app/.templateignore` |
| **ドキュメント** | 1件 | `.cursor/commands/task-vibe-kanban-loop.md` |
| **他** | 4件 | qa-tests, issue21/22 の旧QAテストファイル |

---

## 2. 削除済みドキュメントの内容確認

### `docs/einja/instructions/task-vibe-kanban-loop.md` （削除済み）

**内容**:
- `pnpm task:loop` コマンドの使用方法
- Vibe-Kanban を使用した親Issue/サブIssue 階層管理
- GitHub Issue からタスクを自動選定し、Vibe-Kanban に登録して連続実行
- Phase ごとに親Issue作成、タスクグループはサブIssueとして登録
- PR作成・マージを経て親IssueがDoneになる仕組み

**処理フロー**:
```
pnpm task:loop <issue-number>
  ↓
1. Issue取得・解析
2. ブランチ作成（issue/N, issue/N-phaseM）
3. Vibe-Kanban MCP 接続
4. Phase毎に親Issue作成
5. サブIssue作成・開始指示（parent_issue_id設定）
6. Claude Code 起動（Vibe-Kanban経由）
7. 15秒ポーリング → Done検知 → GitHub Issue更新
8. Phase全タスク完了 → Phase PR作成・マージ
```

**廃止理由**:
- Vibe-Kanban MCP への依存を排除
- Claude Code カスタムコマンド `einja:issue-exec` に移行（tmux + worktree）

---

## 3. 変更されたドキュメントの確認

### `docs/einja/steering/README.md`

**変更内容**: task-loop への直接的な言及なし。ドキュメント構造の整理のみ。

**関連セクション**:
- 開発ワークフローへのリンクあり（`development-workflow.md`）
- タスク管理へのリンクあり（`task-management.md`）

---

### `docs/einja/steering/branch-strategy.md`

**変更内容**: ブランチ階層とWorktreeの関係を明記。

**重要な追加内容**:
```markdown
### ブランチと Worktree の関係

Gitブランチ階層:
IssueBranchBase → issue/123 → issue/123-phase1, issue/123-phase2

Worktree（einja:issue-exec管理）:
- issue/123-phase1 → worktree: task-1.1, task-1.2
- issue/123-phase2 → worktree: task-2.1
```

**einja:issue-exec 実行時のブランチ運用**:
- Manager: Issue & Phase ブランチ + worktree
- Director: Phase worktree で tmux 起動
- Worker: Task worktree で `/einja:task-exec` 実行

**ブランチ CRUD タイミング**:
| 操作 | タイミング | 実行者 |
|-----|----------|--------|
| Create Issue ブランチ | コマンド起動時 | Manager |
| Create Phase ブランチ + worktree | コマンド起動時 | Manager |
| Create Task ブランチ + worktree | タスク開始時 | Director |
| Update Phase ブランチ | タスク PR マージ時 | GitHub |
| Delete Task worktree | タスク完了後 | Director |
| Delete Phase worktree | Phase 完了後 | Manager |

---

### `docs/einja/steering/development-workflow.md`

**変更内容**: Phase B（タスク実行）セクションが全面的に書き換えられた。

**変更前**: `pnpm task:loop` + Vibe-Kanban
**変更後**: `/einja:issue-exec` + `/einja:task-exec`

**新しいフロー（Phase B）**:
```markdown
## Phase B: タスク実行（/einja:issue-exec or /einja:task-exec）

/einja:issue-exec #123
  ↓
Manager: Issue パース、Phase 毎に Director を tmux で起動
  ↓
Director（Phase毎）: タスクグループを依存順に Worker を起動
  ↓
Worker（/einja:task-exec を実行）:
  - task-executer: 実装
  - task-reviewer: 設計との整合性チェック（自動）
  - task-qa: 動作確認（Playwright/curl）（自動）
  - commit & push → PR 自動作成
  ↓
GitHub で PR レビュー → マージモードに応じてマージ
  ↓
Director: PR マージ検知 → GitHub Issue チェックボックス更新
  ↓
Phase全タスク完了？
├─ Yes → Phase PR 作成 → マージモードに応じた処理
└─ No  → 依存解除された次タスクの Worker を起動
  ↓
全 Phase 完了 → 最終 PR 作成
```

**使い分けの明記**:
| コマンド | 用途 | 対象 | 推奨シーン |
|---------|------|------|----------|
| `/einja:issue-exec` | Issue全体の並列実行 | 複数Phase・複数タスクグループ | 大規模機能実装 |
| `/einja:task-exec` | 単一タスクグループの確実な完了 | 1つのタスクグループ | 複雑な実装、品質重視 |

---

### `docs/einja/steering/task-management.md`

**変更内容**: Vibe-Kanbanへの言及削除、einja:issue-exec への言及追加。

**主要な変更箇所**:

1. **タスク管理の方法**セクション:
   - Vibe-Kanbanの説明削除
   - GitHub Issueによる管理に統一

2. **コマンドリファレンス**:
```markdown
### タスク実行関連コマンド

**Issue全体の並列実行**:
/einja:issue-exec #<issue番号>
/einja:issue-exec #<issue番号> --merge-mode auto      # 全自動モード
/einja:issue-exec #<issue番号> --max-phase <番号>      # 指定Phaseまで実行

**単一タスクグループ実行**:
/einja:task-exec #{issue_number} {タスクグループ番号}
```

3. **Vibe-Kanban関連削除**:
   - 親Issue/サブIssue構造の説明削除（Vibe-Kanban固有）
   - `pnpm task:loop` コマンドの説明削除

---

## 4. 新規追加ファイルの確認

### `.claude/commands/einja/issue-exec.md`

**役割**: GitHub Issue全体のタスクを Manager → Director → Worker の3階層で並列実行する。

**責務**:
| 階層 | 責務 |
|------|------|
| **Manager** | Issue パース、ブランチ管理、worktree 管理、tmux 管理、Director 起動、Phase マージ、質問エスカレーション |
| **Director** | Phase 内のタスクグループ管理、Worker 起動、並列制御、PR マージ検知、変更伝播、質問対応 |
| **Worker** | task-exec 実行、Phase 変更取り込み、PR 作成、完了報告 |

**マージモード**:
| モード | タスクPR | Phase PR | 最終PR |
|--------|---------|---------|--------|
| `manual` | 人間マージ待ち | 人間マージ待ち | 人間マージ待ち |
| `task-group-auto` | CI通過後に自動マージ | 人間マージ待ち | 人間マージ待ち |
| `auto` | CI通過後に自動マージ | CI通過後に自動マージ | 人間マージ待ち（常に手動） |

---

### `docs/einja/instructions/issue-exec-workflow.md`

**役割**: `einja:issue-exec` コマンドの使用方法と3階層プロセスの詳細説明。

**重要な内容**:
- `task-vibe-kanban-loop.md` の代替ドキュメント
- **⚠️ 重要**: Vibe-Kanban（`pnpm task:loop`）は廃止され、`/einja:issue-exec` に移行
- tmux セッション構成、worktree 構成、ステータスファイル、質問エスカレーション

**tmux セッション構成**:
```
tmux session: einja-123
  window 0: Manager
  window 1: Director-Phase1
  window 2: Worker-1.1
  window 3: Worker-1.2
  window 4: Director-Phase2
  ...
```

**ステータスファイル**:
```
~/.einja/sessions/issue-123/
  session.json
  phase-1/
    status.json
    task-1.1.json
  questions/
    q-{uuid}.json
  events.jsonl
```

---

### `scripts/lib/worktree-config.ts`

**役割**: worktree用の設定ファイル読み込み（PostgreSQLポート、アプリポート割り当て等）。

**内容**:
```typescript
export interface WorktreeConfig {
  schemaVersion: number;
  postgres: PostgresConfig;
  apps: AppConfig[];
}

// デフォルト設定
{
  schemaVersion: 1,
  postgres: { port: 25432, containerName: "einja-management-postgres" },
  apps: [{ id: "web", portRangeStart: 3000, rangeSize: 1000 }]
}
```

**機能**:
- `worktree.config.json` を読み込み
- プロジェクトルートを自動検出（`package.json`ベース）
- 存在しない場合はデフォルト設定を返す

**task-loop との関係**: なし（worktree 管理の汎用ユーティリティ）

---

## 5. Plans ディレクトリの確認

### `linked-greeting-llama.md`

**内容**: `einja:issue-exec` への移行プラン。

**重要なポイント**:
- Agent Teams 評価結果（不採用）
  - ネスト不可、cwd指定未サポート、セッション再開不可
  - Worker 内部はサブエージェント（Task ツール）で実装
- 推奨アーキテクチャ: **tmux + サブエージェント**
- 質問エスカレーションチェーン（Worker → Director → Manager → Human）
- マージモード（manual / task-group-auto / auto）

**ファイル変更一覧**:
| ファイル | 状況 |
|---------|------|
| `.claude/commands/einja/issue-exec.md` | ✅ 新規作成 |
| `packages/cli/src/commands/issue-exec/` | ❌ **ディレクトリごと削除**（TypeScript CLI → Claude Code 移行） |
| `docs/einja/instructions/task-vibe-kanban-loop.md` | ❌ 削除（マネージドなので dev-cli 側で対応） |

---

### `effervescent-munching-kite-agent-ac08baf.md`

**内容**: Claude Code MCP サーバー共有方法の調査レポート。

**重要な発見**:
- 現在の `.mcp.json` で `vibe_kanban` は stdio で設定されている
- 各Claude Codeインスタンスで個別プロセスが起動される
- 中央Supergatewayサーバーで共有化する方法が提案されている

**Vibe-Kanban MCP 設定（現状）**:
```json
{
  "mcpServers": {
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban@latest", "--mcp"]
    }
  }
}
```

**task-loop との関係**: Vibe-Kanban MCP は `pnpm task:loop` で使用されていた。廃止により不要になった可能性あり。

---

## 6. 残存している参照（要対応）

### ❌ `packages/cli/README.md`

**該当箇所**:
```markdown
### `task:loop`

GitHub Issueのタスクを自動実行します（Claude Code経由）。
Phase毎に親Issueを作成し、タスクグループをサブIssueとして階層管理します。

pnpm task:loop 123
pnpm task:loop 123 --max-group 1.3
npx @einja/dev-cli task:loop 123
```

**対応**: このセクションを削除または `einja:issue-exec` への移行説明に置き換える。

---

### ❌ `README.md`

**該当箇所**:
```markdown
**追加されるnpm scripts:**

pnpm task:loop 123      # GitHub Issue #123のタスクを自動実行
pnpm einja:sync         # テンプレートから最新設定を同期
```

**対応**: `pnpm task:loop` の記述を削除。

---

### ⚠️ 設定ファイル（`.mcp.json`, `.claude/settings.json`）

**該当箇所**:
```json
{
  "mcpServers": {
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban@latest", "--mcp"]
    }
  }
}
```

**対応**: Vibe-Kanban MCP は `task:loop` で使用されていた。`einja:issue-exec` では不要だが、他の用途で使用される可能性があるため、削除前に確認が必要。

---

### ⚠️ `package.json` scripts

**該当箇所**:
```json
{
  "scripts": {
    "task:loop": "npx @einja/dev-cli task:loop"
  }
}
```

**対応**: `task:loop` スクリプトを削除（検索結果では表示されなかったが、存在する可能性あり）。

---

## 7. CLI コマンド実装の確認

### `packages/cli/src/commands/`

**現在の構成**:
```
packages/cli/src/commands/
├── init.ts
├── list.ts
├── sync.test.ts
└── sync.ts
```

**重要な発見**:
- ✅ `task-loop/` ディレクトリは既に削除済み
- ✅ CLI パッケージから TypeScript 実装は完全に削除されている
- ✅ Claude Code カスタムコマンド（`.claude/commands/einja/issue-exec.md`）に移行済み

**削除されたファイル（git status から）**:
```
D packages/cli/src/commands/task-loop/index.ts
D packages/cli/src/commands/task-loop/lib/__mocks__/README.md
D packages/cli/src/commands/task-loop/lib/__mocks__/child-process.mock.ts
D packages/cli/src/commands/task-loop/lib/__mocks__/sample-issues.ts
D packages/cli/src/commands/task-loop/lib/branch-manager.test.ts
D packages/cli/src/commands/task-loop/lib/branch-manager.ts
D packages/cli/src/commands/task-loop/lib/branch-selector.ts
D packages/cli/src/commands/task-loop/lib/conflict-handler.ts
D packages/cli/src/commands/task-loop/lib/dependency-resolver.test.ts
D packages/cli/src/commands/task-loop/lib/dependency-resolver.ts
D packages/cli/src/commands/task-loop/lib/gh-setup.ts
D packages/cli/src/commands/task-loop/lib/github-client.test.ts
D packages/cli/src/commands/task-loop/lib/github-client.ts
D packages/cli/src/commands/task-loop/lib/horizontal-split-detector.test.ts
D packages/cli/src/commands/task-loop/lib/horizontal-split-detector.ts
D packages/cli/src/commands/task-loop/lib/issue-parser.test.ts
D packages/cli/src/commands/task-loop/lib/issue-parser.ts
D packages/cli/src/commands/task-loop/lib/issue-validator.ts
D packages/cli/src/commands/task-loop/lib/project-selector.ts
D packages/cli/src/commands/task-loop/lib/pull-request-manager.ts
D packages/cli/src/commands/task-loop/lib/retry-utils.test.ts
D packages/cli/src/commands/task-loop/lib/retry-utils.ts
D packages/cli/src/commands/task-loop/lib/task-number-utils.test.ts
D packages/cli/src/commands/task-loop/lib/task-number-utils.ts
D packages/cli/src/commands/task-loop/lib/task-state-manager.test.ts
D packages/cli/src/commands/task-loop/lib/task-state-manager.ts
D packages/cli/src/commands/task-loop/lib/types.ts
D packages/cli/src/commands/task-loop/lib/vibe-kanban-client.test.ts
D packages/cli/src/commands/task-loop/lib/vibe-kanban-client.ts
D packages/cli/src/commands/task-loop/lib/vibe-kanban-rest-client.test.ts
D packages/cli/src/commands/task-loop/lib/vibe-kanban-rest-client.ts
D packages/cli/src/commands/task-loop/lib/worktree-utils.test.ts
D packages/cli/src/commands/task-loop/lib/worktree-utils.ts
```

---

## 8. まとめ

### 移行の状況

| カテゴリ | 状況 |
|---------|------|
| **CLI 実装** | ✅ 完全削除済み（`packages/cli/src/commands/task-loop/`） |
| **カスタムコマンド** | ✅ 新規作成済み（`.claude/commands/einja/issue-exec.md`） |
| **ドキュメント（マネージド）** | ✅ 移行済み（`issue-exec-workflow.md`, `development-workflow.md`, `task-management.md`） |
| **Plans** | ✅ 移行プラン作成済み（`linked-greeting-llama.md`） |
| **README（非マネージド）** | ❌ 残存（`packages/cli/README.md`, `README.md`） |
| **設定ファイル** | ⚠️ 確認必要（`.mcp.json` の vibe_kanban、`package.json` scripts） |

### 残存参照の対応優先度

| 優先度 | ファイル | 対応内容 |
|--------|---------|---------|
| 🔴 高 | `packages/cli/README.md` | `task:loop` セクションを削除または `einja:issue-exec` への移行説明に置き換え |
| 🔴 高 | `README.md` | `pnpm task:loop` の記述を削除 |
| 🟡 中 | `package.json` | `task:loop` スクリプトの確認・削除 |
| 🟡 中 | `.mcp.json`, `.claude/settings.json` | `vibe_kanban` MCP の削除可否確認（他の用途で使用されていないか） |
| 🟢 低 | `docs/specs/issues/cli/issue101-vibe-kanban-mcp-update/` | 旧Issue仕様書（参照のみ、削除不要） |

### 代替機能の確認

| 旧機能（task-loop） | 新機能（issue-exec） |
|--------------------|---------------------|
| TypeScript CLI | Claude Code カスタムコマンド |
| Vibe-Kanban MCP | tmux + worktree + ステータスファイル |
| 親Issue/サブIssue階層 | Manager → Director → Worker 階層 |
| 15秒ポーリング | ステータスファイル監視 |
| PR自動作成（Vibe-Kanban経由） | PR自動作成（Worker が `gh pr create`） |
| マージ検知（Vibe-Kanban） | マージ検知（Director が `gh pr list --state merged` ポーリング） |

---

## 調査完了

**調査日時**: 2026-03-03
**調査者**: Explore Agent
