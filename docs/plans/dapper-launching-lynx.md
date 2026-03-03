# CLAUDE.md プロジェクト概要セクションの改善

## Context

CLAUDE.mdの「プロジェクト概要」セクションが、ファイルパス直接参照と頻出コマンドのハードコード記述になっている。Skill名ベースの参照に統一し、頻出コマンドの重複管理を解消する。

### 現状の問題点

1. **ファイルパス参照** → パス変更時に壊れる、Skill仕組みと不整合
2. **頻出コマンド** → CLAUDE.mdにハードコード。project-overviewにまとめれば一元管理できる

## 変更内容

### 1. CLAUDE.md「プロジェクト概要」セクション（L106-119）

**Before:**
```markdown
## プロジェクト概要

Turborepoモノレポ構成（pnpm workspaces）。詳細は以下を参照:
- `.claude/skills/einja-project-overview/SKILL.md` - 構成、技術スタック
- `.claude/skills/einja-coding-standards/SKILL.md` - コーディング規約、インポートパス規約
- `.claude/skills/einja-infra-maintenance/SKILL.md` - 開発環境セットアップ、サーバー管理

### 頻出コマンド
- `pnpm dev:bg` / `pnpm dev:stop` - 開発サーバー起動/停止
- `pnpm build` - プロダクションビルド
- `pnpm lint:fix && pnpm format:fix` - コード自動修正
- `pnpm typecheck` - 型チェック
- `pnpm test` - テスト実行
- `pnpm prepush` - プッシュ前チェック（lint + typecheck + test）
```

**After:**
```markdown
## プロジェクト概要

Turborepoモノレポ構成（pnpm workspaces）。詳細が必要な場合は以下のSkillを参照:
- `einja-project-overview` - 構成、技術スタック、頻出コマンド
- `einja-coding-standards` - コーディング規約、インポートパス規約
- `einja-infra-maintenance` - 開発環境セットアップ、サーバー管理
```

→ 頻出コマンドをCLAUDE.mdから削除し、project-overview Skillに移動

### 2. einja-project-overview SKILL.md に頻出コマンドを追加

**追加内容:**
```markdown
## 頻出コマンド

- `pnpm dev:bg` / `pnpm dev:stop` - 開発サーバー起動/停止
- `pnpm build` - プロダクションビルド
- `pnpm lint:fix && pnpm format:fix` - コード自動修正
- `pnpm typecheck` - 型チェック
- `pnpm test` - テスト実行
- `pnpm prepush` - プッシュ前チェック（lint + typecheck + test）
```

### トレードオフ

| 観点 | 現状（CLAUDE.md直書き） | 変更後（Skill参照） |
|------|----------------------|-------------------|
| 即座に参照可能か | 常にシステムプロンプトに含まれる | Skillロード時に参照可能 |
| 一元管理 | CLAUDE.mdとSkillで二重管理リスク | project-overviewが Single Source of Truth |
| CLAUDE.mdの簡潔さ | 14行占有 | 4行に短縮（-10行） |

頻出コマンドは実作業時にSkillをロードすれば十分。CLAUDE.mdはポインタに徹する方が設計上正しい。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `CLAUDE.md` (L106-119) | Skill名参照に変更、頻出コマンド削除 |
| `.claude/skills/einja-project-overview/SKILL.md` | 頻出コマンドセクション追加 |

## 検証

- `CLAUDE.md` でファイルパス参照が残っていないこと（Grepで確認）
- `einja-project-overview/SKILL.md` に頻出コマンドが含まれること
- `pnpm prepush` が通ること（CLAUDE.mdはlint対象外だが念のため）
