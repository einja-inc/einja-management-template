# einja-issue-spec-create 並列化改善

## Context

`einja-issue-spec-create` の仕様書生成フローを並列化し、処理時間を短縮する。
現在はPhase 3（requirements）→ Phase 4+5（design || ui-design）→ Phase 6（QA）→ Phase 7（tasks）と逐次実行しているが、requirements承認後のdesign/ui-design/QAを三又並列に変更し、かつ各サブエージェント内部でも並列化を強化する。

## 現状

```
Phase 0: 事前調査 + ヒアリング（逐次）
Phase 1-2: GitHub Issue作成（逐次）
Phase 3: requirements.md → [承認ゲート①] → commit
Phase 4+5: design || ui-design → [承認ゲート②③] → commit
Phase 6: qa-tests/ → [承認ゲート④] → commit
Phase 7: tasks生成 → validator → [承認ゲート⑤] → Issue更新 + PR
```

**ボトルネック:**
- design → QA間の直列待ち（QAがdesign.mdに依存）
- 承認ゲート5回（人間の応答待ちが最大ボトルネック）
- qa-generatorのstory{N}.md逐次生成

## 変更内容

### 新フロー

```
Phase 0: 事前調査 + ヒアリング（変更なし）
Phase 1-2: Issue作成（変更なし）
Phase 3: requirements.md → [承認ゲート①] → commit
Phase 4: 三又並列生成（requirements承認後に同時起動）
  ├── [並列-1] design-generator → design.md
  │     └── 内部並列: frontend-architect || backend-architect
  │     └── 内部レビュー: Codex MCP（既存）
  ├── [並列-2] ui-design-generator → ui-design.pen（UI要件時のみ）
  └── [並列-3] qa-generator → qa-tests/（requirementsのみ参照）
        └── 内部並列: story{N}.md を N個のサブエージェントで並列生成
        └── scenarios.md は全story完了後に生成
        └── 内部レビュー: Codex MCP（既存）
  → [横断チェック: designのAPIパス・画面名がQAシナリオで正しく参照されているか]
  → [承認ゲート②: 一括承認（design + ui-design + QA）] → 一括commit
Phase 5: tasks生成（※qa-tests/scenarios.mdを入力として参照） → validator → [承認ゲート③] → Issue更新 + PR
```

### QAのdesign.md依存を解消

qa-generatorは現在ステップ0で `design.md` の存在確認を必須としている。
QAテスト仕様はビジネス要件レベル（Given-When-Then）であり、技術詳細（API仕様、DB設計）はtask-qa実行時にdesign.mdを参照すれば足りる。
→ qa-generatorをrequirements.mdのみで起動し、designと並列実行可能にする。

**変更箇所:**
- qa-generator.md ステップ0: `design.md存在確認（必須）` → `design.md存在確認（任意: あれば参照）` に変更
- qa-generator.md ステップ1: 最優先読み込みリストから `design.md` を除外（`requirements.md` のみ必須に）

### qa-generator内部のstory並列化

現状: story1.md → story2.md → ... → scenarios.md を逐次生成
改善: story{N}.md は互いに完全独立（異なるACセットに対応）なため、N個のgeneral-purposeサブエージェントを並列起動。

```
qa-generator内部:
  Step 0: ガイドライン読み込み + requirements.md読み込み
  Step 1: ストーリー一覧を抽出（requirements.mdから）
  Step 2: story{N}.md を N個のサブエージェントで並列生成
    - 各サブエージェントに共通テンプレート + フォーマット統一ルールを注入
    - 統一ルール: AC番号体系（AC{story}.{seq}）、テストNo採番（{story}00+連番）、
      Given-When-Then形式の厳守、data-testid命名規則
  Step 3: 全story完了後 → scenarios.md + README.md 生成
  Step 4: Codex MCPレビュー（既存）
```

### design-generator内部のfront/back並列化

```
design-generator内部（2段並列: 合計5-7サブエージェント）:

  ── 第1段: 調査フェーズ（並列3エージェント）──
  Step 0: 並列調査
    ├── Explore-1: 既存コード構造調査（Serena MCP / ファイル読み込み）
    ├── Explore-2: 関連docs・過去Plan検索（docs/plans/, docs/einja/）
    └── general-purpose: 外部リソース調査（Asana/Figma/参考実装）※該当時のみ
  Step 1: 調査結果統合 + requirements.md分析（design-generator本体）

  ── 第2段: 設計フェーズ（並列3-4エージェント）──
  Step 2: 並列生成（セクション分担）
    ├── backend-architect:
    │   セクション1（アーキテクチャ概要）、2（ディレクトリ構成）、
    │   3-6（Domain/Infra/App/Presentation層）、7（API仕様）
    ├── backend-architect（DB/インフラ専門）:
    │   セクション8（DB設計・マイグレーション）、12（エラーハンドリング）、
    │   13（セキュリティ）
    ├── frontend-architect:
    │   セクション9（UI層設計）、10（画面設計）、11（UIインタラクション）
    │   ※セクション7（API仕様）はbackend出力を参照前提で記載
    └── ※各エージェントに調査結果（Step 1）とrequirements.mdを入力として提供
  Step 3: マージ + 整合性チェック（design-generator本体）
    - API仕様（backend）↔ UI層（frontend）の型名・フィールド名の整合性確認
    - DB設計 ↔ Domain層の型定義の整合性確認
    - セクション14-17（テスト方針、フェーズ、関連docs等）をdesign-generator本体が生成
  Step 4: Codex MCPレビュー（既存）
```

### 承認ゲートの統合: 5回 → 3回

| 現在 | 改善後 | 理由 |
|------|--------|------|
| ①requirements | ①requirements（維持） | 後続全ての入力で必須 |
| ②ui-design | ②に統合 | |
| ③design | ②一括承認（design + ui-design + QA） | 三又並列の成果物を一括レビュー |
| ④QA | ②に統合 | |
| ⑤tasks | ③tasks（維持） | PR作成前の最終確認 |

### 「レビュー」の位置づけ

ユーザーの元要求では「設計・レビュー・QA」の3つのサブエージェントを並列化したいとのことだった。
分析の結果、独立した「レビューサブエージェント」は以下の理由で不要と判断:
1. **各サブエージェント内にCodex MCPレビューが既に内蔵** — design-generator、qa-generatorそれぞれがCodex MCPによる自己レビューを実施
2. **横断レビューは三又並列完了後に実施** — design↔QAの整合性（APIパス・画面名の参照一致）は承認ゲート②の前にオーケストレーターがチェック
3. **独立レビューエージェントを並列に走らせても、レビュー対象（design/QA出力）が存在しないため意味がない**

つまり、ユーザーの意図する「レビュー」は各サブエージェント内部のレビュー機構 + 完了後の横断チェックとして実現される。

## タスク概要

| ID | タスク | 使用Skill/エージェント | 依存 |
|----|--------|----------------------|------|
| 0-1 | Planファイルを配置 [`Write`] | - | - |
| 0-2 | worktree作成 [`_einja-worktree-guide`] | EnterWorktree | 0-1 |
| 1 | SKILL.md改修: Phase構成変更 + 三又並列 + 承認ゲート統合 + 横断チェック定義 [`einja-skill-creator`] | - | 0-2 |
| 2 | qa-generator.md改修: design.md依存解消 + story並列生成ロジック追加 [`einja-skill-creator`] | - | 0-2, 1と並列可（※タスク1のインターフェース仕様をプロンプトに含めること） |
| 3 | design-generator.md改修: 2段並列化（調査3並列 + 設計3-4並列） [`einja-skill-creator`] | - | 0-2, 1と並列可（※タスク1のインターフェース仕様をプロンプトに含めること） |
| 99-1 | コードレビュー [`einja-review-code`] | - | 1,2,3 |
| 99-2 | 動作確認: 実際にeinja-issue-spec-createを走らせて三又並列を確認 | Bash | 99-1 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | - | 99-2 |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | - | 99-G |

## 並列実行計画

```
[並列グループA] タスク1, 2, 3 を同時実行
  → 全完了後 → 99系
```

## リスク・不明点

| リスク | 深刻度 | 対策 |
|--------|--------|------|
| QAテスト仕様にdesign技術詳細が反映されない | 低 | QA仕様はビジネス要件レベル。技術詳細はtask-qa実行時にdesign.mdを参照 |
| design内部の3エージェント間整合性破綻 | 中 | API仕様はbackend主導。DB設計↔Domain層、API仕様↔UI層の整合性をStep 3でdesign-generator本体がチェック |
| 一括承認の認知負荷 | 中 | 構造化レビューフォーマット（各成果物に確認ポイント明示） |
| story並列生成のフォーマット不一致 | 中 | 共通テンプレート + フォーマット統一ルール（AC番号体系、テストNo採番、命名規則）をプロンプトに注入 |

## 検証・動作確認方法

1. 各ファイルの構文・構造が正しいことをReadで確認
2. 変更箇所の整合性をgit diffで確認
3. 実際に小規模なIssue仕様書作成を走らせて三又並列の動作を確認（99-2）
   - 確認観点: 3つのサブエージェントが同時に起動されること
   - 確認観点: 各成果物（design.md, ui-design.pen, qa-tests/）が欠損なく生成されること
   - 確認観点: 承認ゲートが1回で3成果物を一括表示すること
   - 確認観点: scenarios.md内のAC番号がrequirements.mdと一致すること

## 対象ファイル

- `.claude/skills/einja-issue-spec-create/SKILL.md` — Phase構成変更、承認ゲート統合
- `.claude/agents/einja/issue-specs/qa-generator.md` — story並列生成ロジック追加
- `.claude/agents/einja/issue-specs/design-generator.md` — front/back並列化

## ROI

- エージェント作業時間: QAの5-8分がdesignと並列化で吸収 → **5-8分短縮**
- 承認待ち時間: ゲート2回分 → **5-15分短縮**
- story並列生成: 5ストーリーなら理論上5倍（実質3-4倍）→ **3-5分短縮**
- **合計: 13-28分の短縮（全体の約30-40%）**
