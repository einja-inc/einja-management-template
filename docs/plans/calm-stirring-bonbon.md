# ガイドライン系Skill廃止 → docs一元管理

## Context

開発ガイドラインが `.claude/skills/` と `docs/einja/steering/` に分散している。
api-development, backend-architecture, frontend-development は既に docs に実体があり Skill は薄いラッパー。
coding-standards, component-design は Skill 内の `references/` に内容が埋め込まれている。
playwright-mcp は SKILL.md 自体が内容。

**目的**: `docs/einja/steering/` にガイドラインを一元管理し、6つの不要なSkillを廃止する。

---

## Step 1: docsファイルの作成（内容移動）

### 1-1. `docs/einja/steering/development/coding-standards.md` 作成

SKILL.md の本文（基本原則、クイックリファレンス、ツール設定）+ references/ 4ファイルを1つに統合。

統合元:
- `.claude/skills/einja-coding-standards/SKILL.md` (行6-132)
- `.claude/skills/einja-coding-standards/references/typescript-rules.md`
- `.claude/skills/einja-coding-standards/references/naming-conventions.md`
- `.claude/skills/einja-coding-standards/references/prohibited-patterns.md`
- `.claude/skills/einja-coding-standards/references/import-conventions.md`

構成: SKILL.mdの概要・基本原則・クイックリファレンス → 各references を見出し付きセクションとして追加。
`@einja:managed` マーカーを付与。

### 1-2. `docs/einja/steering/development/component-design.md` 作成

SKILL.md の本文 + references/ 3ファイルを1つに統合。

統合元:
- `.claude/skills/einja-component-design/SKILL.md` (行6-109)
- `.claude/skills/einja-component-design/references/directory-structure.md`
- `.claude/skills/einja-component-design/references/props-patterns.md`
- `.claude/skills/einja-component-design/references/styling-guide.md`

構成: SKILL.mdの概要・基本原則・クイックリファレンス → 各references を見出し付きセクションとして追加。
`@einja:managed` マーカーを付与。

### 1-3. `docs/einja/steering/development/playwright-guidelines.md` 作成

統合元:
- `.claude/skills/einja-playwright-mcp/SKILL.md` (全54行)

`@einja:managed` マーカーを付与。

---

## Step 2: 参照元の更新

### 2-1. `.claude/agents/einja/task/task-executer.md`

**フロントマター**: skills から5つ削除
```yaml
skills:
  - spec-context-loader
  - general-context-loader
```

**本文 行110-126**: 実装種別テーブル + 詳細規約パスを docs 直接参照に変更
```markdown
#### 1.3 実装種別に応じたドキュメント参照

実装種別に応じて、以下のドキュメントを参照すること:

| 実装種別 | 参照ドキュメント |
|---------|--------------|
| **API実装** | `docs/einja/steering/development/api-development.md` |
| **フロントエンド実装** | `docs/einja/steering/development/frontend-development.md` |
| **バックエンド実装** | `docs/einja/steering/development/backend-architecture.md` |
| **コード全般** | `docs/einja/steering/development/coding-standards.md` |
| **コンポーネント設計** | `docs/einja/steering/development/component-design.md` |

**詳細規約が必要な場合**（Readツールで上記ドキュメントの該当セクションを読み込み）
```

### 2-2. `.claude/skills/einja-project-overview/SKILL.md`

行24-26 の関連Skillセクションを docs 参照に変更:
```markdown
## 関連ドキュメント

- `docs/einja/steering/development/coding-standards.md` - コーディング規約（インポートパス規約含む）
- [infra-maintenance](../einja-infra-maintenance/SKILL.md) - 開発環境セットアップ・サーバー管理
- `docs/einja/steering/development/component-design.md` - コンポーネント設計ガイドライン
```

### 2-3. `.claude/skills/einja-skill-creator/SKILL.md`

行420-421 の例示を更新:
- `einja-coding-standards` → docs参照パスに変更、または例示そのものを別のSkillに差し替え

### 2-4. `CLAUDE.md`

プロジェクト概要セクションの `einja-coding-standards` 参照を docs パスに変更:
```markdown
- `einja-project-overview` - 構成、技術スタック、頻出コマンド
- `docs/einja/steering/development/coding-standards.md` - コーディング規約、インポートパス規約
- `einja-infra-maintenance` - 開発環境セットアップ、サーバー管理
```

### 2-5. `README.md`

行411-412 のリンクを docs パスに変更:
```markdown
- [コーディング規約](./docs/einja/steering/development/coding-standards.md)
- [コンポーネント設計ガイドライン](./docs/einja/steering/development/component-design.md)
```

### 2-6. `docs/einja/steering/README.md`

開発ガイドテーブルに3ファイルを追加:
```markdown
| [コーディング規約](development/coding-standards.md) | TypeScript/React命名規則、禁止パターン、インポート規約 | 全開発者 |
| [コンポーネント設計](development/component-design.md) | ディレクトリ構造、Props設計、スタイリング | フロントエンド開発者 |
| [Playwright動作確認](development/playwright-guidelines.md) | 一時ファイル管理、ブラウザ設定 | QA、開発者 |
```

フロントエンド開発者の必読セクションにも追加。

---

## Step 3: Skillディレクトリの削除

以下の6ディレクトリを削除:
- `.claude/skills/einja-api-development/`
- `.claude/skills/einja-backend-architecture/`
- `.claude/skills/einja-frontend-development/`
- `.claude/skills/einja-coding-standards/`
- `.claude/skills/einja-component-design/`
- `.claude/skills/einja-playwright-mcp/`

---

## Step 4: ビルドスクリプトの更新

### `packages/cli/scripts/copy-presets.mjs`

mappings 配列から以下の6エントリを削除（行61-89）:
- einja-api-development (行61-65)
- einja-backend-architecture (行66-70)
- einja-coding-standards (行71-75)
- einja-component-design (行76-80)
- einja-frontend-development (行86-90)

※ einja-playwright-mcp はこのファイルに含まれていないので変更不要。

---

## Step 5: presets/default の同期確認

ビルドスクリプトでコピーされる `presets/default/` 配下の対応するディレクトリも削除:
- `packages/cli/presets/default/.claude/skills/einja-api-development/`
- `packages/cli/presets/default/.claude/skills/einja-backend-architecture/`
- `packages/cli/presets/default/.claude/skills/einja-frontend-development/`
- `packages/cli/presets/default/.claude/skills/einja-coding-standards/`
- `packages/cli/presets/default/.claude/skills/einja-component-design/`

※ これらは次回ビルド時に生成されなくなるが、既存のものは手動削除が必要。

---

## 検証

1. `pnpm --filter @einja/dev-cli build` でビルドが通ること
2. `pnpm prepush` (lint + typecheck + test) が通ること
3. 削除した Skill への参照が残っていないこと: `grep -r "einja-coding-standards\|einja-component-design\|einja-api-development\|einja-frontend-development\|einja-backend-architecture\|einja-playwright-mcp" .claude/ docs/ README.md CLAUDE.md packages/cli/scripts/`
4. 新しい docs ファイルが正しく配置されていること
5. `docs/einja/steering/README.md` のリンクが有効であること

---

## 変更ファイルサマリー

| 操作 | ファイル |
|------|---------|
| **新規作成** | `docs/einja/steering/development/coding-standards.md` |
| **新規作成** | `docs/einja/steering/development/component-design.md` |
| **新規作成** | `docs/einja/steering/development/playwright-guidelines.md` |
| **編集** | `.claude/agents/einja/task/task-executer.md` |
| **編集** | `.claude/skills/einja-project-overview/SKILL.md` |
| **編集** | `.claude/skills/einja-skill-creator/SKILL.md` |
| **編集** | `CLAUDE.md` |
| **編集** | `README.md` |
| **編集** | `docs/einja/steering/README.md` |
| **編集** | `packages/cli/scripts/copy-presets.mjs` |
| **削除** | `.claude/skills/einja-api-development/` (1ファイル) |
| **削除** | `.claude/skills/einja-backend-architecture/` (1ファイル) |
| **削除** | `.claude/skills/einja-frontend-development/` (1ファイル) |
| **削除** | `.claude/skills/einja-coding-standards/` (5ファイル) |
| **削除** | `.claude/skills/einja-component-design/` (4ファイル) |
| **削除** | `.claude/skills/einja-playwright-mcp/` (1ファイル) |
| **削除** | `packages/cli/presets/default/.claude/skills/` 対応5ディレクトリ |
