# Plan: einja-v0-prompt-generator Skill 新設

## Context

v0（Vercel v0.dev）は React + Tailwind + shadcn/ui スタックに特化した AI UI 生成サービス。einja テンプレートには Figma モック生成用 `ui-design-generator` エージェントと Pencil.dev 用 `einja-pencil-design-manager` は存在するが、**v0 用の高品質プロンプト生成を支援する仕組みが無い**。

開発者が v0 を使う際、自力でプロンプトを書くと以下の課題がある:
1. v0 推奨構造（behavior + visual intent + states + style cues）を毎回思い出す必要がある
2. モック要件（画面構成/インタラクション/スタイル）を体系的に洗い出せない
3. 生成プロンプトが再利用可能な資産として残らない

本Planでは **標準化された v0 プロンプトを対話ヒアリングで生成し `.md` に保存する新規Skill `einja-v0-prompt-generator`** を新設する。v0.dev への投入はユーザーが手動でコピペする運用とし、Skill の責務は「プロンプト生成」と「ファイル保存」に限定する。

## 現状

### 関連する既存Skill/Agent（本Skillは連携せず、参考のみ）

| 名前 | 種別 | 役割 | 関係 |
|---|---|---|---|
| `ui-design-generator` | agent (Figma MCP) | requirements.md → Figma lo-fi モック → `ui-design-url.md` | 出力形式の参考 |
| `einja-pencil-design-manager` | Skill | Pencil (.pen) デザイン管理 | 別デザインツール向け先例 |
| `einja-project-requirements` | Skill | AskUserQuestion 多段ヒアリング | **ヒアリング設計の参考元** |
| `einja-skill-plan-guide` / `einja-skill-creator` | Skill | Skill 設計・実装 | 実装タスクの委託先 |

### einja-skill-first 評価結果

- 既存Skillカバレッジ: **部分カバー**（v0向け専用は不在）
- 関連過去Plan・patterns.md記録: なし
- 判定: **新規Skill推奨**

### 確定要件（ユーザー承認済み）

1. 入力: 自由記述（対話ヒアリング）
2. 出力: `.md` ファイル保存 + ユーザーが v0.dev に手動コピペ投入
3. 呼び出し: **スタンドアロン起動のみ**（他Skillに組み込まない）
4. デザインシステム: **v0デフォルト（shadcn/ui + Tailwind）任せ**、プロジェクト固有情報は含めない

## 変更内容

### A. Skill仕様（einja-skill-plan-guide ワークフローA準拠）

| 項目 | 値 |
|---|---|
| **name** | `einja-v0-prompt-generator` |
| **配置先** | `.claude/skills/einja-v0-prompt-generator/`（配布対象、`einja-` プレフィックス） |
| **分類** | オーケストレーター（AskUserQuestion 対話が中核、サブエージェント起動不要） |
| **user-invocable** | `true` |
| **context: fork** | 設定しない（AskUserQuestion を直接使用するため） |
| **allowed-tools** | `AskUserQuestion, Read, Write, Edit, Bash, Glob` |
| **依存Skill** | なし（Agent Teams / Pencil MCP / Figma MCP に依存しない） |

**description（1024文字以内）:**
```
Generates v0.dev (Vercel v0) prompts for React + Tailwind + shadcn/ui UI mockups through interactive hearing. 機能概要・画面構成・インタラクション・スタイル志向を段階的にヒアリングし、v0公式推奨構造（behavior + visual intent + states + style cues）に沿ったプロンプトを`.md`ファイルに保存する。ユーザーは生成された`.md`の内容をv0.devに手動コピペしてモックを生成する。「v0プロンプト作って」「v0プロンプト生成」「v0モック用のプロンプト」「Vercel v0のプロンプト」「v0.devのプロンプト」等で呼び出す。Do NOT use for: Figmaモックアップ生成（→ ui-design-generator agent）、Pencilデザイン管理（→ einja-pencil-design-manager）、フロントエンド実装本体（→ einja-frontend-implement）、v0.devへの自動投入（本Skillは`.md`生成のみ）
```

**Progressive disclosure設計:**

| レベル | 内容 | 想定行数 |
|---|---|---|
| SKILL.md body | ワークフロー Step 1〜5、質問セット概要、v0構造概要、エラー処理 | 300–400 行 |
| `references/v0-prompt-template.md` | v0プロンプト完全テンプレート（プレースホルダ付き）、Tips、良い例/悪い例 | 200行程度 |
| `references/hearing-questions.md` | AskUserQuestion 質問セット詳細（description + Note の完全版） | 150行程度 |

### B. 対話ヒアリング設計（AskUserQuestion 全6問）

| Q# | 目的 | 形式 | 必須 |
|---|---|---|---|
| Q1 | 機能概要・目的 | 単一選択（テンプレート例5つ + 自由入力）のハイブリッド | ✅ |
| Q2 | 画面種別（Landing/Dashboard/Form/List/Chat/Auth/その他） | 単一選択 | ✅ |
| Q3 | 主要画面要素（Header/Sidebar/KPI/Table/Chart/Form/Modal 等） | 複数選択、スキップ可 | - |
| Q4 | 状態・インタラクション（Loading/Empty/Error/Responsive/Dark 等） | 複数選択、スキップ可 | - |
| Q5 | スタイル志向（Modern/Enterprise/Playful/Minimal/Dark） | 単一選択 | ✅ |
| Q6 | 追加指示（v0固有Tips等） | 自由入力、スキップ可 | - |

**分岐ロジック:**
- Q2 で Landing/認証 選択 → Q3 の推奨選択肢を絞る
- Q4 で「レスポンシブ」選択 → プロンプトに `responsive breakpoints` 節を自動追加
- Q4 で「ダークモード」選択 → `Include a dark mode toggle` 指示を自動追加
- Q6 空欄 → プロンプトから "Additional requirements" セクション削除

**全質問共通:** 選択肢に `その他（自由入力）` を必ず含める、`description` + `Note:` の2層記述。

### C. v0プロンプトテンプレート設計

- **プロンプト本体言語**: **英語**（v0 トレーニング主体言語、Vercel公式サンプルも英語）
- **ドキュメント本文（見出し・使い方）**: 日本語（Skill利用者は日本語話者）
- **プロジェクト固有デザイントークン**: 含めない（要件通り v0 デフォルト任せ）
- **Hearing Summary テーブル**: 含める（後日改訂時の入力履歴として有用）

**テンプレ構造（`references/v0-prompt-template.md`）:**
```
# {機能名} - v0 Prompt

## v0 Prompt
Build a {画面種別} for {機能概要}.

### Purpose / Layout & Content Areas / Visual Style / States & Interactions / Behavior / Additional Requirements
{Q1〜Q6の回答を単純文字列置換で埋め込み}

## How to use（日本語コピペ手順）
## Hearing Summary（Q1〜Q6 回答ログ）
```

### D. 出力先設計

**採用**: `docs/v0-prompts/{YYYYMMDD}-{slug}.md`（デフォルト）

- 既存 `docs/plans/YYYYMM/YYYYMMDD-*.md` パターンと親和的
- Step 4 で AskUserQuestion で**4択**提示: A=デフォルト（推奨） / B=カレントディレクトリ / C=パス指定 / **D=`.gitignore`済みディレクトリ（`.local/v0-prompts/`）**
- slug 生成: Q2画面種別 + Q1由来キーワード（例: `dashboard-inventory`）→ AskUserQuestion で確認・上書き可
- 同名ファイル存在 → タイムスタンプ suffix 付与
- `docs/v0-prompts/` 未存在 → Bash `mkdir -p` で自動作成
- **A選択時は git 管理対象**（中間成果物として資産化）、**D選択時は `.gitignore` 配下で機微情報保護**（初回は `.gitignore` に `.local/` 追記も自動）
- Step 3 で機微情報パターン軽量検出（詳細はE節）

### E. ワークフロー全体像（Step 1〜5）

| Step | 内容 | 使用ツール |
|---|---|---|
| **1. 前提確認・初期化** | pwd/ls確認、`docs/v0-prompts/` 未存在なら自動作成、TaskCreate で全Step登録 | Bash, TaskCreate |
| **2. 対話ヒアリング** | Q1〜Q6 を順に実行、回答を内部辞書に格納、分岐ロジック適用 | AskUserQuestion, Read(hearing-questions.md) |
| **3. プロンプト構築** | テンプレ Read → プレースホルダ置換 → 未選択セクション削除 → Hearing Summary構築 → **機微情報パターン軽量検出**（`sk-`, `AKIA`, email, 電話番号 → 検出時 AskUserQuestion で確認） | Read(v0-prompt-template.md), AskUserQuestion |
| **4. 保存先確認・書き出し** | slug自動生成 → AskUserQuestion で保存先確認（デフォルト+カレント+パス指定+**`.gitignore`済みディレクトリ**の4択） → 同名チェック → Write | AskUserQuestion, Bash, Write |
| **5. 案内・最終確認** | パス提示、先頭40行プレビュー、v0.dev URL + コピペ手順案内、修正意向確認 | AskUserQuestion |

**再ヒアリング仕様（Step 5 で B=再ヒアリング選択時）:**
- AskUserQuestion で修正対象Q（Q1〜Q6）を**複数選択**
- 選択されたQのみ再質問、未選択Qは初回回答を保持
- Hearing Summary テーブルに `revision: Q2,Q5` のようなマーク付与
- 再生成時はファイル名にタイムスタンプ suffix
- 最大1回まで（無限ループ防止）

**保存先AskUserQuestion 選択肢（Step 4）:**
- A: デフォルト（推奨） — `docs/v0-prompts/{YYYYMMDD}-{slug}.md`
- B: カレントディレクトリ — `./{slug}-v0-prompt.md`
- C: パスを指定 — 自由入力（機微情報を含む場合は本オプションで `.gitignore` 配下に配置推奨）
- D: `.gitignore` 済みディレクトリ — `.local/v0-prompts/{YYYYMMDD}-{slug}.md`（初回は `.gitignore` に `.local/` が無ければ Bash で追記）

## タスク概要

- **タスク0-0**: TaskCreate で本Plan全タスクを一括登録（依存関係を明示）
- **タスク0-1**: Planファイルを保存先 `docs/plans/YYYYMM/YYYYMMDD-einja-v0-prompt-generator.plan.md` に移動
- **タスク0-2**: worktree作成は**不要**（ドキュメント/Skill追加のみ、既存コードに影響しない軽微変更）
- **タスク0-3（= T1）**: Skill本体3ファイル作成 [`einja-skill-creator`]
  - `.claude/skills/einja-v0-prompt-generator/SKILL.md`
  - `.claude/skills/einja-v0-prompt-generator/references/v0-prompt-template.md`
  - `.claude/skills/einja-v0-prompt-generator/references/hearing-questions.md`
  - **Definition of Done**:
    - description が 1024 文字以内（`wc -m` 相当で実測）
    - ディレクトリ名が `einja-*` glob にマッチ（配布ホワイトリスト自動判定条件）
    - Frontmatter の `name` とディレクトリ名一致
- **T2**: Skill品質レビュー [`einja-skill-plan-guide` ワークフローB]
  - Skill特化観点: Frontmatter品質・構造ボリューム・Progressive disclosure・einja設計思想・Anthropicベストプラクティス
  - **役割分担**: T2 は **Skill構造・Frontmatter・progressive disclosure に特化**、99-1 は **汎用コード観点（配布整合・命名・path安全性）に特化**
- **99-1**: 観点別並列コードレビュー [`einja-review-code`]
  - T2 と観点重複時のマージ順序: **T2先 → 99-1後、両方MAJORなら統合して1回で修正**
- **99-2**: 動作確認: Skill を実行して `.md` 生成成功、v0.dev 投入で意図通りのモック生成（1〜2ケース、ユーザー実施）
- **99-G**: コミット承認ゲート [`AskUserQuestion`]
- **99-3**: コミット・プッシュ [`einja-task-commit`] → PR作成 [`einja-create-pr`]

**注記（旧T3を廃止）**: `packages/cli/scripts/copy-presets.mjs` は `einja-*` プレフィックスを動的スキャン（追加設定不要）と確認済み。独立タスクは立てず、T1 の DoD に「`einja-*` glob マッチ」を組み込み済み。

## 並列実行計画

```
[逐次] タスク0-0（TaskCreate） → 0-1（Plan配置） → 0-3=T1（Skill本体作成）
                                                        │
                                                        ▼
                                                    T2（Skill品質レビュー）
                                                        │
                                                        ▼
                                                    99-1（einja-review-code 汎用観点）
                                                        │
                                                        ▼
                                                    99-2 → 99-G → 99-3
```

- 本Planは独立並列可能なタスクが少ないため（Skill新設 → レビュー → 動作確認の逐次フロー）ほぼ逐次実行
- T2 と 99-1 の**役割分離**: T2=Skill構造特化、99-1=汎用コード観点。両者から MAJOR が出た場合は**T2先→99-1後の順で統合修正**し、二重ラウンドを避ける

## リスク・不明点

| # | リスク/不明点 | 影響 | 対策 |
|---|---|---|---|
| R1 | ヒアリング粒度過多でユーザー疲弊 | 中 | 必須3問 + 任意3問構成、平均2〜3分回答目標 |
| R2 | Q1〜Q6だけで v0 出力品質が不足 | 中 | Q6（追加指示）で自由入力、生成`.md`に「Iterate visually」指示明記 |
| R3 | v0推奨プロンプト構造の仕様変更 | 低 | テンプレを`references/`に分離、SKILL.md本体を変えずに更新可能 |
| R4 | `docs/v0-prompts/` git管理で機微情報漏洩 | 中 | (1) Step 3で機微情報パターン軽量検出（`sk-`, `AKIA`, email, 電話番号）→検出時 AskUserQuestion で確認 (2) Step 4 保存先選択肢に D=`.gitignore` 済みディレクトリを追加 (3) Step 5 案内メッセージにも注意喚起 |
| R5 | 既存 `ui-design-generator` との使い分けが不明瞭 | 中 | descriptionの"Do NOT use for"に明記 + SKILL.md冒頭に比較表（v0 vs Figma vs Pencil） |
| R6 | 配布ホワイトリスト漏れ | 低 | T3で事前確認、`einja-` プレフィックスで自動配布想定 |

**論点（実装時に微調整可）:**
- slug 自動生成 vs 毎回入力: 自動生成 + 確認上書き可 で採用
- プロンプト本文言語: 英語で採用（v0主体言語）
- Hearing Summary テーブル出力: 含める採用（改訂時の入力履歴として有用）

## 検証・動作確認方法

### 静的検証（T2実施）

- Frontmatter: name一致、description が3rd person + What/When/Do NOT use for、`user-invocable: true`、`context: fork` なし
- 行数: SKILL.md 500行以内、references各300行以内
- AskUserQuestion 2層記述: 全質問で `description` + `Note` が付与
- 配布: `.claude/skills/einja-v0-prompt-generator/` が `einja-*` glob にマッチ

### 動作検証（99-2実施、ユーザー手動）

- **ケース1（Dashboard 分岐なし）**: Q2=Dashboard, Q5=Enterprise → Enterpriseライクな Dashboard プロンプト、v0.dev投入でサイドバー+KPI+テーブルが生成
- **ケース2（認証 分岐あり）**: Q2=認証, Q4=[レスポンシブ,ダークモード,バリデーション], Q6="Sign in with Google ボタン" → プロンプト末尾にダークモード・レスポンシブ・Google SSO指示が含まれる、v0投入で対応モック生成
- **ケース3（保存先変更）**: Step 4 で C=パス指定 → 指定パスに出力
- **ケース4（再ヒアリング分岐）**: Step 5 で B=再ヒアリング Q2から → タイムスタンプ付き別ファイル生成
- **ケース5（エッジ）**: 全質問「その他」自由入力 → エラーなく生成完了

### CI・自動テスト

- Skill 単体テストは本Planでは実施しない（対話 Skill のため定量評価困難、必要時に別Plan）

## Critical Files（実装対象）

- `/Users/tomohide/Projects/einja/einja-management-template/.claude/skills/einja-v0-prompt-generator/SKILL.md` （T1 新規）
- `/Users/tomohide/Projects/einja/einja-management-template/.claude/skills/einja-v0-prompt-generator/references/v0-prompt-template.md` （T1 新規）
- `/Users/tomohide/Projects/einja/einja-management-template/.claude/skills/einja-v0-prompt-generator/references/hearing-questions.md` （T1 新規）

**参照元（既存、読取のみ）:**
- `.claude/skills/einja-skill-plan-guide/references/review-checklist.md`（T2で参照）
- `packages/cli/scripts/copy-presets.mjs`（T3で参照）
- `.claude/skills/einja-project-requirements/SKILL.md`（B設計時のヒアリングパターン参考）

## 参考リソース

- [Vercel Blog: Maximizing outputs with v0](https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation)
- [v0 Design Systems Docs](https://v0.app/docs/design-systems-legacy)
- [Anthropic Skill Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
