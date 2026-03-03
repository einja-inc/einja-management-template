# Plan: project-privateセクションの簡素化

## Context

project-privateセクションの冗長な形式を簡素化する。現在の形式：

```markdown
---

<!-- @einja:project-private:start id="xxx" -->
## プロジェクト固有の設定

<!-- このセクションはプロジェクト固有の内容を追記する場所です -->
<!-- einja syncで上書きされません -->
<!-- @einja:project-private:end -->
```

新しい形式：

```markdown
<!-- @einja:project-private:start id="xxx" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
```

変更点：
1. 直前の `---` 罫線を削除
2. `## プロジェクト固有の設定` 見出しを削除
3. 空行 + 2行コメントを1行コメントに統合

## 互換性

CLIの `marker-processor.ts` はstart/endタグのみでパースするため、中身のコメント変更は完全に互換。

## 対象ファイル

### 一括置換対象（63ファイル）

| カテゴリ | ファイル数 |
|---------|-----------|
| `.claude/agents/einja/` | 16 |
| `.claude/commands/einja/` | 7 |
| `.claude/skills/einja-*/SKILL.md` | 13 |
| `docs/einja/steering/` | 20 |
| `docs/einja/instructions/` | 7 |

### 対象外

| カテゴリ | 理由 |
|---------|------|
| `CLAUDE.md` | 修正済み |
| `docs/einja/memory/` | ファイル全体がproject-private、見出しは意味あるコンテンツ |
| `packages/cli/` | ソースコード・テスト（文字列リテラル・テストデータ） |
| `packages/create-einja-app/` | 同上 |
| `docs/plans/` | 過去のplan（参照用） |
| `.claude/skills/einja-skill-creator/scripts/init_skill.py` | 説明用コードブロック内（短い形式で既にOK） |
| `.claude/skills/einja-skill-creator/SKILL.md` | 説明用コードブロック + 自身のproject-private |
| `.claude/skills/einja-coding-standards/references/testing-strategy.md` | 確認が必要 |

## 実装手順

### Step 1: sedで一括置換

2つのパターンに対応：

**パターンA**: `---` + 空行 + `---` + 空行 + project-private（1ファイル: `frontend-implement.md`）
**パターンB**: `---` + 空行 + project-private（約62ファイル）

両パターンをカバーするPerl正規表現で一括処理：

```bash
# .claude/ と docs/einja/ 配下の .md ファイルを対象に、
# "---\n\n" (1つまたは2つ) + 冗長なproject-private を簡素な形式に置換
find .claude/agents .claude/commands .claude/skills docs/einja/steering docs/einja/instructions \
  -name '*.md' -exec perl -0777 -pi -e '
  s/\n---\n(\n---\n)?\n<!-- @einja:project-private:start id="([^"]+)" -->\n## プロジェクト固有の設定\n\n<!-- このセクションはプロジェクト固有の内容を追記する場所です -->\n<!-- einja syncで上書きされません -->\n<!-- @einja:project-private:end -->/\n<!-- \@einja:project-private:start id="$2" -->\n<!-- プロジェクト固有の情報を記入 -->\n<!-- \@einja:project-private:end -->/g' {} +
```

### Step 2: SKILL.md内のドキュメント例も更新

`einja-skill-creator/SKILL.md` 内の説明用コードブロック部分は手動で確認・更新。

### Step 3: 検証

```bash
# 旧形式が残っていないことを確認
grep -r "## プロジェクト固有の設定" .claude/ docs/einja/steering/ docs/einja/instructions/ --include="*.md"

# 新形式の件数を確認（63ファイル程度）
grep -r "<!-- プロジェクト固有の情報を記入 -->" .claude/ docs/einja/ --include="*.md" | wc -l

# テスト実行（marker-processor関連）
cd packages/cli && pnpm test -- marker-processor
```
