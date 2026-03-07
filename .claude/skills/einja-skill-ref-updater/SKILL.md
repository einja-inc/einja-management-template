---
name: einja-skill-ref-updater
description: 外部ツール・ライブラリに依存するSkillの参照元メタデータをスキャンし、最新情報と比較して更新提案を行うSkill。「Skillを更新して」「参照元を最新化して」等で呼び出し可能
user_invocable: true
---

<!-- このSkill自体は外部ツール・ライブラリに依存しないため @references メタデータは不要 -->

# Skill参照元更新 - 外部依存Skillの最新化

## 概要

外部ツール・ライブラリに依存するSkillが参照元の更新に追従できるよう、参照元メタデータの検出・最新化を行う。

## 参照元メタデータ規約

Skill本文中にMarkdownコメントで記載する:

```markdown
<!-- @references
- url: https://github.com/example/tool
  type: github-repo
  description: ツールの説明
-->
```

- `url`: 参照元のURL（GitHub repo, npm, ドキュメントページ等）
- `type`: `github-repo` | `npm-package` | `docs`
- `description`: 参照元の説明

## 動作フロー

1. **対象Skillの特定**
   - 引数で指定された場合はそのSkillのみ
   - 指定なしの場合は `.claude/skills/einja-*/SKILL.md` と `.claude/skills/_einja-*/SKILL.md` を全スキャン
   - `<!-- @references` ブロックを持つSkillを一覧化

2. **参照元情報の取得**
   - 各参照元URLをWebFetchで取得
   - GitHub repoの場合はREADME.mdを取得
   - npm-packageの場合はnpmレジストリから最新情報を取得
   - docsの場合はページ内容を取得

3. **差分検出**
   - 現在のSkill内容と参照元の最新情報を比較
   - 新ルール追加、オプション変更、破壊的変更等を検出
   - 変更がない場合は「最新です」と報告

4. **更新提案**
   - 差分がある場合、具体的な更新内容をAskUserQuestionでユーザーに提示
   - 承認後、Skill内容を更新

5. **更新実行**
   - 承認されたSkillのみ更新
   - 更新後、変更内容のサマリーを報告

## トリガーキーワード

「Skillを更新して」「参照元を最新化して」「react-doctorのSkillを最新化して」等

## 注意事項

- WebFetchが失敗した場合はスキップして次の参照元に進む
- 大幅な変更がある場合は慎重に対応（破壊的変更の可能性）
- 更新はユーザー承認後のみ実行
