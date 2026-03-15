# einja-issue-team-exec: task-exec Skill呼び出し廃止 + Directorプロンプト再設計

## Context

einja-issue-team-execのDirector Teammateが`einja-task-exec` Skillを呼び出す現行設計に、以下の構造的問題がある:

1. **コンテキスト汚染**: task-exec Skillの「追加指示待ち状態」ロジック（~460行）がTeammateのコンテキストに残留し、後続メッセージ（`[peer-review]`, `[conflict-alert]`等）の解釈に影響する
2. **実行モード誤判定**: task-execは`~/.einja/sessions/issue-{N}/`の存在でissue-exec経由かを判定するが、Agent Teams版はこのディレクトリを作成しないため常にスタンドアロンと判定され、「追加指示待ち状態」でブロックする
3. **ネスト深度**: Teammate→Skill(task-exec)→Subagent(executer/reviewer/qa)の3層ネストでコンテキストが膨張する

**役割ベースチーム分担（実装3+レビュー2+QA2等）は検討の結果見送り**。理由:
- Agent TeamsのTeammate数が固定（TeamCreate時に確定、途中増減不可）→ フェーズ間でリソースアンバランス（レビュー待ちの間Reviewerがアイドル等）
- 実装コンテキスト（変更ファイル・設計意図・AC対応）のSendMessage転送が重すぎる（数千トークン）
- タスクグループ=ファイル責任境界の前提が崩れ、ファイル競合リスク増大
- 既存のピアレビュー機構（Director間の`[peer-review]`）が「実装者≠レビュアー」を低コストで補完している

## 現状

### Director Teammateの実行フロー（issue-team-exec SKILL.md Step 4）
```
claim → worktree作成 → einja-task-exec Skill呼び出し → PR作成 → 完了報告 → next claim
```

task-exec Skill内部（SKILL.md Step 1-8）:
```
Issueパース → spec読込・AC抽出 → TaskCreate登録 → 並列実行(executer×N) → reviewer → qa → commit → 実行モード判定 → 追加指示待ち or Director承認待ち
```

### 問題の流れ
```
Director TeammateがSkill呼び出し
  → task-exec SKILL.md全文（~460行）がTeammateコンテキストに追加
  → task-exec完了後も「追加指示待ち状態」ロジックが残留
  → 次のSendMessage（[peer-review]等）を「追加修正の指示」と誤認するリスク
  → Agent Teams版では~/.einja/sessions/が無い→スタンドアロン判定→ブロック
```

## 変更内容

### 方針: task-exec Skill呼び出しを廃止し、Directorプロンプトにフローを直接記述

task-execが担っていた責務を分解・移管する:

| task-execの責務 | 移管先 | 理由 |
|----------------|--------|------|
| Issueパース + specパス特定 | **Lead**（Step 1-2で既に実行中） | Leadが一括実行し、TaskCreateのdescriptionに埋め込む |
| spec読込 + AC抽出 | **Lead**（Step 2.5として新設） | 同上 |
| TaskCreate登録（X.Y.Z個別タスク） | **Directorが直接実行**（Director内ローカル） | DirectorがTaskCreate/TaskUpdateを直接呼び、個別タスク進捗を管理する。**注意: X.Y.ZタスクはDirector内のサブエージェント管理用であり、チーム共有TaskList（X.Yレベル）には登録しない。** |
| 依存関係ベース並列実行ループ | **Directorプロンプト** | サブエージェント並列起動を直接記述 |
| レビューフェーズ（task-reviewer） | **Directorプロンプト** | サブエージェント呼び出しを直接記述 |
| QAフェーズ（task-qa） | **Directorプロンプト** | サブエージェント呼び出しを直接記述 |
| コミット（einja-task-commit） | **Directorプロンプト** | Skill呼び出しを直接記述 |
| Director承認待ちループ（Step 8） | **不要** | Agent TeamsではLead↔Director間のSendMessageで直接通信 |
| 追加指示待ち状態 | **不要** | Agent TeamsではLeadがオーケストレーション |
| task-modification-analyzer | **不要** | Agent Teams版では使わない |

### 改善後のDirector実行フロー
```
claim → worktree作成
  → TaskCreate登録（X.Y.Z個別タスク、依存関係設定）
  → task-executer × N 並列起動（Agent tool直接、TaskUpdate連携）
  → task-reviewer 起動（Agent tool直接）
  → task-qa 起動（Agent tool直接）
  → einja-task-commit Skill
  → PR作成
  → Lead に [pr-ready] 送信
  → Lead から [verdict] 受信待ち
  → approved → worktree削除 → next claim
  → fix_required → 修正 → 既存PRにpush → reviewer → qa → commit → [pr-ready]再送
```

### セッションディレクトリ問題の解消

実行モード判定ロジック（`~/.einja/sessions/issue-{N}/`チェック）はtask-exec SKILL.md Step 8内に閉じている。task-exec呼び出し自体を廃止するため、この判定ロジックは実行されなくなり、問題は自動的に解消される。Agent Teams版ではLead↔Director間のSendMessage（`[verdict]`メッセージ）が代替として機能する。

### 変更対象ファイル

**`.claude/skills/einja-issue-team-exec/SKILL.md`** + **`.claude/settings.json`**

#### 変更1: Step 2.5 新設 — Lead側spec読込・AC抽出

Lead が Step 2（ブランチ作成）の後に追加:
- specディレクトリ探索: `docs/specs/issues/*/issue{N}-*/`
- requirements.md 読込 → 各StoryのACをGiven/When/Then形式で抽出
- design.md パス + セクション名を特定（内容は読まない）
- 抽出結果をStep 3のTaskCreateのdescriptionに埋め込む

※ task-exec SKILL.md Step 2の仕様をそのまま移植。

#### 変更2: Step 3 拡張 — TaskCreateのdescription拡充

現行のTaskCreateはタスクグループ単位。descriptionに以下を追加埋め込み:
- AC（Given/When/Then テキスト）
- design.md パス + セクション名
- 配下タスク一覧（X.Y.Z）と各タスクの詳細（依存関係、完了条件、実行サブエージェント、使用Skill）
- specパス（フォールバック用）

**description埋め込みフォーマット例**:
```
AC:
  Story 1: ユーザーがログインできる
    Given: ユーザーがログインページにいる
    When: 正しい認証情報を入力する
    Then: ダッシュボードにリダイレクトされる
Design: docs/specs/issues/.../design.md#認証フロー
Tasks:
  1.1.1: ログインフォームUI [frontend-coder] blockedBy:[]
  1.1.2: 認証API実装 [backend-architect] blockedBy:[]
  1.1.3: E2Eテスト [task-executer] blockedBy:[1.1.1,1.1.2] Skill:einja-task-exec
Spec: docs/specs/issues/sprint1/issue42-auth/
```
※ `[サブエージェント名]`が未指定の場合、Directorは`task-executer`をデフォルト使用

#### 変更2.5: Step 4 — Teammate spawn時の権限モード設定

DirectorTeammateをAgent toolでspawnする際に `mode: "bypassPermissions"` を指定する。現行はmode未指定のためデフォルト（全ツール呼び出しで承認要求）になっており、実行中に大量の承認プロンプトが飛ぶ問題を解消する（ユーザー明示要求）。

**安全ガード**: `bypassPermissions`はTeammate内のツール呼び出し承認をスキップするが、Teammateプロンプト内のCLAUDE.mdルール（git安全ルール、破壊的操作禁止等）は引き続き適用される。settings.jsonの`ask`リスト（`rm -rf`等）はLead（親エージェント）に適用されるものであり、Teammate内では`bypassPermissions`により承認なしで実行される点に注意。

また、settings.jsonの`permissions.allow`に以下を追加:
- `TeamCreate`
- `TeamDelete`
- `SendMessage`
- `mcp__github__*`（ワイルドカード。現行は個別ツールのみ許可で、PR作成・Issue更新等が未許可。ワイルドカード未サポートの場合は必要なツールを個別列挙: `mcp__github__create_pull_request`, `mcp__github__add_issue_comment`, `mcp__github__issue_write`, `mcp__github__push_files`等）

#### 変更3: Step 4 — Directorプロンプトテンプレート書き換え

現行（SKILL.md L207-280）の `einja-task-exec Skill を使用して` の部分を廃止し、以下のフローを直接記述。

**プロンプト構造化方針**: メインフロー（参照頻度高）を先頭に配置し、ピア間通信ハンドラー・エラー処理をセカンダリセクションとして後置する。推定行数: 現行~70行 → 改修後~130行（task-execの460行からAgent Teams不要分を除外し、必要なロジックのみ移植）。

```markdown
## メインフロー（タスクグループ実行）

1. **タスク claim**: TaskListからstatus=openかつblockedでないタスクを1つclaim
2. **作業環境準備**: worktree作成、ブランチ作成、セットアップ（[ブランチ運用戦略](../../../docs/einja/steering/branch-strategy.md)に従う。ブランチ名: `task/{N}-{X.Y}`、ベース: `origin/issue/{N}-phase{M}`、PR base: `issue/{N}-phase{M}`）
3. **タスク登録**: TaskのdescriptionからAC・設計参照・タスク一覧を読み取り、
   個別タスク（X.Y.Z）をTaskCreateで登録（依存関係設定含む）
   ※ X.Y.ZタスクはDirectorローカル管理。チーム共有TaskList（X.Yレベル）には混入させない
4. **実装フェーズ**: 依存関係ベース並列実行ループ
   - blockedByが空かつpendingのタスクを収集
   - 各タスクの「実行サブエージェント」フィールドに基づき適切なサブエージェントを選択して起動:
     - 指定あり → 指定されたサブエージェント（例: `frontend-coder`, `design-engineer`, `backend-architect`等）
     - 指定なし → デフォルトの `task-executer`
   - タスクグループレベルの指定はタスクレベルでオーバーライド可能
   - 「使用Skill」フィールドがある場合はサブエージェントのpromptに含める
   - 2タスク以上の場合はrun_in_background: trueで並列起動（※ CLAUDE.mdの「run_in_background禁止」はオーケストレーター向けルール。Teammate内のサブエージェント並列起動には適用しない）
   - 完了したタスクをTaskUpdateでcompletedに設定
   - 全タスク完了まで繰り返し
5. **レビューフェーズ**: task-reviewerサブエージェント起動
   - MAJOR判定 → `[review-failed] TaskID: X.Y.Z, Reason: ...` 形式で該当タスクを特定 → 4に戻り該当タスクのみ再実行（最大2回）
   - 3回目のMAJOR → Leadにエスカレーション
6. **QAフェーズ**: task-qaサブエージェント起動
   - FAILURE(A:実装ミス) → `[qa-failed] TaskID: X.Y.Z, Reason: ...` 形式で該当タスクを特定 → 4に戻り該当タスクのみ再実行
   - FAILURE(B:要件齟齬/C:設計不備/D:環境問題) → Leadにエスカレーション
7. **コミット・PR**: einja-task-commit Skill → einja-create-pr Skill → Lead に [pr-ready] 送信
8. **verdict待ち**: Leadからの[verdict]メッセージ受信を待機（SendMessage受信）
   - approved → worktree削除 → 次タスクclaim（1に戻る）
   - fix_required → fixInstructionsに従い修正 → 既存PRにpush（新規PR作成禁止）→ 5に戻る
   - rejected → エラー報告 → 次タスクclaim
9. **全タスク完了 or claimableなし**: Leadにidle通知

## 非タスクグループ依頼の処理（Leadからのアドホック指示）

Leadからタスクグループ実行以外の指示（例: 特定ファイルの修正、PR description更新、CI失敗の調査等）を受信した場合:
- メインフロー実行中 → 現タスクグループの完了を優先し、完了後に対応
- アイドル中（全タスク完了 or claimableなし）→ 即座に対応
- 対応完了後、結果をLeadにmessageで報告し、メインフローに復帰（claimableタスクがあれば1に戻る）
- 判断に迷う指示（スコープ不明、影響範囲不明）→ Leadに確認を返信

## ピア間通信ハンドラー（セカンダリセクション — メインフローの実行中に割り込みで処理）

[task-claim]受信 → ファイル重複チェック → [conflict-alert]
[change-summary]受信 → 宛先マップ更新
[peer-review]受信 → コードレビューのみ実行 → [peer-review-ack]返信
[conflict-alert]受信 → 編集範囲調整 → [conflict-resolved]
[ci-failure]受信 → 該当PRの修正

## エラー処理（セカンダリセクション）

task-executer失敗 → リトライ（最大2回）→ Leadにエスカレーション
task-reviewer MAJOR超過 → Leadにエスカレーション
task-qa FAILURE(B/C/D) → Leadにエスカレーション
PR作成失敗 → 再試行 → Leadにエスカレーション
コンフリクト → einja-conflict-resolver → 解消不可ならLeadにエスカレーション
```

**設計ポイント**:
- メインフロー / ピア間通信 / エラー処理の3セクション構造で、メッセージ受信時にメインフローに引きずられるリスクを低減
- reviewer/qaの差し戻しは`[review-failed]`/`[qa-failed]`メッセージプレフィックスで該当TaskIDを明示し、「全タスク再実行」の誤認を防止

#### 変更4: Step 5 — Lead監視ループに verdict フロー追加

現行のStep 5（L284-309）の SendMessage 受信テーブルに以下を追加:

| メッセージ種別 | 送信元 | 対応 |
|--------------|--------|------|
| `[pr-ready] Task {X.Y}: PR #{PR番号}` | Director → Lead | ゲートチェック実施 → `[verdict]` をDirectorに返信 |
| `[verdict] Task {X.Y}: {approved\|fix_required\|rejected}` | Lead → Director | （新設。Step 4プロンプト内で使用） |

verdict の種別:
- `approved`: Fast Gate / Risk Gate 通過
- `fix_required`: ゲートチェック失敗時の修正指示（`fixInstructions: ...`を含む）
- `rejected`: fixCount超過またはユーザーエスカレーション後の却下

#### 変更5: エラーハンドリング更新

現行（L277）の `einja-task-exec 失敗` を以下に置き換え（変更3のDirectorプロンプトのエラー処理セクションと整合）:
- `task-executer失敗: リトライ（最大2回）→ Leadにエスカレーション`
- `task-reviewer MAJOR超過（3回目）: Leadにエスカレーション`
- `task-qa FAILURE(B/C/D): Leadにエスカレーション`

また、現行のメッセージプレフィックス規約テーブル（SKILL.md末尾）に以下を追加:
- `[pr-ready]`: Director → Lead（PR作成完了通知）
- `[verdict]`: Lead → Director（ゲートチェック結果）
- `[review-failed]`: Director内部（reviewer差し戻し対象タスク特定）
- `[qa-failed]`: Director内部（QA失敗対象タスク特定）

### 変更しないファイル

| ファイル | 理由 |
|---------|------|
| `einja-task-exec/SKILL.md` | tmux版issue-exec・スタンドアロン実行で引き続き使用 |
| `issue-exec-protocol.md` | Agent Teams固有の変更はSKILL.md内に閉じる原則。`[verdict]`/`[review-failed]`/`[qa-failed]`等はAgent Teams版のみのプレフィックスであり、tmux版と共有するプロトコルには含めない。将来両版で共通化する場合は別Issueで対応 |
| `task-executer.md` / `task-reviewer.md` / `task-qa.md` | エージェント定義は変更なし。呼び出し元がSkillからDirectorに変わるだけ |

## タスク概要

### タスク 0-1: Planファイルを `docs/plans/202603/20260316-issue-team-exec-task-exec-removal.plan.md` にリネーム [`Bash`]

### タスク 1-0: 権限設定修正 [`Edit`]

1. `einja-issue-team-exec/SKILL.md` Step 4: Teammate spawn時に `mode: "bypassPermissions"` を追加
2. `.claude/settings.json` の `permissions.allow` に `TeamCreate`, `TeamDelete`, `SendMessage`, `mcp__github__*` を追加

### タスク 1-1: Lead側変更（Step 2.5新設 + Step 3拡張 + Step 5拡張） [`Edit`]

1. Step 2.5 新設（Lead側spec読込・AC抽出 — task-exec Step 2の仕様を移植）
2. Step 3 拡張（TaskCreateのdescription拡充 — AC・設計参照・タスク一覧・specパスを埋め込み）
3. Step 5 Lead監視ループに`[pr-ready]`受信→`[verdict]`返信フロー追加
4. メッセージプレフィックス規約テーブルに`[pr-ready]`/`[verdict]`追加

サブエージェント: `general-purpose`

### タスク 1-2: Director側変更（Step 4プロンプト書き換え + エラーハンドリング） [`Edit`]
依存: 1-1完了後（Lead側のTaskCreate description仕様が確定してから）

1. Step 4 Directorプロンプトテンプレート書き換え（task-exec廃止 → 3セクション構造の直接フロー記述）
2. エラーハンドリングセクション更新（L277の`einja-task-exec 失敗`を置き換え）
3. メッセージプレフィックス規約テーブルに`[review-failed]`/`[qa-failed]`追加

サブエージェント: `general-purpose`

### タスク 99-1: コードレビュー [`einja-review-code`]

### タスク 99-G: コミット承認ゲート [`AskUserQuestion`]

### タスク 99-3: コミット・プッシュ [`einja-task-commit`]

## 並列実行計画

1-1と1-2は依存関係あり（Lead側仕様確定→Director側反映）。ただし同一ファイルの異なるセクションのため、1-1完了後に1-2を実行。

```
0-1 → 1-0 → 1-1 → 1-2 → 99-1 → 99-G → 99-3
```

## task-exec移植対象ロジック判定表

task-exec SKILL.md（~460行）の主要ロジックについて、移植判定:

| ロジック（task-exec内の位置） | 判定 | 移管先 | 理由 |
|------------------------------|------|--------|------|
| Step 0: 入力解析（Issue番号+TG番号） | 不要 | — | LeadがTaskCreateで情報埋め込み済み |
| Step 1: Issueフェッチ+タスク解析 | 不要 | — | Lead Step 1で実行済み |
| Step 2: spec読込+AC抽出 | **移植** | Lead Step 2.5 | task-exec Step 2の仕様をそのまま移植 |
| Step 3: TaskCreate登録 | **移植** | Directorプロンプト | Directorが直接TaskCreate/TaskUpdate実行 |
| Step 4: 依存関係ベース並列実行ループ | **移植** | Directorプロンプト | while(未完了タスク) + blockedBy解決ロジック |
| Step 4: run_in_background並列起動 | **移植** | Directorプロンプト | 2タスク以上の場合run_in_background: true |
| Step 4: ファイル重複確認（直列化判断） | **移植** | Directorプロンプト | 設計セクションから推定 |
| Step 5: task-reviewer呼び出し | **移植** | Directorプロンプト | グループ全体で1回実行 |
| Step 5: MAJOR判定→該当タスク再実行 | **移植** | Directorプロンプト | `[review-failed]`スキーマで対象特定 |
| Step 6: task-qa呼び出し | **移植** | Directorプロンプト | グループ全体で1回実行 |
| Step 6: 失敗時原因分類（A/B/C/D） | **移植** | Directorプロンプト | A→再実行、B/C/D→エスカレーション |
| Step 7: einja-task-commit Skill呼び出し | **移植** | Directorプロンプト | 変更がある場合のみ実行 |
| Step 8: Director承認待ちループ | 不要 | — | SendMessage `[verdict]`で代替 |
| Step 8: `~/.einja/sessions/`判定 | 不要 | — | task-exec非使用で自動無効化 |
| 追加指示待ち状態 | 不要 | — | Agent TeamsではLead管理 |
| task-modification-analyzer | 不要 | — | Agent Teams版では不使用 |
| Phase 99 docs-updater フロー | **条件付き移植** | Directorプロンプト | 99番台タスクがTaskListに存在する場合、DirectorはIssueのタスク種別を確認し、docs-updaterサブエージェントを起動する。現行issue-team-exec SKILL.mdのPhase管理仕様に従う |
| サブエージェント出力表示ルール | **移植** | Directorプロンプト | 全文出力ルールを記載 |
| 実行サブエージェント・Skill継承ルール | **移植** | Directorプロンプト | タスクグループ/タスクレベルのオーバーライド |

## リスク・不明点

| リスク | 影響 | 対策 |
|--------|------|------|
| Directorプロンプト長大化（~70行→~130行） | LLMが分岐を見失う | 3セクション構造（メイン/ピア通信/エラー処理）で分離。メインフローを先頭配置 |
| task-execの品質保証ループの再実装精度 | 差し戻しロジックの欠落 | 上記移植判定表に基づき漏れなく移植。`[review-failed]`/`[qa-failed]`スキーマで粒度制御 |
| ピアレビュー必須化は今回スコープ外 | 独立性の構造保証なし | 現行のアイドル時任意ピアレビューで運用、必須化は別Issueで対応 |
| TaskCreate descriptionの文字数上限 | AC埋め込み時に切り詰められる可能性 | 実装時にAPI制限を確認。上限に近い場合はspecパスのみ記載しDirectorが直接Readするフォールバック |
| X.Y.ZタスクのTaskList汚染 | 他Directorがサブタスクをclaimしてしまう | DirectorはX.Y.Z用のTaskCreate/TaskListをDirectorローカルスコープで使用。チーム共有TaskList（X.Yレベル）には登録しない |
| fix_required時のPR重複 | 既存PRと新規PRが競合 | fix_required時は既存PRブランチにpushのみ。einja-create-pr Skillは初回のみ実行し、以降はgit pushで更新 |
| settings.jsonの`mcp__github__*`ワイルドカード未サポート | 権限追加が不完全 | ワイルドカード未サポート時は必要なmcp__github__ツールを個別列挙（create_pull_request, add_issue_comment, issue_write, push_files等） |

## 検証・動作確認方法

1. **静的検証**: 改修後のSKILL.mdを読み、以下を確認
   - Directorプロンプト内にtask-exec参照が一切ないこと（grepで`task-exec`が残存していないこと）
   - メインフロー / ピア間通信 / エラー処理の3セクション構造が明確に分離されていること
   - Lead Step 2.5のspec読込がtask-exec Step 2と同等の仕様であること
   - verdict フロー（`[pr-ready]` → `[verdict]`）が双方向で定義されていること
   - メッセージプレフィックス規約テーブルに`[pr-ready]`/`[verdict]`/`[review-failed]`/`[qa-failed]`が追加されていること
   - エラーハンドリングがtask-execの品質保証ループと同等のカバレッジであること（上記移植判定表の「移植」項目が全て反映されていること）

2. **差分確認**: `git diff --stat` で変更が `einja-issue-team-exec/SKILL.md` と `.claude/settings.json` のみであること

3. **相互参照チェック**: `grep -r "einja-task-exec" .claude/skills/einja-issue-team-exec/` で参照が完全に除去されていること

4. **task-executer呼び出し互換性確認**: task-executer.md（`.claude/agents/einja/task/task-executer.md`）の入力仕様を確認し、Directorプロンプトからの直接呼び出しで必要な引数が渡されることを確認

5. **動作テストシナリオ**（実装後に手動確認）: 小規模Issue（タスクグループ1つ、タスク2-3個）でissue-team-execを実行し、以下を確認:
   - Directorがtask-executer/reviewer/qaを直接起動できること
   - `[pr-ready]`→`[verdict]`のメッセージフローが正常に動作すること
   - reviewer/qaの差し戻し時に該当タスクのみが再実行されること
   - worktree削除→next claimの遷移が正常であること
   - 並列2Director競合シナリオ（タスクグループ2つ以上）で共有TaskListが汚染されないこと
   - `fix_required`往復（Director→Lead→Director）でPRが重複作成されないこと
   - `bypassPermissions`有効時にTeammateがツール承認なしで動作すること
