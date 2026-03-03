# Plan: einja-skill-advisor Skill 作成

## Context

タスク着手前に「Skillを先に作るべきか」を評価し、必要なら Skill 作成を TODO の先頭に積むメタ Skill を作成する。Plan mode 中でも評価・提案フェーズが動作し、Skill 作成自体は Plan 承認後に `einja-skill-creator` へ委譲する設計。

## 作成するファイル

| ファイル | 内容 |
|---------|------|
| `.claude/skills/einja-skill-advisor/SKILL.md` | Skill 本体（新規作成） |

## 修正するファイル

| ファイル | 変更内容 |
|---------|---------|
| `CLAUDE.md` | 必須フローに自動起動ステップ追加 + Skillテーブル追記 + キーワードトリガー追記 |
| `.claude/commands/einja/spec-create.md` | Phase 0 に skill-advisor 自動評価ステップ追加 |

## Skill 設計概要

### 名前・トリガー

- **Skill名**: `einja-skill-advisor`
- **allowed-tools**: `Read`, `Grep`, `Glob`（Plan mode 制約に完全適合）
- **起動方式**: 以下の3系統（いずれもユーザーが意識せず Claude が自動判断）
  1. **Plan mode 進入時**: CLAUDE.md の必須フロー Step 1 で自動実行。ユーザーが自由形式でタスクを依頼→Plan mode に入った時点で評価
  2. **spec-create 実行時**: `/einja:spec-create` の Phase 0（前提確認）で自動実行。新機能の仕様策定前に Skill の必要性を評価
  3. **明示起動（補助）**: キーワード「Skill作るべき？」「Skill-first」等でも直接呼び出し可能
- **設計意図**: 既存のドキュメント・Skill・サブエージェントがない領域のタスクで特に効果を発揮。「未整備の領域で場当たり的に作業する前に、まず Skill を作って品質を安定させる」判断を Claude が自動で行う

### フロー（4ステップ）

```
ステップ1: 作業パターン分析
  - 作業カテゴリ特定（FE/BE/インフラ/ドキュメント/リファクタ等）
  - 反復性評価（今後も繰り返すか、memory/patterns.md を参照）
  - 複雑度評価（手順数・判断分岐数・参照ドキュメント数）

ステップ2: 既存Skillギャップ分析
  - .claude/skills/einja-*/SKILL.md を Glob で動的取得
  - 各Skillの name/description を読み取り、カバレッジを3段階判定
    - 完全カバー → Skill作成不要
    - 部分カバー → 既存Skill拡張を検討
    - カバー外 → 新規Skill作成を検討

ステップ3: ROI評価（スコアリング）
  コスト側: 作成時間 + 複雑度 + テスト必要度（各1-3点）
  価値側: 再利用頻度 + 品質安定化 + 時間節約 + チーム共有（各1-3点）
  判定: 価値合計 - コスト合計 >= 2 → 推奨

ステップ4: 構造化出力
  - 判定結果（🟢推奨 / 🟡拡張推奨 / ⚪不要）
  - Skill概要仕様（推奨時: 名前・目的・主要フロー・推定時間）
  - 推奨ワークフロー
```

### スキップ基準（即座に「不要」判定）

- 単発の小規模修正（バグ修正、typo、設定値変更）
- CLAUDE.md のキーワードトリガーに既に一致するタスク
- 作業指示が具体的かつ限定的（「ファイルXのY行をZ変更」等）

### Plan mode 対応

```
Plan mode 内で skill-advisor が行うこと:
  ✅ 既存Skill一覧を Glob + Read で取得
  ✅ memory/patterns.md を参照
  ✅ ROI評価ロジック実行（計算のみ）
  ✅ 構造化された評価結果を返却

Plan mode 内で行わないこと:
  ❌ ファイル作成・編集
  ❌ einja-skill-creator の呼び出し
  ❌ Bash コマンド実行

親エージェントの責務（Plan mode 内）:
  - skill-advisor の結果を受け取り AskUserQuestion で提案
  - 承認されたら計画ファイルの TODO-0 に Skill 作成を記載

Plan mode 解除後:
  - TODO-0: einja-skill-creator で Skill 作成
  - TODO-1〜: 作成した Skill で本作業実行
```

### einja-skill-creator との責務分離

| 責務 | skill-advisor | skill-creator |
|------|:---:|:---:|
| ギャップ分析・ROI評価 | ○ | - |
| Skill仕様ドラフト（概要） | ○ | - |
| SKILL.md 作成 | - | ○ |
| テスト・eval | - | ○ |

skill-advisor の出力（Skill概要仕様）が skill-creator の入力として機能する設計。

## CLAUDE.md 変更内容

### 1. 必須フローへの自動起動の組み込み（最重要）

現行の必須フロー:
```
1. 問題・要件を調査・分析する
2. 修正計画を docs/plans/ に作成し提示する
3. ユーザーの明示的な承認を得る
4. 承認後、実装を開始する
```

変更後:
```
1. 問題・要件を調査・分析する
2. 修正計画を docs/plans/ に作成する
3. einja-skill-advisor で「Skill を先に作るべきか」を自動評価する
   - 計画の内容・スコープを見て判断（全体像が見えた状態で評価）
   - 推奨判定 → AskUserQuestion でユーザーに提案
   - 承認 → 計画の TODO-0 に Skill 作成を追加
   - 不要判定 → そのまま次へ進む
   ※ スキップ基準に該当する場合は評価自体を省略
4. 計画をユーザーに提示し、明示的な承認を得る
5. 承認後、実装を開始する（TODO-0 があれば Skill 作成から）
```

**ポイント**: 計画を作って全体像が見えてから Skill の必要性を判断する。ユーザーが Skill の存在を知らなくても、Claude Code 側から自動的に「先に Skill を作ったほうが効率的です」と提案する。

### 2. spec-create.md への組み込み

spec-create の Phase 0（前提確認）に追加:
```
Phase 0: 前提確認
  ├─ TDD適用判定
  ├─ 要件明確さ確認
  ├─ ブランチ選択
  └─ 【追加】einja-skill-advisor で Skill 作成必要性を評価
       → 推奨時はユーザーに提案、承認なら先に Skill 作成
```

### 3. Skill・コマンドテーブルに追記

```markdown
| `einja-skill-advisor` | 作業前のSkill作成必要性評価（Plan/spec-create時に自動起動） |
```

### 4. キーワードトリガーテーブルに追記（excluded セクション）

```markdown
| `Skill作るべき？` `Skill化` `skill-advisor` `Skill-first` | `.claude/skills/einja-skill-advisor/SKILL.md` |
```

## 実装手順

1. **SKILL.md 作成**: `einja-skill-creator` Skill を使用して `.claude/skills/einja-skill-advisor/SKILL.md` を作成
2. **CLAUDE.md 更新**: テーブル2箇所に追記
3. **動作確認**: 適当なタスク説明を与えて Skill を呼び出し、評価結果の出力を確認

## 検証方法

- skill-advisor を Task ツールで呼び出し、テストケースで動作確認:
  - ケース1: 「ログイン画面を作って」→ 既存 Skill（frontend-implement系）でカバー → 不要判定
  - ケース2: 「Prismaスキーマ変更の自動マイグレーション運用を整備して」→ 既存 Skill にない → 推奨判定
  - ケース3: 「READMEのtypo修正」→ スキップ基準に該当 → 即座に不要判定
