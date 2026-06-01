# Plan: einja-project-requirements Skill 新規作成

## Context

システム受託開発において、**クライアント合意用のプロジェクト全体の要件定義書**を生成するSkillが現状存在しない。

既存リソース調査の結果、要件定義書作成の周辺には以下が存在するが、いずれもクライアント合意用のプロジェクト全体要件をカバーしていない:

| 既存リソース | カバー範囲 | 不足 |
|------------|----------|------|
| `.claude/agents/einja/issue-specs/requirements-generator.md` | 機能/Issue単位 ATDD要件定義 | プロジェクト横断のスコープ・体制・スケジュール・リスク等の合意項目を扱わない |
| `.claude/skills/einja-issue-spec-create/` Phase 1 | Issue仕様書作成フローの中の要件定義 | 入口がIssue起点で、契約段階のプロジェクト全体合意には使えない |
| `docs/einja/templates/requirements.md.template` | 機能要件テンプレート（§1-§14） | プロジェクト全体（業務要件/システム化方針/組織/スケジュール）の章立てがない |

これを埋めるための新規Skillを作る。生成物は `docs/project/requirements.md`（1リポジトリ1プロジェクト前提、現状未作成のディレクトリ）。

### ユーザー回答（確定事項）

- **読者・用途**: クライアント合意用（受注後の要件確定・スコープ合意）
- **参考フォーマット**: IPA「機能要件の合意形成ガイド」・JIS X 0166 等の公開ガイドライン
  - 章別に参照源を切り分け（template.md 内に明記）:
    - 業務要件・スコープ・全体構成 → **共通フレーム（SLCP）** / **IPA「超上流から攻めるIT化の事例集」** / **JIS X 0166**
    - 機能要件サマリ → **IPA「機能要件の合意形成ガイド」**
    - 非機能要件 → **IPA/JUAS「非機能要求グレード」**
- **配置先**: `docs/project/requirements.md`（1リポジトリ1プロジェクト前提）
- **ヒアリング主体**: AI（サブエージェント）が AskUserQuestion で対話的に引き出す

### 既存リソースとのファイル/トリガー衝突整理

| 用途 | 配置パス | 生成元 |
|------|---------|-------|
| プロジェクト全体（クライアント合意） | `docs/project/requirements.md` | 本Skill `einja-project-requirements` |
| Issue/機能単位（ATDD要件） | `docs/specs/issues/{category}/issue{N}-{name}/requirements.md` | `einja-issue-spec-create` Phase 1（内部で `requirements-generator` エージェント） |

「要件定義書を作成して」のような短いトリガー語が `requirements-generator` エージェントと衝突するため、本Skill作成と併せて `.claude/agents/einja/issue-specs/requirements-generator.md` の description に **「Do NOT use for: プロジェクト全体の受託開発要件定義・クライアント合意（→ einja-project-requirements Skill）」** を追記する（タスク5.5）。

## 現状

- `docs/project/` ディレクトリは存在しない（新Skillが初回実行時に作成）
- `.claude/skills/` には `einja-issue-spec-create`（Issue単位）と `requirements-generator`（機能単位エージェント）のみ
- 既存 `requirements.md.template` は機能スコープの章立てで、プロジェクト全体には使えない
- `docs/einja/templates/` は配布対象（CLAUDE.md「マネージドディレクトリ」表より）
- `.claude/skills/einja-*/` はビルド時に `presets/default/.claude/skills/` へ自動コピーされる（配布対象）

## 変更内容

新規Skill `einja-project-requirements` を以下の構成で作成する。

### 作成するファイル

| パス | 内容 |
|------|------|
| `.claude/skills/einja-project-requirements/SKILL.md` | オーケストレーション本体（ヒアリング → ドラフト生成 → レビュー → ユーザー承認 → コミット）。≤500行 |
| `.claude/skills/einja-project-requirements/references/template.md` | IPA/JIS準拠の `docs/project/requirements.md` 完全テンプレート（章立て + mermaid記法準拠） |
| `.claude/skills/einja-project-requirements/references/hearing-checklist.md` | ヒアリング観点チェックリスト（カテゴリ別質問テンプレ） |
| `.claude/skills/einja-project-requirements/references/structure-guide.md` | 各章の記入ガイドライン（IPA/JIS参照リンクと適用方針） |

### 変更するファイル

| パス | 変更内容 |
|------|---------|
| `CLAUDE.md`（「キーワードトリガー」表） | `プロジェクト要件定義書 / 受託開発要件 / クライアント合意要件 / project requirements / RFP応答後の要件確定 / システム化要件` をトリガーとして追加 |

### 注意点

- `presets/default/` 配下や CLI ホワイトリスト（`packages/cli/scripts/copy-presets.mjs`, `packages/create-app/scripts/template-update.ts`）への直接編集は **不要**。`einja-` プレフィックスのSkillはビルド時に自動コピーされる
- `docs/project/` は実行時にSkillが生成するため、ホワイトリストへの追加は不要（ユーザープロジェクトのコンテンツ）

## Skill仕様（einja-skill-plan-guide ワークフローA 成果物）

### 1. 基本情報

| 項目 | 値 |
|------|-----|
| Skill名 | `einja-project-requirements` |
| 命名規則 | lowercase + hyphens、`einja-` プレフィックス（配布対象）、64文字以内 ✅ |

### 2. description（frontmatter用）

```
システム受託開発の「プロジェクト全体の要件定義書（クライアント合意用）」を生成する。共通フレーム/IPA超上流ガイド/IPA機能要件の合意形成ガイド/JUAS非機能要求グレード/JIS X 0166を参考とした章立てで、業務要件・システム化方針・スコープ・機能要件サマリ・非機能要件・体制・スケジュール・リスク等を扱う。サブエージェントがAskUserQuestionで段階的（3ラウンド）にヒアリングし、`docs/project/requirements.md` を生成する。「プロジェクト要件定義書」「受託開発要件」「クライアント合意」「project requirements」「RFP応答後の要件確定」「システム化要件」等で呼び出す。Do NOT use for: 機能/Issue単位の要件定義（→ einja-issue-spec-create Phase 1 Skill / requirements-generator エージェント）、軽量PRD、技術設計書（→ design-generator エージェント）、設計レビュー（→ einja-review-spec Skill）。
```

チェック: 3rd person ✅ / What ✅ / When（トリガー6種） ✅ / Do NOT use for（Skill/エージェント区別を明示）✅ / 文字数（約540文字、1024文字以内）✅

実装時には Bash `wc -m` で文字数を再検算する（タスク1の品質チェック内）。

### 3. 分類

| 項目 | 値 |
|------|-----|
| 分類 | **オーケストレーター型** |
| 判断理由 | (1) AskUserQuestion でユーザーと直接対話してヒアリングを進める。(2) 内部で general-purpose / Explore サブエージェントを並列起動して既存資料調査を行う可能性がある。(3) ドラフト後に `einja-review-spec` 等の他Skillを呼ぶ拡張余地が必要。Forked context では Skill tool / Agent tool が使用不可のため、オーケストレーター型を選択 |

### 4. 配置先

| 項目 | 値 |
|------|-----|
| 配置先 | `.claude/skills/einja-project-requirements/`（配布対象） |
| 判断理由 | 全プロジェクト共通で配布する受託開発標準フロー。`einja-` プレフィックスでビルド時自動コピー対象 |

### 5. Frontmatter設定

```yaml
---
name: einja-project-requirements
description: "（上記2.の内容）"
user-invocable: true
# context: fork は設定しない（ユーザー対話 + 内部Skill/Agent呼び出しのため）
# allowed-tools は指定しない（全ツール許可。AskUserQuestion / Read / Write / Edit / Bash / Grep / Glob / Task / Skill を使用）
---
```

### 6. 依存Skill

| 依存Skill | 用途 |
|-----------|------|
| `_einja-subagent-question-protocol` | 内部呼び出しのサブエージェントが PENDING_QUESTIONS で停止する際のプロトコル |
| `_einja-output-format` | 出力の統一フォーマット |
| `einja-review-spec`（将来拡張） | 生成された requirements.md のレビュー（オプション利用） |

### 7. Progressive disclosure 設計

| レベル | ファイル | 内容 | 行数目安 |
|--------|---------|------|---------|
| Level 2 | `SKILL.md` body | コアワークフロー（事前調査 → 3ラウンドヒアリング → ドラフト生成 → 自己検証 → ユーザー承認 → コミット）、ステップ概要、依存Skill呼び出し方針 | ≤500行（einja-skill-plan-guide規約） |
| Level 3 | `references/template.md` | `docs/project/requirements.md` の完全テンプレート（章立て、mermaid記法、IPA/JIS準拠） | ~400行（TOC付き） |
| Level 3 | `references/hearing-checklist.md` | 4ラウンド別ヒアリング質問テンプレ（R1: 基盤§1-§3、R2: システム化要件§4-§6、R3: 品質・データ§7-§9、R4: 実行計画§10-§16） | ~250行 |
| Level 3 | `references/structure-guide.md` | 各章の記入ガイド + IPA/JIS/JUAS参照リンク | ~150行 |

### 8. ワークフロー概要（SKILL.md に記載する手順）

1. **前提確認**: `docs/project/requirements.md` の既存有無を Read で確認
   - 既存あり → 差分追記モード / 新規 → 新規作成モード をユーザーに確認（AskUserQuestion）
2. **事前調査**: `README.md` / 既存 `docs/` / `package.json` / 関連 Asana・Figma URL 等を読み込み、明示済み事項を抽出
3. **ヒアリング（4ラウンド方式、フルセット16章対応）**: `references/hearing-checklist.md` のラウンド構成で AskUserQuestion を順次実行
   - **Round 1（プロジェクト基盤）**: §1 プロジェクト概要 / §2 対象業務（AS-IS/TO-BE両方）/ §3 対象ユーザー・ステークホルダー
   - **Round 2（システム化要件）**: §4 システム化方針 / §5 スコープ境界 / §6 機能要件サマリ（機能一覧・バッチ一覧・帳票一覧）
   - **Round 3（品質・データ）**: §7 非機能要件（JUAS6大項目を表形式で要約）/ §8 データ要件 / §9 外部連携要件
   - **Round 4（実行計画）**: §10 移行 / §11 運用保守 / §12 体制 / §13 スケジュール / §14 品質保証（概要）/ §15 リスクと前提 / §16 合意・変更管理（承認欄含む）
   - 各ラウンドで回答が薄い項目のみ追加確認（最大1回/ラウンド）
   - 前ラウンドの回答を踏まえて次ラウンドの質問を最適化
4. **ドラフト生成**: `references/template.md` をベースに `docs/project/requirements.md` を Write
5. **品質確認**: `references/structure-guide.md` のチェックリストで自己検証 → 不足は補完
6. **ユーザー確認**: 生成物のパスと概要を提示し、修正指示を AskUserQuestion で受ける
7. **承認後コミット**: `einja-task-commit` Skill を呼び出して `docs: プロジェクト要件定義書を追加/更新` でコミット

### 10. 確定章立て（`references/template.md` に反映する `docs/project/requirements.md` のセクション構造）

ユーザーとの対話で確定したフルセット16章構成。

```
0. 文書情報（タイトル / 版番号 / 最終更新日 / 作成者・承認者）
Sources（参照リソース表: Asana / Figma / 見積もり書 / 契約書 / qa-test.md / 関連spec）

1. プロジェクト概要
  1.1 背景
  1.2 目的
  1.3 ビジネス価値（KPI）
  1.4 用語定義

2. 対象業務（AS-IS と TO-BE 両方を必須記述）
  2.1 業務全体像
    2.1.1 AS-IS業務フロー（mermaid flowchart TD + subgraph スイムレーン）
    2.1.2 TO-BE業務フロー（mermaid flowchart TD + subgraph スイムレーン）
  2.2 業務課題と解決方針
  2.3 業務ルール

3. 対象ユーザー・ステークホルダー
  3.1 エンドユーザー（ペルソナ・ロール）
  3.2 ステークホルダー一覧（決裁者・利用者・運用者）
  3.3 権限マトリクス概要

4. システム化方針
  4.1 システム化の範囲
  4.2 採用方針（パッケージ / スクラッチ / SaaS / ハイブリッド）
  4.3 アーキテクチャ方針（高レベル graph TB + subgraph）

5. スコープ境界
  5.1 機能スコープ（含む / 含まない）
  5.2 データスコープ
  5.3 外部システム連携スコープ
  5.4 フェーズ分割（MVP / フェーズ2 等）

6. 機能要件サマリ
  6.1 機能一覧（全機能のID/名称/概要表）
  6.2 バッチ一覧（定期実行処理/ジョブ）
  6.3 帳票一覧（PDF・Excel出力物）
  ※ 画面一覧は除外（Figma/ui-design 側で管理）
  ※ 外部I/F一覧は §9 で扱う

7. 非機能要件（JUAS非機能要求グレード 6大項目を表形式で要約）
  7.1 可用性
  7.2 性能・拡張性
  7.3 運用・保守性
  7.4 移行性
  7.5 セキュリティ
  7.6 システム環境・エコロジー

8. データ要件
  8.1 主要データ概念モデル（mermaid erDiagram）
  8.2 データ量見積もり
  8.3 データ保有方針（保持期間・アーカイブ）

9. 外部連携要件
  9.1 連携システム一覧
  9.2 連携方式
  9.3 連携データ仕様概要

10. 移行要件
  10.1 移行データ
  10.2 移行時期・方式
  10.3 移行リスク

11. 運用・保守要件
  11.1 運用体制
  11.2 監視・障害対応
  11.3 バックアップ
  11.4 保守範囲

12. プロジェクト体制と役割
  12.1 体制図（mermaid graph TB）
  12.2 役割分担（受託側 / 発注側）
  12.3 意思決定プロセス
  12.4 報告・連絡・相談ルール

13. スケジュール
  13.1 マイルストーン
  13.2 フェーズ分割（mermaid gantt）
  13.3 主要レビュータイミング
  13.4 納期
  ※ 見積もり・コスト情報は含めない（Sources表で別文書参照）

14. 品質保証（概要のみ。詳細は qa-test.md 等へ）
  14.1 品質目標
  14.2 受入基準

15. リスクと前提
  15.1 想定リスク・対応策
  15.2 前提条件
  15.3 制約条件
  15.4 未確定事項

16. 合意事項・変更管理
  16.1 変更管理プロセス
  16.2 承認欄（承認者・氏名・日付の表）
  16.3 版歴表（版番号・日付・変更概要・承認者）
```

#### 章別 IPA/JIS/JUAS 参照源マッピング（template.md 内に明記）

| 章 | 主参照源 |
|----|---------|
| §1, §2, §3, §15 | IPA「超上流から攻めるIT化の事例集」/ 共通フレーム（SLCP） |
| §4, §5 | JIS X 0166（要件定義プロセス） |
| §6 | IPA「機能要件の合意形成ガイド」 |
| §7 | IPA/JUAS「非機能要求グレード」（6大項目） |
| §8, §9 | 共通フレーム / JIS X 0166 |
| §10, §11 | IPA/JUAS 非機能要求グレード（運用・移行性） |
| §12, §13, §16 | 共通フレーム（プロセス・プロジェクト管理） |
| §14 | qa-test.md（einja既存QA仕様）と整合 |

### 9. einja設計思想チェック

- [x] ユーザーに専門知識を要求しない（IPA/JIS用語は内部で吸収、選択肢形式で質問）
- [x] 質問は平易な言葉・選択肢形式（AskUserQuestion で description + Note 2層記述）
- [x] 技術的操作（git/ファイル/MCP）はSkill内で自動実行
- [x] エラー時の自動リカバリ（既存ファイル検出 → 差分モード切替）
- [x] 中間成果物の確認に視覚的手段を優先（生成ファイルパス + セクション目次の提示）

## タスク概要

| ID | タスク | 使用Skill/Agent | 依存 |
|----|--------|----------------|------|
| 0-0 | TaskCreate で全タスクを一括登録 | [TaskCreate] | - |
| 0-1 | Planファイルを保存先に配置: **Claude Code自動生成パス（`/Users/t-hiroyoshi/.claude/plans/sequential-enchanting-puddle.md`）はリネーム禁止**。承認後にリポジトリ内 `docs/plans/sequential-enchanting-puddle.md` へ `cp` でコピーして永続化（既存リポジトリ命名規則=ランダム語形式に整合） | [Bash/cp] | 0-0 |
| 0-2 | worktree作成: 新規5ファイル合計~1100行（SKILL.md + references/3ファイル + CLAUDE.md編集）でCLAUDE.md「worktree例外条件（ドキュメントのみ/30行未満）」に該当しないため **作成必須**。`_einja-worktree-guide` に従い `einja-project-requirements-skill` worktreeをセットアップ | [EnterWorktree + _einja-worktree-guide] | 0-1 |
| 0-3 | Skillスケルトン作成（frontmatter + ディレクトリ） | [einja-skill-creator] | 0-2 |
| 1 | `SKILL.md` 本体作成（ワークフロー本体・3ラウンドヒアリング・依存Skill呼び出し記述） | [Write] | 0-3 |
| 2 | `references/template.md` 作成（IPA/JIS/JUAS準拠の `requirements.md` 完全テンプレート） | [Write] | 0-3 |
| 3 | `references/hearing-checklist.md` 作成（4ラウンド構成のヒアリング質問テンプレ。Plan の確定章立て §1-§16 に1:1対応） | [Write] | 0-3 |
| 4 | `references/structure-guide.md` 作成（各章記入ガイド + IPA/JIS/JUAS参照リンク） | [Write] | 0-3 |
| 5 | `CLAUDE.md` のキーワードトリガー表に新エントリ追加（テンプレートリポジトリ固有セクション内） | [Edit] | 0-3 |
| 5.5 | `.claude/agents/einja/issue-specs/requirements-generator.md` の description に Do NOT use for（プロジェクト全体合意は本Skill へ）を追記 | [Edit] | 0-3 |
| 99-1 | **Skill品質チェック** [`einja-skill-plan-guide` ワークフローB]: Frontmatter / 構造 / einja設計思想 / Anthropicベストプラクティス の4観点を general-purpose サブエージェントで実施。MAJOR指摘あれば修正→再レビュー（最大1回） | [einja-skill-plan-guide ワークフローB] | 1-5.5 完了後 |
| 99-1b | **テンプレート内容レビュー**（IPA/JIS/JUAS準拠性、章立て妥当性、用語一貫性、mermaid記法準拠）: `references/template.md` + `references/structure-guide.md` を観点別に general-purpose 並列レビュー | [Agent: general-purpose 並列] | 99-1 |
| 99-2 | 動作確認: (a) Skillロード経路の静的確認（frontmatter parse、ディレクトリ構造、references相対参照）、(b) CLAUDE.mdキーワードトリガーの他Skillとの衝突確認 (grep)、(c) `references/template.md` の章立てが IPA/JIS 最低限要件（業務要件/システム化方針/機能要件サマリ/非機能要件/体制/スケジュール/リスク）をカバーしているか目視チェック、(d) description の `wc -m` で1024文字以内確認 | [Bash + Read] | 99-1b |
| 99-G | コミット承認ゲート（修正概要/レビュー結果/動作確認結果サマリ提示） | [AskUserQuestion] | 99-2 |
| 99-3 | コミット・プッシュ | [einja-task-commit] | 99-G承認後 |

### 並列実行計画

- **並列可（実装フェーズ）**: タスク1〜5.5 はすべて 0-3 のスケルトン完成後に着手可能。SKILL.md / references/3ファイル / CLAUDE.md追記 / requirements-generator.md追記 は対象ファイルが重複しないため最大6並列で実行可能
- **直列必須**: 0-0 → 0-1 → 0-2 → 0-3 → (1〜5.5を最大6並列) → 99-1 → 99-1b → 99-2 → 99-G → 99-3
- **委託サブエージェント**:
  - タスク1〜4: `einja-skill-creator` で雛形作成後、`general-purpose` で内容生成を並列実行
  - タスク5,5.5: 親エージェント直接 Edit（軽微編集）
  - タスク99-1: `einja-skill-plan-guide` ワークフローB（Skill品質チェックリスト適用）
  - タスク99-1b: IPA/JIS準拠性 / 章立て妥当性 / 用語一貫性 の3観点を `general-purpose` で並列レビュー

## リスク・不明点

| リスク/不明点 | 対応 |
|-------------|------|
| Skillトリガー語が既存 `requirements-generator` エージェントと混同される | (a) description の "Do NOT use for" で Skill/エージェントを区別して明示。(b) タスク5.5で `requirements-generator.md` 側にも "Do NOT use for: プロジェクト全体合意（→ einja-project-requirements）" を追記 |
| `docs/project/` ディレクトリが下流リポジトリで衝突する可能性 | 既存ファイル検出 → 差分モード切替で対応。初回実行時に Skill 内で `mkdir -p`。**CLIホワイトリスト影響なし**（`packages/create-app/scripts/template-update.ts` の `knownIgnoreList` に `docs` が含まれる / `packages/cli/scripts/copy-presets.mjs` は `docs/einja/` のみ対象） |
| IPA/JIS の章立てを完全再現するとボリュームが多すぎる | フルセット16章採用は確定済み（ユーザー選択）。剪定済み: 見積もり・コスト=別文書、§14品質保証=概要のみ、画面一覧除外。各章で「該当しない場合は省略可」を template.md に明記 |
| AskUserQuestion フローの単体テストが難しい | Skill のロード経路 + frontmatter の整合性確認を 99-2 で実施し、対話フロー本体はユーザー協力時のスモークテストに留める |
| description が長すぎて 1024文字制限に抵触する可能性 | 計画時点で約540文字（余裕あり）。作成時に Bash `wc -m` で再検算 |
| CLAUDE.md のキーワードトリガー表は `<!-- @einja:excluded -->` ブロック内のため**配布されない非対称性** | Skill本体（`einja-` プレフィックス）は配布される一方、キーワードトリガーは下流リポジトリに伝播しない。下流ユーザーは `/einja-project-requirements` で手動呼び出しか、description のトリガー語で自然発火する設計になる。Skillの description で "システム受託開発の…" などの自然語トリガーを十分に持たせる |
| `general-purpose` サブエージェントがIPA/JIS知識を持たない | (a) タスク2では `references/template.md` のドラフトをサブエージェントに作らせる際、Plan の「参考フォーマット章別マッピング」と章タイトル一覧をプロンプトに含めて与える。(b) 99-1b で IPA/JIS 準拠性を別途レビュー |

## 検証・動作確認方法

1. **Skill ロード確認**: `.claude/skills/einja-project-requirements/SKILL.md` を Read で開き、frontmatter の parse エラーがないか確認
2. **トリガー語検証**: CLAUDE.md に追加したキーワード表が他Skillと衝突しないか Grep で確認
3. **description文字数検算**: `wc -m` で1024文字以内を確認
4. **テンプレート整合性**: `references/template.md` の章立てが IPA/JIS 最低限要件（業務要件/システム化方針/機能要件/非機能要件/体制/スケジュール/リスク）をカバーしているか目視チェックリスト
5. **CLI配布対象確認**:
   - `einja-` プレフィックスを使用しているため、ビルド時に `presets/default/.claude/skills/` へ自動コピーされる予定
   - `docs/project/` は `packages/create-app/scripts/template-update.ts` の `knownIgnoreList` 配下で配布対象外（Skill実行時に下流リポジトリで生成される想定）であることを確認
6. **対話フロー（オプション）**: 承認後にユーザー協力で `/einja-project-requirements`（仮）を起動し、3ラウンドヒアリング → 生成 → 確認の一連動作を確認

## 完了判定

- 全実装タスク（0-1 〜 5.5）が完了
- `einja-skill-plan-guide` ワークフローB（99-1）で MAJOR 指摘なし、MINOR 指摘も対応または明確な理由で見送り
- 99-1b のテンプレート内容レビュー（IPA/JIS/JUAS準拠、章立て、用語、mermaid）で MAJOR 指摘なし
- 静的動作確認（Skillロード・トリガー・description文字数・テンプレート章立て・CLI配布）が PASS
- ユーザー承認（99-G）取得後にコミット・プッシュ
