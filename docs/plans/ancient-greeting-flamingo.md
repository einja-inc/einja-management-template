# Plan: einja-skill-advisor → einja-skill-first リネーム + ロジック強化

## Context

`einja-skill-advisor` は「Skill-firstアプローチ」を実現するメタSkillだが：
1. 名前が汎用的すぎて目的が伝わらない → `einja-skill-first` にリネーム
2. 推奨判定時に過去Planを活用していない → `docs/plans/` から類似作業を検索し、ユースケースをSkill仕様に反映
3. skill-creatorへの委譲表現にばらつきがある → 統一的に明示

## 変更内容

### A. リネーム

#### ディレクトリ
- `.claude/skills/einja-skill-advisor/` → `.claude/skills/einja-skill-first/`

#### SKILL.md 内（7箇所）
- L2: `name: einja-skill-advisor` → `einja-skill-first`
- L3-4: description内 `skill-advisor` → `skill-first`
- L13: 見出し → `einja-skill-first`
- L21: テーブル → `skill-first`
- L45: キーワード → `skill-first`
- L198: 文中「skill-advisor の結果」→ `skill-first の結果`
- L237: project-private id → `einja-skill-first-project`

#### CLAUDE.md（3行、4置換）
- L43: Skillテーブル `einja-skill-advisor` → `einja-skill-first`
- L56: 必須フロー `einja-skill-advisor` → `einja-skill-first`
- L227: キーワード列の `skill-advisor` 削除 + パス列の `einja-skill-advisor` → `einja-skill-first`

#### spec-create.md（1箇所）
- L113: `einja-skill-advisor` → `einja-skill-first`

#### 過去Plan（変更しない、履歴として保持）
- `docs/plans/stateful-wishing-lerdorf.md` - skill-advisor作成時のPlan（12箇所）
- `docs/plans/glimmering-giggling-sedgewick.md` - hook作成Plan（7箇所、hookパスに旧名を含む。将来このPlanを実行する場合はパス更新が必要）

### B. ロジック強化: 過去Plan検索（SKILL.md内）

#### Step 1 強化（L71-75: 作業パターン分析）

現在の「`docs/einja/memory/patterns.md` を参照」に加え、`docs/plans/` からの反復パターン推定を追加：

```
1. 作業カテゴリ特定（変更なし）
2. 反復性評価:
   a. docs/einja/memory/patterns.md を Read で参照
   b. patterns.md に記録がない場合、docs/plans/ からも反復パターンを推定する
      - Glob で docs/plans/*.md を取得（todo-*.md, *-agent-*.md は除外）
      - Grep で作業カテゴリのキーワード + # Plan: タイトル行を検索
      - 類似カテゴリの作業が2件以上あれば反復性の根拠とする
3. 複雑度評価（変更なし）
```

#### Step 5 新規追加（推奨/拡張推奨の場合のみ実行）

Step 4（構造化出力）の後に追加。判定が「不要」の場合はスキップ。

```
### ステップ5: 過去Plan検索によるユースケース収集（推奨/拡張推奨の場合のみ）

以下の手順で過去Planから類似作業を検索し、Skill仕様のユースケースに反映する。

1. Glob で docs/plans/*.md を取得する
   - 除外: todo-*.md, *-agent-*.md（子エージェント出力）
2. Grep で以下のキーワードを検索し、関連Planを特定する
   - ステップ1で特定した作業カテゴリのキーワード
   - 変更対象ファイルパターン（例: .claude/skills/, CLAUDE.md 等）
   - # Plan: タイトル行で関連性を粗くフィルタ
3. 関連性の高いPlan（最大5件）のみ Read で詳細を確認する
   - ## Context セクションから作業概要を抽出
   - 変更対象ファイル・手順から共通パターンを特定
4. 類似度を判定する
   - 高: 変更対象ファイルが重複する
   - 中: 同一ドメインの作業、または手法・パターンが類似
5. 結果を Skill概要仕様のユースケースセクションに反映する
```

#### Skill概要仕様テンプレート拡張（L152-161）

```markdown
### Skill概要仕様
- **名前**: einja-{proposed-name}
- **目的**: {Skillの目的}
- **主要フロー**: {主要な処理ステップの概要}
- **推定作成時間**: {見積もり}
- **ユースケース（過去Planから）**:
  - {Plan名}: {作業概要}（類似度: 高/中）
  - {Plan名}: {作業概要}（類似度: 高/中）

### 推奨ワークフロー
計画のTODO-0にSkill作成を追加し、`einja-skill-creator` Skillで作成後に本作業を開始する。
```

### C. skill-creator委譲の明示化

現状SKILL.md内で既に大半の箇所に `einja-skill-creator` が明記済み（L17, L160, L205, L232）。
追加で統一する箇所：
- L160の推奨ワークフロー: 「einja-skill-creatorで作成後に」→「`einja-skill-creator` Skillで作成後に」（バッククォート追加で統一）

## 影響なし
- 他のSkill定義 → 参照なし
- エージェント定義 → 参照なし
- `presets/` → ビルド時に自動反映（直接編集不要）

## 実装手順

1. `mv .claude/skills/einja-skill-advisor .claude/skills/einja-skill-first`
2. SKILL.md: リネーム（7箇所）+ Step 1強化 + Step 5追加 + テンプレート拡張 + skill-creator表記統一
3. CLAUDE.md: 3行（4置換）更新
4. spec-create.md: 1箇所更新
5. `grep -r "skill-advisor" --include="*.md" | grep -v "docs/plans/"` → 0件確認

## 検証

- [ ] `grep -r "einja-skill-advisor" --include="*.md" | grep -v "docs/plans/"` → 0件
- [ ] `grep -r "skill-advisor" --include="*.md" | grep -v "docs/plans/"` → 0件
- [ ] SKILL.md内にStep 5（過去Plan検索）が存在し、除外条件・上限・類似度基準が明記されていること
- [ ] Skill概要仕様テンプレートに「ユースケース（過去Planから）」セクションがあること
- [ ] 推奨ワークフローに `einja-skill-creator` Skill名がバッククォート付きで統一されていること
