# screen-flow-url.md スキーマ

`docs/project/screen-flow-url.md` の完全スキーマ仕様と冪等性ポリシーを定義する。SKILL.md ワークフロー Step 10（drawio ファイル保存 + manifest 記録）および Step 11（再生成時の冪等性照合）、§5 エラー処理パターン から参照される。`ui-design-url.md` とフィールド互換だが用途が異なる（プロジェクト全体の画面遷移 vs Issue単位の画面モックアップ）。

enum 値（`layout_strategy` / `edge_kind` / `routing` / `node_kind` / `business_role` / `source_confidence` / `status`）は `references/canonical-enums.md` を Single Source of Truth とする。本ファイルでは引用のみ行い、enum 値を独自定義しない。

**cell_id 命名規則・`toCellId` / `xmlAttr` / `escapeRegExp` 等のヘルパーは `drawio-style-rules.md §1` を SSoT として参照すること。本ファイル内で独自命名規則を提示しない。**

## 1. screen-flow-url.md 完全スキーマ

YAML frontmatter + 2つのリストセクション（`screens` / `edges`）の構成。

```yaml
---
drawio_file_path: docs/project/screen-flow.drawio
drawio_url: ""                        # 任意。drawio.com URL 等、ない場合空文字列
schema_version: 2
generated_at: 2026-05-27
project_name: <kebab-project-name>
layout_strategy: swim-lane            # 任意。canonical-enums §1
role_canonical_map:                   # 任意。表示名 → canonical 識別子
  上長: Manager
  管理者: Manager
  人事部: HR
  システム管理者: Admin
---

## screens

- name: dashboard
  stable_id: <project>__dashboard
  cell_id: "cell-dashboard-1"         # drawio mxCell id 属性値（必須）
  role: 人事部                        # 既存（表示名）
  lane_id: HR                         # 任意（canonical 識別子、manifest が SSoT）
  source_confidence: high             # 任意（クロスチェック由来時のみ）
  status: active   # active | orphan
  position:
    x: 480
    y: 720

## edges

- from: dashboard
  to: settings
  trigger: 設定ボタンクリック
  stable_id: dashboard__to__settings  # 必須。{from}__to__{to} 形式（project_name プレフィックスなし）
                                      # screens[].stable_id とは形式が異なる（screens は {project_name}__{name}）
  cell_id: "cell-edge-dashboard-settings-1"  # drawio mxCell id 属性値（必須）
  edge_kind: primary                  # 任意。canonical-enums §2
  routing: straight                   # 任意。canonical-enums §3
  status: active   # active | orphan
```

### 1.1 frontmatter フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `drawio_file_path` | ✅ | string | drawio ファイルのローカルパス。例: `docs/project/screen-flow.drawio`。再生成時の照合キー |
| `drawio_url` | ⚠️ | string | drawio.com URL 等の外部 URL（任意、ない場合は空文字列 `""`） |
| `schema_version` | ✅ | number | スキーマバージョン（互換性管理用、現行: `2`） |
| `generated_at` | ✅ | date | 最終生成日（`YYYY-MM-DD`） |
| `project_name` | ✅ | string | プロジェクト名（kebab-case、`stable_id` プレフィックスに使用） |
| `layout_strategy` | ⚠️ | string | レイアウト戦略。canonical-enums §1 の enum 値。未指定時のデフォルトは `user-flow`（v3 default）。ただし v1 manifest signature（`schema_version: 1` + `lane_id` 全件 undefined + `position` あり）が検出された場合のみ `grid` 強制（後方互換） |
| `entry_detection_method` | ⚠️（任意） | string | エントリポイント確定方法の識別子。値は `canonical-enums §10 entry-detection-method` enum（`manifest` / `heuristics-name` / `topology-indegree-zero` / `user-confirmed` / `fallback-grid`）。Skill 実行時に自動記録（手動編集不要）。トレーサビリティ用 |
| `role_canonical_map` | ⚠️ | object | 表示名 → canonical 識別子（canonical-enums §5）のマップ。未指定 = `{}` でデフォルト辞書のみ使用 |

### 1.2 screens[] フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `name` | ✅ | string | 画面名（kebab-case） |
| `stable_id` | ✅ | string | 冪等性照合用ID。`{project_name}__{name}` 形式 |
| `cell_id` | ✅ | string | drawio mxCell の id 属性値。`stable_id` と双方向トレース可能（両方必須）。**生成規約は `drawio-style-rules.md §1.5` を SSoT とする**（本ファイルで独自命名規則を定義しない） |
| `role` | ⚠️ | string | 対象ユーザー/ロール（要件§3由来。表示名。複数は `/` 区切り） |
| `lane_id` | ⚠️ | string | canonical 識別子（canonical-enums §5）。manifest が SSoT。未指定時は `role` から `role_canonical_map` 経由で逆引き推定 |
| `source_confidence` | ⚠️ | string | クロスチェック由来時の信頼度。canonical-enums §6。未指定 = `high`（§2 業務フロー由来として扱う） |
| `status` | ✅ | string | `active`（要件にあり） / `orphan`（要件から削除済み） |
| `position` | ⚠️ | object | `{x, y}` 座標。ユーザー手動編集を尊重して保持 |
| `is_entry_point` | ⚠️ | boolean | エントリポイント明示フラグ。デフォルト `false`。manifest 明示が最優先（heuristics より優先）。user-flow レイアウト時に BFS の起点判定で使用 |

### 1.3 edges[] フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `from` | ✅ | string | 遷移元画面の `name` |
| `to` | ✅ | string | 遷移先画面の `name` |
| `trigger` | ✅ | string | 遷移トリガー（例: 「設定ボタンクリック」） |
| `stable_id` | ✅ | string | `{from}__to__{to}` 形式（**project_name プレフィックスなし**。screens[].stable_id とは形式が異なる） |
| `cell_id` | ✅ | string | drawio mxCell の id 属性値。`stable_id` と双方向トレース可能（両方必須）。**生成規約は `drawio-style-rules.md §1.5` を SSoT とする**（本ファイルで独自命名規則を定義しない） |
| `edge_kind` | ⚠️ | string | エッジ種別。canonical-enums §2。未指定時は `inferEdgeKind(trigger)` で trigger キーワード判定 |
| `routing` | ⚠️ | string | 経路種別。canonical-enums §3。未指定 = `straight` |
| `status` | ✅ | string | `active` / `orphan` |

**Note**: `edges` の `stable_id` には `screens` と異なり `project_name` プレフィックスを付けていない。これは本 Skill が「1 drawio ファイル = 1 プロジェクト」を前提としており、ファイル内で `{from}__to__{to}` だけで一意に識別できるため。複数プロジェクトを同一ファイルに混在させる場合は SKILL.md レベルで AskUserQuestion による衝突回避が必要。

**cell_id と stable_id の双方向トレース**: screens/edges 各エントリに `stable_id`（冪等性照合用）と `cell_id`（drawio mxCell id 照合用）を **両方必須**として保持することで、manifest → drawio（cell_id で特定）および drawio → manifest（cell_id 逆引き）の双方向トレースを実現する。

## 2. ui-design-url.md とのフィールド差分

| フィールド | screen-flow-url.md | ui-design-url.md | 互換性 |
|----------|--------------------|-------------------|--------|
| `drawio_file_path` | ✅ | ❌ | 本Skill固有 |
| `drawio_url` | ⚠️ | ❌ | 本Skill固有 |
| `schema_version` | ✅ | ❌ | 本Skill固有 |
| `layout_strategy` | ✅ | ❌ | 本Skill固有 |
| `role_canonical_map` | ✅ | ❌ | 本Skill固有 |
| `screens[]` | ✅ | ❌ | 本Skill固有（プロジェクト全体画面リスト） |
| `edges[]` | ✅ | ❌ | 本Skill固有（画面遷移） |
| `frames[]` | ❌ | ✅ | ui-design-generator 固有（Issue単位の画面モックアップ） |
| `design_target` | ❌ | ✅ | ui-design-generator 固有 |
| `issue_id` | ❌ | ✅ | ui-design-generator 固有 |

**用途の相違**:
- `ui-design-url.md`: Issue単位の画面モックアップ管理（1画面の詳細デザイン、`docs/specs/issues/{cat}/issue{N}-{name}/` 配下）
- `screen-flow-url.md`: プロジェクト全体の画面遷移管理（複数画面の関係性、`docs/project/` 配下）

## 3. 冪等性ポリシー

**目的**: 同一プロジェクトで Skill を複数回実行しても、既存 drawio ファイル上のユーザー手動編集を破壊しないこと。

### 3.1 再生成フロー

1. 既存 `docs/project/screen-flow-url.md` を Read
2. `drawio_file_path` から既存 `.drawio` ファイルを Read（存在する場合）
3. **screens 照合**: 新規生成リスト vs 既存 `screens[]` を `stable_id` で照合
   - 一致 → `cell_id` を流用、既存 `position` を保持（手動レイアウト変更を尊重）
   - 未知の `stable_id` → 新規 mxCell 作成
   - 既存にあって今回ない `stable_id` → `status: orphan` に変更（**自動削除しない**）
4. **edges 照合**: 同様に `stable_id` で照合
   - 未知 → 新規 edge mxCell 作成
   - 削除対象 → `status: orphan`
5. orphan 化された節点について、ユーザー向けに「N 個の画面/エッジが要件定義から削除されました。drawio ファイル上で確認後、不要なら手動削除してください」とログ出力

### 3.2 バックアップ

- 上書き前に `docs/project/screen-flow-url.md.bak` として直前バージョンを退避
- `.bak` は `.gitignore` で除外推奨

### 3.3 衝突ケース

- ユーザーが drawio ファイル上で `cell_id` を持つセルを手動削除した場合 → 再生成時に「missing」検出 → **AskUserQuestion** で次の4択を提示:
  1. **再作成** — manifest と一致するセルを drawio ファイルに復元
  2. **削除を確定** — manifest からも該当エントリを削除
  3. **中止** — 再生成を中止し原因調査
  4. **その他（自由入力）** — 上記以外の対応をユーザーが指示

## 4. Plugin Data Key 移行ユーティリティ

旧 Figma 実装（setSharedPluginData / getSharedPluginData / writeNodeKind / readNodeKind / writeBusinessRole 等）は drawio 化により廃止。drawio では mxCell の `id` / `style` 属性でノード種別・業務ロール情報を代替する。

## 5. v1 / v2 後方互換ルール

`schema_version: 1` 据置のため、新フィールド（`layout_strategy` / `role_canonical_map` / `lane_id` / `source_confidence` / `edge_kind` / `routing`）は全て **任意**（既存 §5 ポリシー踏襲）。

`schema_version: 2` 追加フィールド（`cell_id`）のデフォルト補完は以下の通り:

| フィールド | 未指定時 |
|----------|--------|
| `layout_strategy` | `user-flow`（v1 grid signature 検出時のみ `grid`）として読む |
| `role_canonical_map` | `{}` 空オブジェクト + canonical-enums §5 デフォルト辞書のみ使用 |
| `screens[].lane_id` | `inferLane(role, role_canonical_map)` で逆引き推定 |
| `screens[].source_confidence` | `low`（v2 ブランチ補完時のデフォルト。manifest 明示値が優先） |
| `edges[].edge_kind` | `inferEdgeKind(trigger)`（trigger キーワード判定） |
| `edges[].routing` | `auto`（v2 ブランチ補完時のデフォルト） |

### normalizeManifestV1or2 ユーティリティ

v1（Figma ベース）→ v2（drawio ベース）は必須フィールド名変更を含む破壊的変更であるため、自動マイグレーションは行わない。v1 検出時は AskUserQuestion で確認する。

```javascript
async function normalizeManifestV1or2(raw) {
  const v = raw.schema_version;

  if (v === 1) {
    // v1 (Figma) → v2 (drawio) は破壊的変更（自動マイグレーション不可）
    // AskUserQuestion で確認
    const choice = await AskUserQuestion({
      question: "manifest schema_version: 1 (Figma) が検出されました。drawio 化に伴い再生成が必要です。",
      options: [
        "再生成して drawio 化",         // → _migration_required: true を付与し、Step 3 以降の通常フローで再生成
        "中止",                          // → Skill 終了
        "その他（自由入力）"
      ]
    });
    if (choice === "再生成して drawio 化") {
      return {
        ...raw,
        schema_version: 2,
        _migration_required: true,
        figma_legacy_fields: { // 旧 v1 の Figma フィールドを退避保存（参考用）
          figma_url: raw.figma_url,
          file_key: raw.file_key,
          plan_key: raw.plan_key,
        },
      };
    }
    if (choice === "中止") {
      throw new Error("User aborted v1 → v2 migration");
    }
    // "その他（自由入力）": 親 Skill 側で再計画ハンドリング
    throw new Error("UserRequestsCustomMigration: " + (choice ?? "unknown"));
  }

  if (v === 2) {
    // v2 デフォルト補完（既存ロジック踏襲: layout_strategy / lane_id / source_confidence など）
    // schema_version: 2 では hasV1Signature は呼ばない（v1 専用判定のため）
    // layout_strategy 未指定時のデフォルトは "user-flow"
    return {
      ...raw,
      layout_strategy: raw.layout_strategy ?? "user-flow",  // 推奨デフォルト
      role_canonical_map: raw.role_canonical_map ?? {},
      schema_version: 2,
      screens: (raw.screens ?? []).map(s => ({
        ...s,
        is_entry_point: s.is_entry_point ?? false,
        lane_id: s.lane_id ?? inferLane(s.role, raw.role_canonical_map ?? {}),
        source_confidence: s.source_confidence ?? "low",
        cell_id: (s.cell_id && !s.cell_id.startsWith("PLACEHOLDER"))
          ? s.cell_id
          : toCellId("screen__" + simpleSuffix(s.stable_id)),  // toCellId は drawio-style-rules.md §1.5
      })),
      edges: (raw.edges ?? []).map(e => ({
        ...e,
        edge_kind: e.edge_kind ?? inferEdgeKind(e.trigger),
        routing: e.routing ?? "auto",
        cell_id: (e.cell_id && !e.cell_id.startsWith("PLACEHOLDER"))
          ? e.cell_id
          : toCellId("edge__" + simpleSuffix(e.from) + "__to__" + simpleSuffix(e.to)),
      })),
    };
  }

  // E8: 未知 schema_version
  throw new Error("Unknown schema_version: " + v);
}

/**
 * v1 grid manifest signature を判定。
 *
 * 前提: v1 grid emitter は screens[] に `position` を必ず emit する（PR #148 時点）。
 * schema_version === 2 のブランチでは呼び出さないこと（v1 専用判定）。
 */
function hasV1Signature(raw) {
  // v1 manifest（schema_version 未指定 or 1）のみを対象とする
  return (raw.schema_version === undefined || raw.schema_version === 1)
    && raw.layout_strategy === undefined
    && (raw.screens ?? []).every(s => s.lane_id === undefined)
    && (raw.screens ?? []).some(s => s.position !== undefined);
}

/**
 * stable_id から {project_name}__ プレフィックスを剥がすヘルパー。
 * cell_id 自動補完で使用する。
 * 例: "attendance-saas__dashboard" → "dashboard"
 */
function simpleSuffix(stableId) {
  if (!stableId) return stableId ?? "";
  const idx = stableId.indexOf("__");
  return idx !== -1 ? stableId.slice(idx + 2) : stableId;
}
```

**注釈**: v1 fixture（`screen-flow-url-v1-grid.md`）は `schema_version: 1` のまま据置。`normalizeManifestV1or2` の AskUserQuestion 動作確認用 fixture として継続的に活用できる。v1 reader が v2 manifest を読むと `file_key` 必須エラーになるため、v2 以降は本 Skill の最新版（`normalizeManifestV1or2` 対応済み）で処理すること。

### v2 manifest への新規候補マージ

`normalizeManifestV1or2` は **既存エントリの任意フィールドデフォルト補完のみ** を行う。v2 manifest に存在しない新規画面候補（クロスチェック由来の `forbidden-403` 等）は自動補完しないため、再生成時には SKILL.md Step 3 の画面候補推定（権限マトリクス × フロー クロスチェック含む）を必ず再実行し、新規候補を旧 manifest にマージする必要がある。

マージルール:
- 既存 stable_id 一致 → manifest 側のフィールドを維持（手動編集を尊重）
- 旧 manifest にない新規候補 → ヒアリング項目 A で確認後、append
- 旧 manifest にあって今回推定にない → status: orphan（自動削除しない、SKILL.md Step 11 参照）

### fixture 命名推奨

v1 / v2（Figma 時代）/ v3（drawio 時代）と fixture が増えるため、以下の命名規則を推奨:

- `screen-flow-url-v1-grid.md` — v1 grid manifest fixture（**後方互換動作確認用 fixture**、schema_version: 1 のまま据置。v2 reader で読むと normalizeManifestV1or2 の AskUserQuestion 警告が出るのが期待動作）
- `screen-flow-url-v2-swimlane.md` — v2 swim-lane manifest fixture（Figma 時代の歴史的 fixture、schema_version: 1 のまま据置）
- `screen-flow-url.md` — 最新版（v3 user-flow、schema_version: 2、drawio フィールド使用）

## 6. YAML 最小実例（screens 1件、edges 1件）

**完全実例**: 10画面 + 12エッジを含む完全な manifest 実例は `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` を参照。

```yaml
---
drawio_file_path: docs/project/screen-flow.drawio
drawio_url: ""
schema_version: 2
generated_at: 2026-05-27
project_name: attendance-saas
layout_strategy: swim-lane
role_canonical_map:
  人事部: HR
---

## screens

- name: dashboard
  stable_id: attendance-saas__dashboard
  cell_id: "attendance-saas__dashboard"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 480, y: 720 }

## edges

- from: dashboard
  to: monthly-report
  trigger: 月次レポートボタンクリック
  stable_id: dashboard__to__monthly-report
  cell_id: "dashboard__to__monthly-report"
  edge_kind: primary
  routing: straight
  status: active
```

## 7. 拡張性（schema_version 互換性管理）

`schema_version: 2` 時の必須フィールドは §1.1〜§1.3 のテーブルで✅マーク付き全項目。任意フィールド（⚠️）は未指定時に §5 の `normalizeManifestV1or2` がデフォルト値を補完する。

**`schema_version` 据置ルール**: optional フィールド追加・YAML unknown field 無視は変更なし。**必須フィールド変更時は `schema_version` をバンプ + AskUserQuestion 確認**（v1 → v2 は本変更が初回事例）。

将来スキーマ変更時のマイグレーションパス:

- **v2 → v3**: 新フィールド追加は後方互換（optional フィールドは `normalizeManifestV1or2` の v2 ブランチでデフォルト補完）。必須フィールド追加・既存フィールド削除は破壊的変更となるため、`schema_version` をバンプし、`normalizeManifestV1or2` に新ブランチを追加して AskUserQuestion で確認する
- **未知の schema_version 検出時**: E8 エラーとして Skill は読み込みを停止し、ユーザーに Skill バージョン更新を促す

## 8. status フィールドと draft ライフサイクル

SKILL.md ワークフロー **Step 4.5（ドラフト確認フェーズ）** および **Step 10（manifest 出力）** から参照される。manifest の確定状態を示す `status` フィールドの仕様と、draft note のライフサイクル（生成 → 修正 → 承認 → 削除 or 中止退避）を定義する。

### 8.1 status フィールド

manifest frontmatter に追加可能な `status` フィールド。

- **値**: `draft` / `confirmed` の enum
- **配置**: frontmatter 末尾（任意フィールド）
- **未指定時のデフォルト**: `confirmed`（既存 sample 等で未指定の manifest は confirmed として解釈、後方互換維持）

| 値 | 意味 | 対応ファイル |
|---|---|---|
| `draft` | ユーザー承認待ち、drawio 未書き込み | `docs/project/screen-flow-url.draft.md` |
| `confirmed` | 承認済み、drawio 描画 + 本番 manifest 出力完了 | `docs/project/screen-flow-url.md` |

**配置ルール**:
- **draft note**（`<manifest-name>.draft.md`）の場合: 末尾の HTML コメントブロック内に `status: draft` を記載
  - 理由: draft note は未確定 manifest であり、frontmatter は本番 manifest と同形式を保つ（status 以外のフィールドが parser で正しく読まれる）
  - コメント内 status は人間レビュー用、機械的読み取りは不要
- **本番 manifest**（`<manifest-name>.md`）の場合: frontmatter に `status: confirmed` を **任意**で追加可能
  - 既存 sample 等は未指定（デフォルト = confirmed と解釈、§8.1 デフォルト規約参照）
  - 明示的にライフサイクル状態を残したい場合のみ追加

### 8.2 ライフサイクル

draft note と本番 manifest の状態遷移:

1. **Step 4.5 開始時**: `docs/project/screen-flow-url.draft.md`（`status: draft`）を Write で生成
2. **修正フェーズ**: ユーザー選択（項目戻り / フィールド直接修正）に応じて draft note を Edit で更新 → Step 4.5 再表示
3. **承認後**: draft note は **保持したまま** Step 5 へ進む（即削除しない）。drawio 書き込み中断時の再開ソースとして残す
4. **Step 10 manifest 出力成功後**: draft note を削除し、本番 `screen-flow-url.md`（`status: confirmed`）に確定
5. **中止時**: draft note を `<manifest-name>.draft.aborted.md` にリネーム（既存衝突時は `<manifest-name>.draft.aborted-YYYYMMDD-HHMMSS.md` の timestamp サフィックス付き名にフォールバック、上書き禁止）→ Skill 終了

### 8.2.1 draft note と manifest reader の関係（cell_id PLACEHOLDER 取り扱い）

> **draft note と manifest reader の関係**: Step 4.5 の `screen-flow-url.draft.md` では `cell_id` が `PLACEHOLDER_CELL_ID_*` で生成される。本 schema_version: 2 では `cell_id` は **manifest 上必須**だが、draft note 段階では PLACEHOLDER を許容する。`normalizeManifestV1or2` の v2 ブランチで cell_id が PLACEHOLDER の場合は自動補完する（§5 の `toCellId` ロジック参照）。よって reader は draft note を読み込んでも cell_id が PLACEHOLDER のまま通る前提で設計する。

### 8.3 拡張子の予約

`docs/project/` 配下で予約される拡張子パターン:

| 拡張子 | 意味 | git 管理 |
|---|---|---|
| `.draft.md` | 未確定ドラフト（Step 4.5 提示用） | ignore（§8.6） |
| `.draft.aborted.md` | 中止時退避（再開可能性のため保持） | ignore（§8.6） |
| `.draft.aborted-<timestamp>.md` | aborted 衝突時のフォールバック（`YYYYMMDD-HHMMSS` サフィックス） | ignore（§8.6） |
| `.bak` | 上書き前のバックアップ（既存 §3.2 / Step 10/11 で使用） | ignore 推奨 |

### 8.4 サマリ表テンプレ（AskUserQuestion description 表示用）

Step 4.5 の AskUserQuestion description に表示するサマリ表テンプレ。`hearing-checklist.md §7.7` から参照される。

| 項目 | screen-flow 例 |
|---|---|
| 全体件数 | screens: 11、edges: 12 |
| 主要構造 | layout_strategy: user-flow / entry: login |
| 推定信頼度 | source_confidence 別件数（high: 11） |
| 注目項目 | back edge: 1（approval→request） |
| 差分（再生成時） | ✅ 追加 N 件 / ❌ 削除 M 件 / 🔄 変更 K 件 |

description は最大 8〜10 行に収め、詳細は draft note ファイルパス（`docs/project/screen-flow-url.draft.md`）を案内する設計とする。差分絵文字（✅/❌/🔄）の意味は `hearing-checklist.md §7.5` 参照。

### 8.5 既存 manifest 読み込み + 差分算出アルゴリズム

Step 4.5 冒頭で、既存 confirmed manifest が存在する場合の差分算出疑似アルゴリズム:

```
1. Read で `docs/project/<manifest-name>.md` を読む（存在しなければ初回扱い、差分強調なし）
2. 既存 manifest の `## screens` から name / stable_id 一覧を抽出（Set X）
3. draft note の `## screens` から name / stable_id 一覧を抽出（Set Y）
4. Set 差分:
   - 追加: Y - X → ✅ で表示
   - 削除: X - Y → ❌ で表示（orphan 化予定として明示）
   - 共通: X ∩ Y → 各 entry のフィールド値比較 → 差分ありなら 🔄 で表示
5. edges / elements も同様に diff
6. サマリ表の「差分」列に件数を集計、description には先頭 10 行程度を表示
```

これは **Step 4.5 内の読み取り専用処理**であり、Step 10/11/12 の冪等性照合（drawio 書き込み後の cell_id 突合）とは独立。冪等性照合は従来通り §3 / Step 10/11 直前で実施する（役割の違い: Step 4.5 = 承認前の差分プレビュー、Step 10/11 = drawio 書き込み後の cell_id 突合）。

### 8.6 `.gitignore` 整備

draft note は一時ファイルのため git 管理対象外とする。

- **推奨パターン**:
  - `docs/project/*.draft.md`
  - `docs/project/*.draft.aborted*.md`
- Skill 実行時に Step 4.5 内で `.gitignore` 確認・未登録なら追記する（SKILL.md Step 4.5 処理 1.5 参照）
