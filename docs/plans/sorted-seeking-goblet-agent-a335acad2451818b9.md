# `einja-issue-team-exec` Skill アーキテクチャ検討

## 現行 issue-exec の実装分析

現行 `einja-issue-exec` は `tmux + claude CLI + git worktree` の3点セットに強く依存している。

```
Manager (tmux session + claude 対話モード)
  ├── Director Phase 1 (tmux window + claude 対話モード + phase worktree)
  │     ├── Worker 1.1 (tmux window + claude 対話モード + task worktree)
  │     └── Worker 1.2 (tmux window + claude 対話モード + task worktree)
  └── Director Phase 2 (tmux window + claude 対話モード + phase worktree)
        └── Worker 2.1 (tmux window + claude 対話モード + task worktree)
```

**tmux依存の理由（現行）:**
- 対話モード（`claude`）でAskUserQuestionを使うため
- Manager/Director/Workerが独立したプロセスとして長期間稼働するため
- ステータスは `~/.einja/sessions/` ファイルベースで管理

**問題点:**
- CLI環境（tmux使用可能）以外では動作しない
- Desktop / VS Code Extension では tmux が使えない
- `claude -p`（非対話モード）だとAskUserQuestionが使えない（= 質問エスカレーションができない）

---

## 設計判断 1: 階層構造（3階層 vs 2階層 vs ハイブリッド）

### 分析

**現行3階層の存在理由:**
- tmux対話モードではManagerが30秒間隔でポーリングするため、直接全Workerを監視するのはコスト高
- Directorに `spec事前チェック`, `依存DAG解析`, `ゲートチェック`, `Workerリトライ` などの複雑な責務を委譲している
- Phase間の独立性（Director間はお互いを知らない）

**サブエージェントモデルでの変化:**
- Task tool + `run_in_background: true` で並列起動すると、Managerが全Workerの `TaskOutput` をポーリングできる
- `isolation: "worktree"` により独立worktreeが自動付与される（ブランチ管理が変わる）
- Agent toolのビルトイン結果報告（TaskOutput）があるため、ファイルベースのステータス管理が不要

**3階層のデメリット（サブエージェントモデルで）:**
- ネストが深いと `TaskOutput` の取得が複雑になる
  - Manager → Director: Directorの完了を待つ
  - Director → Worker: Workerの完了をDirectorが待つ
- Directorがサブエージェントの場合、`AskUserQuestion` が使えない
  - PENDING_QUESTIONS プロトコルで Manager 経由でユーザーに届けるが、2段階エスカレーション（Worker→Director→Manager→User）になる
- Phase内のWorker完了待ちをDirectorに委譲することで、Managerから進捗が見えにくい

**2階層のデメリット:**
- Managerが全Worker（全Phase合計）を直接管理する
- Phase間のシーケンシャル実行（Phase N完了→Phase N+1開始）をManagerが直接制御する必要がある
- Phase内のWorker依存DAGもManagerが解析・管理する
- 責務集中によりManagerのコンテキストが肥大化するリスク

### 推奨: ハイブリッド（状況適応型）

```
通常ケース（Phase間に依存関係あり = 直列Phase）:
  Manager
    ├── Worker 1.1 (Phase1, isolation:worktree)
    ├── Worker 1.2 (Phase1, isolation:worktree)
    └── Worker 2.1 (Phase2, isolation:worktree) ← Phase1完了後に起動

並列Phaseケース（Phase間に依存関係なし）:
  Manager
    ├── Director Phase 1 (isolation:worktree)
    │     ├── Worker 1.1
    │     └── Worker 1.2
    └── Director Phase 2 (isolation:worktree)
          └── Worker 2.1
```

**判定基準:**
- Phaseが1つ、またはPhase間が直列依存 → 2階層（Manager→Worker）
- Phase間に並列関係がある → 3階層（Manager→Director→Worker）

**根拠:**
- 大多数のIssueは単一Phaseかシンプルな直列Phase構成
- 3階層は並列Phaseが明確に存在する場合のみ使う（コスト対効果）
- 2階層はManagerがコンテキストを一元把握できるため、AskUserQuestionによるエスカレーションが最短経路になる

---

## 設計判断 2: ブランチ戦略

### `isolation: "worktree"` の挙動

Claude Code SDK の `isolation: "worktree"` は、サブエージェント起動時に新しい worktree を自動作成する。ブランチ名は自動生成される（制御不可）。

**問題:** 現行の `issue/{N}`, `issue/{N}-phase{M}`, `task/{N}-{X.Y}` ブランチ体系と整合しない。

### 選択肢

**Option A: isolation:worktree に任せる（自動ブランチ）**
- メリット: シンプル。手動ブランチ管理が不要
- デメリット: PR作成時のbase/headブランチが現行体系と異なる。人間がPRを見たときに何のWorkerか不明瞭
- 評価: PRのbranch名が読みにくくなるため、採用しにくい

**Option B: Worker起動前に明示的にブランチ作成、isolation:worktreeのブランチを後からrename/rebase**
- メリット: ブランチ体系を維持できる
- デメリット: isolation:worktree の自動ブランチを rename することは SDK 上サポートされていない

**Option C: isolation:worktree を使わず、Workerにブランチ作成・worktree操作を自己実施させる**
- メリット: 現行のブランチ体系を完全維持。Workerが `git worktree add` を自分で行う
- デメリット: isolation によるサンドボックス保護がない。Worker間でリポジトリの `.git` を共有するため、Worker間のgit操作安全ルール順守が重要
- 評価: 現行 issue-exec と同様の方式。CLAUDE.md の git安全ルールで担保

**Option D: isolation:worktree を使いつつ、worktree内でブランチを作成してpush。PRはworktree内ブランチで作成**
- メリット: sandboxは得られる。PRのbaseは正しく設定できる
- デメリット: isolation:worktreeが作る自動ブランチは使用されず、Worker内で別途 `git checkout -b task/{N}-{X.Y}` する
- 評価: 二重管理になるが実用的

### 推奨: Option C（Worker自己管理）または Option D（isolation+内部ブランチ）

現行体系（`task/{N}-{X.Y}` → `issue/{N}-phase{M}` → `issue/{N}` → `baseBranch`）の意味は大きい（人間のレビュー体験）。

**推奨は Option D:**
- `isolation: "worktree"` でWorkerを物理的に分離（CLAUDE.md安全ルールの補完）
- Worker内で `git checkout -b task/{N}-{X.Y}` して現行ブランチ体系を維持
- PR作成は Worker内から `gh pr create --base issue/{N}-phase{M}` で実行

ただし、`isolation: "worktree"` が実際にどのブランチから worktree を作るかの挙動確認が必要（実装時に要検証）。

---

## 設計判断 3: 状態管理

### Agent toolビルトインの結果報告 vs ファイルベース

**Agent toolビルトイン:**
- `TaskOutput` でサブエージェントの結果を取得できる
- `run_in_background: true` で並列起動し、全タスク完了後に `TaskOutput` でまとめて結果取得
- ビルトインの機能で十分なため、ファイルベースのステータス管理は不要

**ファイルベース（現行 `~/.einja/sessions/`）が必要な場面:**
- 質問エスカレーション（WorkerからManagerへのPENDING_QUESTIONS中継）
- Workerがawaiting_review状態をDirectorに通知するシグナリング
- セッション復旧（Manager異常終了後の再開）

**結論:**
- **通常の状態管理**: Agent toolビルトイン（TaskOutput）を使う
- **質問エスカレーション**: PENDING_QUESTIONSプロトコルを使う（ファイル不要）
- **セッション復旧**: `~/.einja/sessions/issue-{N}/session.json` は最小限維持（Phase進捗のみ）
- **ゲートチェック**: DirectorがWorkerのTaskOutput結果を受け取り、そこでチェック

### 既存 `~/.einja/sessions/` との互換性

新Skill（issue-team-exec）は独立したSkillとして作成するため、現行 issue-exec との後方互換性は不要。ただし、セッション復旧のためのファイル構造は似た形式で維持する（ユーザーの認知コスト削減）。

---

## 設計判断 4: エラーリカバリ

### Worker失敗時のリトライ

**現行:** Directorがtmuxウィンドウ消失を15秒間隔で監視 → 自力リトライ（最大2回）

**新Skill案:**
```
Manager / Director が Worker の TaskOutput を受け取る
  ├── 正常完了（SUCCESS） → 次の処理へ
  ├── 失敗（FAILURE） → 同じ isolation:worktree でリトライ（最大2回）
  └── PENDING_QUESTIONS → ユーザーに質問 → 回答をWorkerに渡して再開
```

**ポイント:**
- `run_in_background: true` の場合、TaskOutput がエラー内容を含む
- リトライは新しい Task tool 呼び出し（resume ではなく新規起動）
- worktree の状態はリトライ間で引き継ぐ（同じworktreeをWorkerに再渡し）

### Manager異常終了時のリカバリ

サブエージェントモデルでは、Manager がメインセッション。
- メインセッションがクラッシュした場合 → Worker（サブエージェント）も全停止
- 復旧手段: `~/.einja/sessions/issue-{N}/session.json` の進捗情報から再開

**実装方針:**
- Manager起動時に `session.json` を書き込み（Phase進捗をリアルタイム更新）
- `--resume` フラグで起動した場合、完了済みPhaseをスキップして未完了Phaseから再開

### チェックポイント

```
session.json（最小構成）:
{
  "issueNumber": 123,
  "baseBranch": "main",
  "mergeMode": "manual",
  "startedAt": "ISO8601",
  "phases": [
    { "number": 1, "status": "completed" },
    { "number": 2, "status": "in_progress",
      "taskGroups": [
        { "id": "2.1", "status": "completed", "prNumber": 456 },
        { "id": "2.2", "status": "in_progress" }
      ]
    }
  ]
}
```

---

## 設計判断 5: einja-task-exec との統合

### 現行の統合方法

```
Director（tmux window）
  → tmux send-keys: `/einja-task-exec #{N} {X.Y}`
```

### 新Skillでの統合方法

```
Worker（サブエージェント、isolation:worktree）
  → プロンプト内で Skill tool を呼び出し: `einja-task-exec #{N} {X.Y}`
```

**注意点:**

1. **Director承認待ちループ（Step 8）の扱い:**
   - 現行の `einja-task-exec` は `~/.einja/sessions/issue-{N}/` の存在でissue-exec経由かを判定する
   - 新Skillでは `~/.einja/sessions/issue-{N}/` を作成するため、この判定が効く
   - ただし、Step 8の「DirectorVerdictをポーリング」はファイルベース。新Skillではこれをどう扱うか要検討

2. **選択肢A: task-exec の Step 8 を活かす（ファイルベース連携を維持）:**
   - Manager/DirectorがWorkerの TaskOutput を待つのではなく、task-exec がawaiting_reviewになったら `task-{X.Y}.json` を見てDirectorが判定を書く
   - 既存 task-exec との後方互換性が保たれる
   - ファイルベースの依存が残る（デメリット）

3. **選択肢B: issue-team-exec 専用の task-exec 変形を作る:**
   - Worker は直接 `task-executer/task-reviewer/task-qa/einja-task-commit` を順次呼ぶ（task-exec を使わない）
   - TaskOutput で完了報告 → ManagerがDirectorとしてゲートチェック
   - task-exec の Director承認待ちループ（Step 8）が不要
   - 実装の重複が生じる（デメリット）

4. **推奨: 選択肢A（既存 task-exec を活かす）:**
   - Worker サブエージェントは既存の `einja-task-exec` Skill を呼ぶ
   - task-exec は `~/.einja/sessions/` の存在を検知してStep 8に入る
   - Manager/DirectorはWorkerが `awaiting_review` になるのをファイル監視（30秒間隔ポーリング）で検知
   - ゲートチェック → `directorVerdict` 書き込み → Workerが検知して次へ

**コミット・ブランチ管理の整合性:**
- `einja-task-commit` Skill は Workerサブエージェントから呼ばれる（現行通り）
- Worker は `task/{N}-{X.Y}` ブランチにコミット・プッシュ
- PRの base は `issue/{N}-phase{M}`（3階層時）または `issue/{N}`（2階層時）

---

## 設計判断 6: Agent Teams オプション

### CLI環境でのAgent Teams活用

**メリット:**
- Directorが独立したClaude Codeインスタンス = 各自コンテキストウィンドウを持つ
- Phase数が多い場合のManagerコンテキスト節約
- Director間でメッセージ通信が可能（PENDING_QUESTIONS の中継が不要）

**デメリット:**
- CLI環境のみ（Desktop / VS Code では利用不可）
- `einja-team-exec` の制限: 1セッションにつき1チームのみ、nested teams不可
- Workerをteammateとして spawn するとteam sizeが爆発する（Phase×Worker数）

### 環境検出による自動切り替えの実現可能性

```
起動時:
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 かつ tmux利用可能
    → Director を teammate として spawn（Agent Teams モード）
  それ以外
    → Director を Task tool で spawn（サブエージェントモード）
```

**評価:**
- 技術的には実現可能だが、2つのコードパスを維持するコストが高い
- Agent Teams はWorkerレベルまで展開すると「nested teams不可」制約に抵触する
- Directorをteammateとして、WorkerをDirector配下のサブエージェントとする混合モードは理論的に可能だが複雑

**推奨: Phase 1では無視、将来オプションとして留保**
- まずサブエージェントのみで実装し、安定動作を確認
- Agent Teams は実験的機能のため、設計を過度に複雑化させるリスクを避ける

---

## 推奨アーキテクチャ

### 全体構成図

```
Manager（メインセッション）
  ├── Step 0: 環境準備（tmux不要、session.json初期化）
  ├── Step 1: Issue パース（Phase構造・タスクグループ抽出）
  ├── Step 2: ブランチ作成（issue/{N}, issue/{N}-phase{M}）
  │
  ├── [2階層モード: 直列Phase or 単一Phase]
  │     Phase 1:
  │       Worker 1.1（Task, isolation:worktree）→ einja-task-exec
  │       Worker 1.2（Task, isolation:worktree）→ einja-task-exec
  │       ↓ 全Worker完了
  │     ゲートチェック（Manager直接実施）
  │       ↓ 通過
  │     Phase 1 PR作成（issue/N-phase1 → issue/N）
  │       ↓ マージ
  │     Phase 2: ...（順次）
  │
  └── [3階層モード: 並列Phase]
        Director Phase 1（Task, isolation:worktree）
          Worker 1.1（Task, isolation:worktree）→ einja-task-exec
          Worker 1.2（Task, isolation:worktree）→ einja-task-exec
          ゲートチェック（Director実施）
          Phase 1 PR作成
        Director Phase 2（Task, isolation:worktree）[並列]
          Worker 2.1（Task, isolation:worktree）→ einja-task-exec
          ゲートチェック
          Phase 2 PR作成
          ↓ 全Director完了
        最終PR作成（issue/N → baseBranch）
```

### ブランチ体系

```
{baseBranch}
 └── issue/{N}
      ├── issue/{N}-phase1
      │    ├── task/{N}-1.1  （Worker内で git checkout -b）
      │    └── task/{N}-1.2
      └── issue/{N}-phase2
           └── task/{N}-2.1
```

### 状態管理

```
~/.einja/sessions/issue-{N}/
  session.json          # Manager が管理（Phase進捗・マージモード）
  phase-{M}/
    task-{X.Y}.json     # Worker/Director が管理（Step 8連携用）
```

AgentツールのTaskOutput を主要な結果取得手段として使用し、ファイルは最小限（Step 8連携とリカバリのみ）。

### PENDING_QUESTIONS プロトコルの流れ

```
Worker → PENDING_QUESTIONS → TaskOutput
  Director/Manager が受け取り
    → AskUserQuestion でユーザーに質問
    → 回答を新しいTask呼び出し（resume）でWorkerに渡す
```

---

## リスク分析と対策

| リスク | 影響 | 対策 |
|--------|------|------|
| isolation:worktreeのブランチ名が制御不可 | PRのbase/headが不明瞭 | Worker内で明示的にブランチ作成（Option D） |
| Worker数×Phase数でコンテキスト肥大 | Manager/Directorのトークンコスト増大 | 2階層モードで必要最小限の情報のみWorkerに渡す |
| einja-task-exec Step 8のファイルポーリング | Manager/Directorがポーリングループに入る | 30秒間隔のポーリングはBashでsleepループ（Agent tool内のloopは避ける） |
| サブエージェントでAskUserQuestionが使えない | 質問エスカレーションが2段階になる | PENDING_QUESTIONSプロトコルを全階層で徹底。最大2回までの制限 |
| Manager異常終了（メインセッションクラッシュ） | 全Worker停止 | session.jsonへのリアルタイム書き込み + --resume機能 |
| isolation:worktreeの実際の挙動が不明 | ブランチ管理が設計通りにならない | 実装時に単純ケースで動作確認してから本実装 |

---

## 現行 issue-exec からの移行パス

### フェーズ1: issue-team-exec の独立実装
- `einja-issue-exec` とは別の新Skill `einja-issue-team-exec` として作成
- 単一Phase・直列Phase（2階層）のみサポート
- tmux / CLI依存なし

### フェーズ2: einja-task-exec との統合検証
- isolation:worktreeの実際の挙動を確認
- Worker内でeinja-task-execが正常動作するか検証
- Step 8（Director承認待ちループ）とファイル連携の動作確認

### フェーズ3: 並列Phase対応（3階層）
- Phase間依存関係の自動解析
- Director サブエージェントの実装
- 並列PhaseのゲートチェックとPR管理

### フェーズ4: 既存 issue-exec との共存・移行
- `einja-issue-exec`（CLI専用）を残しつつ、新Skill を推奨
- ユーザーがDockerやDesktopから使う場合は issue-team-exec を推奨
- 将来的に機能が安定したら issue-exec を非推奨化

---

## 未解決の設計質問（要ユーザー判断）

1. **einja-task-exec の Step 8 を使う（ファイル連携維持）か、issue-team-exec専用フローにするか**
   - Step 8を使う場合: ファイルポーリングがWorkerに残る（デメリット）が既存Skillを再利用（メリット）
   - 専用フローにする場合: Task tool の結果をDirectorがそのまま受け取れて綺麗だが、task-execと実装が乖離する

2. **isolation: "worktree" を使うか否か**
   - 使う場合: sandboxは得られるがブランチ管理が複雑（Option D）
   - 使わない場合: 現行と同じworktree手動管理（CLAUDE.mdの安全ルールで担保）

3. **2階層 vs 3階層の切り替えを自動にするか、ユーザー選択にするか**
   - 自動判定（Phase間依存関係から推論）vs 明示的な `--mode 2tier` / `--mode 3tier`
