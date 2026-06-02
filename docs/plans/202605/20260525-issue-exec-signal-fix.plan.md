# issue-exec系 Worker/Director シグナルファイル未作成バグの修正

## Context

issue-exec系コマンド（tmuxモード・Agent Teamsモード両方）で「ディレクターがワーカープロセスの状況をウォッチできていない」バグが報告された。
根本原因は、Worker/Directorの完了時にシグナルファイルが作成されないため、Manager/Leadの監視ループが120秒タイムアウトし、能動的な検知ができないこと。

**仕様と実装の乖離**: 消費側（einja-issue-exec/einja-issue-team-exec）にはシグナルファイルの受信仕様が明記されているが、生産側（einja-task-exec/director-prompt.md）にシグナルファイル作成の指示が記載されていない。

## 現状

### シグナルファイル機構の設計

```
Worker/Director 完了
  → ステータスファイル更新（task-{X.Y}.json の status = "awaiting_review"）
  → シグナルファイル作成（touch ~/.einja/sessions/issue-{N}/signals/worker-{X.Y}.signal）  ← ★欠落
  → Manager/Lead の bash ポーリングループが 2秒以内に検知
  → ゲートチェック実施
```

### 欠落箇所 3つ

| # | ファイル | 問題 |
|---|---------|------|
| 1 | `einja-task-exec/SKILL.md` Step 8 (行451) | status更新後の `touch` コマンドが未記載 |
| 2 | `director-prompt.md` Step 7 (行141), Step 9 (行159) | SendMessage後の `touch` コマンドが未記載 |
| 3 | 両監視ループ | 120秒タイムアウト後のフォールバック動作が未定義 |

## 変更内容

### Fix 1: einja-task-exec/SKILL.md — Step 8 fix_required ループにシグナル再作成を追加

**対象**: `.claude/skills/einja-task-exec/SKILL.md` 行481-485（Step 8 fix_required ブロック）

> **注意**: 初回のシグナルファイル作成は Step 7.5（行464）で対応済み。Fix 1 の修正範囲は **Step 8 の fix_required ループ内でのシグナル再作成のみ**。

現状の fix_required ブロック（行481-485）:
```
  3. directorVerdict = "fix_required" → fixInstructions を読み、修正実行:
     - fixInstructions の内容に基づいて task-executer で修正
     - 修正後、再度 task-reviewer → task-qa → einja-task-commit
     - status を再度 "awaiting_review" に更新
     - directorVerdict をクリア（null に戻す）
```

修正後（順序変更 + シグナル再作成追加）:
```
  3. directorVerdict = "fix_required" → fixInstructions を読み、修正実行:
     - fixInstructions の内容に基づいて task-executer で修正
     - 修正後、再度 task-reviewer → task-qa → einja-task-commit
     - directorVerdict をクリア（null に戻す）
     - fixInstructions をクリア
     - status を再度 "awaiting_review" に更新
     - シグナルファイルを再作成: `touch ~/.einja/sessions/issue-{N}/signals/worker-{X.Y}.signal`
```

> **レースコンディション防止**: directorVerdictクリア → fixInstructionsクリア → status更新 → シグナル作成 の順序を厳守。シグナルファイルは「状態更新完了後の起床トリガー」であり、この順序が逆転するとManagerが起床時に stale な directorVerdict = "fix_required" を読み取り、同じ修正指示を再処理する競合が発生する。

### Fix 2: director-prompt.md — SendMessage後のシグナルファイル作成を追加

**対象**: `.claude/skills/einja-issue-team-exec/director-prompt.md`

3箇所に追加:

**(A) Step 7 行141 — PR作成通知後**
```
   - シグナルファイルを作成:
     ```bash
     mkdir -p ~/.einja/sessions/issue-{N}/signals
     touch ~/.einja/sessions/issue-{N}/signals/director-{ID}.signal
     ```
```

**(B) Step 9 行159 — idle通知後**
```
9. **全タスク完了 or claimable なし**: Lead に `[idle]` 通知後、シグナルファイルを作成: `touch ~/.einja/sessions/issue-{N}/signals/director-{ID}.signal`
```

**(C) 共通プロトコルセクション（行203-208）の末尾 — シグナルファイル包括ルールを追加**

> 挿入位置: `## エラー処理` ではなく `## 共通プロトコル` セクション末尾。シグナルファイルはエラー時固有ではなく、全通知に適用される共通プロトコルの一部であるため。

```
### シグナルファイル作成ルール

Lead への SendMessage 送信後は、以下の基準でシグナルファイルを作成する:

| メッセージ | シグナル | 理由 |
|-----------|---------|------|
| `[pr-ready]` | **必須** | Lead がゲートチェックを即座に実行する必要がある |
| `[idle]` | **必須** | Lead がDirectorの再割当・Phase完了判定を行う必要がある |
| `[error]` エスカレーション | **必須** | Lead がリトライ/中止の判断を即座に行う必要がある |
| `[progress]` | 不要 | 情報ログのみ、Lead の即時アクション不要 |
| `[task-claim]`（broadcast） | 不要 | 情報更新のみ、Lead の即時アクション不要 |
| `[change-summary]`（broadcast） | 不要 | 情報更新のみ |
| `[peer-review]` | 不要 | Director間の直接通信、Lead経由しない |
| `[conflict-resolved]` | 不要 | ログ記録のみ |

コマンド: `mkdir -p ~/.einja/sessions/issue-{N}/signals && touch ~/.einja/sessions/issue-{N}/signals/director-{ID}.signal`
```

### Fix 3: einja-issue-exec/SKILL.md — タイムアウトフォールバック追加

**対象**: `.claude/skills/einja-issue-exec/SKILL.md` 行375の後

```
   - **タイムアウト時のフォールバック**: 120秒経過してもシグナルが検出されなかった場合（`$SIGNALS` が空文字列）、Managerは以下を実行する:
     1. **全Workerのステータスファイルを走査**し、未処理のactionable stateがないか確認する。対象: `status` が `awaiting_review` かつ未判定（`directorVerdict` が null）のWorker
     2. 未処理Workerが見つかればシグナル受信時と同様にゲートチェックを実施する
     3. **Worker pane の生存確認**（tmuxモードのみ）: `tmux list-panes -t "$EINJA_TMUX_SESSION:$EINJA_TMUX_WINDOW"` でWorker paneの存在を確認。paneが消滅しているWorkerが `in_progress` のままの場合は、当該タスクを `failed` に遷移し、ユーザーにエラーを報告する
     4. 未処理もpane消滅もなければ、監視ループの先頭に戻り再度120秒のシグナル待機に入る
     5. **最大待機上限**: 連続5回（約10分間）ステータス変化もpane消滅もない場合、全Worker paneの状態を詳細出力（`tmux capture-pane`）してユーザーに報告し、手動介入を促す
   - これはシグナルファイルの作成漏れ、Worker のハング、プロセスクラッシュに対する防御策である
```

### Fix 4: einja-issue-team-exec/SKILL.md — タイムアウトフォールバック追加

**対象**: `.claude/skills/einja-issue-team-exec/SKILL.md` 行307の後

```
> **タイムアウト時のフォールバック**: 120秒経過してもシグナルが検出されなかった場合、Leadは以下を実行する:
> 1. 全DirectorのTaskListステータスを確認し、未処理のactionable stateがないか走査する。対象: `[pr-ready]`・`[error]`・`[idle]` に相当する状態のDirector
> 2. 未処理があればシグナル受信時と同様に処理する
> 3. 未処理がなければ監視ループの先頭に戻り、再度120秒のシグナル待機に入る
> 4. **最大待機上限**: 連続5回（約10分間）変化がない場合、全Directorの状態をユーザーに報告し手動介入を促す
> これはシグナルファイルの作成漏れに対する防御策である
```

## タスク概要

| ID | タスク | 使用Skill/ツール | 依存 |
|----|--------|-----------------|------|
| 0-1 | Planファイルを `docs/plans/` に配置 | [Bash] | — |
| 1 | einja-task-exec/SKILL.md Step 8 fix_requiredループにシグナル再作成追加（順序変更+touch追加） | [Edit] | 0-1 |
| 2 | director-prompt.md にシグナルファイル作成を追加（個別2箇所 + 共通プロトコル包括ルール） | [Edit] | 0-1 |
| 3 | einja-issue-exec/SKILL.md にタイムアウトフォールバック追加（actionable state走査 + Worker pane生存確認 + 最大待機上限） | [Edit] | 0-1 |
| 4 | einja-issue-team-exec/SKILL.md にタイムアウトフォールバック追加（actionable state走査 + 最大待機上限） | [Edit] | 0-1 |
| 99-1 | 観点別並列コードレビュー | [einja-review-code] | 1,2,3,4 |
| 99-G | コミット承認ゲート | [AskUserQuestion] | 99-1 |
| 99-3 | コミット・プッシュ | [einja-task-commit] | 99-G |

## 並列実行計画

- タスク1,2,3,4 は全て独立したファイルへの変更のため**全並列実行可能**
- worktree不要（Skill定義mdファイルの軽微な修正のみ）

## リスク・不明点

- **リスク低**: 全変更がSkill定義（.md）のみ。実行コードの変更なし
- **`touch` の冪等性**: touchは既存ファイルへの再実行でも安全。消費側の `rm -f` でクリーンアップ済み
- **fix_required ループの再シグナル**: directorVerdictクリア → status更新 → シグナル作成 の順序を厳守。順序逆転はManagerのstale read競合を引き起こす
- **Agent toolモード**: worktree隔離だがシグナルファイルは `~/` パスのため影響なし
- **mkdir -p の防御的追加**: 消費側（Manager/Lead）は既に `mkdir -p` しているが、生産側（Worker/Director）でも防御的に実行する

## 検証・動作確認方法

1. 4ファイルの変更内容をgrepで確認:
   - `grep -n "signal\|touch.*signal" einja-task-exec/SKILL.md` → Step 7.5に既存2箇所 + Step 8 fix_requiredに1箇所（再作成）+ 順序注記
   - `grep -n "signal\|touch.*signal\|mkdir.*signal" director-prompt.md` → 4箇所以上（PR後、idle後、包括ルール表、コマンド行）
   - `grep -n "フォールバック\|タイムアウト\|actionable\|pane.*確認\|tmux.*list" einja-issue-exec/SKILL.md` → 複数箇所
   - `grep -n "フォールバック\|タイムアウト\|actionable" einja-issue-team-exec/SKILL.md` → 複数箇所
2. 仕様整合性: einja-issue-exec 行313の仕様コメントと、einja-task-exec Step 8の実装が一致すること
3. einja-issue-team-exec/SKILL.md 行305の仕様と、director-prompt.mdの記述が一致すること
4. fix_required時の順序: directorVerdictクリア → status更新 → シグナル作成 の順序が明記されていること

## Planレビュー結果（1回目: MAJOR → 修正済み）

### 対応した指摘:
1. **[MAJOR] fix_required再レビュー時のシグナル作成順序レース** → directorVerdictクリア→status更新→シグナル作成の順序を明記
2. **[MAJOR] フォールバックの「変化があれば」が不十分** → 「未処理のactionable state」判定に変更
3. **[MINOR] mkdir -p 欠落** → 生産側にも mkdir -p を追加
4. **[MINOR] 包括ルール挿入位置** → エラー処理セクション→共通プロトコルセクションに移動
5. **[MINOR] SendMessageキュー確認の具体性不足** → 削除し、TaskListステータス確認に一本化
6. **[MINOR] Worker pane能動的チェックの欠如** → Fix 3にtmux list-panes/capture-pane による生存確認を追加
7. **[MINOR] 無限ループ脱出条件** → 連続5回（10分）変化なしで手動介入促進
8. **[MINOR] Agent toolモードへの言及** → リスクセクションに明記
9. **[MINOR] シグナル対象メッセージの基準** → 包括ルールにメッセージ種別対応表を追加
