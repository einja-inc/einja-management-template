# issue-exec系 worktree prune-race / finalize-stall 修正 PR

## Context

Issue #343 Phase 1 を `einja-issue-team-exec`（Agent Teams 版）で実行した際、Skill 指示書の**構造的欠陥が 2 種類**、運用中に再現性をもって表面化した。Skill 自体の恒久バグなので、PR で修正して以後の全 issue-exec / issue-team-exec 実行に効かせる。

1. **prune-race（worktree 巻き込み削除）**: worktree 作成ブロックの `else` 節に `git worktree prune --expire now` がある。`git worktree prune` は path 引数を取れない**グローバル操作**で、admin entry のうち「作業ディレクトリが（一時的にでも）存在しない」ものを一括削除する。複数 Director/Worker が並行で worktree を作成中、ある主体の prune が**他主体の作成途中 worktree の登録を race 削除**し、対象の作業が壊れる（#343 で director-1 の作業中 worktree が実際に消失）。

2. **finalize-stall（完成成果物の破棄リスク）**: Director が Step 7（コミット・PR）で stall し、`[pr-ready]` 送信前に止まるケースが #343 で 3 回発生（1.2 / 1.8 / 1.11）。いずれも**成果物はディスク上に完成・未コミット**だった。しかし現行 `SKILL.md` エラー表の該当行は「Director Teammate 停止（PR作成前）→ 新 Teammate spawn してリトライ」しかなく、**完成済み成果物を破棄して再実行**する挙動になる（実際は Lead が手動で worktree を点検し commit+PR を引き取り回避）。この回避策が Skill に未定型化。

### 期待結果
- prune による他主体 worktree の巻き込み削除がゼロ（自 path 限定 cleanup に置換、5 箇所）。
- Director が finalize で止まっても、Lead が成果物を破棄せず引き取れる手順が Skill に明文化（Agent Teams 版のみ）。

## 現状（修正対象箇所）

### 重要: SSOT は本リポジトリ（einja-management-template）

`docs/einja/` および `.claude/skills/einja-*` の**原本（Single Source of Truth）はこの einja-management-template リポジトリ**。変更はビルド時に `presets/default/.claude/skills/` へ自動コピーされ、`@einja-inc/dev-cli` の `einja-dev-sync` で下流（eenchow-bot 等）へ配布される。
→ **eenchow-bot（下流）で直すと次の sync で巻き戻る。本リポジトリで直すのが唯一の正しい修正先。** `presets/default/` 配下は編集禁止（ビルドで上書き）。`vendor`/submodule も触らない。

### 欠陥①: `git worktree prune --expire now`（計 5 箇所）

**Agent Teams 版** `.claude/skills/einja-issue-team-exec/director-prompt.md`
- **L38** Director worktree 作成ブロック（reuse 判定: L35）
- **L86** Worker worktree 作成ブロック（reuse 判定: L83）

**tmux 版** `.claude/skills/einja-issue-exec/SKILL.md`
- **L183** Manager worktree 作成ブロック（reuse 判定: L180、※ `BRANCH` は else 内 L187 で定義）
- **L291** Step 5 tmux Worker worktree（reuse 判定: L288）
- **L662** 「Worker起動手順（再掲）」tmux Worker worktree（reuse 判定: L659）

5 箇所すべて構造が同一:
```bash
if git worktree list --porcelain | grep -qFx "worktree $WORKTREE_ABS"; then
  : # 既存worktreeを再利用
else
  git worktree prune --expire now 2>/dev/null   # ← 欠陥（グローバル）
  if [ -d "$WORKTREE_PATH" ]; then
    rm -rf "$WORKTREE_PATH"
  fi
  if git worktree list --porcelain | grep -q "branch refs/heads/$BRANCH$"; then
    echo "ERROR: $BRANCH は別のworktreeで使用中" >&2
    exit 1
  fi
  git worktree add "$WORKTREE_PATH" "$BRANCH"
fi
```

### 欠陥②: finalize-stall リカバリ未定型（Agent Teams 版のみ）

tmux 版は Director ロールが存在しない（Manager が責務吸収・単一プロセス）ため**対象外**。Agent Teams 版のみ:
- `director-prompt.md` Step 7（L138-146）: コミット/PR 失敗時の Lead 即時通知パスが無く、stall すると沈黙する。
- `SKILL.md` エラー表（`## エラーハンドリング（Agent Teams固有）`）の L501:
  `| Director Teammate 停止（PR作成前） | idle 通知 + タスク状態が in_progress のまま | Lead が新 Teammate spawn してリトライ（最大2回）→ 3回目失敗はユーザーエスカレーション |`
  → 「成果物完成・未コミット」ケースを区別せず破棄再実行になる。

## 変更内容（推奨アプローチのみ）

### 変更 1: グローバル prune → 自 path 限定 remove に置換（5 箇所）

**実測で確定した簡潔な修正**（現行コードは「グローバル `git worktree prune`」のみ。本計画の初版で検討した gitdir 一致ループは不要と実測で判明したため不採用）:
- `git worktree remove "$WORKTREE_ABS" --force` は、**登録のみ残る stale entry（ディレクトリ消失済み）も、登録＋ディレクトリが残る live entry も、自 path 1 件だけ**を安全に解除できる（実測: 同パスへの `git worktree add` も解除後に成功）。未登録 path には `|| true` で no-op。**他主体の登録には一切触れない** → race 解消。
- ただし副作用の手当てが 1 つ必要: 旧 `prune` は「自 path の stale 登録」も消していた。これを除去すると、自 path に stale 登録（dir 消失）が残ったまま reuse 判定 `grep -qFx` が真になり、**壊れた worktree を再利用**してしまう。→ **reuse 判定に「ディレクトリ存在」を AND 条件で追加**して回避する。

5 箇所すべてを以下の構造に置換:
```bash
if git worktree list --porcelain | grep -qFx "worktree $WORKTREE_ABS" && [ -d "$WORKTREE_PATH" ]; then
  : # 既存worktreeを再利用（登録 + ディレクトリの両方が存在する場合のみ）
else
  # 対象 path に紐づく worktree のみを安全に解除する。
  # グローバルな `git worktree prune` は path を限定できず、他主体が並行作成中の
  # worktree 登録まで race 削除するため使用禁止。`git worktree remove --force` は
  # 自 path 1 件のみ（stale 登録含む）を解除する。
  git worktree remove "$WORKTREE_ABS" --force 2>/dev/null || true
  if [ -d "$WORKTREE_PATH" ]; then
    rm -rf "$WORKTREE_PATH"
  fi
  if git worktree list --porcelain | grep -q "branch refs/heads/$BRANCH$"; then
    echo "ERROR: $BRANCH は別のworktreeで使用中" >&2
    exit 1
  fi
  git worktree add "$WORKTREE_PATH" "$BRANCH"
fi
```

注意（箇所差分）:
- Manager worktree（SKILL.md L180-193）は `BRANCH` を else 内（L187）で定義しているが、`git worktree remove` は `$WORKTREE_ABS` のみ参照するため定義順に影響なし。構造は同一置換でよい（Codex 実測で 5 箇所すべて置換前に `$WORKTREE_ABS`/`$WORKTREE_PATH` 定義済みを確認）。
- 5 箇所で `WORKTREE_PATH` / `WORKTREE_ABS` の値は異なるが、変数名・ロジックは共通。

**【表記揺れ防止・必須】** 5 箇所すべてで以下の**完全に同一の置換後文字列**を使う。Agent Teams 版担当・tmux 版担当の両サブエージェントに同一指示として渡す:
- reuse 判定行: `if git worktree list --porcelain | grep -qFx "worktree $WORKTREE_ABS" && [ -d "$WORKTREE_PATH" ]; then`
- prune 行の置換: `git worktree prune --expire now 2>/dev/null` → `git worktree remove "$WORKTREE_ABS" --force 2>/dev/null || true`
- コメント文言・インデント・`|| true` の有無を含め完全一致させる。

### 変更 2-a: director-prompt.md Step 7 に finalize 失敗の即時通知を追加（Agent Teams 版のみ）

Step 7（L138-146）の `[pr-ready]` / シグナルファイル記述群の直後に、以下を追記:
```
   - **finalize 失敗時の即時通知（必須）**: コミットまたは PR 作成に失敗した、もしくは
     何らかの理由で `[pr-ready]` 送信まで到達できない場合、**沈黙せず即座に** Lead へ
     `[error]` を送信する。本文に以下を含める:
       - タスク番号（X.Y）
       - Director worktree の絶対パス
       - `git -C <worktree> status --short` と `git -C <worktree> log --oneline -3` の出力
       - 失敗ステップ（commit / push / pr-create のいずれか）
     これにより Lead は完成済み成果物を破棄せず finalize を引き取れる（SKILL.md エラー表参照）。
```

### 変更 2-b: SKILL.md エラー表に finalize-stall リカバリ行を追加・既存行を明確化（Agent Teams 版のみ）

`## エラーハンドリング（Agent Teams固有）` 表の L501 を成果物の有無で 2 ケースに分割する:
- 既存行を「**成果物未完成**」ケースに限定:
  `| Director Teammate 停止/stall（finalize 前: 成果物が未完成） | idle 通知 + 成果物（modifications/qa-tests）未生成 | Lead が新 Teammate spawn してリトライ（最大2回）→ 3回目失敗はユーザーエスカレーション |`
- 新規行を追加（**成果物完成・未コミット**ケース）:
  `| Director stall（finalize 段階: 成果物は完成・未コミット） | [error] 受信、または idle + Director worktree に未コミットの完成成果物あり | Lead が git -C <worktree> status/diff/log で git 状態を点検 → Fast Gate 相当の検証（成果物存在・<<<<<<< / PARTIAL 等の danger-signal なし）に通れば、成果物を破棄せず Lead が commit + push + PR を引き取る（einja-task-commit / einja-create-pr 相当）。検証 NG のみ新 Teammate で当該タスク再実行 |`

**Lead 引き取りの検知条件と具体アクション**（表本文 or 直後に明記する）:
- **検知条件**: Director から `[error]`（変更 2-a の送信）を受信、または idle 検出時に `git -C <worktree> status --short` が**未コミットの完成成果物**を示す（modifications/qa-tests 等が存在し danger-signal なし）。コミット済みで PR 未作成のケースも含む。
- **具体アクション**: Lead が当該 worktree に対し `git -C <worktree>` で点検 → Fast Gate 相当検証通過後、`einja-task-commit`（未コミットなら）→ `einja-create-pr` を**当該 worktree を対象に**実行して引き取る。新 Teammate には引き継がない（成果物完成のため再実行不要）。
- **変更 2-a との対応**: Step 7 の `[error]` は commit / push / pr-create のどの失敗でも送信し、その失敗ステップを本文に含める。Lead はそのステップ以降を引き取る。

> 注: Lead の点検・引き取りは `git -C <worktree>`（cd しない）で行い、CLAUDE.md の git 安全ルール（`git add .` 等のグローバル操作禁止、自 path 限定）を厳守する。
> 注: `[error]` プレフィックスは `message-schemas.md`（L15: `[error] | Director → Lead | エラー報告`）に**既存**。スキーマ追記は不要・流用する（重複追記しないこと）。

## タスク概要

- **0-0**: タスク分解を TaskCreate で一括登録 [TaskCreate]
- **0-1**: Plan ファイルを `docs/plans/202606/20260602-issue-exec-worktree-prune-race-fix.plan.md` に配置 [Bash mv]
- **0-2**: worktree 不要（`.claude/skills/` の md 指示書のみ・小規模） → 現ツリーで直接編集
- **1**: `director-prompt.md` の prune 2 箇所（L38/L86）を自 path 限定 cleanup に置換（変更 1） [general-purpose / Edit]
- **2**: `director-prompt.md` Step 7 に finalize 失敗の即時通知を追記（変更 2-a） [general-purpose / Edit]
- **3**: `einja-issue-team-exec/SKILL.md` エラー表 L501 を 2 ケースに分割（変更 2-b） [general-purpose / Edit]
  - タスク 1-3 は **Agent Teams 版の同一 Skill 内**＝1 サブエージェントに直列委託（衝突回避）
- **4**: `einja-issue-exec/SKILL.md` の prune 3 箇所（L183/L291/L662）を自 path 限定 cleanup に置換（変更 1） [general-purpose / Edit]
  - タスク 4 は **tmux 版の別ファイル**＝タスク 1-3 と**並行可能**（別サブエージェント・編集対象ファイル非重複）
- **99-1**: 並行レビュー [einja-common:codex-agent + general-purpose] — 観点: bash 正確性（reuse 判定の dir チェック・`remove --force` の stale 解除挙動・5 箇所の置換漏れ）、整合性（`[error]` 規約が message-schemas.md に存在・Fast Gate 定義が issue-exec-protocol.md と一致）、網羅性（finalize-stall 手順の漏れ）
- **99-2**: 動作確認 — 一時 repo で「並行 prune が他 worktree を消さない」+「stale 自登録を `remove --force` が解除し再 add 成功」の再現テスト（後述）
- **99-2a**: ビルド整合確認 — `presets/default/.claude/skills/` への自動コピー対象であることを確認（直接編集はしない）。Plan ファイル同梱確認（実装 commit に同梱）
- **99-G**: コミット承認ゲート（レビュー結果**全文** + 動作確認サマリ + plan 同梱方針を報告し AskUserQuestion）
- **99-3**: コミット・プッシュ → PR 作成 [einja-task-commit / einja-create-pr]
- **99-4 判定**: 本変更は **Skill 指示書（`.claude/skills/`）のみ**でアプリ runtime 非影響 → 動作確認は再現テスト + bash 構文で十分。Discord verify 等は不要（理由を完了報告に明記）

## 並列実行計画

- 実装: **タスク 1-3（Agent Teams 版）** と **タスク 4（tmux 版）** は編集対象ファイルが重複しない（`einja-issue-team-exec/*` ⇔ `einja-issue-exec/SKILL.md`）ため**並行**。タスク 1-3 内は director-prompt.md を 2 タスクが触る（L38/L86 と Step 7）+ SKILL.md（エラー表）ため**同一サブエージェントに直列委託**。
- レビュー（99-1）: codex-agent と general-purpose を**並行**起動。

## リスク・不明点

- **`git worktree remove --force` の stale 解除挙動**: 実測で「登録のみ残る stale entry を自 path 限定で解除し、同パスへ再 add 成功」を確認済み。99-2 で再確認する。
- **reuse 判定の dir チェック追加**: 旧 `prune` が消していた「自 path stale 登録」を `remove --force` で個別解除する設計に変えたため、reuse 判定が stale 登録で誤って真になるのを `&& [ -d "$WORKTREE_PATH" ]` で防ぐ。5 箇所すべてに適用漏れがないか 99-1 で確認。
- **placeholder 変数**: md 内 bash は `${project-name}` / `{N}` / `{X.Y}` 等の placeholder を含む（実行時に Skill 側が解決）。`bash -n` 構文チェックは placeholder を実値に置換した抽出スニペットで行う。
- **finalize-stall 引き取りの責務境界**: Lead が commit する際は `git -C <worktree>` で worktree 内に限定。グローバル操作禁止を表に明記。
- **【トレードオフ・許容】別 path の stale ブランチ登録は自動回復しない**: 旧 `git worktree prune` は「別 path に登録された同一ブランチの stale 登録」も巻き込み削除していた（副次効果）。`git worktree remove "$WORKTREE_ABS" --force` は自 path 限定のため、別 path に放置された `task/N-X.Y` の stale 登録は残る。この場合、後続 `git worktree add` ではなく**その直前の既存チェック**（`grep -q "branch refs/heads/$BRANCH$"` → `exit 1`）で**明示的にエラー停止**する（サイレント破壊ではない）。これは「他主体の worktree を race 削除しない」ことを優先した意図的な設計判断。pruneで自動回復していた稀ケースがエラー停止に変わるが、並列実行の安全性を優先し許容する。
- **スコープ確定**: prune-race は 5 箇所すべて修正（ユーザー承認済み）。finalize-stall は Agent Teams 版のみ（tmux 版に Director ロール無し・Manager が責務吸収）。共通プロトコル（issue-exec-protocol.md）には波及させない。
- **【既存バグ・スコープ外】`/var`→`/private/var` symlink**: macOS の `/tmp`・`/var` 配下では `$(pwd)` ベースの `WORKTREE_ABS` と git porcelain（symlink 解決後）が不一致になり得る既存問題。ただし実 Skill のパスは `~/.einja/worktrees/...` = `/Users/...` に解決されるため発生しない。本 PR の導入問題ではなく対応は任意（将来 `realpath` 検討）。

## 検証・動作確認方法

1. **構文**: 5 箇所の置換後ブロックを placeholder 解決済みで抽出し `bash -n`。
2. **prune-race 再現テスト**（`/tmp` の使い捨て git repo、本体リポジトリ非影響）:
   - worktree A・B を作成。
   - 旧挙動（`git worktree prune --expire now`）: A のディレクトリを一時退避中に prune すると A 登録が消えることを確認（バグ再現）。
   - 新スニペット（自 path=B のみ対象）: A の登録が**消えない**ことを確認。
   - stale 自登録ケース: B のディレクトリのみ削除 → reuse 判定（`grep -qFx && [ -d ]`）が**偽**になり else へ → `git worktree remove --force` で stale 登録解除 → `git worktree add` 成功を確認。
   - **別 path stale ブランチケース**（トレードオフ確認）: 同一ブランチを別 path に登録して放置 → 自 path で `git worktree add` 前の `grep -q "branch refs/heads/$BRANCH$"` チェックが**意図どおり `exit 1`** することを確認（サイレント破壊しない）。
3. **静的整合**: `[error]` プレフィックスが `message-schemas.md` の規約一覧に存在することを grep。Fast Gate の danger-signal（`<<<<<<<` / PARTIAL）が `issue-exec-protocol.md` と一致することを確認。
4. **ビルド整合**: `presets/default/` への自動コピー対象パスであることを確認（手動コピー・手動編集はしない）。
5. PR の CI（lint 等）green を確認。
