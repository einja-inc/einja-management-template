# Plan: einja-skill-advisor → einja-skill-first リネーム影響範囲調査

## Context

`einja-skill-advisor` を `einja-skill-first` にリネームする影響範囲を完全に調査し、変更が必要な箇所を特定する。

## 影響範囲調査結果

### 1. Skillディレクトリと定義ファイル

| ファイルパス | 変更内容 |
|-------------|---------|
| `.claude/skills/einja-skill-advisor/` | ディレクトリ名を `.claude/skills/einja-skill-first/` にリネーム |
| `.claude/skills/einja-skill-advisor/SKILL.md` | ファイルを移動後、内部の `name: einja-skill-advisor` を `name: einja-skill-first` に変更 |
| `.claude/skills/einja-skill-advisor/SKILL.md` (line 2) | `name: einja-skill-advisor` → `name: einja-skill-first` |
| `.claude/skills/einja-skill-advisor/SKILL.md` (line 3-4) | descriptionフィールドのキーワード「skill-advisor」を「skill-first」に変更 |
| `.claude/skills/einja-skill-advisor/SKILL.md` (line 13) | タイトル `# einja-skill-advisor:` → `# einja-skill-first:` |
| `.claude/skills/einja-skill-advisor/SKILL.md` (line 19-26) | テーブル見出し「skill-advisor」を「skill-first」に変更 |
| `.claude/skills/einja-skill-advisor/SKILL.md` (line 45) | キーワードリスト「skill-advisor」を「skill-first」に変更 |
| `.claude/skills/einja-skill-advisor/SKILL.md` (line 237) | project-privateコメントID `einja-skill-advisor-project` → `einja-skill-first-project` |

### 2. CLAUDE.md（プロジェクトルート）

| 行番号 | 現在の記述 | 変更後 |
|-------|-----------|--------|
| 43 | `\| einja-skill-advisor \| 作業前のSkill作成必要性評価（Plan/spec-create時に自動起動） \|` | `\| einja-skill-first \| 作業前のSkill作成必要性評価（Plan/spec-create時に自動起動） \|` |
| 56 | `3. einja-skill-advisor で「Skill を先に作るべきか」を自動評価する` | `3. einja-skill-first で「Skill を先に作るべきか」を自動評価する` |
| 227 | `\| Skill作るべき？ Skill化 skill-advisor Skill-first \| .claude/skills/einja-skill-advisor/SKILL.md \|` | `\| Skill作るべき？ Skill化 skill-first Skill-first \| .claude/skills/einja-skill-first/SKILL.md \|` |

**注意**: 227行目のキーワードトリガーから「skill-advisor」を削除し、「skill-first」のみを残す。

### 3. spec-create.md（コマンド定義）

| 行番号 | 現在の記述 | 変更後 |
|-------|-----------|--------|
| 113 | `einja-skill-advisor Skillを使用して、このタスクに対してSkillを先に作るべきかを自動評価する。` | `einja-skill-first Skillを使用して、このタスクに対してSkillを先に作るべきかを自動評価する。` |

### 4. presets配下（CLI配布用ディレクトリ）

**重要**: 以下のファイルはビルド時に自動的に原本からコピーされるため、**直接編集不要**。原本を修正すればビルド時に反映される。

| ファイルパス | 備考 |
|-------------|------|
| `packages/cli/presets/default/CLAUDE.md.template` | 原本: `CLAUDE.md`（自動変換生成） |
| `packages/cli/presets/default/.claude/commands/einja/spec-create.md` | 原本: `.claude/commands/einja/spec-create.md`（単純コピー） |
| `packages/cli/presets/default/.claude/skills/einja-skill-advisor/` | 原本: `.claude/skills/einja-skill-advisor/`（単純コピー） |

### 5. docs/plans/ 配下（既存計画ファイル）

| ファイル | 行番号/箇所 | 内容 |
|---------|-----------|------|
| `docs/plans/stateful-wishing-lerdorf.md` | 複数箇所 | このファイルはeinja-skill-advisor自体を作成した計画ファイル。参考文書として残すか、アーカイブするかユーザーに確認 |

### 6. 他のSkill定義での参照

検索結果: **参照なし**

`.claude/skills/einja-*/SKILL.md` 内で `skill-advisor` や `einja-skill-advisor` を参照しているSkillは存在しない。

### 7. エージェント定義での参照

検索結果: **参照なし**

`.claude/agents/einja/*.md` 内で `skill-advisor` を参照しているエージェント定義は存在しない。

### 8. descriptionフィールドでのトリガーキーワード

| Skillファイル | 該当行 | 内容 |
|-------------|-------|------|
| `.claude/skills/einja-skill-advisor/SKILL.md` | 3-4行目 | descriptionに「skill-advisor」が含まれる。これを「skill-first」に変更する |

## 変更手順（推奨順序）

### Phase 1: Skillディレクトリのリネーム

1. `.claude/skills/einja-skill-advisor/` を `.claude/skills/einja-skill-first/` にリネーム
2. `SKILL.md` 内の全ての `einja-skill-advisor` / `skill-advisor` を `einja-skill-first` / `skill-first` に置換

### Phase 2: 参照元ファイルの更新

1. `CLAUDE.md` の3箇所を更新（43行目、56行目、227行目）
2. `.claude/commands/einja/spec-create.md` の1箇所を更新（113行目）

### Phase 3: 既存計画ファイルの扱い

1. `docs/plans/stateful-wishing-lerdorf.md` の扱いを決定（アーカイブ or 更新 or 削除）

### Phase 4: ビルド確認

1. CLI配布用ディレクトリ（`packages/cli/presets/default/`）は自動コピーされることを確認
2. ビルドスクリプト実行後、presets配下にも反映されることを確認

## 検証項目

- [ ] `.claude/skills/einja-skill-first/SKILL.md` が正しく配置されている
- [ ] `CLAUDE.md` の全参照が更新されている
- [ ] `spec-create.md` の参照が更新されている
- [ ] `grep -r "skill-advisor" .` で不要な残存参照がないことを確認
- [ ] `grep -r "einja-skill-advisor" .` で不要な残存参照がないことを確認
- [ ] Skill呼び出しが正常に動作する（トリガーキーワード「skill-first」で起動確認）
- [ ] spec-createコマンドからの自動呼び出しが正常に動作する

## 備考

- **presetsディレクトリの自動生成**: CLAUDE.mdの記載により、`.claude/skills/einja-*/` は `presets/default/.claude/skills/einja-*/` に自動コピーされる
- **CLAUDE.md.template**: `CLAUDE.md` から変換生成されるため、原本を修正すれば反映される
- **既存計画ファイル**: `stateful-wishing-lerdorf.md` はeinja-skill-advisor作成時の計画ファイルのため、リネーム影響を受ける
