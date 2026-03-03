# Plan: docs/einja/ への手動ファイル作成禁止ルールをCLAUDE.mdに追記

## Context

別リポジトリでこのリポジトリのNPMパッケージ（`@einja/dev-cli`）を利用している際、Agentが `docs/einja/` 配下にドキュメントを手動作成してしまうケースがある。`docs/einja/` はCLIパッケージで管理されるファイル群（`einja sync` で同期）のため、手動作成すると次回sync時に上書き・競合が発生する。

## 変更内容

### CLAUDE.md に「マネージドディレクトリ」セクションを追加

**配置場所**: L108「プロジェクト概要」セクションの直後（L113の後）
- `@einja:excluded` の外なので、配布先テンプレートにも反映される

**追記内容**:

```markdown
## マネージドディレクトリ（編集禁止）

`docs/einja/` は `@einja/dev-cli` パッケージで管理されている。`einja sync` で同期されるため、以下のルールを厳守すること。

| ディレクトリ | 操作 | 理由 |
|------------|------|------|
| `docs/einja/steering/` | **読み取り専用** | CLI同期で上書きされる |
| `docs/einja/templates/` | **読み取り専用** | CLI同期で上書きされる |
| `docs/einja/instructions/` | **読み取り専用** | CLI同期で上書きされる |
| `docs/einja/example/` | **読み取り専用** | CLI同期で上書きされる |
| `docs/einja/memory/` | **読み書き可** | プロジェクト固有の学習記録（同期対象外） |

**禁止事項**: `docs/einja/` 配下に新規ファイル・ディレクトリを作成しないこと（`memory/` 内を除く）
```

### 対象ファイル

- `/Users/kzp/code/GitHub/einja-inc/einja-management-template/CLAUDE.md` (L113の後に追記)

## 検証

1. `@einja:excluded` の外に配置されていることを確認
2. `node scripts/generate-template.mjs` を実行し、`presets/default/CLAUDE.md.template` に新セクションが含まれることを確認
3. テンプレート内のプレースホルダー変換に影響がないことを確認
