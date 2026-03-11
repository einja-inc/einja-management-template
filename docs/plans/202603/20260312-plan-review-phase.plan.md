# Plan: CLAUDE.md Planモードにレビューフェーズ追加

## Context

Planモードのワークフロー（Step 1〜7）では、planファイル記述後すぐにExitPlanModeでユーザーに提示している。計画の品質を担保するため、ExitPlanMode前にサブエージェントによるレビューフェーズを追加し、指摘があれば自動修正してから提示する。

方式はSkill型（`einja-review-plan` 新設）を採用。理由:
- CLAUDE.mdにサブエージェントプロンプトを直接記述するパターンは既存に存在しない
- `einja-review-code`と同一パターンで一貫性を保つ
- CLAUDE.mdへの追加は委託ルール1行 + Step 6.5の3行のみ（肥大化回避）
- レビュー観点の変更がSkill内で完結する

## 現状

CLAUDE.md「Planモード時の必須フロー」（Step 1〜7）にレビューステップがない。

## 変更内容

### 1. `einja-review-plan` Skill 新設

`einja-review-code`（143行）の骨格を参考に新設。

#### 構造（einja-review-codeからの流用/差し替え）

| 要素 | 流用 | 変更点 |
|------|------|--------|
| Step 1: 入力取得 | 差し替え | git diff → planファイル + ユーザー元要求の読み込み |
| Step 2: 並行2レビュアー起動 | 構造のみ | レビュアー1: general-purpose、レビュアー2: codex-agent（Agent toolのsubagent_type指定。Codex MCP不使用） |
| Step 3: 統合判定テーブル | そのまま | PASS/MINOR/MAJORルール同一 |
| Step 4: 結果返却・質問 | 拡張 | MAJOR/不明点がある場合は親エージェント経由でユーザーに質問可能 |

#### Planレビュー観点（4軸）

| 軸 | 観点 |
|----|------|
| A: 要件カバレッジ | ユーザーの元要求がすべて計画に反映されているか |
| B: タスク分割・依存関係 | タスクの粒度は適切か、並列化戦略に矛盾はないか |
| C: リスク・見落とし | 技術的リスク、影響範囲の見落とし、エッジケースの考慮漏れ |
| D: 実現性・スコープ | アプローチは現実的か、過剰/不足な変更がないか |

#### MAJOR指摘時の挙動

- MAJOR指摘あり → 親エージェントがplanを修正 → 再レビュー（最大2回）
- 2回修正してもMAJOR残存 → レビュー結果を付記してExitPlanMode（ユーザー判断に委ねる）
- MINOR/PASSのみ → MINOR指摘があればplanに反映 → ExitPlanMode

#### スキップ条件

- 軽微な変更（1ファイル・10行以下の修正計画）
- ユーザーが明示的にスキップを指示した場合

### 2. CLAUDE.md 変更

**Planモード時の必須フロー**: Step 6と7の間に追加
```
6.5. planファイルのレビューを実施する
   - `einja-review-plan` Skillを呼び出す
   - MAJOR判定時は自動修正→再レビュー（最大2回）。解消しない場合はレビュー結果付記でExitPlanMode
   - スキップ条件: 軽微な変更（1ファイル・10行以下）またはユーザー明示スキップ
```

**委託ルール > Skill テーブル**: 1行追加
```
| `einja-review-plan` | Planレビュー（ExitPlanMode前） |
```

## タスク概要

| # | タスク | 使用Skill/サブエージェント | 備考 |
|---|--------|--------------------------|------|
| 0 | Planファイルを `docs/plans/202603/20260312-plan-review-phase.plan.md` にリネーム | [Bash] | 親エージェント直接実行 |
| 1 | `einja-review-plan` Skill作成 | [einja-skill-creator] | 上記Skill仕様セクションの内容をプロンプトに含めて委託。einja-review-code/SKILL.mdを骨格として参照するよう指示 |
| 1-R | Skill実装レビュー | [einja-skill-plan-guide ワークフローB] → [einja-review-code] | einja-skill-creator完了後、Skill固有品質チェック→汎用コードレビューの順で実施 |
| 2 | CLAUDE.md更新（Step 6.5追加 + 委託ルール1行追加 + キーワードトリガー追加） | [Edit] | 親エージェント直接実行。3箇所の編集 |
| 3 | 最終レビュー | [einja-review-code] | コード変更全体（Skill + CLAUDE.md）の完了レビュー |
| 4 | コミット・プッシュ | [einja-task-commit] | |

### CLAUDE.md編集箇所の詳細（タスク2）

| 編集箇所 | 内容 |
|---------|------|
| Planモード時の必須フロー | Step 6と7の間にStep 6.5を挿入（3行） |
| 委託ルール > Skill テーブル | `einja-review-plan` 行を追加（1行） |
| キーワードトリガーテーブル | `Planレビュー` `plan review` `計画レビュー` → `einja-review-plan` を追加（1行） |

## 並列実行計画

```
タスク0（リネーム）
  ↓
タスク1（Skill作成 [einja-skill-creator]）, タスク2（CLAUDE.md更新 [Edit]）  ← 並列
  ↓
タスク1-R（Skill実装レビュー [einja-skill-plan-guide WF-B] → [einja-review-code]）
  ↓
タスク3（最終レビュー [einja-review-code]）
  ↓
タスク4（コミット [einja-task-commit]）
```

## 対象ファイル

| ファイル | 操作 |
|---------|------|
| `.claude/skills/einja-review-plan/SKILL.md` | 新規作成 |
| `CLAUDE.md` | Step 6.5追加 + 委託ルール1行追加 |

## 参考ファイル

| ファイル | 参照目的 |
|---------|---------|
| `.claude/skills/einja-review-code/SKILL.md` | 骨格の参考元（143行、並行起動・統合判定・出力フォーマット） |

## リスク・不明点

| リスク | 対策 |
|--------|------|
| レビューのトークンコスト増加 | スキップ条件で軽微変更は除外 |
| 再レビューループの無限化 | 最大2回の上限を設定済み |
| Codex MCP未接続時 | レビュアー1（汎用サブエージェント）は常に実行 |

## Skill仕様: einja-review-plan

### 1. 基本情報

| 項目 | 値 |
|------|-----|
| **Skill名** | `einja-review-plan` |
| **命名規則チェック** | lowercase + hyphens ✓、64文字以内 ✓ |

### 2. description

```
Planモードで作成した計画のレビューを実施するSkill。レビューサブエージェントとcodex-agent（Codex MCP有効時）を並行で呼び出し、計画の要件カバレッジ・タスク分割・リスク網羅性・実現性を検証する。「Planレビュー」「plan review」「計画レビュー」等で呼び出す。Do NOT use for: コード変更のレビュー（→ einja-review-code）、Skill実装のレビュー（→ einja-skill-plan-guide ワークフローB）
```

- [x] 3rd person で記述
- [x] What: 計画のレビュー実施
- [x] When: Planモードでplan記述後、ExitPlanMode前
- [x] Do NOT use for: コードレビュー、Skill実装レビューとの混同防止
- [x] 1024文字以内

### 3. 分類

| 項目 | 値 |
|------|-----|
| **分類** | タスク型 |
| **判断理由** | 親エージェント（Planモード）から呼ばれて、レビューという独立した作業を完結する。ユーザーとの直接対話は不要（結果を親に返す） |

### 4. 配置先

| 項目 | 値 |
|------|-----|
| **配置先** | `.claude/skills/einja-review-plan/` |
| **判断理由** | 全プロジェクト共通で配布するSkill（Planモードは全プロジェクトで使用される）。`einja-` プレフィックスで配布対象 |

### 5. Frontmatter設定

```yaml
---
name: einja-review-plan
description: "Planモードで作成した計画のレビューを実施するSkill。レビューサブエージェント（general-purpose）とcodex-agentを並行で呼び出し、計画の要件カバレッジ・タスク分割・リスク網羅性・実現性を検証する。「Planレビュー」「plan review」「計画レビュー」等で呼び出す。Do NOT use for: コード変更のレビュー（→ einja-review-code）、Skill実装のレビュー（→ einja-skill-plan-guide ワークフローB）"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Agent
---
```

- [x] `user-invocable`: 未設定（CLAUDE.mdのワークフローから呼ばれる）
- [x] `context: fork`: 未設定（親エージェントのコンテキスト内で実行し、結果を元にplanファイルを修正する必要があるため）
- [x] `allowed-tools`: Read（planファイル読み込み）、Glob/Grep（関連ファイル検索）、Agent（レビュアー起動。codex-agentはsubagent_type指定で起動）

### 6. 依存Skill

| 依存Skill | 条件 |
|-----------|------|
| なし | Agent Teams不使用、Pencil不使用 |

### 7. Progressive disclosure設計

| レベル | 内容 | 行数目安 |
|--------|------|---------|
| SKILL.md body | 実行フロー（Step 1〜4）、レビュー観点、統合判定、出力フォーマット、スキップ条件 | 約140行（einja-review-codeの143行と同等） |
| references/ | なし（Skillが小規模のため分離不要） |

- [x] 500行以内に収まる見込み
- [x] 参照ファイル分離不要（本体で完結）

### 8. einja設計思想チェック

- [x] ユーザーに専門知識を求めない（レビュー観点はSkill内に定義済み）
- [x] 不明点・曖昧な箇所がある場合は積極的に質問する（PENDING_QUESTIONS形式で親エージェントに返却→ユーザーに確認）
- [x] 技術的操作は自動実行（サブエージェント起動・統合は自動）
- [x] 実行コンテキスト収集は自律的（planファイルのパスはPlanモードから自動取得）
- [x] エラー時の自動リカバリ（codex-agent起動失敗時はレビュアー1のみで続行）

### SKILL.md 本体の構造設計

```
# einja-review-plan Skill: 計画の品質レビュー

ロール宣言

## スキップ条件
- 軽微な変更（1ファイル・10行以下）
- ユーザー明示スキップ

## 実行フロー

### Step 1: planファイルの読み込み
- Planモードのplanファイルを Read で取得
- ユーザーの元要求（会話コンテキストから）を把握

### Step 2: レビューサブエージェントの並行呼び出し
- 1つのメッセージで2つのAgent tool呼び出しを同時に行い並行実行

#### レビュアー1: Planレビューサブエージェント【必須】
- Agent tool (general-purpose) で起動
- プロンプトにplanファイル内容 + ユーザー元要求を埋め込み
- レビュー観点A〜D（要件カバレッジ/タスク分割/リスク/実現性）
- 不明点がある場合はPENDING_QUESTIONS形式で返却

#### レビュアー2: codex-agent【常時】
- Agent tool (subagent_type: codex-agent) で起動
- planファイルを渡してレビューモードで技術的妥当性を検証
- 起動失敗時はスキップ扱い

### Step 3: レビュー結果の統合
- einja-review-codeと同一の統合ルールテーブル
- PENDING_QUESTIONSがある場合は親エージェントに返却

### Step 4: 結果返却
- 構造化フォーマットで返却
- MAJOR判定 → 親エージェントがplan修正→再レビュー（最大2回）
- 不明点 → 親エージェント経由でユーザーに確認

## レビュー観点（レビュアー1プロンプトに埋め込む）
A. 要件カバレッジ
B. タスク分割・依存関係
C. リスク・見落とし
D. 実現性・スコープ

## 判定基準
PASS / MINOR / MAJOR テーブル
```

## 検証・動作確認方法

- `pnpm prepush` でlint/typecheck通過を確認
- `git diff` で意図しない変更がないことを検証
- Skill作成後、SKILL.mdの構造がeinja-review-codeと一貫しているか目視確認
- einja-skill-plan-guide ワークフローBのチェックリストで品質検証
