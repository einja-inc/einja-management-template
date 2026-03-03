# Plan: `@einja:seed` → `@einja:project-private` リネーム＋機能拡張

## Context

einja CLIのsync機能で配布されるmdファイルに、利用者が「プロジェクト固有コンテンツ」を追記できる領域を明示的に提供したい。

**現状の問題:**
- `@einja:seed` はマーカー名が機能を表していない（「種」より「プロジェクト固有領域」が正しい）
- 一部ファイル（新規3ファイル等）にseedセクションがない
- `.claude/` 配下にマーカーがなく、利用者がどこに追記できるか不明
- seedのみ（managedなし）だと本文がunmanaged扱いになりテンプレート更新が反映されない

**解決策:**
1. `@einja:seed` → `@einja:project-private` に完全リネーム
2. 利用者リポジトリの旧マーカーはsync時に自動マイグレーション
3. managedなしファイルでも使えるよう挙動を拡張
4. `.claude/` 配下の全配布対象ファイルにproject-privateセクション追加

## 挙動

### managed + project-private（docs/einja/ 等）
従来のseedと同じ。マーカーベース処理内でローカル版を保持。

### project-privateのみ（managedなし。.claude/ 等）— 新規挙動
```
1. base版・テンプレート・ローカルの3つからproject-privateセクションを抽出
2. 残りの本文を3方向マージで処理（テンプレート更新が反映される）
3. ローカル版のproject-privateセクションをファイル末尾に再付加
4. ローカルにproject-privateがなければテンプレート版をseed（マーカーペアが存在すれば空でも「存在する」扱い）
```

### 自動マイグレーション
sync時にローカルファイルで `@einja:seed` を検出したら、処理前に自動で `@einja:project-private` にリネーム。

## 変更対象ファイル

### Phase 1: sync engine リネーム＋拡張

| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/types/sync.ts` | `MarkerSectionType` の `"seed"` → `"project-private"`。`MarkerErrorType` の `"seed_without_id"` → `"project_private_without_id"`。`JsonPathsConfigSchema` の `seed` → `project-private`（キー名変更） |
| `packages/cli/src/lib/sync/marker-processor.ts` | 全パターンの `seed` → `project-private` 置換。`extractProjectPrivateSections(content)` / `reattachProjectPrivateSections(content, sections)` / `hasManagedMarkers(content)` メソッド追加。`migrateLegacySeedMarkers(content)` メソッド追加（自動マイグレーション用） |
| `packages/cli/src/lib/sync/seed-synchronizer.ts` → **`project-private-synchronizer.ts`** にリネーム | クラス名・メソッド名リネーム + managedなしファイル用の同期ロジック追加 |
| `packages/cli/src/lib/sync/json-processor.ts` | `isPathSeed()` → `isPathProjectPrivate()` 等、seed参照12箇所をリネーム |
| `packages/cli/src/commands/sync.ts` | import変更、`hasMarkers()` の `seed` → `project-private`、managedなしファイルの分岐追加、マイグレーション処理の呼び出し |
| `packages/cli/src/lib/sync/metadata-manager.ts` | `.einja-sync.json` のマイグレーション処理追加（`jsonPaths.seed` → `jsonPaths["project-private"]`） |

### Phase 2: テスト リネーム＋追加

| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/lib/sync/marker-processor.test.ts` | 全テストの `seed` → `project-private` + 抽出・再付加テスト追加 + マイグレーションテスト追加 |
| `packages/cli/src/lib/sync/integration.test.ts` | seed → project-private + managedなしファイルの統合テスト追加（下記シナリオ） |
| `packages/cli/src/lib/sync/metadata-manager.test.ts` | seed参照置換 + .einja-sync.jsonマイグレーションテスト |
| `packages/cli/src/lib/sync/conflict-reporter.test.ts` | seed参照があれば置換 |
| `packages/cli/src/lib/sync/json-processor.test.ts`（存在すれば） | seed参照置換 |

**統合テストシナリオ:**
- 初回sync: project-privateのみファイル → テンプレート全体がコピーされる
- 2回目sync: テンプレート本文変更 → 3方向マージで本文更新、project-private保持
- 2回目sync: ローカル本文も変更 → 3方向マージでコンフリクト検出、project-private保持
- project-private空セクションの処理（マーカーペアのみ → 存在扱い）
- 旧 `@einja:seed` マーカー → 自動マイグレーション → 正常処理

### Phase 3: create-einja-app対応

| ファイル | 変更内容 |
|---------|---------|
| `packages/create-einja-app/src/utils/merger.ts` | ローカル `MarkerSection` 型、`parseStartMarker()`、`parseEndMarker()` 含め `seed` → `project-private` 置換 + managedなしファイル対応 |
| `packages/create-einja-app/tests/unit/utils/merger.test.ts` | テスト置換＋追加 |

### Phase 4: 配布対象ファイルのマーカー更新

#### 4-a: 既存26ファイルの `@einja:seed` → `@einja:project-private` 置換

`docs/einja/steering/`, `docs/einja/instructions/`, `docs/einja/memory/` 配下の全seedマーカー付きファイル

#### 4-b: seedセクション未設置の3ファイルに新規追加

| ファイル | ID |
|---------|-----|
| `docs/einja/steering/development/coding-standards.md` | `coding-standards-project` |
| `docs/einja/steering/development/component-design.md` | `component-design-project` |
| `docs/einja/steering/development/playwright-guidelines.md` | `playwright-guidelines-project` |

#### 4-c: .claude/skills/einja-*/（SKILL.mdのみ、11ファイル）

末尾にproject-privateセクション新規追加。ID: `{skill名}-project`

#### 4-d: .claude/agents/einja/（全17ファイル）

末尾にproject-privateセクション新規追加。ID: `{agent名}-project`

#### 4-e: .claude/commands/einja/（全7ファイル）

末尾にproject-privateセクション新規追加。ID: `{command名}-project`

#### 4-f: CLAUDE.md

`@einja:excluded` セクションの直前にproject-privateセクション追加（ID: `claude-md-project`）

#### 4-g: skill-creatorのドキュメント例示更新

`.claude/skills/einja-skill-creator/SKILL.md` と `scripts/init_skill.py` 内のseed例示をproject-privateに更新

#### 4-h: ドキュメント内のseed参照更新

| ファイル | 内容 |
|---------|------|
| `packages/cli/docs/MARKER_SPECIFICATION.md`（存在すれば） | seed → project-private |
| `packages/cli/README.md` | seed参照があれば更新 |
| `packages/create-einja-app/README.md` | seed参照があれば更新 |
| CHANGELOG内のseed参照 | 歴史的記録のため**据え置き** |

### Phase 5: ビルド＋最終確認

1. `pnpm --filter @einja/dev-cli build` でpresets/defaultに反映
2. `pnpm prepush`（lint + typecheck + test）
3. `grep -r "@einja:seed" --include="*.ts" --include="*.md" --include="*.py" --include="*.json" --include="*.yml"` — seed残存なし確認（CHANGELOG除く）

## project-privateセクションの共通フォーマット

```markdown
---

<!-- @einja:project-private:start id="{ID}" -->
## プロジェクト固有の設定

<!-- このセクションはプロジェクト固有の内容を追記する場所です -->
<!-- einja syncで上書きされません -->
<!-- @einja:project-private:end -->
```

## 除外対象（project-privateを追加しない）

| ファイル | 理由 |
|---------|------|
| `.claude/skills/einja-*/references/*.md` | リファレンス資料 |
| `.claude/skills/einja-*/templates/*.md` | テンプレート定義 |
| `docs/einja/example/**/*.md` | サンプル教材 |
| `docs/einja/templates/README.md` | テンプレートREADME |

## 検証方法

1. `pnpm --filter @einja/dev-cli test` — CLIの全テストパス
2. `pnpm --filter create-einja-app test` — create-einja-appの全テストパス
3. `pnpm prepush` — lint + typecheck + test パス
4. `grep -r "@einja:seed" --include="*.ts" --include="*.md" --include="*.py" --include="*.json" --include="*.yml"` — seed残存なし（CHANGELOG除く）
5. 統合テストシナリオ（Phase 2参照）
