# Plan: einja-project-overview SKILL.md の参照先再定義

## Context

「プロジェクト概要」Skillが関心事の異なるドキュメント（コーディング規約、インフラ管理Skill等）を参照していた。「このプロジェクトは何か？どういう構造か？」に答えるハブとして、適切な参照先のみに絞る。

## 変更内容

**対象ファイル**: `.claude/skills/einja-project-overview/SKILL.md`

### 参照すべきドキュメント（3つ）

| 参照 | 目的 |
|------|------|
| `docs/einja/steering/README.md` | 全ドキュメントへのナビゲーションハブ |
| `docs/einja/steering/product.md` | 何のためのプロジェクトか（製品ビジョン） |
| `docs/einja/steering/architecture.md` | どういう技術構成か |

### 除外するもの

- `infra-maintenance` Skillリンク → インフラ運用は別の関心事
- コーディング規約・コンポーネント設計 → 開発ガイドラインの関心事
- `db-schema-design.md` → スキーマ詳細設計であり概要ではない
- `backend-architecture.md` → 4層設計の実装詳細

## 検証

- SKILL.md の内容を `Read` で確認
