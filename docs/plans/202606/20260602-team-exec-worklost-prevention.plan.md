# einja-issue-team-exec 作業消失防止 + claim競合恒久化 + 完了真実性 + Lead独立検証 + 障害耐性強化

## Context

#343 Phase 1 を `einja-issue-team-exec`（Agent Teams版）で実行した運用で、Skill指示書の構造的欠陥が複数顕在化した。今セッションで prune-race / finalize-stall(stall経路) を修正済み（PR #151）。残る課題を 3エージェント（risk分析×2 + Explore×1）で精査した結果、以下が判明:

1. **【CRITICAL】Worker の commit/merge 矛盾**: `director-prompt.md` は Worker に「コミットさせない」(L124)と書きつつ `git merge --no-ff task/N-X.Y.Z`(L111) で統合する。Worker が真にコミットしなければ merge は空振りし、直後の `git worktree remove --force`(L116) で**完成作業が黙って消える**。
2. **【CRITICAL】Teammate破棄/解散時の作業消失**: Lead の Step 9 cleanup は `git worktree remove --force` + `git branch -D` を **push/PR/merge済み確認なし**で実行。Director は `shutdown_request` を**無条件approve**（ガードなし）、Lead は応答を待たず `TeamDelete`。finalize引き取り(今回追加)は**stall経路限定**で shutdown 経路では発火しない。→ push/PR未済の完成成果物が worktree ごと**復帰不能に消失**。
3. **【CRITICAL】claim の原子性欠如**: claim は「open読む→in_progressに書く」の非アトミックなread-then-writeで owner/CAS/lease 無し。#343 の二重claim(1.2)は再配置で回避しただけで恒久対策が無い。
4. **【HIGH】stall誤検知**: Director のハングと長時間実装が「応答有無」で原理的に区別不能（SKILL.md自身が誤検知懸念を明記）。
5. **【HIGH/MED】状態の非永続化**: session.json に worktree path / 未コミット状態 / fixCount / processed_pr_numbers が記録されず、worktree消失後・Lead停止後に復元手掛かりが無い。
6. **【HIGH】完了の真実性（チェック済みなのに未完了）**: Issue チェックボックスを `[x]` にするのは Lead（`completed` 遷移時、protocol.md 2.3）。だが `completed` の根拠は「Fast Gate 通過＋マージした(と信じている)」で、(a)Gate は形式・自己採点（task-reviewer/qa は Director内自己チェック、Fast Gate は AC 意味的検証でない）、(b)flip 時にタスク番号 `X.Y` を `sed` するだけで**成果物実在・AC を再検証しない**、(c)manual モードで実マージ前に completed 扱いされうる、(d)マージ後の AC 再検証工程が無い。→ **箱は「検証済みdone」ではなく「マージしたつもり」を表す**。#343 はタスク箱10/10（各タスクは phaseブランチへはマージ）だが、監査で「**phase→develop の最終統合が未到達**＋MAJORバグ」だった実例。つまり真実性は「タスク→phase」だけでなく**統合チェーン全体（task→phase→issue→develop）**で担保が要る。
7. **【CRITICAL】自己申告を信じる検証構造（ハルシネーション・静的のみ）**: task-reviewer/task-qa は**Director 配下の自己採点**、Lead の Fast Gate は証跡の「存在」確認のみで**テストを一度も再実行しない**。→ Director/Worker が「テスト成功」と**ハルシネーションで報告しても素通り**、**静的チェックのみで E2E 未実施→マージ後に全然動かない障害が多発**。高品質な既存 `_einja-phase-review`（Scorecard+Playwright+回帰）が **team-exec に未接続**。解散前の横断監査も無い。

### 期待結果
- **【主】Lead は全タスクの監査・ブランチ運用・マージ（ドレイン）を完了してからチームを破棄する** → 破棄時点で失う作業が原理的に存在しない。
- Worker 成果物が worktree 削除で消えない（commit/merge の一本化）。
- 解散・shutdown 経路でも push/PR未済の完成成果物を破棄せず保全・引き取り（ドレイン不能な異常時の保険）。
- claim 二重取りを裁定で構造的に解消。
- stall とロング実装を heartbeat で確実に区別。
- worktree/PR/カウンタ状態を session.json に永続化し resume 復元性を向上。
- **チェックボックス `[x]` を「検証済みdone（実マージ＋成果物実在＋AC再検証）」に紐付け、偽完了を防ぐ。**
- **Lead が Director の自己申告を信じず独立に検証（テスト再実行・種別別E2E・解散前Final Sweep）し、ハルシネーション成功／静的のみ→動かない障害を構造的に排除。**

### スコープ外（本PRでは台帳のみ・別Issue）
- Lead 自身の停止からのフル自動復旧（Agent Teams既知制限）。
- Integrator/レビュー専任 Teammate ロールの新設（まず Lead内集約・条件付き必須化で代替。効果測定後に判断）。
- tmux版(einja-issue-exec)への波及（Director ロール不在のため finalize/claim/heartbeat は非該当。cleanup安全化のみ将来検討）。

## 現状（修復対象の事実確認）

SSOT は本リポジトリ（einja-management-template）。`.claude/skills/einja-issue-team-exec/*` を修正すればビルド時に `presets/default/` へ自動コピー → 下流配布。

> **【レビュー反映・実ファイル基準の正確な行参照】** 実装SAは編集前に必ず該当行を Read で再確認すること（行番号は目安）。
> - `director-prompt.md`: Worker→Director merge = **L111-112**、Worker worktree削除 = **L114-118**（L116 `git worktree remove --force` / **L117 は既に `git branch -d`（非強制）**）、「コミットさせない」= **L124**。
> - `SKILL.md` Step 9: `git worktree remove --force` と **`git branch -D`（強制）は SKILL.md 側のみ**（L481-484 付近の `xargs` 一括）。

| # | 欠陥 | 該当箇所 |
|---|------|---------|
| 1 | Worker commit/merge矛盾 | `director-prompt.md`（L111-112 merge / L114-118 worktree削除 / L124 コミットさせない） |
| 2 | cleanup無確認削除 | `SKILL.md` Step 9 L481-484（`git worktree remove --force` / `git branch -D`）。`director-prompt.md` L114-118 は既に `git branch -d`（保全条件のみ追加） |
| 2 | shutdown無条件approve | `director-prompt.md`（shutdown_request処理が**未記載**）、`SKILL.md` Step 9（応答待ちなし）、`message-schemas.md`（shutdown_request/response） |
| 2 | finalize引き取りがstall限定 | `SKILL.md` エラー表（今回追加した行は「stall」起点） |
| 3 | claim非アトミック | `director-prompt.md` L11、`SKILL.md` L369 |
| 4 | stall誤検知 | `SKILL.md` L309-314 監視ループ |
| 5 | 状態非永続化 | `SKILL.md` Step 3（session.json初期状態）、Step 4 |
| 6 | 完了の真実性（偽`[x]`） | `SKILL.md` Step 5-2/5-3/5-4（ゲート→マージ検知→completed→checkbox）、`issue-exec-protocol.md` 2.2/2.3 |
| 7 | 自己申告依存・テスト再実行なし・E2E未実施・phase-review未接続 | `director-prompt.md` Step5/6（自己採点）、`SKILL.md` Step 5-1a/5-2/Step6/Step9、`issue-exec-protocol.md` §3.1/§3.2（Fast/Risk Gate） |

## 変更内容（推奨アプローチのみ）

**全変更が `.claude/skills/einja-issue-team-exec/` 配下の md 指示書 + 共通プロトコル md。アプリ runtime 非影響。**

### 変更1（CRITICAL #1）: Worker の commit を必須化し merge 矛盾を解消
`director-prompt.md` Step 4。
- L124「task-executer にはコミットさせない（Step 7でまとめて実行）」を改訂し、**Worker は自 worktree（`task/N-X.Y.Z`）で X.Y.Z 単位の変更を必ずコミットする**（Director の `git merge` が空振りしないため）と明記。
- **二段コミットの役割分担を明文化（レビュー反映）**: ①Worker が X.Y.Z をコミット（中間統合用）→ ②Director が `git merge --no-ff` で Director worktree（`task/N-X.Y`）へ統合 → ③Step 7 は Director worktree の**統合済みコミットをそのまま push/PR**（再コミット不要。`einja-task-commit` は未コミット差分がある場合のみコミットし、無ければ push/PR のみ）。これにより「Worker中間コミット」と「Step 7」が二重コミットで衝突しない。
- L111-112 の merge 手順の直前に「Worker worktree に未コミット変更が残っていないこと（`git -C <worker-wt> status --short` が空）を確認してから merge。残っていれば Director がコミットして取り込む」フォールバックを追記。

### 変更2（CRITICAL #2-a）: cleanup を「保全優先」に変更
`SKILL.md` Step 9 L481-484（`git branch -D` はここ）。`director-prompt.md` L114-118 は既に `git branch -d`（保全条件のみ追加）。
- worktree/branch 削除の**前提条件**を明文化: 当該 branch が **(a) PR作成済み or (b) リモートにpush済み or (c) base へマージ済み** のいずれかを満たす場合のみ削除可。
- **`SKILL.md` の `git branch -D`（強制）→ `git branch -d`（マージ済みのみ削除成功）に変更**。未マージで消す必要がある場合は「push済み or PR存在」を個別確認してから明示削除。
- 未push かつ未PR かつ未マージの worktree は**削除しない・保全**し、Lead に `[error]` で「未回収成果物あり」を報告（変更4の sanity check と連動）。
- grep一括削除の厳密化（部分一致防止）: **`git worktree list` の出力形式は `<path> <sha> [<branch>]` なので `git branch` 用の `^[* ]+` は誤り**。正しくは worktree パス基準で `grep "worktrees/task-${N}-"`、branch基準は `grep -E "task/${N}-"`（末尾ハイフンで N=12 が N=123 に部分一致するのを防止）。

### 変更3-0（CRITICAL #2・最重要）: 「ドレイン完了 → 破棄」の順序不変条件（teardown gate）
`SKILL.md` Step 9（解散シーケンス）/ セッションクリーンアップ。
- **不変条件を明文化**: Lead は **全ての in-flight 作業を終端まで運んでから**チームを破棄する。具体的には、`shutdown_request` / `TeamDelete` / worktree削除を実行する**前に**、以下を満たすことを必須ゲートとする:
  1. 共有 TaskList に **未push の `in_progress`（claim中）タスクが残っていない**（全タスクが completed、または PR作成済み+push確認済み、または明示的に abandoned-and-preserved）。
  2. 各タスクグループの PR が **作成済み・ゲート（Fast/Risk Gate）通過済み**。マージは**マージモード依存**: `auto`/`task-group-auto` はマージ完了まで、`manual` は「**PR作成済み + push済み（worktree非依存）**」を終端とみなす（ユーザーマージ待ちは終端扱いで可）。
  3. 全 Director worktree が **safe-to-delete**（変更2の保全条件: push済み or PR存在 or マージ済み）。
- **manual モードのドレイン完了（レビュー反映）**: `manual` で「PR作成済み・未マージ」のまま解散指示が来た場合、不変条件は満たす（push済み=worktree非依存=安全）が、Lead は AskUserQuestion で「**先にPRをマージしてから解散 / 未マージのまま解散（PRは残る）**」を確認する。未マージでも worktree削除は安全なので無限待機しない。
- **ドレイン手順**: 解散指示を受けたら Lead はまず「残作業の回収フェーズ」に入る — 進行中 Director は heartbeat 継続なら完了を待ち（変更6）、停止していれば sanity check → 引き取り（変更4）。**全タスクが終端に達するまで shutdown_request を送らない**。
- これにより「破棄時点で失う作業が原理的に存在しない」状態を作る。変更3/4 は不変条件を満たせない異常時（Director停止・finalize失敗）の保険として機能する。
- ユーザー明示の「セッション終了」選択時も同じゲートを通す（即時 TeamDelete を禁止し、ドレイン → 破棄の順序を強制）。例外: ユーザーが「未完了作業を破棄してでも即終了」と明示した場合のみ、保全対象を報告した上で破棄。

### 変更3（CRITICAL #2-b）: shutdown ハンドシェイクを安全化
`director-prompt.md`（新規セクション「shutdown_request 受信時の処理」）+ `SKILL.md` Step 9 + `message-schemas.md`。
- **Director側**: `shutdown_request` 受信時、(i) `[pr-ready]` 未送信 かつ (ii) worktree に未コミット/未push の完成成果物あり、なら**即approveせず**、まず finalize（commit+push+PR）を試行 → 成功で `[pr-ready]` 送信後 approve、失敗なら `[error]`（worktree絶対パス・git status/log 添付）送信後に approve。成果物が無い/finalize不要なら通常approve。
- **Lead側 Step 9 の新しいステップ順序（レビュー反映・明示）**: ①ドレインゲート確認（変更3-0の不変条件）→ ②`shutdown_request` 送信 → ③`shutdown_response` 待機（タイムアウト例30秒）→ ④各 worktree の sanity check（変更4）→ ⑤未回収検知時は finalize 引き取り（変更4）→ ⑥`TeamDelete` → ⑦worktree/branch cleanup（変更2の保全条件付き）。**sanity check と引き取りは必ず TeamDelete・削除の前**。
- `message-schemas.md` に shutdown ハンドシェイクの本文規約（未finalize時のreport含む）を明記。`[error]` は既存規約(L15)を流用。

### 変更4（CRITICAL #2-c）: worktree削除前の Lead sanity check（finalize引き取りを shutdown 経路へ拡張）
`SKILL.md` Step 9（および解散・全Phase完了の cleanup 共通化）。
- worktree を削除する**直前**に Lead が各 Director worktree で `git -C <wt> status --short`（未コミット）と未push commit 検知を実行。**upstream 未設定（初回push前）でも失敗しないよう**、`@{u}..` は使わず `git -C <wt> log --branches --not --remotes --oneline`（リモート未到達コミット）を用いる。これで未コミット/未push の完成成果物を検知。
- 検知時は、今回追加した finalize-stall 引き取りフロー（Fast Gate 相当検証 → `einja-task-commit` + `einja-create-pr` を当該 worktree 対象に実行）を**stall経路だけでなく shutdown/解散経路でも発火**させる。エラー表の該当行を「stall **または** shutdown 時」へ一般化。
- 引き取り完了 or 保全判断が済むまで worktree を削除しない。

### 変更5（CRITICAL #3）: claim 裁定で二重取りを解消
`director-prompt.md` L11-14 + `message-schemas.md`。
- claim手順を「(1) `TaskUpdate` で `owner=自分` + `status=in_progress` → (2) **直後に `TaskGet` で `owner==自分` を確認**（負けていれば即abort して次タスクへ）→ (3) `[task-claim]` broadcast（**claim宣言時刻を本文に含める**）→ (4) **裁定ウィンドウ（例2-3秒）** 待機 → (5) **ウィンドウ経過後に競合 `[task-claim]` を受信していなければ claim 確定**。受信していたらタイブレークで1名に確定、敗者は `status=open` に戻して(release) 別タスクを claim」に明文化。
- **裁定の権限階層（レビュー反映）**: (2)の `TaskGet` 確認は**早期abort用の軽量チェック**（non-CAS の TaskUpdate で同時に両者が owner=自分 を書く瞬間の穴を完全には塞がない）。**最終確定は (5) の `[task-claim]` タイブレークが単一の裁定者**とする。タイブレーク基準は「claim宣言時刻（`[task-claim]` 本文の時刻）が早い方、同時刻は Director名の辞書順小」で決定論的。
- `TaskUpdate` の `owner` フィールドを活用（API実在）。Lead側にも「1タスク=1owner」の検証（`[task-claim]` 重複検知時の調停）を Step 5 に追記。
- **【統合レビュー反映・スコープ限定】裁定（owner/TaskGet確認/裁定ウィンドウ/タイブレーク）は共有 TaskList の X.Y claim（`director-prompt.md` L11）のみに適用。Director 内の X.Y.Z 個別タスクの in_progress 化（L57-63）はDirector単独管理で裁定不要・変更しない**（裁定ウィンドウを入れるとDirector内ループが無駄に遅延するため）。

### 変更6（HIGH #4）: heartbeat / lease で stall を確実に区別
`director-prompt.md`（実装ループ）+ `SKILL.md` L309-314 監視 + `message-schemas.md`。
- **Director**: 実装中も一定間隔（例90秒）で `[heartbeat] Task X.Y: alive, phase={implementing|reviewing|qa|finalizing}` を Lead へ送信。これを lease 更新として扱う。
- **Lead**: heartbeat メッセージは**起床トリガーにせずキューでバックログ処理**（`[progress]` と同様にログ + 「Director別の最終heartbeat時刻」をメモリ保持）。既存のシグナル待機ループ（SKILL.md L309-314）を抜けた際にキューを読み、最終heartbeat時刻を更新。heartbeat 継続中は長時間実装とみなし誤killしない。heartbeat 途絶（lease 失効、例 heartbeat間隔×3）で初めて stall 候補とし、worktree sanity check（変更4）→ 引き取り or 再割当。
- **検知精度の限界（レビュー反映）**: Lead はスリープ後にキューを読むため、lease 失効検知の最大遅延は「シグナル待機間隔（最大120秒）+ 処理時間」。即時性は不要（stall は分単位の事象）なのでこの精度で十分とするが、Plan に明記する。
- `message-schemas.md` に `[heartbeat]` を追加（下記「メッセージ規約 SSOT」）。**【統合レビュー反映】`director-prompt.md` のシグナルファイル作成ルール表にも `[heartbeat] | シグナル不要 | 情報ログのみ・Lead即時アクション不要（キューでバックログ処理）` 行を追加**し、message-schemas.md・実装ループ・シグナル表の3点で `[heartbeat]` を一致させる。

### 変更7（HIGH/MED #5）: session.json 状態永続化
`SKILL.md` Step 3（session.json初期状態スキーマ）/ Step 4/5 のみ。**`issue-exec-protocol.md` は変更しない（レビュー反映）**。
- 追加フィールドは **Agent Teams版固有**（worktree絶対パス / branch / 最終コミットSHA / PR番号 / fixCount / retryCount / processed_pr_numbers）であり、tmux版と共通の `issue-exec-protocol.md`（status遷移定義のみ）には持ち込まない。SKILL.md 内の session.json スキーマ定義に閉じて完結させ、波及を避ける。
- session.json のタスク状態に上記フィールドを追加。Director claim / finalize / verdict 時に更新。
- resume フロー（SKILL.md Step 0-3）に「session.json から worktree パス・未回収成果物の手掛かりを読む」手順を追記。Lead停止後の復元性を底上げ（フル自動復旧はスコープ外だが手掛かりを残す）。

### 変更8（HIGH #6）: チェックボックス flip を「検証済みdone」に紐付け（完了の真実性）
`SKILL.md` Step 5-4（マージ後処理）。`issue-exec-protocol.md` 2.3 の `sed` 機械部分は変更しない（Agent Teams スコープに閉じる）。
- チェックボックスを `[x]` にする**前**に Lead が以下を必須実行し、**全通過時のみ flip**:
  1. **マージ実確認**: `gh pr view {PR} --json state,mergedAt,baseRefName` で `state == "MERGED"` を確認。**manual モードの確認順序**: Step 5-3 の AskUserQuestion（ユーザーへマージ完了確認）の後、Step 5-4 冒頭で `gh pr view` を**機械的な裏取り**として実行。ユーザーが「マージ済」と答えたが `state != MERGED` の場合は箱を付けず、PR URL を提示して未チェックのまま次へ（二重質問しない）。PR未マージなら箱は付けない。
  2. **マージ先での再検証（検証先は phaseブランチ）**: 【重要】タスクPRのマージ先は **main/develop ではなく `gh pr view` の `baseRefName`（= `issue/{N}-phase{M}` phaseブランチ）**。その base に対し再検証する。手段は **checkout/switch せず**: `git fetch origin` → `git show origin/{baseRefName}:{path}` または `gh api repos/{owner}/{repo}/contents/{path}?ref={baseRefName}` で**成果物（変更ファイル・modifications/qa-tests 等）の実在**を確認。AC スモークが要る場合は既存の Director/phase worktree 上で実行（Lead はメインツリーを汚さない）。**軽量・冪等**: ファイル実在確認 + AC 代表コマンド1本程度（〜30秒目標）、`processed_pr_numbers` で既処理PRはスキップ。
  3. **不通過時**: 箱を `[x]` にせず、status を `completed` にしない。Lead が `[error]`/ユーザー報告で「マージしたが検証不通過（偽完了候補）」を flag し、必要なら fix ループへ戻す。
- **再検証中の status（依存ブロック回避）**: マージ確認後〜再検証通過までは status を中間状態 `awaiting_verification`（または `in_progress` 維持）とし、**`completed` 遷移は再検証通過後**。依存タスクの claim 解放は `completed` 後のままだが、再検証を軽量(〜30秒)に保つことで直列チェーンのスループット低下を最小化。
- **drain-gate（変更3-0）との関係を明記**: 「checkbox `[x]` = 実マージ＋検証済み」と「drain の終端（manual は PR作成＋push＝worktree非依存）」は**別閾値**。manual で「PR作成済み・未マージ」は drain 上は安全に解散可（作業は保全）だが、**箱は付かない（未マージ=未done を正しく表す）**。
- **manual 解散後の flip 主体消失への対処**: manual で未マージのまま解散すると、後でユーザーがマージしても箱を flip する Lead が居ない。→ **Step 9 完了報告に「未チェックで残ったタスクグループ一覧 + PR URL（マージ後に手動 flip 要）」を必ず含める**。加えて resume 時（変更7の session.json `PR番号` 活用）に未 flip PR のマージ状態を再チェックして補完する手順を追記。
- **統合チェーン全体への適用**: タスク箱は「task→phase（baseRefName）マージ＋検証」で flip。**Phase 完了時（SKILL.md Step 6 Phase PR）・最終統合時（issue→develop）にも同じ「マージ実確認＋成果物実在再検証」を適用**し、Phase チェック/最終完了が「phase→develop 未到達」のまま done 扱いにならないようにする（#343 の phase→develop 未統合の再発防止）。Phase/最終レベルの検証先は各 PR の `baseRefName`。
- **副作用注意**: 既存の Step 5-4 は「TaskUpdate completed → checkbox更新」の2手。これを「マージ確認→再検証→（通過時）completed+checkbox / （不通過時）flag」へ拡張。protocol.md 2.3 の冪等 sed はそのまま流用（通過時のみ実行）。

### 変更9（CRITICAL #7）: Lead 独立検証ゲート（実装主体 Director ≠ 検証主体 Lead）
**変更8 の「AC再検証」の実体がこれ。** task-reviewer/task-qa は Director 配下＝自己採点で、Lead の Fast Gate は証跡の「存在」しか見ず**テストを一度も再実行しない**。→ ハルシネーション「成功」・静的のみ（E2E未実施）がそのまま通る。独立性は**新Teammate増設ではなく「実装(Director)≠検証(Lead)＋機械的事実(exit code/bytes>0)依拠」**で担保する（Codex/general-purpose 一致）。**新Teammート・新状態・新スキーマは追加しない。**

- **9-1 Lead-Owned Verification Gate（`SKILL.md` Step 5-1a/5-2 拡張）**: `[pr-ready]` 受信時、verdict 付与の**前**に検証を実行。【実行場所・最重要】**Lead は worktree/checkout を持たず `git branch` のみで HEAD を動かさない**ため、Lead 自身は実行せず、**Director/phase worktree のパス（変更7の session.json `worktreePath`）を渡した Lead-owned 監査サブエージェント**を spawn し、**そのworktree内で（`bash -C <wt>` 相当）**実行させる（変更8 L113「checkout/switch せず既存worktree上で実行」の規律に統一。Director配下の task-qa は流用しない）。worktree が既に削除済みなら L1 はスキップし L0 のみで判定。
  - **L0 証跡実体検証（常時）**: Outcome Manifest（`artifacts/outcomes/{taskId}-outcome.json`、既存・task-executer/_einja-task-qa生成）/ qa-tests / modifications の各 evidence が **bytes>0 ＋ exitCode==0 ＋ toolCallId/実ファイル到達可**。「存在」でなく「実体」。空・欠落は即不合格。
  - **L1 テスト再実行（常時・最低ライン）**: 監査サブエージェントが対象worktree内で `lint/typecheck/build/test`（monorepo は `pnpm --filter {影響package}` で限定）を再実行し、**Director の報告値でなく自分の exit code** で判定。非0 → `fix_required`。
  - **危険シグナル再スキャン（常時）**: diff に `<<<<<<<` / `PARTIAL` / `FAILURE` / 未解決 TODO/FIXME。
  - 結果を `artifacts/audit/{X.Y}-audit.json`（exit code・stdout先頭・evidence照合）に記録。これが無ければ `approved` を出さない（Director報告と audit.json の**二枚鑑定**）。
- **9-2 動作確認の種別別必須化（`SKILL.md` Step 5-2 / `issue-exec-protocol.md` §3.2 Risk Gate を「曖昧発火」→「種別で必須」へ）**:
  - **L2**: UI変更（`.tsx/.jsx/.css` 含む）→ **Playwright MCP で代表シナリオ1本を必須実行**（画面表示だけでなく操作フロー到達まで）。API/RPC変更 → **curl で実エンドポイント打鍵必須**（モック不可）。**発火判定**: `[pr-ready]` 受信後 `gh pr diff {PR} --name-only` で差分ファイルを取得し `.tsx/.jsx/.css` 等を判定（軽量・常時実行可）。
  - **L3**: 認証/課金/migration/外部API 変更 → **人間受け入れ必須**（auto でも manual 降格）。
  - 純ロジック/util/docs のみ → 静的（L0/L1）で可、E2E スキップ。
  - **protocol.md §3.1/§3.2 改訂は `[Agent Teams版のみ]` 見出しで隔離**（tmux版 Manager は Skill/spawn を持たず「自らテスト再実行」できないため、従来の存在確認ベースを維持。混在させない）。tmux版 Manager の Playwright/人間降格対応可否は実装時に確認。
- **9-3 `_einja-phase-review` 接続（`SKILL.md` Step 6 Phase完了）**: 高品質な既存 Skill（Weighted Scorecard PASS≥65/CONDITIONAL45-64/FAIL<45/PHASE_ESCALATE + Playwright MCP + フル回帰 + Outcome Manifest 全件検証）が **team-exec に未接続**。Phase PR 作成後、**Lead が `Skill` ツールで `_einja-phase-review` を直接呼ぶ**（既存の `phase-reviewer` Agent / `einja-task-exec` 差し戻し経路は経由しない＝team-exec に無いため）。**返却値マッピング（必須）**: Lead が `{verdict, score, fixRequired[]}` を受け取り、PASS/CONDITIONAL→Phase PRマージ、FAIL→`fixRequired[]` を `[verdict] fix_required` に変換し該当 Director へ差し戻し、PHASE_ESCALATE→ユーザー。**【統合レビュー反映・要タスク5】** 現状 `_einja-phase-review` は (i) **PASS/CONDITIONAL は markdown レポートのみ**（構造化 `{verdict,fixRequired[]}` は FAIL 時だけ）、(ii) `allowed-tools` に **`Skill` が欠落**（Step4 で einja-review-code を Skill 呼びするのに不整合・確認済み）、(iii) **diff範囲が `origin/issue/{N}...HEAD` にハードコード**（Phase設計）。→ team-exec 接続には**タスク5（`_einja-phase-review/SKILL.md` 小改修: 全判定で `{verdict,score,fixRequired[]}` を構造化返却 + `allowed-tools` に `Skill` 追加 + diff範囲を引数化）が必要**。**前提**: checkout 済みツリー前提のため 9-1 同様 **対象ブランチを持つ worktree 上で実行**（Lead はメインツリーを汚さない）。
- **9-4 Final Sweep（`SKILL.md` 新 Step 8.5・解散前）**: 現状 Step 9 は TeamDelete + ブランチ削除のみで**横断監査が無い**。全Phase完了後・解散前に **Lead が `Skill` ツールで `_einja-phase-review` を直接呼ぶ**。検証先は**最終 Issue ブランチ**: Lead が**一時検証 worktree（`git worktree add <tmp> issue/{N}`、メインHEAD非依存）**を作成→そこで実行→削除。diff 範囲は `git diff --name-only origin/{baseBranch}...origin/issue/{N}`（タスク5で diff範囲を引数化したものを渡す。引数化前は Skill 内部の `origin/issue/{N}...HEAD` 固定では Issue→base 検証にならない点に注意）。**【配置・統合レビュー反映】Step 8.5 は Step 9 の drain-gate（変更3-0）のサブステップとして実行し、shutdown_request 送信の前に Final Sweep 通過を必須とする**。未充足は**解散前（Director がまだ居る間）に該当 Director へ差し戻し**。→ **drain-gate の終端条件に「Final Sweep 通過」を含める**。
- **9-5 allowed-tools**: `SKILL.md` frontmatter に `mcp__playwright__*` を追加（Lead のブラウザ検証用）。
- **発火条件（コスト最小化）**: L0/L1 常時、L2 は UI/API 変更時、L3 は認証等の該当時、Final Sweep は解散前1回。ドキュメントのみ等は L0/L1 のみ。fixCount は既存2回ループを流用（監査 FAIL も同ループ）。
- **原理的限界の明記（誠実）**: 本ゲートでも意図・UX・業務ルール解釈・AC自体の誤りは防げない → **認証/課金/データ整合フローの人間受け入れ（L3・9-4）は省略不可**。「QA漏れを劇的に減らす」ものであり「絶対に防ぐ」ものではない。

### メッセージ規約 SSOT（3SA共通・`message-schemas.md` へ追記、director/SKILL はこれを参照）

実装時はこのフォーマットを唯一の正とし、3ファイル間で文言を一致させる:
```
[heartbeat] Task {X.Y}: alive, phase={implementing|reviewing|qa|finalizing}
[task-claim] Task {X.Y}: {タスク名}\nFiles: {編集予定ファイル}\nDirector: {自分の名前}\nClaimedAt: {ISO8601}   # ← ClaimedAt を追加（裁定タイブレーク用）
```
shutdown ハンドシェイク（Agent Teams の `shutdown_request`/`shutdown_response` 本文規約）:
```
shutdown_response: { approve: true|false, status: "approved"|"deferred", worktree: "{絶対パス or none}", reason: "{未finalize報告 or none}" }
```
- `[error]` は既存規約（`message-schemas.md` L15: Director→Lead）を流用・追記不要。

## タスク概要

- **0-0**: タスク分解を TaskCreate で一括登録
- **0-1**: Plan を `docs/plans/202606/20260602-team-exec-worklost-prevention.plan.md` に配置 [Bash mv]
- **0-2**: worktree 不要（`.claude/skills/` の md 指示書のみ）。現ツリーで編集。※ただし本PRは別ブランチ運用を 99-G で確認（PR #151 とは別スコープのため）
- **1**: `director-prompt.md` の変更（変更1 / 変更2-Worker削除 / 変更3-Director側 / 変更5-claim / 変更6-Director heartbeat）[general-purpose / Edit] — 単一ファイル直列
- **2**: `SKILL.md` の変更（変更2-Lead cleanup / 変更3-Lead handshake + 変更3-0 drainゲート / 変更4-sanity check / 変更6-Lead監視 / 変更7-session.json / 変更8-checkbox真実性 Step5-4 / **変更9-1〜9-5 Lead独立検証ゲート: Step5-1a/5-2拡張・Step6 phase-review接続・Step8.5 Final Sweep（drain-gateサブステップ・shutdown前必須）・frontmatter playwright追加**）[general-purpose / Edit] — 単一ファイル直列。**タスク1と並行可**（別ファイル）。**SKILL.md が最大の変更集中点 → SAは「セクション単位で Read→Edit→確認」を繰り返し、一度に全体を書こうとしないこと**
- **3**: `message-schemas.md` の変更（shutdown handshake 本文規約 / `[heartbeat]` / `[task-claim]` の ClaimedAt 追加）[general-purpose / Edit] — タスク1・2と並行可（別ファイル）。上記「メッセージ規約 SSOT」を唯一の正として5SAに同一指示で渡す
- **4**: `issue-exec-protocol.md` の変更（**変更9-1 §3.1 Fast Gate 強化 / 変更9-2 §3.2 Risk Gate を種別別必須化**）[general-purpose / Edit] — タスク1・2・3・5と並行可（別ファイル）。**【波及注意・隔離方式】共通プロトコル＝tmux版にも適用されるため、§3.1末尾・§3.2末尾に `### [Agent Teams版のみ]` 独立セクションとして追記し、既存の共通テーブルは変更しない**（tmux版 Manager は Skill/spawn を持たず「自らテスト再実行」不可のため混在禁止）。99-1 で tmux版整合を確認。変更7（session.json）はここに持ち込まない
- **5**: `_einja-phase-review/SKILL.md` の小改修（**全判定で `{verdict,score,fixRequired[]}` を構造化返却 / `allowed-tools` に `Skill` 追加 / diff範囲を引数化**）[general-purpose / Edit] — 変更9-3/9-4 が team-exec から呼ぶ前提を満たすため。タスク1-4と別ファイルで並行可。**既存の phase-reviewer Agent / einja-task-exec 経由フローを壊さない後方互換**（FAIL時の既存返却を維持しつつ PASS/CONDITIONAL も構造化、diff範囲は省略時 `origin/issue/{N}...HEAD` をデフォルト）
- **99-1**: 観点別並行レビュー [codex-agent サブエージェント + general-purpose] — 観点: (a)正確性（claim裁定・shutdownハンドシェイク・cleanup保全条件のロジック健全性、bashスニペット）(b)整合性（`[heartbeat]`/shutdown_response/session.jsonフィールドが3ファイル間で一致、issue-exec-protocol.md と矛盾なし）(c)副作用（既存フロー破壊なし・既に修正済みのprune/finalize-stall行と整合）(d)スコープ妥当性（Lead停止/Integratorを除外した判断）
- **99-2**: 動作確認 — (a)`bash -n` で各 md 内 bash スニペット構文（placeholder解決後）(b)`/tmp` 使い捨てrepoで「未push/未マージ worktree は cleanup で削除されない」「push済みは削除される」を再現テスト(c)claim裁定・shutdownハンドシェイクの**シーケンス静的トレース**（作業消失経路が塞がれたことを確認）
- **99-2a**: Plan 同梱確認（実装 commit に同梱）
- **99-G**: コミット承認ゲート（修正概要 + レビュー結果**全文**と対応 + 動作確認サマリ + **ブランチ方針**を報告し AskUserQuestion）
- **99-3**: コミット・プッシュ → PR 作成 [einja-task-commit / einja-create-pr]
- **99-4 判定**: Skill 指示書のみ・アプリ runtime 非影響 → 動作確認は再現テスト+静的トレース+bash構文で十分。Discord verify 等は不要（理由を完了報告に明記）
- **99-5 最新main取り込み**: コミット/PR後、`git fetch origin` → コンフリクト確認（`git merge-tree`）→ `git merge origin/main`（force-push不要）で最新 main を取り込み push（PR #151 と同様の手順）。ユーザー指示「終わったら最新main取り込み」に対応

## 並列実行計画
- 実装: タスク1（director-prompt.md）/ 2（SKILL.md）/ 3（message-schemas.md）/ 4（issue-exec-protocol.md）/ 5（_einja-phase-review/SKILL.md）は**編集対象ファイルが非重複**のため**5並行**。ただしクロスファイル整合（スキーマ名・本文規約・ゲート用語・phase-review返却契約）を保つため、本Planの「変更3/5/6/7/9 + メッセージ規約SSOT」の文言をSSOTとして5SAに同一指示で渡し、各SAは自ファイルのみ編集。SKILL.md（タスク2）が最大集中点。
- レビュー（99-1）: codex-agent サブエージェント と general-purpose を**並行**起動。

## リスク・不明点
- **TaskUpdate の owner / claim のアトミック性**: `owner` フィールドは API 実在。ただし TaskUpdate 自体が CAS かは不明 → 「owner設定→TaskGet再確認→裁定ウィンドウ」の楽観的検出で実用上の二重取りを潰す方針（完全アトミックを前提にしない）。レビューで裁定ロジックの健全性を担保。
- **heartbeat 間隔の妥当性**: 90秒は仮。短すぎるとメッセージ輻輳、長すぎると検知遅延。Plan では「間隔×3 で lease 失効」とし具体値はレビューで調整可能とする。
- **変更が非常に大きい（5ファイル・9変更＋phase-review小改修）**: 単一PRだがファイル単位で並行・独立。レビュアーも累次で「PR規模」を懸念。**分割案を 99-G で必ず提示**（例: PR-A=作業消失防止+claim+heartbeat+永続化〔変更1-7〕 / PR-B=完了真実性+Lead独立検証+phase-review改修〔変更8-9+タスク5〕。後者が「動かない障害」の最重要対策で集中レビュー価値が高い）。ユーザーは統合を選択済みだが、レビュー結果次第で分割を再提案する。
- **【統合レビュー反映】`_einja-phase-review` 接続改修（タスク5）でファイルが5つ目に**: 変更9-3/9-4 が依存する `_einja-phase-review` は (i)PASS/CONDITIONALが構造化返却でない (ii)`allowed-tools` に `Skill` 欠落 (iii)diff範囲ハードコード、の3点で team-exec 接続前提を満たさない（確認済み）。タスク5で後方互換の小改修。これにより「mdのみ・4ファイル」前提から5ファイルに拡大→ PR-B 側の分割判断に織り込む。
- **ブランチ方針**: 本PRは PR #151（prune/finalize-stall）とは別スコープ。**PR #151 は現在 OPEN・未マージ**で、その修正（コミット c59a5c2）は現ブランチ `fix/pr-dedup-idempotent` に存在し main 未到達。本Planの変更4は #151 が入れた finalize-stall 行を拡張するため、**(a) PR #151 マージ後の main から新規ブランチ / (b) PR #151 ブランチ（または最新main取り込み済みの現ブランチ）を base** のどちらにするかを 99-G で確認する（#151 未マージの間は finalize-stall 行が main に無いため、(b) または #151 を含む状態を base にする必要がある）。
- **既存修正との衝突**: 今回 PR #151 で finalize-stall 行・prune置換を入れた箇所と同じファイルを触る。merge済み main を取り込んだ状態で作業し、既存修正を壊さないこと（変更4はその finalize-stall 行を「shutdown経路へ一般化」する形で拡張）。
- **【一次リスク・変更9前提】Outcome Manifest の merge 生存**: `_einja-phase-review`/9-1 L0 は `artifacts/outcomes/{taskId}-outcome.json` を全件読む前提。team-exec では Worker が**個別worktreeで生成→Director worktreeへ `git merge`→Worker worktree削除**（director-prompt L108-118）。`artifacts/outcomes/` が merge で phase ブランチへ**伝播しないと、phase-review/Final Sweep が常に `outcome missing` で FAIL** する構造的リスク。→ 99-2 で「outcome が Worker→Director merge を生存し phase ブランチに存在する」ことを再現テストで確認。生存しない場合は director-prompt の merge 手順に outcome 退避を追加（その場合タスク1のスコープに含める）。
- **Lead の検証実行場所（変更8規律との統一）**: 変更9のテスト再実行・phase-review・Final Sweep は**すべて対象ブランチを持つ worktree 上で実行**（Lead はメインツリーを汚さない）。9-1/9-3 は Director/phase worktree、9-4 は一時検証 worktree。この規律を全SAに徹底。

## 検証・動作確認方法
1. **構文**: 各 md 内 bash スニペット（cleanup条件・claim・sanity check）を**代表値に置換してから**（`{N}`→`999`, `{X.Y}`→`1.2` 等。placeholder のままだと `bash -n` が不安定）`bash -n`。runtimeエラー（`@{u}` 等）は静的トレースで補完。
2. **cleanup保全 再現テスト**（`$HOME` 配下の使い捨てrepo、symlink回避）:
   - push済みブランチの worktree → 削除される（正常）。
   - 未push・未マージ・未PR の worktree → **削除されない・保全される**（作業消失が塞がれたことを実証）。
   - `git branch -d`（非強制）が未マージで失敗 → 保全フォールバックに落ちることを確認。
3. **シーケンス静的トレース**: Context の「作業消失経路」（finalize中hang→shutdown→force削除）を新フローでトレースし、(0)解散ゲートでドレイン未完なら破棄に進まない、(i)Lead が shutdown_response 待ち→sanity check で未push検知→引き取り、(ii)Director が未finalizeでapprove拒否、のいずれかで**消失が起きないこと**を確認。正常系では「ドレイン（全PR作成・ゲート・マージ）完了 → shutdown → 削除」の順序が守られることをトレース。
4. **整合grep**: `[heartbeat]` / `shutdown_response` / session.json 追加フィールドが `director-prompt.md` / `SKILL.md` / `message-schemas.md` 間で一致。`issue-exec-protocol.md` の resume 記述と矛盾なし。
5. **完了真実性トレース（変更8）**: 「Fast Gate通過だが成果物未統合/AC未充足」のケースを Step 5-4 新フローでトレースし、(i)`gh pr view` で未マージ→箱を付けない、(ii)マージ済みだがマージ先に成果物不在→AC再検証で不通過→`[error]` flag、のいずれかで**偽`[x]`が付かない**ことを確認。#343 型（箱[x]だが develop未到達）が再発しないことを静的に確認。
6. **Lead独立検証トレース（変更9）**: 「Director が test=成功と申告したが実際は exit code 非0」のケースを 9-1 でトレースし、Lead の再実行で非0検知→`fix_required` になることを確認。「UI変更だが E2E 未実施」が 9-2 で Playwright MCP 必須化により approve されないことを確認。`_einja-phase-review` 接続（9-3）・Final Sweep（9-4）が解散前に発火し未充足を差し戻すことをシーケンスで確認。
7. **既存資産の実在確認 + タスク5後方互換**: `_einja-phase-review` Skill と `mcp__playwright__*` の利用可能性、入出力（PASS/CONDITIONAL/FAIL/PHASE_ESCALATE）を Read で確認。**タスク5改修後、(a)全判定で `{verdict,score,fixRequired[]}` 構造化返却 (b)`allowed-tools` に `Skill` 追加 (c)diff範囲引数化（省略時 `origin/issue/{N}...HEAD` デフォルト）が、既存の phase-reviewer Agent / einja-task-exec 経由フローを壊さない後方互換であることを確認**（既存呼び出し元の入出力期待を Read で照合）。
8. **Outcome Manifest merge 生存テスト（変更9一次リスク）**: 使い捨てrepoで Worker worktree に `artifacts/outcomes/x.json` を作成→`git merge --no-ff`→Worker worktree 削除 を再現し、**Director/phase ブランチに outcome が残存**することを確認。残存しなければ merge 手順に退避を追加（タスク1）。
9. PR の CI（lint 等）green。
