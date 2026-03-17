---
name: einja-practice-extractor
description: >
  特定projectから再利用可能な実践やワークフローを抽出し、management-templateへどう移植するかの計画を作成するSkill。既存projectの仕様書生成、QA運用、Skill設計、レビュー運用、実装フローなどを観察して、既存Skill拡張 / 新規Skill / steering更新 / template更新 のどこへ反映すべきか整理したい場合に使用。プロジェクト固有事情を一般化してmanagement-templateへ昇格させる作業で使う。
allowed-tools:
  - Read
  - Grep
  - Glob
---

<!-- ベース: .claude/skills/einja-skill-first/SKILL.md -->
<!-- ベース: .claude/skills/einja-skill-creator/SKILL.md -->

# einja-practice-extractor

source project に存在する実践を抽出し、management-template に移植するための分析・計画 Skill。

この Skill の役割は「良さそうなものを列挙すること」ではない。source project の実践を一般化し、management-template の既存資産へどう反映するかを判断可能な形に落とし込むことが目的。

## 役割

- source project から再利用価値のあるプラクティス候補を抽出する
- project 固有事情と一般化可能な実践を切り分ける
- management-template の既存 Skill / steering / templates を確認し、重複とギャップを判定する
- 各候補を `既存Skill拡張 / 新規Skill / steering更新 / template更新` に分類する
- 実装者がそのまま使える移植計画を出力する

## 前提

- 初期版は **単一 project の分析** のみを扱う
- この Skill 自身は **ファイル編集を行わない**
- 複数 project 比較や直接実装はスコープ外とする

## 入力

最低限、以下を会話文脈から解釈する。

- `source_project`: 調査対象の project パス、repo 名、または機能群
- `focus_area`: 特に見たい領域
  - 例: 仕様書生成、QA、Skill設計、レビュー運用、実装フロー
- `target_scope`: management-template のどこへ反映したいか
  - 未指定時は `Skill / steering / templates` 全体を見る
- `constraints`: 更新したくない領域、時間制約、既知の前提

入力が曖昧でも、まず repo 内の構造・既存 Skill・既存 guide を読んで補完する。補完できないときだけ不足情報を質問する。

## 調査対象

source project では以下を優先して読む。

1. Skill
2. 仕様書テンプレート、QA仕様、設計書
3. steering / development guide
4. 実際の成果物サンプル
5. 関連 plan や運用ドキュメント

management-template 側では以下を必ず確認する。

1. `.claude/skills/einja-*/SKILL.md`
2. `docs/einja/steering/`
3. `docs/einja/templates/`
4. 必要なら `packages/cli/presets/default/.claude/skills/`

## 抽出ルール

### 採用するもの

- 複数回の再利用が見込める
- 品質やレビュー速度を安定化させる
- management-template に一般化して持ち込める
- 既存資産の穴を埋める、または既存資産を明確に改善する

### 除外するもの

- 特定ドメインのデータモデルや業務固有文言に強く依存する
- source project の組織体制や一時的事情に閉じる
- 実装詳細だけで、テンプレートや Skill に昇格させる価値が薄い
- 既に management-template に同等の仕組みがあり、差分が説明できない

## 反映先分類

各候補を必ず以下のどれか1つに分類する。

| 分類 | 意味 |
|------|------|
| `既存Skill拡張` | 既存 Skill に手順や観点を足すのが最適 |
| `新規Skill` | 独立した責務として新しい Skill に切り出すべき |
| `steering更新` | guide や運用方針へ反映するのが最適 |
| `template更新` | requirements/design/qa-test など生成物の型へ反映するのが最適 |

既存資産に寄せられるなら、常に新設より拡張を優先する。

## 実行フロー

### 1. source project の観察

- 注目領域に関係する Skill、guide、テンプレート、実例を読む
- 「どの工夫が一貫して効いているか」を探す
- 単なる文言差分ではなく、構造・手順・判断基準の差分を抽出する

### 2. management-template との差分確認

- 既存 Skill / steering / templates を読む
- source project の実践が既にあるか、部分的にあるか、完全に欠けているかを判定する
- 重複がある場合は「何が足りないか」だけを残す

### 3. 候補の評価

各候補について最低限以下を判定する。

- 何を改善する実践か
- どの成果物やフローに効くか
- management-template に一般化できるか
- 反映先分類はどれか
- 直接移植ではなく抽象化が必要か

### 4. 移植計画の作成

- 反映先ごとに変更方針をまとめる
- 既存ファイルを更新するか、新規 Skill を追加するかを明示する
- 実装順序を決める
- 検証方法を付ける

## 出力フォーマット

常に以下の Markdown 構造で出力する。

```markdown
# Practice Extraction Report

## Summary
- source project
- focus area
- 抽出した主要プラクティス数
- 採用判断の要約

## Observed Practices
| ID | Practice | Evidence | Why it works | Generalizable |
|----|----------|----------|--------------|---------------|

## Candidate Transfers
| ID | Transfer | Target | Classification | Priority |
|----|----------|--------|----------------|----------|

## Target Mapping
### 既存Skill拡張
- 対象Skill
- 追加すべき責務や手順

### 新規Skill
- Skill名候補
- 責務
- 既存Skillと分ける理由

### steering更新
- 更新すべき guide
- 追加すべき原則、観点、チェックリスト

### template更新
- 更新すべき template
- 追加すべき項目や構造

## Migration Plan
1. 先に更新するもの
2. 次に更新するもの
3. 検証方法

## Assumptions
- 前提
- 除外事項
```

## 記述ルール

- source project 固有名詞は必要な箇所だけに留め、一般化した表現を優先する
- 「良さそう」ではなく、何が改善されるかを書く
- Evidence は必ず具体的なファイルや成果物に紐づける
- 反映先分類は曖昧にしない
- 実装者が迷わない粒度で移植計画を書く

## 良い出力の条件

- candidate ごとに反映先が1つに決まっている
- 既存資産との重複判定が入っている
- 一般化の必要性が説明されている
- そのまま plan や issue に落とせる

## この Skill がやらないこと

- source project と management-template の直接同期
- 実装やファイル編集
- 複数 project の比較分析
- 一般論だけのベストプラクティス集作成
