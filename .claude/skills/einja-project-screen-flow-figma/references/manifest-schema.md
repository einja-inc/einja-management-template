# screen-flow-url.md スキーマ

`docs/project/screen-flow-url.md` の完全スキーマ仕様と冪等性ポリシーを定義する。SKILL.md ワークフロー Step 10（Figma URL + manifest 記録）および Step 11（再生成時の冪等性照合）、§5 エラー処理パターン から参照される。`ui-design-url.md` とフィールド互換だが用途が異なる（プロジェクト全体の画面遷移 vs Issue単位の画面モックアップ）。

enum 値（`layout_strategy` / `edge_kind` / `routing` / `node_kind` / `business_role` / `source_confidence` / `status`）は `references/canonical-enums.md` を Single Source of Truth とする。本ファイルでは引用のみ行い、enum 値を独自定義しない。

## 1. screen-flow-url.md 完全スキーマ

YAML frontmatter + 2つのリストセクション（`screens` / `edges`）の構成。

```yaml
---
figma_url: https://www.figma.com/design/<file_key>
file_key: <fileKey>
plan_key: <planKey>
schema_version: 1
generated_at: 2026-05-18
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
  node_id: "1:23"
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
  node_id: "1:45"
  edge_kind: primary                  # 任意。canonical-enums §2
  routing: straight                   # 任意。canonical-enums §3
  label_collision_warning: false      # 任意（衝突回避失敗時 true）
  status: active   # active | orphan
```

### 1.1 frontmatter フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `figma_url` | ✅ | string | Figma ファイルの完全URL。再生成時の照合キー |
| `file_key` | ✅ | string | URL から抽出した fileKey（Figma API 呼び出し用） |
| `plan_key` | ✅ | string | Figma plan/team key（`whoami` で取得） |
| `schema_version` | ✅ | number | スキーマバージョン（互換性管理用、現行: `1`） |
| `generated_at` | ✅ | date | 最終生成日（`YYYY-MM-DD`） |
| `project_name` | ✅ | string | プロジェクト名（kebab-case、`stable_id` プレフィックスに使用） |
| `layout_strategy` | ⚠️ | string | レイアウト戦略。canonical-enums §1 の enum 値。未指定 = `grid`（v1 後方互換） |
| `role_canonical_map` | ⚠️ | object | 表示名 → canonical 識別子（canonical-enums §5）のマップ。未指定 = `{}` でデフォルト辞書のみ使用 |

### 1.2 screens[] フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `name` | ✅ | string | 画面名（kebab-case、Figma FrameNode 名と一致） |
| `stable_id` | ✅ | string | 冪等性照合用ID。`{project_name}__{name}` 形式 |
| `node_id` | ✅ | string | Figma ノードID（`"1:23"` コロン形式） |
| `role` | ⚠️ | string | 対象ユーザー/ロール（要件§3由来。表示名。複数は `/` 区切り） |
| `lane_id` | ⚠️ | string | canonical 識別子（canonical-enums §5）。manifest が SSoT。未指定時は `role` から `role_canonical_map` 経由で逆引き推定 |
| `source_confidence` | ⚠️ | string | クロスチェック由来時の信頼度。canonical-enums §6。未指定 = `high`（§2 業務フロー由来として扱う） |
| `status` | ✅ | string | `active`（要件にあり） / `orphan`（要件から削除済み） |
| `position` | ⚠️ | object | `{x, y}` 座標。ユーザー手動編集を尊重して保持 |

### 1.3 edges[] フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `from` | ✅ | string | 遷移元画面の `name` |
| `to` | ✅ | string | 遷移先画面の `name` |
| `trigger` | ✅ | string | 遷移トリガー（例: 「設定ボタンクリック」） |
| `stable_id` | ✅ | string | `{from}__to__{to}` 形式（**project_name プレフィックスなし**。screens[].stable_id とは形式が異なる） |
| `node_id` | ✅ | string | Figma VectorNode（矢印）のノードID |
| `edge_kind` | ⚠️ | string | エッジ種別。canonical-enums §2。未指定時は `inferEdgeKind(trigger)` で trigger キーワード判定 |
| `routing` | ⚠️ | string | 経路種別。canonical-enums §3。未指定 = `straight` |
| `label_collision_warning` | ⚠️ | boolean | エッジラベル衝突回避失敗時 `true`。未指定 = `false`。**SSoT は本 manifest**。Figma plugin data 側にも同名 key で併記するが、再生成時の参照は manifest 優先（Figma 手動編集を無視） |
| `status` | ✅ | string | `active` / `orphan` |

**Note**: `edges` の `stable_id` には `screens` と異なり `project_name` プレフィックスを付けていない。これは本 Skill が「1 Figma ファイル = 1 プロジェクト」を前提としており、ファイル内で `{from}__to__{to}` だけで一意に識別できるため。複数プロジェクトを同一ファイルに混在させる場合は SKILL.md レベルで AskUserQuestion による衝突回避が必要。

**Figma plugin data 側の整合性**: Figma `setSharedPluginData("einja.screenFlow", "stable_id", ...)` に記録する値も上記形式（`screens` は `{project_name}__{name}`、`edges` は `{from}__to__{to}`）に揃えること。manifest と Figma plugin data の `stable_id` 不一致は再生成時の冪等性照合 (§3.1) を破壊する。

## 2. ui-design-url.md とのフィールド差分

| フィールド | screen-flow-url.md | ui-design-url.md | 互換性 |
|----------|--------------------|-------------------|--------|
| `figma_url` | ✅ | ✅ | 共通 |
| `file_key` | ✅ | ✅ | 共通 |
| `plan_key` | ✅ | ❌ | 本Skill固有 |
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

**目的**: 同一プロジェクトで Skill を複数回実行しても、既存 Figma 上のユーザー手動編集を破壊しないこと。

### 3.1 再生成フロー

1. 既存 `docs/project/screen-flow-url.md` を Read
2. `file_key` から Figma ファイルを開く（**新規作成しない**）
3. **screens 照合**: 新規生成リスト vs 既存 `screens[]` を `stable_id` で照合
   - 一致 → `node_id` を流用、既存 `position` を保持（手動レイアウト変更を尊重）
   - 未知の `stable_id` → 新規 FrameNode 作成
   - 既存にあって今回ない `stable_id` → `status: orphan` に変更（**自動削除しない**）
4. **edges 照合**: 同様に `stable_id` で照合
   - 未知 → 新規 VectorNode + TextNode + group 作成
   - 削除対象 → `status: orphan`
5. orphan 化された節点について、ユーザー向けに「N 個の画面/エッジが要件定義から削除されました。Figma 上で確認後、不要なら手動削除してください」とログ出力

### 3.2 バックアップ

- 上書き前に `docs/project/screen-flow-url.md.bak` として直前バージョンを退避
- `.bak` は `.gitignore` で除外推奨

### 3.3 衝突ケース

- ユーザーが Figma 上で `stable_id` を持つノードを手動削除した場合 → 再生成時に「missing」検出 → **AskUserQuestion** で次の4択を提示:
  1. **再作成** — manifest と一致するノードを Figma に復元
  2. **削除を確定** — manifest からも該当エントリを削除
  3. **中止** — 再生成を中止し原因調査
  4. **その他（自由入力）** — 上記以外の対応をユーザーが指示

## 4. Plugin Data Key 移行

旧スキーマでは Figma `setSharedPluginData("einja.screenFlow", ...)` に対して `role` key で `screen` / `edge` を記録していたが、新スキーマでは `node_kind` key へ統一し、業務ロールは `business_role` key として別途追加する。

| 旧 key | 新 key | 意味 | 移行方針 |
|-------|-------|------|--------|
| `role` (値: `screen`/`edge`) | `node_kind` (値: `screen`/`edge`/`lane`) | ノード種別 | 書き込みは新 key に統一、読み込み互換性のため `role` も fallback で読む。廃止時期は別途決定（旧 key 削除は不要、無視されるだけ） |
| (なし) | `business_role` (値: `Common`/`Employee`/`Manager`/`HR`/`Admin`/`Ext`) | 業務ロール canonical（canonical-enums §5） | 新規追加 |
| `stable_id` | `stable_id` | 識別子 | 変更なし |

namespace は `einja.screenFlow` 固定（canonical-enums §8）。

### 読み込み互換性ユーティリティ

```javascript
function readNodeKind(node) {
  return node.getSharedPluginData("einja.screenFlow", "node_kind")
    || node.getSharedPluginData("einja.screenFlow", "role")
    || null;
}
function writeNodeKind(node, kind) {
  node.setSharedPluginData("einja.screenFlow", "node_kind", kind);
}
function readBusinessRole(node) {
  return node.getSharedPluginData("einja.screenFlow", "business_role") || null;
}
function writeBusinessRole(node, canonicalRole) {
  node.setSharedPluginData("einja.screenFlow", "business_role", canonicalRole);
}
```

`findAll` フィルタ条件は `readNodeKind(n) === "screen"` 等に書き換える。

## 5. v1 後方互換ルール

`schema_version: 1` 据置のため、新フィールド (`layout_strategy` / `role_canonical_map` / `lane_id` / `source_confidence` / `edge_kind` / `routing` / `label_collision_warning`) は全て **任意**。未指定時のデフォルト挙動:

| フィールド | 未指定時 |
|----------|--------|
| `layout_strategy` | `grid` として読む |
| `role_canonical_map` | `{}` 空オブジェクト + canonical-enums §5 デフォルト辞書のみ使用 |
| `screens[].lane_id` | `inferLane(role, role_canonical_map)` で逆引き推定 |
| `screens[].source_confidence` | `high`（§2 業務フロー由来として扱う） |
| `edges[].edge_kind` | `inferEdgeKind(trigger)`（trigger キーワード判定） |
| `edges[].routing` | `straight` |
| `edges[].label_collision_warning` | `false` |

### normalizeManifestV1 ユーティリティ

```javascript
function normalizeManifestV1(raw) {
  return {
    ...raw,
    layout_strategy: raw.layout_strategy ?? "grid",
    role_canonical_map: raw.role_canonical_map ?? {},
    screens: (raw.screens ?? []).map(s => ({
      ...s,
      lane_id: s.lane_id ?? inferLane(s.role, raw.role_canonical_map ?? {}),
      source_confidence: s.source_confidence ?? "high",
    })),
    edges: (raw.edges ?? []).map(e => ({
      ...e,
      edge_kind: e.edge_kind ?? inferEdgeKind(e.trigger),
      routing: e.routing ?? "straight",
      label_collision_warning: e.label_collision_warning ?? false,
    })),
  };
}
```

`schema_version` 未知（≠1）の場合は Skill 読み込みを停止し、ユーザーに Skill 更新を促す。

### v1 → v2 再生成時の新規候補マージ

`normalizeManifestV1` は **既存エントリの任意フィールドデフォルト補完のみ** を行う。v1 manifest に存在しない新規画面候補（クロスチェック由来の `forbidden-403` 等）は自動補完しないため、再生成時には SKILL.md Step 3 の画面候補推定（権限マトリクス × フロー クロスチェック含む）を必ず再実行し、新規候補を旧 manifest にマージする必要がある。

マージルール:
- 既存 stable_id 一致 → manifest 側のフィールドを維持（手動編集を尊重）
- 旧 manifest にない新規候補 → ヒアリング項目 A で確認後、append
- 旧 manifest にあって今回推定にない → status: orphan（自動削除しない、SKILL.md Step 11 参照）

### v1 fixture 命名推奨

v1 互換 fixture を残す場合、`{original-name}-v1-{strategy}.md` 命名を推奨。例:
- `screen-flow-url.md`（v2 swim-lane 版） + `screen-flow-url-v1-grid.md`（v1 grid 互換 fixture）

これにより v2 出力ファイルとの差別化が明確になり、`normalizeManifestV1` の動作確認用 fixture として継続的に活用できる。他 Skill でも同パターンの採用を推奨。

## 6. YAML 最小実例（screens 1件、edges 1件）

**完全実例**: 10画面 + 12エッジを含む完全な manifest 実例は `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` を参照。

```yaml
---
figma_url: https://www.figma.com/design/abc123
file_key: abc123
plan_key: team::1152187400294529955
schema_version: 1
generated_at: 2026-05-18
project_name: attendance-saas
layout_strategy: swim-lane
role_canonical_map:
  人事部: HR
---

## screens

- name: dashboard
  stable_id: attendance-saas__dashboard
  node_id: "1:2"
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
  node_id: "1:8"
  edge_kind: primary
  routing: straight
  label_collision_warning: false
  status: active
```

## 7. 拡張性（schema_version 互換性管理）

`schema_version: 1` 時の必須フィールドは §1.1〜§1.3 のテーブルで✅マーク付き全項目。任意フィールド（⚠️）は v1 範囲で追加されたものであり、未指定時は §5 の `normalizeManifestV1` がデフォルト値を補完する。

将来スキーマ変更時のマイグレーションパス:

- **v1 → v2**: 新フィールド追加は後方互換（v1 manifest は v2 reader が読み取り可）。必須フィールド追加・既存フィールド削除は破壊的変更となるため、Skill 側で `schema_version` 判定し、未満バージョンは AskUserQuestion で「自動マイグレーション / 中止」を確認する
- **未知の schema_version 検出時**: Skill は読み込みを停止し、ユーザーに Skill バージョン更新を促す
