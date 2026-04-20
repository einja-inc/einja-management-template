---
name: _einja-epic-contract-validator
description: >-
  Epic契約ファイル（epic-manifest.json / 各Issueのscope.md / resume-state.json）の
  構造検証を行うインナーSkill。JSON Schema準拠、ID一意性、AC/Feature/依存DAG整合、
  UI割当整合、永続マーカー検証などを決定論的に実施し、PASS/WARNING/FAILURE判定を返却。
  LLMレビュー項目（Issue縦切り独立性、AC検証可能性等）は本Skillの対象外（einja-review-spec側）。
  einja-epic-spec-createから呼び出される内部Skill。
  Do NOT use for: Issue縦切り独立性の主観判定（einja-review-spec）、仕様書内容のレビュー、実装コードレビュー
user-invocable: false
allowed-tools: [Bash, Read, Grep, Glob]
---

# _einja-epic-contract-validator

Epic契約ファイル（`epic-manifest.json` / 各Issueの `scope.md` / `resume-state.json` / `operationLog` / 永続マーカー）の**構造検証（決定論）**を担うインナーSkill。`einja-epic-spec-create` から呼び出され、PASS / WARNING / FAILURE の判定を返却する。

## 1. 責務

### 本Skillが扱う範囲（決定論的な構造検証のみ）

- JSON Schema 準拠検証（`docs/einja/templates/epic-specs/schemas/` 配下）
- JSON Schema では表現困難な相互整合性検証（ID一意性、AC一意割当、依存DAG、双方向参照整合 等）
- 永続マーカーの形式検証（正規表現）
- `idempotencyKey` / `questionId` / `fingerprint` の形式検証
- `schemaVersion` の互換性検証（major 一致必須、minor 追加は warning）

### 本Skillが扱わない範囲（LLMレビューへ委譲）

以下の「主観判断」が必要な項目は `einja-review-spec` に委譲する。本Skillは構造整合性のみを確認する。

- Issue 縦切り独立性（デプロイ・テスト可能な単位か）の妥当性
- Feature / Story 分割の粒度妥当性
- AC の検証可能性・網羅性
- 仕様書本文（requirements.md / design.md / scope.md 本文）の内容レビュー

組み合わせの全体像:
- **`_einja-epic-contract-validator`**（本Skill）: 構造検証 = 「**形式**が正しいか」
- **`einja-review-spec`**: LLMレビュー = 「**内容**が妥当か」

両者の結果を `einja-epic-spec-create` が統合して承認ゲートに使用する。

## 2. 入力

| 入力形態 | 内容 |
|---------|------|
| Epicディレクトリパス（推奨） | `docs/specs/epics/{epic-slug}/` — 配下の `epic-manifest.json`、各Issueの `scope.md` と `resume-state.json`、`question-broker.json` をまとめて検証する |
| 個別ファイルパス | `--manifest <path>` / `--scope <path>` / `--resume-state <path>` / `--broker <path>` の単独指定も可。既存ファイルのみ検証対象とする |

スキーマファイルは `docs/einja/templates/epic-specs/schemas/` を参照:

- `epic-manifest.schema.json`
- `scope-frontmatter.schema.json`
- `resume-state.schema.json`
- `operation-log-entry.schema.json`（`resume-state.schema.json` から `$ref` 参照）
- `question-broker.schema.json`
- `persistent-marker.schema.json`

関連規約ドキュメント:

- `docs/einja/templates/epic-specs/persistent-marker-spec.md`
- `docs/einja/templates/epic-specs/id-conventions.md`

## 3. 検証項目一覧（決定論）

### 3.1 schemaVersion 互換性

| 条件 | 判定 |
|-----|------|
| `epic-manifest.json` の `schemaVersion` が manifest スキーマの `const` と不一致 | FAILURE |
| `scope.md` frontmatter の `schemaVersion` と manifest の `schemaVersion` の **major** が不一致（例: manifest=1.0 / scope=2.0） | FAILURE |
| major 一致・minor のみ差異（例: manifest=1.0 / scope=1.1）かつ追加キーが互換拡張 | WARNING（未知keyをエラーにせずログ出力） |
| `resume-state.json` の `schemaVersion` が manifest と major 不一致 | FAILURE |
| 永続マーカーの `schema=1.0` 以外（例: `schema=2.0`） | FAILURE |

v1 系は `1.0` 固定。`1.1` 以降は後方互換を保つ。

### 3.2 ID 一意性

Epic 単位で以下の ID の一意性を確認する。重複検出は FAILURE。

| ID 種別 | 正規表現 | スコープ |
|--------|---------|---------|
| `epicId` | `^EPIC-\d+$` | Epic 単位で唯一 |
| `features[].id` | `^F-\d+$` | Epic 内で一意 |
| `issues[].slug` | `^[a-z0-9-]+$` | Epic 内で一意 |
| `acceptanceCriteria[].id` | `^AC-\d+$` | Epic 内で一意 |
| `uiFrames[].id`（存在時） | `^[a-z0-9-]+$`、`minLength: 1` | Epic 内で一意 |
| `transitions[].id`（存在時） | `^TR-\d+$` | Epic 内で一意 |

### 3.3 割当整合性

| 項目 | 判定 |
|-----|------|
| 各 `features[]` エントリの `issueSlug` が `issues[].slug` に存在する | 不存在 → FAILURE |
| 各 `features[]` が最低 1 つの Issue に割り当てられている（= `issueSlug` が有効） | 未割当 → FAILURE |
| 各 AC がちょうど 1 Issue に所有される（`acceptanceCriteria[].ownerIssueSlug` と `issues[].acIds` が双方向整合） | 未割当・重複割当いずれも FAILURE |
| 各 Issue が最低 1 つの AC を持つ（`issues[].acIds.length >= 1`） | 空配列 → FAILURE（スキーマ側 `minItems: 1` でも検出可） |
| `issues[].featureIds` の各値が `features[].id` に存在 | 不存在 → FAILURE |
| `issues[].storyIds` の各値が `features[].storyIds` いずれかに存在 | 不存在 → FAILURE |

### 3.4 依存 DAG

| 項目 | 判定 |
|-----|------|
| `issues[].dependsOn` の参照先 slug が `issues[].slug` に存在する | 不存在 → FAILURE |
| 依存関係が有向非循環グラフ（topological sort 可能） | 循環検出 → FAILURE |
| 自己依存（`slug in dependsOn`） | FAILURE |

循環検出は Kahn のアルゴリズム（入次数ベース）または深さ優先探索で実施。

### 3.5 scope.md 整合

| 項目 | 判定 |
|-----|------|
| `issues[].scopePath` のファイルが実在 | 不在 → FAILURE |
| `scope.md` に YAML frontmatter が存在し、`scope-frontmatter.schema.json` に準拠 | 欠落・違反 → FAILURE |
| `scope.md` frontmatter の `schemaVersion` と manifest の `schemaVersion` が major 一致 | 不一致 → FAILURE |
| `scope.md` frontmatter の `epicId` が manifest `epicId` と一致 | 不一致 → FAILURE |
| `scope.md` frontmatter の `issueSlug` が manifest `issues[].slug` と一致 | 不一致 → FAILURE |
| `scope.md` frontmatter の `featureIds` / `storyIds` / `acIds` / `dependsOn` が manifest の当該 Issue エントリと**集合として一致**（順序は問わない） | 不一致 → FAILURE |
| `scope.md` frontmatter の `uiFrameIds` / `transitionIds`（存在時）が manifest と集合として一致 | 不一致 → FAILURE |
| `scopePath` のパターン `docs/specs/epics/{epic-slug}/issues/{issue-slug}/scope.md` が manifest `slug` / `issues[].slug` と一致 | 不一致 → FAILURE |

### 3.6 UI 割当整合（任意フィールド、存在時のみ検証）

`hasUI: false` かつ `uiFrames` / `transitions` が未定義の場合はスキップ。以下は定義されている場合のみ検証する。

| 項目 | 判定 |
|-----|------|
| `issues[].uiFrameIds` の参照先が `uiFrames[].id` に存在 | 不存在 → FAILURE |
| `issues[].transitionIds` の参照先が `transitions[].id` に存在 | 不存在 → FAILURE |
| `transitions[].from` / `transitions[].to` が `uiFrames[].id` に存在 | 不存在 → FAILURE |
| `uiFrames[].ownerIssueSlug` / `transitions[].ownerIssueSlug` が `issues[].slug` に存在 | 不存在 → FAILURE |
| `hasUI: true` なのに `uiFrames` / `transitions` が空配列または未定義 | WARNING（UIなしEpicへの切替推奨） |
| `hasUI: false` なのに `uiFrames` / `transitions` が非空 | FAILURE（整合性崩れ） |

### 3.7 永続マーカー / 冪等キー検証（resume-state.operationLog が存在する場合）

各 `operationLog[]` エントリに対して:

| 項目 | 判定 |
|-----|------|
| `persistentMarker` が正規表現 `^<!-- einja:epic-id=EPIC-\d+ issue-slug=([a-z0-9-]+\|null) kind=(issue-spec\|issue-spec-pr\|tracker\|epic-pr\|milestone) schema=1\.0 -->$` に一致 | 不一致 → FAILURE |
| `idempotencyKey` が `^EPIC-\d+:([a-z0-9-]+\|null):(issue-spec\|issue-spec-pr\|tracker\|epic-pr\|milestone)$` に一致 | 不一致 → FAILURE |
| `idempotencyKey` の `{epicId}` 部分が manifest の `epicId` と一致 | 不一致 → FAILURE |
| `idempotencyKey` の `{issueSlug}` 部分が `null` または manifest `issues[].slug` に存在 | 不在 → FAILURE |
| Epic 全体リソース（`kind` ∈ `tracker` / `epic-pr` / `milestone`）では `issueSlug` 部分が `null` | 非 null → FAILURE |
| Issue 単位リソース（`kind` ∈ `issue-spec` / `issue-spec-pr`）では `issueSlug` 部分が非 null | null → FAILURE |
| `persistentMarker` 内の `epic-id` / `issue-slug` / `kind` が `idempotencyKey` と整合 | 不整合 → FAILURE |
| `status=failed` かつ `error=null` | FAILURE（スキーマ違反） |
| `status=failed` かつ `error.retryable=false` | WARNING（PENDING_QUESTIONS 昇格対象の注意） |

### 3.8 question-broker.json 検証（存在する場合）

**ファイル全体の構造検証**:

| 項目 | 判定 |
|-----|------|
| ルートが `{ "schemaVersion": "1.0", "questions": [...] }` の object 形式 | 違反 → FAILURE |
| `question-broker.schema.json` に準拠（ajv-cli で検証） | 違反 → FAILURE |

**`.questions[]` 各エントリの検証**:

| 項目 | 判定 |
|-----|------|
| `questionId` が `^Q-[a-f0-9]{12}$` | 不一致 → FAILURE |
| `fingerprint` が `^[a-f0-9]{64}$` | 不一致 → FAILURE |
| `appliesToIssueSlugs` の各値が manifest `issues[].slug` に存在 | 不在 → FAILURE |
| `sourceIssueSlug` が null または manifest `issues[].slug` に存在 | 不在 → FAILURE |
| 同一 `fingerprint` のエントリが重複登録されていない | 重複 → WARNING |
| `status=answered` エントリに `answer` が null | FAILURE |

## 4. 実行方法

### 4.1 ツール選定

JSON Schema 検証には `ajv-cli` / `ajv`（Node.js）を推奨。相互整合検証は jq + Bash スクリプトで補完する。プロジェクト内で利用可能なツールに応じて実装者が選択してよい。

代表的な実装パターン:

| 役割 | 推奨ツール | 備考 |
|------|----------|------|
| JSON Schema 検証 | `ajv-cli`（`npx ajv-cli`）または Node.js `ajv` パッケージ | Draft 2020-12 対応、`$ref` 解決可 |
| 相互整合検証 | jq + Bash（`Read` / `Grep` / `Glob` / `Bash`） | ID 一意性、参照整合、DAG 循環等 |
| YAML frontmatter 抽出 | `Bash`（`sed` / `awk` / Node.js 一行スクリプト）＋ YAML → JSON 変換 | `js-yaml` 等。frontmatter を JSON 化して JSON Schema で検証 |
| DAG 循環検出 | Node.js 一行スクリプト | Kahn / DFS |

### 4.2 実行手順（疑似コード）

```bash
# 0. 入力解決
EPIC_DIR="docs/specs/epics/{epic-slug}"
MANIFEST="$EPIC_DIR/epic-manifest.json"
SCHEMA_DIR="docs/einja/templates/epic-specs/schemas"

# 1. JSON Schema 検証（ajv-cli）
npx ajv-cli validate \
  -s "$SCHEMA_DIR/epic-manifest.schema.json" \
  -d "$MANIFEST" \
  --strict=true --all-errors --spec=draft2020

# 2. 各 scope.md の frontmatter 抽出と検証
for SCOPE in "$EPIC_DIR"/issues/*/scope.md; do
  # frontmatter を YAML → JSON 変換して一時ファイルへ
  node -e "const yaml=require('js-yaml');const fs=require('fs'); \
    const m=fs.readFileSync('$SCOPE','utf8').match(/^---\n([\s\S]*?)\n---/); \
    if(!m){process.exit(1);} \
    process.stdout.write(JSON.stringify(yaml.load(m[1])));" > /tmp/scope-fm.json

  npx ajv-cli validate \
    -s "$SCHEMA_DIR/scope-frontmatter.schema.json" \
    -d /tmp/scope-fm.json \
    --strict=true --all-errors --spec=draft2020
done

# 3. resume-state.json が存在すれば検証
for STATE in "$EPIC_DIR"/issues/*/resume-state.json; do
  [[ -f "$STATE" ]] || continue
  npx ajv-cli validate \
    -s "$SCHEMA_DIR/resume-state.schema.json" \
    -r "$SCHEMA_DIR/operation-log-entry.schema.json" \
    -d "$STATE" \
    --strict=true --all-errors --spec=draft2020
done

# 4. question-broker.json が存在すれば検証
BROKER="$EPIC_DIR/question-broker.json"
if [[ -f "$BROKER" ]]; then
  npx ajv-cli validate \
    -s "$SCHEMA_DIR/question-broker.schema.json" \
    -d "$BROKER" \
    --strict=true --all-errors --spec=draft2020
fi

# 5. 相互整合検証（jq + Node.js スクリプト）
#   - ID 一意性
#   - AC ちょうど 1 Issue 所有（ownerIssueSlug ↔ issues[].acIds 双方向）
#   - features[].issueSlug の参照整合
#   - dependsOn の参照整合 + DAG 循環
#   - scope.md frontmatter と manifest の集合一致
#   - UI フィールド整合（hasUI との整合含む）
#   - operationLog の永続マーカー / idempotencyKey 形式検証
```

### 4.3 集計と判定

全検証項目のうち:

- FAILURE が 1 件以上 → **FAILURE**
- FAILURE なし、WARNING が 1 件以上 → **WARNING**
- FAILURE / WARNING いずれもなし → **PASS**

## 5. 出力形式

以下の Markdown で結果を返す。`einja-epic-spec-create` 側がパースして承認ゲートに使用する。

```markdown
## Epic契約検証結果

### 判定: PASS | WARNING | FAILURE

#### 対象
- Epic ディレクトリ: docs/specs/epics/{epic-slug}/
- manifest: docs/specs/epics/{epic-slug}/epic-manifest.json
- 検証対象 scope.md: {件数}
- 検証対象 resume-state.json: {件数}
- question-broker.json: {有無}

#### 検証項目チェックリスト
- [✅/⚠️/❌] schemaVersion 互換性（manifest / scope / resume-state / 永続マーカー）
- [✅/⚠️/❌] ID 一意性（epicId / features[].id / issues[].slug / acceptanceCriteria[].id / uiFrames[].id / transitions[].id）
- [✅/⚠️/❌] Feature → Issue 割当（features[].issueSlug 参照整合）
- [✅/⚠️/❌] AC ちょうど 1 Issue 所有（双方向整合）
- [✅/⚠️/❌] Issue 最低 1 AC
- [✅/⚠️/❌] 依存 DAG 循環（topological sort 可能）
- [✅/⚠️/❌] dependsOn 参照整合
- [✅/⚠️/❌] scope.md 存在・frontmatter 準拠・manifest との集合一致
- [✅/⚠️/❌] UI 割当整合（uiFrames / transitions / hasUI 整合、任意フィールド）
- [✅/⚠️/❌] 永続マーカー形式（operationLog[].persistentMarker / idempotencyKey）
- [✅/⚠️/❌] question-broker.json 整合（存在時）

#### FAILURE 項目の詳細
- 項目: {検証項目名}
  - 対象: {ファイルパス / JSONPath}
  - 内容: {何がどう違ったか}
  - 修正方針: {短く）

#### WARNING 項目の詳細（任意）
- 項目: {検証項目名}
  - 対象: {ファイルパス / JSONPath}
  - 内容: {詳細}
  - 推奨アクション: {対応案}

#### LLMレビューへ委譲する項目（本Skill対象外）
- Issue 縦切り独立性の妥当性
- Feature / Story 分割粒度の妥当性
- AC の検証可能性・網羅性
- 仕様書本文の内容レビュー
→ `einja-review-spec` で実施すること。
```

## 6. PASS / WARNING / FAILURE 判定基準

| 判定 | 意味 | Epic側のアクション |
|------|------|------------------|
| **PASS** | 構造整合性に問題なし | 後続フェーズへ進行可 |
| **WARNING** | minor schema 追加、`hasUI:true` なのに UI 未定義、`error.retryable:false` 残存など運用継続可能な注意事項のみ | ユーザー報告のうえ進行可。ただし WARNING 内容を承認ゲートで確認する |
| **FAILURE** | 構造整合性が崩れている | Epic 側で即停止。manifest / scope.md を再生成して再検証。3 回以上失敗した場合は `PENDING_QUESTIONS` に昇格してユーザー判断を仰ぐ |

## 7. LLMレビューへ委譲する項目の明示

本Skillは**構造検証のみ**を扱い、以下は `einja-review-spec` に委譲する:

| 委譲項目 | 理由 |
|---------|------|
| Issue 縦切り独立性（デプロイ・テスト可能な単位か） | 主観的判断が必要。manifest の構造では判定不能 |
| Feature / Story 分割の粒度妥当性 | 粒度の適切さは LLM による全体把握が必要 |
| AC の検証可能性・網羅性 | AC 本文の妥当性は自然文レビューが必要 |
| `scope.md` 本文の説明妥当性 | YAML frontmatter の構造は検証するが、本文内容は検証しない |
| Epic requirements.md / design.md の内容 | 本Skill対象外。`einja-review-spec` で扱う |

構造検証（本Skill）と LLM レビュー（`einja-review-spec`）の結果を `einja-epic-spec-create` が統合して承認ゲートを運用する。

## 8. 使用例

### 8.1 `einja-epic-spec-create` からの呼び出し

```markdown
<!-- einja-epic-spec-create の内部 -->

### Step 1.5: Epic契約検証

以下の Skill を呼び出して構造検証を実施する:

Skill: `_einja-epic-contract-validator`
args: Epic ディレクトリ `docs/specs/epics/{epic-slug}/` を対象に、manifest / 全 scope.md / resume-state（存在時）/ question-broker（存在時）を検証してください。

判定が:
- PASS → Step 2 へ進行
- WARNING → ユーザーに警告内容を報告のうえ Step 2 へ進行（承認ゲート1で確認）
- FAILURE → manifest / scope.md を再生成（attemptCounts.contractValidator 2 回まで）。3 回失敗で `PENDING_QUESTIONS` に昇格。
```

### 8.2 個別ファイル検証（デバッグ用途）

```markdown
Skill: `_einja-epic-contract-validator`
args: 以下の単一 scope.md のみ frontmatter 準拠と manifest 整合を検証してください。
  - scope: docs/specs/epics/user-profile-settings/issues/profile-view-edit/scope.md
  - manifest: docs/specs/epics/user-profile-settings/epic-manifest.json
```

## 9. 実装時の注意

- **スキーマの `$ref` 解決**: `resume-state.schema.json` は `operation-log-entry.schema.json` を相対 `$ref` で参照する。`ajv-cli` 使用時は `-r` で明示的に参照スキーマを読ませる。
- **YAML frontmatter の抽出**: `scope.md` 冒頭の `---` ... `---` ブロックのみを取り出し、JSON 化してから JSON Schema で検証する。
- **集合比較**: `featureIds` / `storyIds` / `acIds` / `dependsOn` / `uiFrameIds` / `transitionIds` は順序を問わず要素の集合として比較する（並び替えて比較、重複検出も含む）。
- **エラーメッセージの集約**: `ajv-cli` は `--all-errors` を付けて全エラーを収集する（デフォルトは最初のエラーで停止）。
- **静かな失敗の禁止**: FAILURE 項目は必ず対象ファイルパス・JSONPath・違反内容を出力する。サマリだけで済ませない。
- **読み取り専用**: 本 Skill は検証のみ行い、ファイルを書き換えない。修正は呼出側（`einja-epic-spec-create`）の責務。

## 10. 依存情報

- JSON Schema 群: `docs/einja/templates/epic-specs/schemas/`
- 永続マーカー仕様: `docs/einja/templates/epic-specs/persistent-marker-spec.md`
- ID 命名規約: `docs/einja/templates/epic-specs/id-conventions.md`
- サンプル: `docs/einja/templates/epic-specs/samples/epic-manifest.sample.json`, `scope.sample.md`, `resume-state.sample.json`
