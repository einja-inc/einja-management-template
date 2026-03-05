# レビューレポート: enchanted-wiggling-ember.md

レビュー実施日: 2026-03-05

---

## 前回指摘事項の反映確認

| 指摘番号 | 内容 | 反映状況 |
|---------|------|---------|
| 1 | 命名の一貫性: `issue-spec-requirements-generator` → 短縮名 | 反映済み（requirements-generator.md 等） |
| 2 | sync-cursor-commands の更新が必要 | TG-2.3 に追加済み |
| 3 | エージェント名の長さ: ディレクトリ名でスコープ担保 | 反映済み（issue-specs/ + 短縮ファイル名） |
| 4 | task-exec リネーム不要 | そのまま維持（妥当） |

前回指摘 4 点はすべて反映されている。

---

## 新たに発見された問題

### 重大（見落とすと壊れる）

#### [CRITICAL-1] copy-presets.mjs の Skill 固定列挙に新Skillが含まれていない

**実態**: `packages/cli/scripts/copy-presets.mjs` の Skill コピーは固定列挙（ハードコード）。
現在の列挙に含まれているのは以下のみ：
- einja-conflict-resolver
- einja-general-context-loader
- einja-output-format
- einja-spec-context-loader
- einja-project-overview
- einja-skill-creator
- einja-task-commit
- einja-task-qa

**問題**: 新規作成される以下の Skill が列挙に入っていないため、ビルド（`pnpm build`）しても `presets/default/` にコピーされない：
- `einja-issue-spec-create`（新規）
- `einja-task-exec`（新規）
- `einja-issue-spec-generator`（リネーム後）
- `einja-issue-spec-validator`（リネーム後）

また、`einja-task-spec-generator` と `einja-task-spec-validator` の **削除エントリ** も必要。

**対処**: Phase 2 の TG として「`copy-presets.mjs` への新 Skill 追加 + 旧 Skill 削除」を追加する必要がある。

#### [CRITICAL-2] issue-exec.md の更新箇所が「2箇所」では足りない

**実態**: `issue-exec.md` の `/einja:task-exec` 参照は **少なくとも3箇所**：
- 103行目: 代替手段の説明
- 206行目: Worker 起動手順の説明
- 394行目: tmux send-keys の実際のコマンド文字列

計画書には「2箇所」と記載されているが、394行目のコマンド文字列が漏れると Worker 起動が壊れる。

**対処**: TG-2.3 の issue-exec.md 更新対象を「全件」に修正すること。

#### [CRITICAL-3] grep 検証パターンに複数の見逃しがある

現在の TG-3.1 grep パターンの欠落：

| 欠落しているチェック | 実際に残存する箇所 |
|--------------------|------------------|
| `agents/specs/`（einja/ なしの短縮形） | sync-cursor-commands.md:54 |
| `.cursor/commands/` 内の旧ファイル残存 | .cursor/commands/update-docs-by-task-specs.md |
| `README.md` 内の旧コマンド参照 | README.md:60 |

また、誤検知ノイズになる箇所（除外が必要）：
- `docs/specs/issues/**/qa-tests/` — 履歴エビデンスなので除外推奨
- `docs/plans/` — 過去計画ファイルなので除外推奨
- `modifications/` — 作業記録なので除外推奨

**対処**: TG-3.1 の grep コマンドを修正し、除外パターンに `docs/specs/` `docs/plans/` `modifications/` `packages/create-einja-app/templates/default/docs/plans/` を追加する。また、`agents/specs/` と `.cursor/commands/` のチェックを追加する。

---

### 中リスク（計画漏れ）

#### [MEDIUM-1] README.md の更新が計画に含まれていない

**実態**: `README.md` 60行目に以下の記述がある：
```
`.claude/commands/` - `/einja:spec-create`, `/einja:task-exec` などのスラッシュコマンド
```

TG-2.5 は CLAUDE.md のみで、README.md が含まれていない。

**対処**: TG-2.5 に README.md を追加する（Skill/コマンドテーブルの記述を更新）。

#### [MEDIUM-2] sync-cursor-commands.md のパス例示が現実と不一致

**実態**: `sync-cursor-commands.md` 54行目：
```
spec-requirements-generator → .claude/agents/specs/spec-requirements-generator.md
```
実際のパスは `.claude/agents/einja/specs/` だが、例示では `agents/specs/` と短縮されている。
リネーム後は `.claude/agents/einja/issue-specs/requirements-generator.md` になる。

TG-2.3 で「エージェントパス agents/specs/ → agents/issue-specs/」と記載されているが、
このパターンで置換すると `agents/einja/specs/` を持つパスには一致しない可能性がある。

**対処**: TG-2.3 の sync-cursor-commands.md 更新で、具体的にどの文字列を何に置換するかを明示すること。

#### [MEDIUM-3] .cursor/commands/update-docs-by-task-specs.md の旧ファイル削除が計画されていない

**実態**: `.cursor/commands/update-docs-by-task-specs.md` が存在する。
`sync-cursor-commands` コマンド再実行で `update-docs-by-issue-specs/RULE.md` が生成されるはずだが、
旧ファイルの **削除** は自動では行われない（スクリプトが削除しない設計の可能性がある）。

**対処**: TG-3.2（ビルド・テスト）の手順に「`.cursor/commands/` 内の旧ファイル手動削除確認」を追加する。

#### [MEDIUM-4] einja-task-spec-generator/SKILL.md と einja-task-spec-validator/SKILL.md のリンクパス変更が2段階になっている

**実態**:
- `einja-task-spec-generator/SKILL.md`:101行目 → `../../agents/einja/specs/spec-tasks-generator.md`
- `einja-task-spec-validator/SKILL.md`:126行目 → `../../agents/einja/specs/spec-tasks-validator.md`

リネーム後（einja-issue-spec-generator/SKILL.md）ではリンクパスを：
1. ディレクトリ: `specs/` → `issue-specs/`
2. ファイル名: `spec-tasks-generator.md` → `tasks-generator.md`

の **両方** を変更する必要がある。TG-2.2 の記述では「エージェント名更新」とのみ書かれており、
パスの `specs/` → `issue-specs/` の変更が明記されていない。

**対処**: TG-2.2 の更新内容に「相対パス内の `specs/` → `issue-specs/` 変更」を明記する。

---

### 更新不要と判断できるもの

| 対象 | 判断 | 理由 |
|-----|------|------|
| `docs/specs/issues/**/qa-tests/` 内の旧語 | 更新不要 | 履歴エビデンスなので変更すると証跡が変わる |
| `docs/plans/` 内の過去計画書の旧語 | 更新不要 | 作業記録。ただし grep 検証からは除外すること |
| `modifications/` 内の旧語 | 更新不要 | 作業記録 |
| テストファイル内の旧パス（テストデータ文字列） | 更新不要 | 単なるサンプルデータとして使用。実ファイルパスを参照していない |
| `packages/cli/presets/default/` 配下 | ビルド後に自動反映 | copy-presets.mjs で上書きされる（ただし Skill の固定列挙更新は必要） |

---

## TG-2.2 の行数確認（Skill ファイル数の計算）

計画書で「TG-2.2: スキル内部参照更新（8ファイル）」とあるが、実際にリストされているのは9行：

1. einja-issue-spec-generator/SKILL.md
2. einja-issue-spec-validator/SKILL.md
3. einja-task-qa/SKILL.md
4. einja-task-qa/references/troubleshooting.md
5. einja-task-qa/references/usage-patterns.md
6. einja-task-commit/SKILL.md
7. einja-general-context-loader/SKILL.md
8. einja-spec-context-loader/SKILL.md
9. einja-skill-first/SKILL.md

ヘッダーは「8ファイル」だが実際は9ファイル。minor な誤りだが修正推奨。

---

## 総合評価

### 反映状況
前回指摘 4 点: 全反映済み。

### 新たなリスク
- **重大**: 3件（CRITICAL-1〜3）
- **中リスク**: 4件（MEDIUM-1〜4）

### 最小修正が必要な計画変更

1. **新規 TG を追加**: `copy-presets.mjs` の Skill 固定列挙更新（CRITICAL-1）
2. **TG-2.3 修正**: issue-exec.md の更新箇所を「全件（少なくとも3箇所）」に修正（CRITICAL-2）
3. **TG-3.1 修正**: grep パターンに `agents/specs/` チェック追加、`.cursor/commands/` チェック追加、除外パターンに `docs/specs/` `docs/plans/` `modifications/` を追加（CRITICAL-3）
4. **TG-2.5 修正**: README.md を追加（MEDIUM-1）
5. **TG-2.3 修正**: sync-cursor-commands.md の置換文字列を具体的に明示（MEDIUM-2）
6. **TG-3.2 修正**: .cursor/commands/ 旧ファイル削除確認を追加（MEDIUM-3）
7. **TG-2.2 修正**: 相対パス内の `specs/` → `issue-specs/` 変更を明記（MEDIUM-4）
8. **ヘッダー修正**: TG-2.2 の「8ファイル」→「9ファイル」（minor）
