# Plan: Figma移行を直接ファイル編集でworktreeに反映しPR作成

## Context

`worktree-3layer-review-harness` ブランチはPR #144マージ済み。ローカルmainの4コミット（Figma移行）はすでにブランチ祖先に含まれているが、PR #144マージ時のconflict resolution（`--theirs`採用）で一部ファイルのFigma変更が上書き消失している。

`einja-task-exec/SKILL.md` はすでに `ca8cc35` でFigma移行済み。

## 現状

| ファイル | 現状 | 問題 |
|---------|------|------|
| `einja-task-exec/SKILL.md` | ✅ Figma移行済み（`ca8cc35`） | なし |
| `einja-issue-spec-create/SKILL.md` | ❌ コンフリクトマーカー残存（UU状態） | cherry-pick abort後に直接編集が必要 |
| `einja-review-spec/SKILL.md` | ❌ コンフリクトマーカー残存（UU状態） | cherry-pick abort後に直接編集が必要 |
| `ui-design-generator.md` | ❌ コンフリクトマーカー残存（UU状態） | cherry-pick abort後に直接編集が必要 |

**現在の状態**: `45e008e` の cherry-pick がコンフリクト停止中（UU状態）

## アプローチ: cherry-pick abort → ファイル直接編集

**⚠️ ハードブロッカー**: `git cherry-pick --abort`（タスク1）が完了するまで、ファイル編集タスク（2-A/2-B/2-C）を絶対に開始してはならない。コンフリクトマーカーが残存した状態でファイル編集を行うと git 状態が壊れる。

cherry-pickは既存祖先コミットの二重適用になるためNG。代わりに `45e008e` が意図した変更内容を現在のファイルに直接適用する（abort後にコンフリクトマーカーが消え、HEADの内容に戻る）。

## 変更内容（abort後の各ファイルの直接編集）

### ファイル1: `.claude/agents/einja/issue-specs/ui-design-generator.md`

cherry-pick abort後のファイルはHEAD版（Pencilベースのhi-fiワークフロー含む）に戻る。

**コンフリクト対応箇所（abort後の編集内容）**:

#### 箇所A（旧コンフリクト1: 行124付近の大規模ブロック）

コンフリクトブロック全体を削除し、以下の内容に**手動マージ**する（45e008e側もHEAD側もそのまま採用しない）:

保持するもの:
- `lo-fi制約は改修時も守ること（既存画面の色はlo-fiでは再現しない）` の行
- `### lo-fi レビュー観点` セクション全体（画面構成・操作導線・Story対応 + Phase 1では評価しない3項目）

削除するもの:
- `## hi-fi モード（Phase 2）の作業ワークフロー` セクション全体（`ui-design.pen`参照を含む）
- コンフリクトマーカー（`<<<<<<<`, `=======`, `>>>>>>>`）

なお45e008e側の「既存画面のレイアウト、配色...」は行277以降（`一貫性のあるUI改修を実現` の行）としてコンフリクト外にすでに存在するため、コンフリクトブロック内の45e008e側は捨てる。

#### 箇所B（旧コンフリクト2: design-component-manifest.json行）

abort後のHEAD版には以下の行がある:
```
- `design-component-manifest.json`（DSコンポーネント一覧・不足リスト）
```
下流consumerが削除済みかつPencil MCP依存のため → **削除**

---

### ファイル2: `.claude/skills/einja-review-spec/SKILL.md`

abort後のHEAD版では行86の観点Bが `ui-design.pen` 参照になっている。

**編集内容（行86の観点B）**:

HEAD版からのマージ（`ui-design.pen` → `ui-design-url.md（Figma）` に変更し、詳細UX観点は保持）:

```
変更前（HEAD版）:
| B | UI/UX・画面整合 | `ui-design.pen` と requirements/design の整合、一貫性、主要導線、インタラクション4状態設計（disabled/error/empty/loading）の有無、エラーメッセージの位置と再試行導線の明示、多重送信防止とローディング制御、基本フォーカス管理 |

変更後（統合版）:
| B | UI/UX・画面整合 | `ui-design-url.md`（Figma）と requirements/design の整合、一貫性、主要導線、インタラクション4状態設計（disabled/error/empty/loading）の有無、エラーメッセージの位置と再試行導線の明示、多重送信防止とローディング制御、基本フォーカス管理 |
```

`ui-design.pen` を `ui-design-url.md`（Figma）に変更するのみ。詳細UX観点（4状態・エラーメッセージ・多重送信防止・フォーカス管理）はHEAD版をそのまま維持する。

---

### ファイル3: `.claude/skills/einja-issue-spec-create/SKILL.md`

abort後のHEAD版にある `ui-design.pen` 参照を `ui-design-url.md` に更新する。
3layer-review-harnessで追加した詳細requirements.md構造・AC命名規則・UX要件は保持する。

**編集内容（内容マッチで変更・行番号でなく文字列検索を使うこと）**:

**⚠️ コンフリクト箇所（行223-255）について**: このコンフリクトは `ui-design.pen` 参照差分ではなく、requirements.mdの必須セクション定義の競合（HEAD側:詳細13セクション構造 vs 45e008e側:簡略版1行）。**HEAD側（詳細版）を採用**すること。45e008e側（254行の旧セクション一覧形式）を採用すると `ui-design-url.md` 参照が消失するため採用不可。

| 変更箇所（内容マッチ） | 変更内容 |
|---|---|
| `requirements.md、ui-design.pen、design.md` | `requirements.md、UIデザイン（Figma: ui-design-url.md）、design.md` |
| `ui-design.pen のスクリーンショット要約` | `ui-design-url.md のFigma URLからFigma MCPで取得したスクリーンショット要約` |
| `出力: {仕様書ディレクトリ}/ui-design.pen` （Phase 1並列-2の出力行）| `出力: {仕様書ディレクトリ}/ui-design-url.md（YAMLフロントマター付きMarkdown）` |
| `ui-design.pen のフレーム命名（WF-S{n}-F{nn}）が一致しているか` | `ui-design-url.md のフレーム命名が一致しているか` |
| `ui-design.pen の lo-fi WF も対象に含める` | `ui-design-url.md（Figma）も対象に含める` |
| `Phase 1 の ui-design.pen レビュー観点（lo-fi WF）:` | `Phase 1 の ui-design-url.md レビュー観点（lo-fi WF）:` |
| `ui-design.pen 一括提示` | `ui-design-url.md（Figma）一括提示` |
| `ui-design.pen は並列生成中のため参照不可` | `ui-design-url.md は並列生成中のため参照不可` |
| `ui-design-generatorエージェント → ui-design.pen（hi-fi 詳細化）` | `ui-design-generatorエージェント → ui-design-url.md（Figma）` |
| `mode=hi-fi, phase=2, existing_pen_path=...` 行 | 削除（Pencil hi-fi固有パラメータ）|
| `ui-design.pen がある場合はスクリーンショット要約を渡す` | `ui-design-url.md がある場合はFigma MCPでスクリーンショット要約を渡す` |
| `Phase 2 の ui-design.pen レビュー観点（hi-fi）:` | `Phase 2 の ui-design-url.md レビュー観点（hi-fi）:` |
| `ui-design.pen がある場合のスクリーンショット確認` の行 | `ui-design-url.md がある場合のFigma MCPでのスクリーンショット確認` |
| `ui-design.pen が生成された場合` | `ui-design-url.md が生成された場合` |
| `UIデザインへのリンク（ui-design.pen）` | `UIデザインへのリンク（Figma URL: ui-design-url.md）` |
| 成果物ツリー内の `ui-design.pen` | `ui-design-url.md  # UIデザイン（FigmaURL + フレームmanifest）` |

## タスク概要

| ID | 内容 | Skill/方法 |
|----|------|-----------|
| 0-0 | TaskCreate一括登録 | - |
| 0-1 | Planファイル配置（`docs/plans/202605/`） | - |
| **1** | `git cherry-pick --abort`（⚠️ 完了まで2系着手禁止） | Bash |
| **2-A** | `ui-design-generator.md` 編集（hi-fiワークフロー削除・design-component-manifest削除・lo-fi観点は保持） | `codex-agent` |
| **2-B** | `einja-review-spec/SKILL.md` 編集（行86: `ui-design.pen` → `ui-design-url.md（Figma）`、詳細UX観点は保持） | `codex-agent` |
| **2-C** | `einja-issue-spec-create/SKILL.md` 編集（Pencil→Figma置換・3layer追加分は保持） | `codex-agent` |
| **3** | 観点別並列コードレビュー（`git diff HEAD`対象） | `einja-review-code` |
| 99-G | コミット承認ゲート | `AskUserQuestion` |
| 99-3 | コミット・プッシュ | `einja-task-commit` |
| **4** | PR作成（worktree-3layer-review-harness → main） | `gh pr create` |

## 並列実行計画

```
順次: 0-0 → 0-1 → 1（cherry-pick abort）→ 並列（2-A || 2-B || 2-C）→ 3（コードレビュー）→ 99-G → 99-3 → 4（PR）
                  ↑ここ完了まで2系絶対着手禁止
```

## リスク・不明点

| リスク | 対策 |
|--------|------|
| `einja-issue-spec-create/SKILL.md` の行番号ズレ | 内容マッチ（文字列検索）で編集。行番号は参照しない |
| 他に残存するPencil参照 | 検証1で `grep -rn "ui-design\.pen"` を実行して確認 |

## 検証・動作確認方法

1. `grep -rn "ui-design\.pen" .claude/skills/ .claude/agents/` → `einja-pencil-design-manager/` 以外で0件
2. `grep "ui-design-url" .claude/skills/einja-review-spec/SKILL.md` → 行86に存在かつUX詳細観点も残存
3. `grep -c "ui-design-url" .claude/skills/einja-issue-spec-create/SKILL.md` → 5件以上
4. `grep "ui-design\.pen" .claude/agents/einja/issue-specs/ui-design-generator.md` → 0件
5. `grep "hi-fi モード" .claude/agents/einja/issue-specs/ui-design-generator.md` → 0件（hi-fiセクション削除確認）
5. PRが正常に作成できること
