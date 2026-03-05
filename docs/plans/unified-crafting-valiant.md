# Plan: Skill命名規則の文書化 + 配布制御のプレフィックスベース化

## Context

- `/skills` 表示でSkill名が不統一（`einja-` 付き・なしが混在）
- 配布制御が `copy-presets.mjs` のホワイトリスト方式で、命名規則と連動していない
- `einja-` 付きだが配布されていないSkillが12個ある

命名規則を文書化し、配布制御をプレフィックスベースに統一する。

## 設計方針

### 命名規則

| 区分 | ディレクトリ名 | name フィールド | 配布 |
|------|--------------|----------------|------|
| ユーザー向け | `einja-{name}/` | `einja-{name}` | される |
| インナー（内部参照用） | `_einja-{name}/` | `_einja-{name}` | される |
| リポジトリ固有 | `{name}/` | `{name}` | されない |

**ポイント**: `_` プレフィックスはインナーSkillの目印だが、`_einja-` は配布対象。
`copy-presets.mjs` の既存 `_` フィルタ（L246-248）はファイルレベルで適用されるが、
Skillディレクトリの選択は別ロジック（`einja-*` OR `_einja-*` マッチ）で行うため衝突しない。

### 配布制御

`copy-presets.mjs` のSkillホワイトリストを廃止し、`.claude/skills/` をスキャンして
`einja-*` および `_einja-*` ディレクトリを自動コピーする方式に変更。

## 変更内容

### TODO-1: einja-skill-creator/SKILL.md に命名規則セクションを追加

**ファイル**: `.claude/skills/einja-skill-creator/SKILL.md`

L62-66（`name` フィールド説明）を拡充:
```
- **name**: Skill識別子。ディレクトリ名と一致させること
  - インナーSkill（他Skillから内部的に参照される、プロトコル定義、出力テンプレート等）
    は `_` プレフィックスをつける（例: `_einja-output-format`）
  - プロジェクト固有のSkillには名前空間プレフィックスをつけない
  - プロジェクトの名前空間プレフィックスはCLAUDE.mdに定義される
```

L72-81（構造例）にプレフィックスの説明を追加。

### TODO-2: CLAUDE.md のexcludedセクションにSkill命名規則を追加

**ファイル**: `CLAUDE.md`（`@einja:excluded` セクション内）

追加する内容:
- Skill作成時は `einja-` プレフィックスをつける（配布対象にするため）
- インナーSkillは `name` フィールドに `_einja-` をつける
- 配布しないリポジトリ固有Skillはプレフィックスをつけない
- 配布制御はディレクトリ名の `einja-` プレフィックスで自動判定

### TODO-3: 配布されていない12個のSkillの name フィールド統一

現在 `einja-` ディレクトリだが `name` にプレフィックスがないSkillを修正。
`copy-presets.mjs` のプレフィックスベース化により全て配布対象になる。

**ユーザー向け（name に `einja-` を追加）: 5個**

| ファイル | 現在の name | 修正後 name |
|---------|-----------|--------|
| `einja-conflict-resolver/SKILL.md` | `conflict-resolver` | `einja-conflict-resolver` |
| `einja-infra-maintenance/SKILL.md` | `infra-maintenance` | `einja-infra-maintenance` |
| `einja-task-commit/SKILL.md` | `task-commit` | `einja-task-commit` |
| `einja-task-qa/SKILL.md` | `task-qa` | `einja-task-qa` |
| `einja-team-exec/SKILL.md` | `team-exec` | `einja-team-exec` |

**インナー（ディレクトリを `_einja-*` にリネーム + name 修正）: 4個**

| 現在のディレクトリ | リネーム後 | name 修正後 |
|---|---|---|
| `einja-output-format/` | `_einja-output-format/` | `_einja-output-format` |
| `einja-project-overview/` | `_einja-project-overview/` | `_einja-project-overview` |
| `einja-general-context-loader/` | `_einja-general-context-loader/` | `_einja-general-context-loader` |
| `einja-spec-context-loader/` | `_einja-spec-context-loader/` | `_einja-spec-context-loader` |

**ディレクトリリネームに伴う参照パス更新**:
- `CLAUDE.md` L139: `einja-project-overview` → `_einja-project-overview`
- `.claude/skills/cli-package-specs/SKILL.md` L136: 配布Skill例の更新
- `.claude/skills/einja-task-exec/SKILL.md` L128: `einja-general-context-loader` → `_einja-general-context-loader`
- **エージェントの `skills:` フロントマター更新（重要）**: `output-format` → `_einja-output-format`
  - `.claude/agents/einja/frontend-coder.md`
  - `.claude/agents/einja/backend-architect.md`
  - `.claude/agents/einja/codex-agent.md`
  - `.claude/agents/einja/design-engineer.md`
  - `.claude/agents/einja/frontend-architect.md`
- 各SKILL.md内の `@einja:project-private` マーカーID（機能に影響なし、整合性のため更新推奨）

### TODO-4: copy-presets.mjs をプレフィックスベースに改修

**ファイル**: `packages/cli/scripts/copy-presets.mjs`

変更内容:
- L62-101のSkill個別マッピング（8エントリ）を削除
- `.claude/skills/` をスキャンし、`einja-*` または `_einja-*` にマッチするディレクトリを**個別のmappingエントリとして動的に追加**するロジックに置き換え
  - **重要**: `.claude/skills/` 全体を1エントリとして `copyDir` に渡す方法はNG（`_einja-*` が `_` フィルタで弾かれる）。各Skillディレクトリを個別エントリとして追加すること
- 既存の `_` プレフィックスフィルタ（L246-248）はそのまま維持（エントリ内のファイルレベルフィルタとして機能）
- **cleanup**: スキャン前に `presets/default/.claude/skills/` 全体を削除してからコピーする（旧ディレクトリの残留防止）

### TODO-4b: file-copier.ts のプレフィックスフィルタを `_einja-` にも対応

**ファイル**: `packages/cli/src/lib/preset-update/file-copier.ts` L194-195, L254

現在: `prefixFilter` が `string` 型で `"einja-"` 固定
修正: `entry.startsWith("einja-") || entry.startsWith("_einja-")` の OR 条件に変更。
`prefixFilter` の型を `string` → `string[]` に変更するか、カスタムフィルタ関数に置き換え

### TODO-5: cli-package-specs ディレクトリリネーム

`cli-package-specs` はリポジトリ固有Skillなのでプレフィックスなしのまま維持。
ただし `name` フィールドが `cli-package-specs` のままでOK（配布されない）。
→ **変更不要**

### TODO-6: CLAUDE.md のCLIパッケージ二重管理テーブル注釈更新

**ファイル**: `CLAUDE.md` L252
現在: `.claude/skills/einja-*/` → 単純コピー
修正: 「einja-* プレフィックスのディレクトリを自動スキャンしてコピー」に注釈更新

### TODO-7: CLAUDE.md の cli-package-specs 参照パス

変更なし（ディレクトリリネームしないため）

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `.claude/skills/einja-skill-creator/SKILL.md` | 命名規則セクション追加 |
| `CLAUDE.md` | excludedセクションに命名規則追加 + L139,L252更新 |
| `.claude/skills/einja-*/SKILL.md` × 5 | ユーザー向け: name に einja- 追加 |
| `.claude/skills/einja-*/SKILL.md` × 4 | インナー: name に _einja- 設定 |
| `.claude/skills/einja-{4個}` → `_einja-{4個}` | インナーSkillのディレクトリリネーム |
| `.claude/skills/cli-package-specs/SKILL.md` | L136 参照パス更新 |
| `.claude/skills/einja-task-exec/SKILL.md` | L128 参照パス更新 |
| `packages/cli/scripts/copy-presets.mjs` | Skill配布をプレフィックスベースに改修 |
| `packages/cli/src/lib/preset-update/file-copier.ts` | `_einja-` フィルタ対応追加 |

## 検証

1. `/skills` で全Skillの表示名を確認
   - ユーザー向け: `einja-*` または `einja:*`
   - インナー: `_einja-*`
   - リポジトリ固有: プレフィックスなし
2. `pnpm --filter @einja/dev-cli build` でビルド成功
3. `presets/default/.claude/skills/` の内容確認
   - `einja-*` と `_einja-*` ディレクトリが存在すること
   - `cli-package-specs` が含まれないこと
   - 旧名 `einja-output-format` 等が残留していないこと
4. エージェントの `skills:` 参照が正しくロードされること（`_einja-output-format` の解決確認）
5. `pnpm prepush` が通ること

### 注意事項
- `einja-coding-standards` は SKILL.md がなく `references/` のみの不完全なSkill。プレフィックスベース化でスキャン対象になるが、配布時に問題がないか確認すること
