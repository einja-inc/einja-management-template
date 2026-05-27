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
| `layout_strategy` | ⚠️ | string | レイアウト戦略。canonical-enums §1 の enum 値。未指定時のデフォルトは `user-flow`（v3 default）。ただし v1 manifest signature（`schema_version: 1` + `lane_id` 全件 undefined + `position` あり）が検出された場合のみ `grid` 強制（後方互換） |
| `entry_detection_method` | ⚠️（任意） | string | エントリポイント確定方法の識別子。値は `canonical-enums §10 entry-detection-method` enum（`manifest` / `heuristics-name` / `topology-indegree-zero` / `user-confirmed` / `fallback-grid`）。Skill 実行時に自動記録（手動編集不要）。トレーサビリティ用 |
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
| `is_entry_point` | ⚠️ | boolean | エントリポイント明示フラグ。デフォルト `false`。manifest 明示が最優先（heuristics より優先）。user-flow レイアウト時に BFS の起点判定で使用 |

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
| `layout_strategy` | `user-flow`（v1 grid signature 検出時のみ `grid`）として読む |
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
    layout_strategy: (
      // ① 明示指定があればそれを採用（user-flow / swim-lane / grid のいずれか）
      raw.layout_strategy
      // ② 未指定かつ v1 grid signature を持つ manifest は grid 強制（後方互換）
      ?? (hasV1Signature(raw) ? "grid"
      // ③ それ以外は v3 default
      : "user-flow")
    ),
    role_canonical_map: raw.role_canonical_map ?? {},
    screens: (raw.screens ?? []).map(s => ({
      ...s,
      is_entry_point: s.is_entry_point ?? false,
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

/**
 * v1 grid manifest signature を判定。
 *
 * 前提: v1 grid emitter は screens[] に `position` を必ず emit する（PR #148 時点）。
 * もし position が未 emit のケースが将来発生した場合は、`raw.screens.some(s => s.position !== undefined)`
 * 条件を削除して `lane_id` 全件 undefined のみで判定する形に変更が必要。
 */
function hasV1Signature(raw) {
  return raw.layout_strategy === undefined
    && raw.schema_version === 1
    && (raw.screens ?? []).every(s => s.lane_id === undefined)
    && (raw.screens ?? []).some(s => s.position !== undefined);
}
```

**注釈**: 明示 swim-lane manifest は ① で早期 return されるため `hasV1Signature` 判定に到達しない（誤判定なし）。

`schema_version` 未知（≠1）の場合は Skill 読み込みを停止し、ユーザーに Skill 更新を促す。

### v1 → v2 再生成時の新規候補マージ

`normalizeManifestV1` は **既存エントリの任意フィールドデフォルト補完のみ** を行う。v1 manifest に存在しない新規画面候補（クロスチェック由来の `forbidden-403` 等）は自動補完しないため、再生成時には SKILL.md Step 3 の画面候補推定（権限マトリクス × フロー クロスチェック含む）を必ず再実行し、新規候補を旧 manifest にマージする必要がある。

マージルール:
- 既存 stable_id 一致 → manifest 側のフィールドを維持（手動編集を尊重）
- 旧 manifest にない新規候補 → ヒアリング項目 A で確認後、append
- 旧 manifest にあって今回推定にない → status: orphan（自動削除しない、SKILL.md Step 11 参照）

### v1 fixture 命名推奨

v1 → v2 → v3 と fixture が増えるため、以下の 3 層命名規則を推奨:

- `screen-flow-url-v1-grid.md` — v1 grid manifest fixture（既存）
- `screen-flow-url-v2-swimlane.md` — v2 swim-lane manifest fixture（任意）
- `screen-flow-url.md` — 最新版（v3 user-flow、default）

これにより各バージョンの出力ファイルとの差別化が明確になり、`normalizeManifestV1` および `hasV1Signature` の動作確認用 fixture として継続的に活用できる。他 Skill でも同パターンの採用を推奨。

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

**`schema_version` 据置ルール（v3 user-flow 対応）**: `is_entry_point` フィールド追加に伴う `schema_version` バンプは不要。理由: `is_entry_point` は optional フィールドであり、YAML unknown field は無視されるルールに従うため、既存 v1 manifest を v3 reader が読み取っても互換性が保たれる（§5 `normalizeManifestV1` が `false` をデフォルト補完）。

将来スキーマ変更時のマイグレーションパス:

- **v1 → v2**: 新フィールド追加は後方互換（v1 manifest は v2 reader が読み取り可）。必須フィールド追加・既存フィールド削除は破壊的変更となるため、Skill 側で `schema_version` 判定し、未満バージョンは AskUserQuestion で「自動マイグレーション / 中止」を確認する
- **未知の schema_version 検出時**: Skill は読み込みを停止し、ユーザーに Skill バージョン更新を促す

## 8. status フィールドと draft ライフサイクル

SKILL.md ワークフロー **Step 4.5（ドラフト確認フェーズ）** および **Step 10（manifest 出力）** から参照される。manifest の確定状態を示す `status` フィールドの仕様と、draft note のライフサイクル（生成 → 修正 → 承認 → 削除 or 中止退避）を定義する。

### 8.1 status フィールド

manifest frontmatter に追加可能な `status` フィールド。

- **値**: `draft` / `confirmed` の enum
- **配置**: frontmatter 末尾（任意フィールド）
- **未指定時のデフォルト**: `confirmed`（既存 sample 等で未指定の manifest は confirmed として解釈、後方互換維持）

| 値 | 意味 | 対応ファイル |
|---|---|---|
| `draft` | ユーザー承認待ち、Figma 未書き込み | `docs/project/screen-flow-url.draft.md` |
| `confirmed` | 承認済み、Figma 描画 + 本番 manifest 出力完了 | `docs/project/screen-flow-url.md` |

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
3. **承認後**: draft note は **保持したまま** Step 5 へ進む（即削除しない）。Figma 描画中断時の再開ソースとして残す
4. **Step 10 manifest 出力成功後**: draft note を削除し、本番 `screen-flow-url.md`（`status: confirmed`）に確定
5. **中止時**: draft note を `<manifest-name>.draft.aborted.md` にリネーム（既存衝突時は `<manifest-name>.draft.aborted-YYYYMMDD-HHMMSS.md` の timestamp サフィックス付き名にフォールバック、上書き禁止）→ Skill 終了

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

これは **Step 4.5 内の読み取り専用処理**であり、Step 10/11/12 の冪等性照合（Figma 書き込み後の node_id 突合）とは独立。冪等性照合は従来通り §3 / Step 10/11 直前で実施する（役割の違い: Step 4.5 = 承認前の差分プレビュー、Step 10/11 = Figma 書き込み後の node_id 突合）。

### 8.6 `.gitignore` 整備

draft note は一時ファイルのため git 管理対象外とする。

- **推奨パターン**:
  - `docs/project/*.draft.md`
  - `docs/project/*.draft.aborted*.md`
- Skill 実行時に Step 4.5 内で `.gitignore` 確認・未登録なら追記する（SKILL.md Step 4.5 処理 1.5 参照）
