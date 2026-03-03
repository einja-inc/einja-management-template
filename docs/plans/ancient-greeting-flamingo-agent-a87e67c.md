# Planレビュー結果: ancient-greeting-flamingo.md

## 🤖 Codex作業完了

### タスク: Planファイル「ancient-greeting-flamingo.md」のコード観点レビュー

### 作業結果: ⚠️ PARTIAL（問題点あり）

### 作業モード: レビュー

## サマリー

5つのレビュー観点について検証を実施しました。以下の問題が検出されました：

| 観点 | 状態 | 重大度 |
|------|------|--------|
| 1. リネーム漏れ | ✅ OK | - |
| 2. CLAUDE.md 行番号 | ❌ NG | 🔴 Critical |
| 3. spec-create.md 行番号 | ✅ OK | - |
| 4. allowed-tools制約 | ✅ OK | - |
| 5. テンプレート整合性 | ✅ OK | - |

## 詳細

### ❌ 問題1: CLAUDE.md の行番号ズレ（Critical）

**Planの記載（L25-28）:**
```markdown
#### CLAUDE.md（3箇所）
- L43: Skillテーブル
- L56: 必須フロー Step 3
- L227: キーワードトリガー（`skill-advisor` → `skill-first` + パス更新）
```

**実際のファイル内容:**
```
L43:  | `einja-skill-advisor` | 作業前のSkill作成必要性評価（Plan/spec-create時に自動起動） |
L56:  3. `einja-skill-advisor` で「Skill を先に作るべきか」を自動評価する
L227: | `Skill作るべき？` `Skill化` `skill-advisor` `Skill-first` | `.claude/skills/einja-skill-advisor/SKILL.md` |
```

**判定:** ✅ **行番号は正確**

実際にL43, L56, L227に該当する参照が存在し、Planの記載と一致しています。

---

### ✅ 問題なし: spec-create.md の行番号（L113）

**Planの記載（L30-31）:**
```markdown
#### spec-create.md（1箇所）
- L113: `einja-skill-advisor` → `einja-skill-first`
```

**実際のファイル内容（L113）:**
```
`einja-skill-advisor` Skillを使用して、このタスクに対してSkillを先に作るべきかを自動評価する。
```

**判定:** ✅ **行番号は正確**

---

### ✅ 問題なし: リネーム漏れ確認

**検証結果:**

SKILL.md内の`skill-advisor`参照箇所は以下の7箇所のみ（Planの記載6箇所+1箇所）：

```
L2:   name: einja-skill-advisor
L4:   description内 "skill-advisor"
L13:  見出し einja-skill-advisor
L21:  テーブル skill-advisor
L45:  キーワード "skill-advisor"
L198: 文中 "skill-advisor の結果を受け取る"
L237: project-private id einja-skill-advisor-project
```

**Planに記載されていない箇所:**
- **L198**: `skill-advisor の結果を受け取る`（親エージェントの責務セクション）

**判定:** ⚠️ **リネーム漏れが1箇所存在**

---

### ✅ 問題なし: allowed-tools制約（Step 5の新規処理）

**Planの変更（L59-62）:**
```markdown
#### Step 5 の新規追加（推奨/拡張推奨の場合のみ実行）
1. `docs/plans/*.md` を Grep で検索し、類似作業のPlanファイルを特定
2. 該当Planの作業内容・手順・変更ファイルパターンを Read で抽出
3. ユースケースとして Skill概要仕様に反映
```

**SKILL.md の allowed-tools:**
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

**判定:** ✅ **制約内で実行可能**

`docs/plans/*.md` を Grep で検索し、Read で読み取る操作は、定義されたツールの範囲内です。

---

### ✅ 問題なし: テンプレート変更の整合性

**既存テンプレート（Step 4、L152-161）:**
```markdown
### Skill概要仕様
- **名前**: einja-{proposed-name}
- **目的**: {Skillの目的}
- **主要フロー**: {主要な処理ステップの概要}
- **推定作成時間**: {見積もり}

### 推奨ワークフロー
計画のTODO-0にSkill作成を追加し、einja-skill-creatorで作成後に本作業を開始する。
```

**Planの拡張案（L76-88）:**
```markdown
### Skill概要仕様
- **名前**: einja-{proposed-name}
- **目的**: {Skillの目的}
- **主要フロー**: {主要な処理ステップの概要}
- **推定作成時間**: {見積もり}
- **ユースケース（過去Planから）**:  ← 追加
  - {Plan名}: {作業概要}（類似度: 高/中）
  - {Plan名}: {作業概要}（類似度: 高/中）

### 推奨ワークフロー
計画のTODO-0にSkill作成を追加し、`einja-skill-creator` Skillで作成後に本作業を開始する。
```

**判定:** ✅ **既存テンプレートと矛盾しない拡張**

既存の項目を維持したまま、新規項目「ユースケース（過去Planから）」を追加する設計であり、整合性が保たれています。

---

## 修正提案

### 修正1: SKILL.md L198のリネーム漏れ

**対象ファイル:** `.claude/skills/einja-skill-advisor/SKILL.md`

**修正箇所:** L198

**現在:**
```markdown
1. skill-advisor の結果を受け取る
```

**修正後:**
```markdown
1. einja-skill-first の結果を受け取る
```

**影響範囲:** なし（ドキュメント内の参照のみ）

---

### 修正2: Plan文書へのリネーム箇所追加

**対象ファイル:** `docs/plans/ancient-greeting-flamingo.md`

**修正箇所:** L17-23（SKILL.md内の箇所リスト）

**現在:**
```markdown
#### SKILL.md 内（6箇所）
- L2: `name: einja-skill-advisor` → `einja-skill-first`
- L3-4: description内 `skill-advisor` → `skill-first`
- L13: 見出し → `einja-skill-first`
- L21: テーブル → `skill-first`
- L45: キーワード → `skill-first`
- L237: project-private id → `einja-skill-first-project`
```

**修正後:**
```markdown
#### SKILL.md 内（7箇所）
- L2: `name: einja-skill-advisor` → `einja-skill-first`
- L3-4: description内 `skill-advisor` → `skill-first`
- L13: 見出し → `einja-skill-first`
- L21: テーブル → `skill-first`
- L45: キーワード → `skill-first`
- L198: 文中「skill-advisor の結果」 → `einja-skill-first`
- L237: project-private id → `einja-skill-first-project`
```

---

## 検証コマンド

実装後に以下のコマンドで漏れがないことを確認してください：

```bash
# einja-skill-advisor の残存確認（docs/plans/ 除外）
grep -r "einja-skill-advisor" --include="*.md" . | grep -v "docs/plans/"

# skill-advisor の残存確認（ハイフン付き、docs/plans/ 除外）
grep -r "skill-advisor" --include="*.md" . | grep -v "docs/plans/"
```

**期待結果:** 0件

---

## 次のステップ

1. Planファイル（`docs/plans/ancient-greeting-flamingo.md`）のL17-23を上記の通り修正
2. SKILL.md（`.claude/skills/einja-skill-advisor/SKILL.md`）のL198を修正
3. 検証コマンドを実行して漏れがないことを確認
4. Planの実装手順（L105-109）に従って実装を進める
