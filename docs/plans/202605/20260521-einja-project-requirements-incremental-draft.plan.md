# Plan: einja-project-requirements に「随時ドラフト追記 + 再開」を追加

## Context
`einja-project-requirements` Skill は現状、4ラウンドのヒアリングをすべて終えてから `docs/project/requirements.md` に一括 Write する設計。
ユーザー要望:
1. ヒアリング途中で随時ドラフトが作成されるようにしたい（質問・回答ペア単位で `requirements.md` に追記）
2. 書き途中のドラフトがあれば続きから聞くようにしたい（質問単位で再開、判定は `requirements.md` を解析）

これにより「セッション中断 → 再開」「途中でユーザーが現状を見ながら答えられる」「全質問に答え切る前に脱落しても成果物が残る」というUXを実現する。

## 現状

### 対象worktree
- `/Users/t-hiroyoshi/git/einja/einja-management-template/.claude/worktrees/einja-project-requirements-skill/`
- ブランチ: `feat/einja-project-requirements`（**origin より 4コミット遅れ**、要 `git pull --ff-only`）

### Skillの構成
- `SKILL.md` — Step 0〜6 のメインフロー
- `references/hearing-checklist.md` — 4ラウンドの質問テンプレ集（既存質問IDは `Q{ラウンド}-{グループ}-{番号}` の3階層 例 `Q1-A-1`、要確認）
- `references/structure-guide.md` — 章別記入ガイド + 品質チェックリスト
- `references/template.md` — §0〜§16 の完全テンプレ（825行、プレースホルダは `[ XXX を記入 ]` 形式が中心、要事前確認）

### 現状フロー
| Step | 内容 |
|------|------|
| 0 | 前提確認（既存ファイル検出 + モード選択 AskUserQuestion + ディレクトリ準備） |
| 1 | 事前調査（Explore/general-purpose 最大3並列） |
| 2 | **ヒアリング 4ラウンド**（AskUserQuestion 逐次、ファイル書き込みなし） |
| 3 | **ドラフト生成**（テンプレート読込 → `docs/project/requirements.md` を一括 Write） |
| 4 | 自己検証（structure-guide.md でチェック） |
| 5 | ユーザー確認 + Edit修正ループ最大3回 |
| 6 | コミット承認ゲート + `einja-task-commit` |

### 出力先
- `docs/project/requirements.md`（固定）

## 変更内容

### 変更0: 事前準備（実装着手前に実施）
**目的**: レビュー指摘 MINOR-01 / MINOR-02 / R2-1 / R2-2 への対応。実装前にテンプレと質問体系の実態を確認し、Plan前提と差異があれば修正する。

- `references/template.md` を Read し、**実在するプレースホルダ形式**を全種類抽出（`[ XXX を記入 ]` / 空テーブル行 / `{...}` 等）
- `references/hearing-checklist.md` を Read し、**実在する質問ID体系**を確定（おそらく `Q{ラウンド}-{グループ}-{番号}` の3階層）
- 確定した形式を本Planのリスク表・変更内容に追記し、SKILL.md 改修時の判定ロジックに反映

### 変更1: `hearing-checklist.md` に「質問ID + 対応セクション」マッピング表を追加
- 既存の質問ID体系（変更0で確定）を活かし、各質問が `requirements.md` のどのセクション（例: `§1.2`, `§3 タイトル直下の表`）を埋めるかを明示
- マッピング表には **Editのアンカー用に「直前見出しテキスト」も併記**（後述の変更3でEditのold_stringを一意化するため）
- マッピング表に **「スキップ可否」フラグ** を追加（任意回答 = スキップ可、必須回答 = 不可）

### 変更2: `SKILL.md` Step 0 を「再開判定」付きに拡張

#### Step 0 状態別Writeトリガー（MINOR R1-4 への対応）

| `requirements.md` の状態 | テンプレWrite | バックアップ | 開始質問 |
|---|---|---|---|
| 未存在 | テンプレ全体を Write | 不要 | Q1-A-1（先頭） |
| 続きから | **Write しない**（既存維持） | 不要 | パースで推定された未回答先頭 |
| 最初から | テンプレ全体を Write（既存を上書き準備） | `requirements.md.start-over.YYYYMMDDhhmm.bak` にリネーム後 | Q1-A-1 |
| 上書き | テンプレ全体を Write | `requirements.md.overwrite.YYYYMMDDhhmm.bak` にリネーム後 | Q1-A-1 |

→ Step 5 の既存 `.regen-bak` 命名規則と衝突しないようプレフィックス + タイムスタンプを採用（MINOR-07 対応）

#### パース判定ルール（MINOR-01, R2-1 への対応）
- 変更0で確定したプレースホルダ形式（例: `[ XXX を記入 ]`、空テーブル行、`<!-- ... -->`）をすべて「未確定マーカー」として定義
- セクション本文の非空白文字列のうち、未確定マーカー以外を含む場合「埋め済み」と判定
- マッピング表で「セクション ↔ 質問ID」を参照し、**最も若い未埋めセクションに対応する質問を再開起点とする**

#### Step 0 の AskUserQuestion 選択肢
- `[続きから（Q{x}から推定）/ 最初から / 上書き / 再開位置を手動指定 / cancel]`
- 「再開位置を手動指定」を追加（MINOR R1-6 対応）→ ユーザーが質問IDを自由入力して開始点を指定
- 推定結果は質問文中に明示（「Q1-B-2 まで埋まっていると推定。これで合っていますか？」）

### 変更3: `SKILL.md` Step 2 を「質問単位 Edit ループ」に変更

#### ループ前提
- Step 0 の状態表に従い、必要なら **テンプレ全体を Write** して既知の初期状態を作る
- 「続きから」の場合のみ既存ファイル維持

#### ループ本体
各質問 `Q{x}` について:
1. AskUserQuestion を1問実行（**「スキップ（後回し）」「該当なし（恒久スキップ）」選択肢を含める** — MINOR-04, R2-4対応）
2. 回答に応じてEdit:
   - **通常回答**: 対応セクションを確定内容に置換
   - **スキップ（後回し）**: テンプレのまま残す → Step 4で欠落検出可能
   - **該当なし（恒久スキップ）**: 対応セクションに `<!-- SKIPPED: 該当なし -->` を埋め込み、Step 4の検出から除外
3. Edit の `old_string` は **「直前見出し行 + プレースホルダ行」のペア** を必須とする（MINOR R1-5, R2-3 対応）。マッピング表の「直前見出し」を使う
4. 「[Q{x} 完了 → §{section} を更新]」の進捗表示

#### ラウンド境界（MINOR-05, R2-5 対応）
- 各ラウンド完了時に**必須の確認**を入れる: `[次ラウンドへ / 一旦中断 / 再開位置を指定して中断]`
- 「中断」を選んだ場合、即座にループを抜けて Step 5 のユーザー確認に飛ぶ（または「次回 `/einja-project-requirements` 呼び出し時に続きから再開できます」とアナウンスして終了）

### 変更4: `SKILL.md` Step 3 を「最終整合性チェック」へ縮小
- Step 2 で既に書き込み済みのため、Step 3 はテンプレ全体の Write を行わない
- 「未埋め箇所のスキャン」: `<!-- SKIPPED: ... -->` 以外のプレースホルダが残っていれば警告し、Step 2 ループに戻す（最大1回）
- テンプレ Read は Step 0 に前出し

### 変更5: Step 4 自己検証
- structure-guide.md チェックリストで全章を最終検証
- スキップ済みセクションは `<!-- SKIPPED -->` マーカーで除外、未スキップで空ならエラー

### 対象ファイル
- `.claude/worktrees/einja-project-requirements-skill/.claude/skills/einja-project-requirements/SKILL.md`（メイン）
- `.claude/worktrees/einja-project-requirements-skill/.claude/skills/einja-project-requirements/references/hearing-checklist.md`（質問IDマッピング表追加）
- `references/structure-guide.md` / `references/template.md` は変更0で読み取り、必要時のみ追加修正

## タスク概要

| # | 内容 | 使用Skill/サブエージェント | 依存 |
|---|------|---------------------------|------|
| 0-0 | 全タスクをTaskCreateで一括登録 | TaskCreate | - |
| 0-1 | Planファイルを `docs/plans/202605/` 配下に命名規則に従って配置 | Bash/Write | 0-0 |
| 0-2a | worktree内で `git status` を実行し、未コミット変更がないか確認 | Bash | 0-1 |
| 0-2b | クリーンなら `git pull --ff-only` を実行。変更があれば停止しユーザー報告 | Bash | 0-2a |
| 0-3 | `template.md` `hearing-checklist.md` を Read し、実プレースホルダ形式・質問ID体系を確認。差異があれば Planの「変更内容」を内部メモで補正 | Read | 0-2b |
| 1 | `hearing-checklist.md` に質問IDマッピング表（質問ID / 対応セクション / 直前見出し / スキップ可否）を追加 | Edit | 0-3 |
| 2 | `SKILL.md` Step 0 拡張（再開判定 + 状態別Write表 + AskUserQuestion新選択肢） | Edit | 1 |
| 3 | `SKILL.md` Step 2 を質問単位Editループに書き換え（スキップ選択肢、Edit一意化ルール、ラウンド境界必須確認） | Edit | 2 |
| 4 | `SKILL.md` Step 3 を最終整合チェックへ縮小 + Step 4 SKIPPED除外ロジック | Edit | 3 |
| 99-1 | コードレビュー [`einja-review-code`] | Skill | 4 |
| 99-2 | 動作確認（テスト用ディレクトリで実Skill呼び出しスモークテスト: 1-2問通す → requirements.md更新確認 → 中断→再開シナリオ確認） | Bash/Skill実呼び出し | 99-1 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | - | 99-2 |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | Skill | 99-G |

## 並列実行計画

- 全タスクは SKILL.md の連続セクション編集が中心のため **直列実行**
- タスク1とタスク2は対象ファイルが異なる（hearing-checklist.md vs SKILL.md）ため理論上並列可だが、変更2はマッピング表を参照するためタスク1完了が前提
- 結論: **直列**。サブエージェント並列起動は不要

## リスク・不明点

| リスク | 対応 |
|--------|------|
| 既存ファイルが手動編集されており、テンプレプレースホルダの判定が誤検出する | Step 0 の AskUserQuestion で推定結果を提示し、「再開位置を手動指定」選択肢で逃げ道を確保 |
| Edit対象のアンカー（見出し）がテンプレと異なって失敗 | マッピング表に「直前見出し」を含め、Edit の `old_string` を「見出し + プレースホルダ」のペアで一意化 |
| 「続きから」モードで既存ファイルの見出し構造がテンプレと不整合 | Step 0 でテンプレと既存の見出し構造を比較し、不整合検出時は警告 + 「最初から」推奨 |
| 質問→セクションのマッピングがズレるとEditが空振りor誤った章を更新 | hearing-checklist.md にマッピング表を一元管理。タスク0-3で実IDとセクションを照合 |
| プレースホルダ形式がPlan想定と異なる（`[ XXX を記入 ]` vs `<!-- TBD -->`） | タスク0-3で実テンプレを確認し、判定ロジックを実形式に合わせる |
| 質問ID体系がPlan想定と異なる（3階層 vs 2階層） | タスク0-3で実体系を確認し、マッピング表を実形式で記述 |
| スキップ判定（後回し vs 該当なし）が曖昧 | AskUserQuestion 選択肢に両者を明示。`<!-- SKIPPED -->` マーカーで区別 |
| バックアップファイル命名が Step 5 の `.regen-bak` と衝突 | プレフィックス（`start-over` / `overwrite`）+ タイムスタンプ付き命名で衝突回避 |
| Skill変更によりCI/lintが落ちる | SkillはMarkdownのみで型/ランタイム影響なし。`pnpm prepush` を worktree内で実行 |

## 検証・動作確認方法

1. **静的検証**: SKILL.md frontmatter（`name:`, `user-invocable:`）維持確認 + Markdownの見出し構造確認
2. **マッピング整合性**: hearing-checklist.md の全質問IDが requirements.md テンプレの全セクションを過不足なくカバーしているか確認
3. **スモークテスト（タスク99-2）**: テスト用一時ディレクトリで以下を実行
   - シナリオA（新規）: `requirements.md` 未存在 → Skill起動 → Q1-A-1で回答 → `requirements.md` が生成され §1.x が埋まっているか確認
   - シナリオB（再開）: シナリオAで生成された `requirements.md` を保持したまま Skill再起動 → 「続きから（Q1-A-2 から推定）」が提示されるか、回答 → Q1-A-2 対応セクションのみ更新されるか確認
   - シナリオC（スキップ）: 質問に「該当なし」を選択 → `<!-- SKIPPED: 該当なし -->` が埋め込まれ Step 4 で警告されないか確認
4. **レビュー**: `einja-review-code` で観点別並列レビュー（A: 仕様整合性, B: ループ脱出条件, C: Edit安定性, D: 既存パターン準拠）
