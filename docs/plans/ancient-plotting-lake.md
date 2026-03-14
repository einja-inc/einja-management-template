# Plan: テンプレートリポジトリでパッケージリリース以外のGitHub Actionsを無効化

## Context

このリポジトリ（`einja-inc/einja-management-template`）はテンプレートリポジトリであり、アプリケーションのデプロイ・プレビュー環境は不要。パッケージリリース（`publish-packages.yml`）のみ実行したい。一方、ワークフローファイル自体は `@einja-inc/create-app` 経由で下流プロジェクトに配布されるため、ファイルは完全な状態で保持する必要がある。

## 変更内容

各ワークフローの全ジョブに以下の条件を追加:
```yaml
if: github.repository != 'einja-inc/einja-management-template'
```

### 対象ファイルと変更箇所

| ファイル | ジョブ数 | 変更内容 |
|---------|---------|---------|
| `deploy-stable-branches.yml` | 多数 | 全ジョブに `if` 条件追加 |
| `create-release-draft.yml` | 2 | 全ジョブに `if` 条件追加 |
| `deploy-pr-preview.yml` | 4 | 全ジョブに `if` 条件追加 |
| `cleanup-pr-preview-on-close.yml` | 1-2 | 全ジョブに `if` 条件追加 |
| `cleanup-pr-preview-db.yml` | 1 | 全ジョブに `if` 条件追加 |
| `claude.yml` | **変更なし**（維持） | このリポジトリでも使用するため |
| `publish-packages.yml` | **変更なし**（維持） | - |

### 既存 `if` 条件がある場合の対応

既存の `if` がある場合は `&&` で結合:
```yaml
# 例: 既存条件がある場合
if: github.repository != 'einja-inc/einja-management-template' && <既存条件>
```

## 使用予定Skill・サブエージェント

### 実装用
- `general-purpose` サブエージェント: 5本のワークフローファイルへの `if` 条件追加

### レビュー用
- `einja-review-code` Skill: 変更後のレビュー

## 検証方法

1. 全ワークフローの各ジョブに `if: github.repository != 'einja-inc/einja-management-template'` が追加されていることを確認
2. `publish-packages.yml` は変更されていないことを確認
3. YAML構文の妥当性確認
4. `pnpm prepush` 通過確認
