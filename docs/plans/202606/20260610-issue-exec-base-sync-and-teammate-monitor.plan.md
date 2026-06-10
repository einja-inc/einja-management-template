# issue-exec系 信頼性向上: ①ベースブランチ遅延対策 ②teammate監視モードの構造修正

> 本Planは独立した2テーマを扱う。**別コミット・別PR**に分離して実装する（ファイル無関係・レビュー観点別・混ぜると巨大PRで巻き戻しリスク）。
> 本Planは前セッションで策定・レビュー（einja-review-plan + codex-agent、**MINOR判定・指摘反映済み**）まで完了している。行番号アンカーはタスクA0/B0（grep全棚卸し・実在確認）で実行時に再確認するため、行ドリフトには自己修正で対応する。

## Context

下位リポジトリで顕在化した2問題。最新公式ドキュメント調査（claude-code-guide）+ Codex とのダブルチェックで設計を収束済み。

### 問題1: Issueブランチのベースブランチ遅延
`issue/{N}` で長期作業するとベース（develop/main）から遅れ、最終マージで大量コンフリクト・他セッション作業の巻き戻しが起きる。実害（eenchow-bot）: `issue/343` が develop から **70 commit 遅れ**、最終PR #412 が CONFLICTING/DIRTY・`.env.develop` 巻き戻しリスク。team/非team両方。根本原因は `issue-exec-protocol.md §12.3` に同期プロトコルの定義はあるが各SKILLに実装場所が無く、§12.3 自体が「Manager監視ループでbase進行を検知」という受動モデルで事実上機能していないこと。

### 問題2: teammate表示モード検出の構造的不整合
`einja-team-exec/SKILL.md` L72-82 と hooks（task-completed.sh/teammate-idle.sh L30）が、**Claude Code が公式提供しない env var `CLAUDE_CODE_TEAMMATE_MODE`** を二重に判定。フックは `${:-tmux}` でtmux仮定、SKILLは env空→in-process判定、で挙動がズレる。下位リポジトリで teammateMode=auto（settings top-level）の時、フックはシグナル生成するのにSKILLがin-process誤判定し tmux pane監視をしない。

**公式調査で確定した事実（根拠: code.claude.com/docs/en/agent-teams, hooks, env-vars, GitHub Issues #29207/#29660/#32987/#23572/#24301）:**
- `teammateMode` = tmux/in-process/**auto（デフォルト）**。auto は tmux内 or iTerm2 で split panes。
- **`CLAUDE_CODE_TEAMMATE_MODE` は公式提供されない env var**（einjaが settings env で補完）。hooks にも渡らない。
- hooks(TaskCompleted/TeammateIdle)は **stdin JSON で team_name/teammate_name/task_id を受け取る**（公式）。
- Agent Teams の **環境変数の自動継承は実装不安定**（#29660/#32987）。instructions export 経由も hook 伝播は保証されない（debug log で実績確認できず）。
- teammate の実効モード（pane/in-process）を hook/skill から確実判定する公式手段は**無い**。#29207 で tmux 明示でも silent in-process fallback あり。

→ 結論: **「実効モードを当てに行く」設計は不可能**。hooks は判定をやめ常にシグナル生成、**Lead Skill だけが einja の監視モードを決める**。

## 変更内容

### ───────── PR-A: ベースブランチ遅延対策（問題1）─────────

**方針1: Phase境界強制同期（§12.3.1）** — Phase完了→次Phase着手前に Manager/Lead が必ず:
```bash
git fetch origin
BEHIND=$(git rev-list --count "issue/{N}..origin/{baseBranch}")  # issue/{N}がbaseより遅れているコミット数
if [ "$BEHIND" -gt 0 ]; then
  git merge --no-edit "origin/{baseBranch}"   # 衝突→einja-conflict-resolver
  git push origin "issue/{N}"                  # 失敗→§12.2リトライ
fi
# 次Phaseブランチは最新化後の issue/{N} から作成/追従（merge-only・冪等）
```

**方針2: 最終PR作成前 遅れ検知ゲート（§12.3.2・必須）** — `einja-create-pr` 直前に:
```bash
git fetch origin
BEHIND=$(git rev-list --count "issue/{N}..origin/{baseBranch}")
echo "issue/{N} は origin/{baseBranch} から ${BEHIND} コミット遅れ"
if [ "$BEHIND" -gt 0 ]; then
  echo "[WARN] ${BEHIND}件のbase更新未取込。巻き戻しリスク。取込実行"
  git merge --no-edit "origin/{baseBranch}"; git push origin "issue/{N}"
fi
# この後PR作成 → CONFLICTING/DIRTY PRを構造的に防ぐ
```

**方針3: 監視ループ検知モデルの整理** — §12.3 の「Manager監視ループでbase進行検知→sync_required通知」を方針1/2に置換。`sync_required` のうち base同期通知分は廃止（memory obs 1496: workflow図のsync_required通知は未実装）。

**精査で確定した既存記述の扱い（レビュー指摘を精査・短絡を回避）:**
- `rebase` 記述（workflow.md L215/L275, issue-exec SKILL L756）は**全て `task/{N}-{X.Y}`（rebase可）文脈** → 残す。Phase境界 merge のコンフリクト行を追加する。
- `sync_required`（workflow.md L248, issue-exec SKILL L854）= 旧監視ループ概念・未実装 → 削除/方針1整合に書換。

| ファイル | 変更 |
|---------|------|
| `docs/einja/instructions/issue-exec-protocol.md` | **§12.3（L305-336）改訂**: §12.3.1 Phase境界強制同期 / §12.3.2 最終PRゲート。sync_required（L319/L335）削除。タイミング表差替 |
| `docs/einja/steering/branch-strategy.md` | L384-394「自動同期」を方針1/2へ。L376（merge-only表）直後に「base追従は必ずmerge」1文 |
| `docs/einja/instructions/issue-exec-workflow.md` | L248 sync_required削除、L215/L275 はtaskブランチ文脈と明記（残す）、Phase境界同期の追記 |
| `.claude/skills/einja-issue-exec/SKILL.md` | 最終PRゲート（Step8 L613-623直前）、Phase境界同期（Step7 L604-606）、L854 sync_required書換、L756 mergeコンフリクト行追加、ツリー注記 |
| `.claude/skills/einja-issue-team-exec/SKILL.md` | base取込同期（Step6 L541-542間, push成功確認後にL543へ）、最終PRゲート（Step8 L573-575間） |
| `.claude/skills/einja-issue-team-exec/director-prompt.md` | L43-54付近に「base参照前にfetch済み前提」1文（任意） |
| `docs/einja/steering/commit-rules.md` | L18-21付近に「共有ブランチの最新化はpull --rebaseでなくmerge」1文 |

### ───────── PR-B: teammate監視モードの構造修正（問題2）─────────

**設計核: hooks は判定せず常にシグナル生成。Lead Skill だけが監視モードを決める。**

**B-1. hooks（task-completed.sh / teammate-idle.sh）**
- `${CLAUDE_CODE_TEAMMATE_MODE:-tmux}` モード判定を**削除**
- **session id 解決（signal dir決定）**: `EINJA_SESSION_ID`(=`issue-{N}`) を**主経路**。未設定時のみ stdin JSON の `team_name` から命名サフィックス（`-directors`/`-workers` 等、B0で規則確認）を除去して復元 → `CLAUDE_CODE_SESSION_ID` → `CLAUDE_SESSION_ID`。**`team_name` をそのまま signal dir に使わない**（Lead が見る `issue-{N}` とズレるため）
- task_id/teammate_name は **stdin JSON 優先**（CLAUDE_CODE_TASK_ID 等は env fallback）
- セッション単位 signal dir に**常にシグナル生成**（in-process時は Lead が無視するので無害）
```bash
HOOK_INPUT="$(cat)"; json_get(){ node -e '...' "$1" <<<"$HOOK_INPUT" || jq ... ; }
# signal dir は EINJA_SESSION_ID(issue-{N}) 主経路。未設定時のみ team_name からサフィックス除去で復元
SESSION_ID="${EINJA_SESSION_ID:-}"
[ -z "$SESSION_ID" ] && SESSION_ID="$(json_get team_name | sed -E 's/-(directors|workers)$//')"
[ -z "$SESSION_ID" ] && SESSION_ID="${CLAUDE_CODE_SESSION_ID:-${CLAUDE_SESSION_ID:-}}"
[ -n "$SESSION_ID" ] || exit 0
# mode判定なし。常に signal 生成（stdin JSON 全文を書く）
```

**B-2. `einja-team-exec/SKILL.md` Step 1-A**
- 「表示モード検出（env var判定）」→「**Lead監視モード resolve**（`EINJA_TEAMMATE_MONITOR_MODE`）」に変更
- resolver: `EINJA_TEAMMATE_MONITOR_MODE` > top-level teammateMode(project→user) > auto。**auto/tmux は `$TMUX`非空 + `tmux list-panes`成功で tmux、それ以外/失敗で in-process 降格**
- **tmux監視でも SendMessage/TaskList poll を併用**（#29207 silent fallback保険）

**B-3. `einja-team-exec/references/monitoring.md`**（存在確認の上）
- hooks を「実効モード依存の監視」でなく「**イベント signalizer（常時生成）**」と再定義。in-process時は signals無視、tmux時は wake trigger

**B-4. `einja-issue-team-exec/SKILL.md`** — team-exec の新監視方針を参照する記述に更新（L78付近）

**B-5. `docs/einja/instructions/agent-teams-env.md` + `.claude/settings.json`**
- agent-teams-env.md: `CLAUDE_CODE_TEAMMATE_MODE`「プラットフォーム提供」記述を**削除/訂正**（公式提供されない）。hook 入力は **stdin JSON 前提**に修正（env var 依存記述を削除）。`claude --teammate-mode tmux` は **Lead起動時オプション**として記載（auto silent fallback回避・CLI>settings）
- `.claude/settings.json` L4: env ブロックの `CLAUDE_CODE_TEAMMATE_MODE: "tmux"` を**削除**（hooks/SKILLが参照しなくなるため不要。残すとdocs訂正と矛盾）。※settings.json は cli-package-specs 対象

**再利用資産**: einja-conflict-resolver、§12.2リトライ、git rev-list --count（新規ツール/Skill無し）。
**配布**: 全て原本。ビルド時 presets/default へ自動コピー（直接編集しない）。hooks/SKILL は cli-package-specs（二重管理禁止）準拠。

## タスク概要

- **0-0**: TaskCreate一括登録（PR-A/PR-B別系列・依存明示）
- **0-1**: Plan配置 `docs/plans/202606/20260610-issue-exec-base-sync-and-teammate-monitor.plan.md`
- **0-2**: worktree作成 [`_einja-worktree-guide`]

**PR-A（問題1・直列依存あり）**
- A0: grep全棚卸し（`§12.3`/`sync_required`/`IssueBranchBase`/`rebase`）で対象・文脈確定 [Grep] ← T1前提
- A1: protocol §12.3改訂 [Task] ← PR-A正本・最優先
- A2: branch-strategy [Task]（A1と並列可）
- A3: issue-exec SKILL [Task] / A4: issue-team-exec SKILL [Task] / A5: workflow.md [Task] / A6: director-prompt [Task]（A1後に並列）
- A7: commit-rules [Task]

**PR-B（問題2・PR-Aと完全独立・並列可）**
- B0: monitoring.md 等の参照ファイル実在確認 [Glob/Read] ← B前提
- B1: hooks 2本 [Task] ← PR-B基盤
- B2: team-exec SKILL 監視モード [Task]（B1後）
- B3: monitoring.md [Task]（B1後・B2と並列）
- B4: issue-team-exec SKILL 参照更新 [Task]（B2後）
- B5: agent-teams-env.md [Task]（B1後・並列可）

**検証（各PR個別に）**: 99-1 [einja-review-code] → 99-2 動作確認 → 99-G コミット承認ゲート [AskUserQuestion] → 99-3 [einja-task-commit]

## 並列実行計画

```
PR-A: A0 → A1 ∥ A2 → (A3 ∥ A4 ∥ A5 ∥ A6) → A7 → 検証 → PR-A commit
PR-B: B0 → B1 → (B2 ∥ B3 ∥ B5) → B4 → 検証 → PR-B commit
制約: B4 は A4 完了後（A4 --先行--> B4。同一ファイルの別箇所編集を直列化）
```
- A4とB4は同一ファイル einja-issue-team-exec/SKILL.md だが、A4=Step6/8の同期挿入、B4=L78の監視方針参照で**箇所が別**。**B4をA4完了後に直列化**して同時編集回避（上図の制約に明示）。オーケストレーターが順序を保証。
- 各サブエージェントに変更対象ファイル明示・他ファイル不可・git add は対象のみを指示。

## リスク・不明点

| リスク | 対応 |
|-------|------|
| §12.3旧記述の他参照 | A0 grep棚卸しで確定（rebase=task文脈は残す/sync_required=削除を判別） |
| team版A4: push前にphase{M+1}を切ると古いissue参照 | merge→push成功確認をphase{M+1}作成の前提に明記 |
| hooks の stdin JSON フィールド名が実機と差異 | B1着手時にdebug log/公式hooksドキュメントで team_name/teammate_name/task_id を確認。env varフォールバック併設で堅牢化 |
| monitoring.md 等参照ファイルが存在しない可能性 | B0で実在確認。無ければ team-exec SKILL本体に統合 |
| instructions export のhook伝播は不確実 | B設計は伝播を前提にしない（hooksはstdin JSON使用）。EINJA_SESSION_IDフォールバックは残すが主経路にしない |
| #29207 silent fallback | tmux監視でも SendMessage/TaskList poll併用で取りこぼし防止。tmux list-panes失敗で in-process降格 |
| settings.json読取(node) | fs.readFileSync+JSON.parse（require回避）、jq fallback、project→user優先。JSONCは非対応前提（einja settingsはコメント無し確認済） |

## 検証・動作確認方法

**PR-A**: ①同期コマンドが merge-only・冪等(behind=0スキップ)・conflict-resolver連携・§12.2参照を満たす ②一時repoで rev-list behind判定 + merge挙動dry-run ③`grep -rn "§12.3\|sync_required\|IssueBranchBase"` で旧記述残存と新方針一致を確認
**PR-B**: ①hooks がmode判定無しでstdin JSONから常時signal生成すること（一時的に擬似JSONをstdin投入し signal生成を確認） ②resolver dry-run: $TMUX有/無・teammateMode tmux/auto/in-process・tmux list-panes失敗で正しく tmux/in-process が出る ③`grep -rn "CLAUDE_CODE_TEAMMATE_MODE"` でhooks/SKILLから判定依存が消えたこと ④agent-teams-env.md が stdin JSON前提に修正されたこと
**共通**: ⑤ビルドで presets/default 反映確認 ⑥（任意・別途）下位リポジトリで短いIssueを team/非team実行し、Phase境界・最終PR前の同期ログ、env var非設定でも teammate監視が成立することを確認
