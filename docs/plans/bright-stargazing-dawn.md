# Plan: einja-team-exec SKILL.md 書き直し + skill-creator 参考URL規約追加

## Context

einja-team-exec SKILL.mdがサブエージェントの仕組みをベースに書かれていたが、Agent TeamsのTeammatesはサブエージェントとは完全に別アーキテクチャであることが判明。公式ドキュメント（https://code.claude.com/docs/en/agent-teams）に基づいて正しい仕様で書き直す。

また、Skill作成時に参考にした公式ドキュメントやベースとなるSkillのURLをコメントとして記録する規約を、einja-skill-creatorにも追加する。

### Teammates vs サブエージェントの根本的な違い

| 項目 | Teammates | サブエージェント |
|------|-----------|--------------|
| 実体 | 独立したClaude Codeプロセス | メインセッション内の一時的な子プロセス |
| 通信 | メンバー同士で直接メッセージ可能 | メインにのみ報告 |
| spawn方法 | 自然言語プロンプトで役割指定 | `subagent_type`で指定 |
| 特殊化 | general-purposeベース、プロンプトで専門化 | `.claude/agents/`のカスタム定義可能 |
| コンテキスト | 各自独立したフルコンテキストウィンドウ | メインの指示を引き継ぎ |

## 対象ファイル

| ファイル | 操作 |
|---------|------|
| `.claude/skills/einja-team-exec/SKILL.md` | 全面書き直し |
| `.claude/skills/einja-skill-creator/SKILL.md` | 参考URL規約の追加 |

## 変更内容

### 1. einja-team-exec/SKILL.md 書き直し

**削除するもの:**
- `subagent_type`に基づくチームメンバー選出ガイド（テーブル3つ + 編成例）
- `TeamCreate`/`TaskCreate`/`TaskUpdate`等のサブエージェント用ツール呼び出し手順
- サブエージェントの文脈で書かれたワークフロー全体

**新しく書くもの:**
- 概要: Teammatesは独立したClaude Codeインスタンスであること
- spawn方法: 自然言語プロンプトで役割・指示を記述（`subagent_type`ではない）
- spawn時のプロンプト設計ガイド: 役割・担当範囲・制約を明確に記述する方法
- プロンプト例（公式ドキュメントのパターンに準拠）:
  ```
  Create an agent team for [タスク].
  Spawn teammates:
  - [役割1]: [担当範囲と指示]
  - [役割2]: [担当範囲と指示]
  ```
- チームサイズの目安（公式: 3-5 teammates、5-6 tasks/teammate）
- 通信: 直接メッセージ + 共有タスクリスト
- ファイル競合回避（公式: 各teammateが異なるファイルを担当）
- コミット管理（CLAUDE.mdのgit安全ルールはCLAUDE.md経由で自動適用）
- 完了・シャットダウン手順
- 参考ドキュメントURLをコメントで記載

**参考URLコメント（SKILL.md冒頭、フロントマター直後）:**
```markdown
<!-- 参考: https://code.claude.com/docs/en/agent-teams -->
```

### 2. einja-skill-creator/SKILL.md 参考URL規約追加

「SKILL.mdの作成」セクション内に以下の規約を追加:

**追加箇所**: `#### 記述パターン` セクションの近辺、または「Skill記述ガイド」セクション内

**追加内容**:
```
#### 参考ドキュメントの記録

Skill作成時に参考にした公式ドキュメント、ベースとなるSkill、
設計判断の根拠となった情報源をSKILL.md内にHTMLコメントで記載する。

**記載箇所**: フロントマター（`---`）直後

**フォーマット**:
<!-- 参考: https://example.com/docs/feature -->
<!-- ベース: .claude/skills/existing-skill/SKILL.md -->

これにより、Skillの設計根拠を後から追跡でき、
公式仕様の変更時に影響範囲を特定しやすくなる。
```

## 検証

- [ ] SKILL.mdのフロントマターが正しいYAML形式であること
- [ ] サブエージェント関連の記述（`subagent_type`、`TaskCreate`等）が残っていないこと
- [ ] 公式ドキュメントの仕様と矛盾がないこと
- [ ] 参考URLコメントがSKILL.mdに記載されていること
- [ ] einja-skill-creatorに参考URL規約が追加されていること
