# wireframe-url.md スキーマ

`docs/project/wireframe-url.md` の完全スキーマ仕様、冪等性ポリシー、`screen-flow-url.md` との差分、`schema_version v1→v2` マイグレーションルールを定義する。`einja-project-screen-spec` Skill の Step 5/6/8/9/11/12 から参照される。

本ファイルで使用する enum 値（element kind / layout / state / status / source）および stable_id 命名規約は、すべて `references/canonical-enums.md` の **lowercase + ハイフン形式** をそのまま引用する。

---

## §1. 完全スキーマ

`docs/project/wireframe-url.md` は YAML frontmatter + 2つのリストセクション（`## screens` / `## elements`）で構成される。`screen-flow-url.md` から `edges[]` を持たず、代わりに画面単位のワイヤーフレーム情報を保持する。

### 1.1 frontmatter 必須フィールド

```yaml
---
schema_version: 1
figma_url: https://www.figma.com/design/<file_key>/<file_name>?node-id=<wireframes_page_id>
file_key: <fileKey>
project_name: <kebab-project-name>
generated_at: 2026-05-25
source_screen_flow_file_key: <fileKey>
source_screen_flow_schema_version: 1
---
```

| フィールド | 型 | 用途 / 制約 |
|----------|---|------------|
| `schema_version` | number | スキーマバージョン。本Skill v1 スコープでは固定値 `1`。未知バージョン検出時は §5 のエラー処理に従う |
| `figma_url` | string | Figma ファイルの完全URL（`?node-id=` 付き）。`screen-flow-url.md` と同一の Figma file を指す |
| `file_key` | string | URL から抽出した fileKey。**`screen-flow-url.md` の `file_key` と同一値**（同一 Figma ファイル内に wireframes Page を追加する設計） |
| `project_name` | string | プロジェクト名。**`screen-flow-url.md` の `project_name` と同一値**。ASCII 英数ハイフン32字以内（`setSharedPluginData` key 100字制限予防のため、canonical-enums.md §6.5 truncate ロジックと整合させる必要あり） |
| `generated_at` | date | 最終生成日（`YYYY-MM-DD` または ISO 8601）。再生成時に毎回更新 |
| `source_screen_flow_file_key` | string | 入力 `screen-flow-url.md` の `file_key`。整合性検証用（`file_key` と同値であることを Step 3 / Step 12 で確認） |
| `source_screen_flow_schema_version` | number | 入力 `screen-flow-url.md` の `schema_version`。整合性検証用。v1 Skill は `1` のみ受理。不一致時はエラー E9 |

### 1.2 frontmatter 任意フィールド

```yaml
plan_key: team::1152187400294529955
linked_screen_flow: docs/project/screen-flow-url.md
wireframes_page_id: "0:5"
fidelity: mid-fi
color_mode: mono
```

| フィールド | 型 | 用途 |
|----------|---|------|
| `plan_key` | string | Figma plan/team key（`whoami` で取得）。空でも動作するが trace 性のため記録推奨 |
| `linked_screen_flow` | string | 上流 manifest への相対パス。整合性検証時の問い合わせ先表示用 |
| `wireframes_page_id` | string | Figma 内 wireframes Page の PageNode ID（`"0:5"` コロン形式）。`findAll` スコープ切替に使用 |
| `fidelity` | string | ワイヤーフレーム忠実度。本Skill v1 では `mid-fi` 固定（lo-fi / hi-fi は v2 想定） |
| `color_mode` | string | カラーモード。本Skill v1 では `mono`（グレースケール）固定 |

### 1.3 `## screens` セクション

各 screen エントリは Markdown リスト項目 + ネスト YAML で記述する。

```yaml
## screens

- name: dashboard
  linked_screen_stable_id: sample-attendance-saas__dashboard
  screen_stable_id: sample-attendance-saas__wf__dashboard
  stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  layout: desktop
  state: normal
  node_id: "5:12"
  size: { width: 1440, height: 900 }
  position: { x: 0, y: 0 }
  status: active
```

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `name` | ✅ | string | 画面名（kebab-case）。`screen-flow-url.md` の `screens[].name` と一致 |
| `linked_screen_stable_id` | ✅ | string | 上流 `screen-flow-url.md` の `screens[].stable_id` 参照キー。canonical-enums.md §6.3 形式（`{project_name}__{name}`） |
| `screen_stable_id` | ✅ | string | 論理 wireframe 画面ID（layout/state 非依存）。canonical-enums.md §6.2 形式（`{project_name}__wf__{name}`） |
| `stable_id` | ✅ | string | **物理 Frame 識別子**（冪等性照合キー）。canonical-enums.md §6.1 形式（`{project_name}__wf__{name}__{layout}__{state}`） |
| `layout` | ✅ | string | レイアウト種別。canonical-enums.md §2 enum（`desktop` / `mobile` / `modal`） |
| `state` | ✅ | string | 画面状態。canonical-enums.md §3 enum（`normal` / `loading` / `error` / `empty`） |
| `node_id` | ✅ | string | Figma FrameNode ID（`"5:12"` コロン形式） |
| `size` | ✅ | object | `{width, height}` ピクセル値。layout enum のサイズ目安と一致させる |
| `position` | ✅ | object | `{x, y}` 座標（wireframes Page 内）。ユーザー手動編集を尊重し再生成時も保持 |
| `status` | ✅ | string | canonical-enums.md §4 enum（`active` / `orphan`） |
| `stable_id_full` | ⚠️ | string | 100字 truncate 発生時のみ記録。元の stable_id 文字列を保持（canonical-enums.md §6.5） |

### 1.4 `## elements` セクション

各 element エントリは「どの画面 frame に属するか」を `screen_frame_stable_id` で示し、画面内の要素を列挙する。

```yaml
## elements

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__input-text__employee-name
  kind: input-text
  node_id: "5:18"
  status: active
  source: function-spec-flow_time_punch.md (§3.2 FN-001 入力)
  label: 従業員名
  required: true
  placeholder: 例)山田太郎
```

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `screen_frame_stable_id` | ✅ | string | 親 screen の `stable_id`（§1.3）。物理 Frame 識別子 |
| `element_stable_id` | ✅ | string | 要素冪等性照合キー。canonical-enums.md §6.4 形式（`{screen_frame_stable_id}__el__{kind}__{slug_or_index}`） |
| `kind` | ✅ | string | 要素種別。canonical-enums.md §1 enum（Core 15 + Optional 9 + Fallback 1 = 25種） |
| `node_id` | ✅ | string | Figma 要素ノードID |
| `status` | ✅ | string | canonical-enums.md §4 enum（`active` / `orphan`） |
| `source` | ✅ | string | canonical-enums.md §5 enum + 出典詳細（例: `function-spec-flow_time_punch.md (§3.2 FN-001 入力)`） |
| `stable_id_full` | ⚠️ | string | 100字 truncate 発生時のみ記録 |

kind 別の追加必須/任意フィールドは §2 で定義する。

---

## §2. element kind 別フィールド表（Core 15 + Optional 9 + Fallback 1）

`kind` / `screen_frame_stable_id` / `element_stable_id` / `node_id` / `status` / `source` 以外の **kind 別フィールド** を定義する。すべての enum 値は canonical-enums.md §1 と完全一致。

### 2.1 Core 15（v1 必須実装）

| kind | 追加必須フィールド | 追加任意フィールド |
|------|----------------|-----------------|
| `header` | - | `text`（プロジェクト名・ユーザー識別文字列） |
| `side-nav` | `items[]`（活性画面リスト。`screen-flow-url.md` screens[] 由来） | - |
| `page-title` | `text`（画面タイトル） | - |
| `breadcrumb` | `items[]`（パンくず配列。`screen-flow-url.md` edges[] 逆引き由来） | - |
| `input-text` | `label`（入力欄ラベル） | `required`（bool）, `placeholder`, `max_length`（v2 で必須化候補） |
| `input-select` | `label` | `required`, `options[]`（function-spec §5.4 enum 制約由来。v2 で必須化候補） |
| `input-date` | `label` | `required`, `placeholder` |
| `required-mark` | `parent_element_stable_id`（紐付け先の `element_stable_id`） | - |
| `button-primary` | `text`（ボタンラベル） | `target_edge_stable_id`（遷移系の場合。`screen-flow-url.md` edges[].stable_id 参照） |
| `button-secondary` | `text` | `target_edge_stable_id`（遷移・キャンセル系） |
| `table` | `columns[]`（ヘッダー名配列） | `sample_row_count`（デフォルト3）, `data_source`（function-spec §4.2 由来） |
| `validation-error` | `parent_element_stable_id`, `message_template`（メッセージ雛形文字列） | - |
| `error-banner` | `message_template`（業務エラー文言雛形） | - |
| `empty-state` | `message`（空状態テキスト） | - |
| `loading-indicator` | - | `message`（ローディング中表示文言） |

### 2.2 Optional 9（v1 では manifest 記録のみ、Figma 描画は `placeholder-block` 代替）

| kind | 追加必須フィールド | 追加任意フィールド |
|------|----------------|-----------------|
| `modal-dialog` | `title`（モーダル見出し） | `body_text`, `confirm_button_text`, `cancel_button_text` |
| `tabs` | `items[]`（タブラベル配列） | `active_index`（デフォルト0） |
| `pagination` | - | `total_pages`, `page_size` |
| `checkbox` | `label` | `required`, `checked_by_default` |
| `radio` | `label`, `options[]` | `required`, `default_value` |
| `textarea` | `label` | `required`, `placeholder`, `max_length` |
| `badge-status` | `text`（バッジ表示文言） | `variant`（v2 で enum 化候補） |
| `toast` | `message_template` | `severity`（info/warning/error。v2 で enum 化候補） |
| `search-filter` | `target_element_stable_id`（絞り込み対象、例: table の `element_stable_id`） | `filter_fields[]` |

### 2.3 Fallback 1

| kind | 追加必須フィールド | 追加任意フィールド |
|------|----------------|-----------------|
| `placeholder-block` | `note`（推定不能理由・TBDメモ） | - |

`source: unrecognized` 固定で manifest 記録される。Figma 上では中央配置のグレー矩形 + ラベル「TBD」で描画。

---

## §3. 冪等性ポリシー（多層 stable_id 突合）

**目的**: 同一プロジェクトで本 Skill を複数回実行しても、Figma 上のユーザー手動編集（位置調整・文言調整）と manifest を破壊しないこと。

### 3.1 再生成フロー

1. 既存 `docs/project/wireframe-url.md` を Read（存在しなければ新規生成モード）
2. `frontmatter.file_key` から Figma ファイルを開き、`wireframes_page_id` で wireframes Page にスコープ切替（`figma.currentPage = wireframesPage`）
3. **整合性検証**（Step 3 / Step 12 相当）:
   - `source_screen_flow_file_key` と現行 `screen-flow-url.md` の `file_key` が一致するか
   - `source_screen_flow_schema_version` が現行 Skill の受理範囲内か
   - 不一致時はエラー E9（§5 参照）
4. **screens[] 突合**: 新規生成リスト vs 既存 `screens[]` を **物理 stable_id**（`{project}__wf__{name}__{layout}__{state}`）で完全一致照合
   - 一致 → 既存 `node_id` / `position` / `size` を流用（手動レイアウト変更を尊重）
   - 未知の `stable_id` → 新規 FrameNode 作成、position は自動配置ロジック適用
   - 既存にあって今回ない `stable_id` → `status: orphan` に変更（**自動削除はしない**。ユーザーに手動削除を促す）
5. **elements[] 突合**: `element_stable_id` で完全一致照合（screens[] と同様のフロー）
   - 一致 → 既存 `node_id` を流用、kind 別フィールドは新規推定値で上書き（manifest が正、ただし `position` 相当の Figma レイアウトは保持）
   - 未知 → 新規ノード作成（wireframe-primitives.md §3 の JS 関数テンプレで描画）
   - 既存にあって今回ない → `status: orphan`
6. orphan 化された節点について、ユーザー向けに「N 個の screen frame / M 個の element が要件定義から削除されました。Figma 上で確認後、不要なら手動削除してください」とログ出力

### 3.2 stable_id 100字 truncate ルール

canonical-enums.md §6.5 を引用：

> `setSharedPluginData` の key が 100字を超える場合は SHA-256 ハッシュの先頭 16進 12桁に truncate する。元の stable_id は manifest の `stable_id_full` 任意フィールドに保持し、`stable_id` には truncate 値を記録。

擬似コード（canonical-enums.md §6.5 と整合させて 100字以内に収まるよう調整）:

```javascript
function truncateStableId(rawId) {
  if (rawId.length <= 100) return rawId;
  const hash = sha256(rawId).slice(0, 12);  // 16進 12桁
  // 83 + "__h__"(5) + 12 = 100 になるよう調整
  return rawId.slice(0, 83) + "__h__" + hash;
}
```

**truncate 適用時の manifest 記録**:

```yaml
- name: very-long-screen-name-that-might-exceed-100-chars
  stable_id: sample-attendance-saas__wf__very-long-screen-na__h__a1b2c3d4e5f6
  stable_id_full: sample-attendance-saas__wf__very-long-screen-name-that-might-exceed-100-chars__desktop__normal
  ...
```

**衝突検知**: truncate 後の `stable_id` が既存と衝突した場合（同一 hash prefix の偶発衝突）は警告ログ出力 + 連番付与（`__01`, `__02`）で回避。連番は `stable_id_full` 側には付与せず、truncate 後の `stable_id` のみに付加する。

### 3.3 バックアップ

- 上書き前に `docs/project/wireframe-url.md.bak` として直前バージョンを退避
- `.bak` は `.gitignore` で除外推奨

### 3.4 衝突ケース（Figma 側の手動削除）

ユーザーが Figma 上で `stable_id` を持つノードを手動削除した場合 → 再生成時に「missing」検出 → **AskUserQuestion** で次の4択を提示:

1. **再作成** — manifest と一致するノードを Figma に復元
2. **削除を確定** — manifest からも該当エントリを削除（`status: orphan` を経由せず即削除）
3. **中止** — 再生成を中止し原因調査
4. **その他（自由入力）** — 上記以外の対応をユーザーが指示

---

## §4. `screen-flow-url.md` との差分表

両 manifest は同一 Figma file を共有するが、目的・スキーマ・冪等性キーが異なる。

| 項目 | `screen-flow-url.md` | `wireframe-url.md` |
|------|---------------------|--------------------|
| **目的** | 画面遷移俯瞰（プロジェクト全体の画面リスト + 遷移エッジ） | 画面単位ワイヤーフレーム（mid-fi、要素プリミティブ配置） |
| **Figma 操作** | 新規ファイル作成 | 既存ファイル内に wireframes Page を追加（**新規ファイル作成しない**） |
| **stable_id 形式（screen）** | `{project}__{name}` | `{project}__wf__{name}__{layout}__{state}`（物理）／ `{project}__wf__{name}`（論理） |
| **主要セクション** | `## screens` + `## edges` | `## screens` + `## elements` |
| **Figma namespace（`setSharedPluginData`）** | `einja.screenFlow` | `einja.screenSpec` |
| **`findAll` スコープ** | `figma.currentPage`（新規ファイル直下のデフォルト Page） | `figma.currentPage = wireframesPage`（setCurrentPageAsync で切替） |
| **上流入力** | `requirements.md` のみ | `requirements.md` + `screen-flow-url.md` + `docs/project/function-specs/` |
| **冪等性キー** | `screens[].stable_id`（論理ID = 物理ID） | `screens[].stable_id`（物理ID、layout/state 含む） + `elements[].element_stable_id` |
| **整合性検証** | なし（自己完結） | `source_screen_flow_file_key` / `source_screen_flow_schema_version` で `screen-flow-url.md` との整合性を検証 |
| **schema_version 受理範囲** | v1 単独 | v1 単独（v2 マイグレーションは §5） |
| **追加任意フィールド** | `position`, `role` | `size`, `layout`, `state`, `linked_screen_stable_id`, `screen_stable_id`, `wireframes_page_id`, `fidelity`, `color_mode` 等 |
| **orphan ライフサイクル** | screens / edges 単位 | screens（物理 Frame）/ elements 単位（より細粒度） |

**運用上の制約**:
- `wireframe-url.md` の `file_key` は `screen-flow-url.md` と必ず一致（同一 Figma file 共有）。不一致時は §5 エラー E9
- `wireframe-url.md` の `screens[].linked_screen_stable_id` は `screen-flow-url.md` の `screens[].stable_id` と必ず一致（上流参照の整合性）。不一致時は §5 エラー E9
- `screen-flow-url.md` 側で screen が orphan 化された場合、`wireframe-url.md` 側の該当 screens[] / elements[] も連動して orphan 化する（手動削除はしない）

---

## §5. schema_version v1→v2 マイグレーションルール

### 5.1 v1 設計方針

**v1 = wireframe manifest 最小読取専用スコープ**。本Skill v1 は frontmatter 必須 7 フィールド + `screens[]` 必須 10 フィールド + `elements[]` 必須 6 フィールド + kind 別必須フィールド（§2）のみを保証する。

v1 スコープ確定事項:
- `fidelity: mid-fi` 固定
- `color_mode: mono` 固定
- Optional 9 kind は manifest 記録のみで Figma 描画は `placeholder-block` 代替
- 動的 UI 挙動（タブ切替・モーダル開閉・トースト表示順序等）は manifest に記録しない

### 5.2 拡張ポリシー

- **v1 中の任意フィールド追加は OK**（後方互換、破壊的変更なし）
- 必須化したい項目は v2 として扱う（破壊的変更）
- v1 manifest を v2 Skill で読み込み: 必須化フィールド欠落 → 警告ログ + 推定/プレースホルダー補完
- v2 manifest を v1 Skill で読み込み: 拡張フィールドは無視（v1 は破壊的変更を受けない）

### 5.3 v2 で必須化候補のフィールド（参考、v1 スコープ外）

後続 .md 仕様書 Skill（項目定義書・メッセージ仕様書等）が必須にしたい項目の候補一覧。**v1 では実装しない**。

#### frontmatter
- `fidelity` 拡張（`lo-fi` / `hi-fi` 受理）
- `color_mode` 拡張（`color` 受理、デザインシステムカラー連携）
- `design_system_url`（デザインシステム manifest への参照）

#### screens[]
- `breadcrumb_path: [...]`（パンくず固定パス）
- `tab_group_id`（タブ画面のグルーピング、同一論理画面の複数タブ管理）
- `responsive_breakpoints[]`（layout 切替条件）

#### elements[]
- `max_length`, `min_value`, `max_value`（バリデーション境界値）
- `error_messages: { required: "...", format: "...", out_of_range: "..." }`（エラー文言完全定義）
- `ui_state_visibility: [normal, loading, error]`（状態別表示制御）
- `accessibility: { aria_label: "...", role: "..." }`（アクセシビリティ属性）
- `data_source_id`（function-spec FN-XXX への 1:1 リンク、現行 `source` の構造化）

### 5.4 v1→v2 マイグレーション手順（v2 リリース時に本セクションを更新）

v2 リリース時に本ファイル（manifest-schema.md §5）でマイグレーション手順を更新する。想定フロー:

1. v2 Skill 起動時に `frontmatter.schema_version` を判定
2. `schema_version: 1` 検出 → AskUserQuestion で「自動マイグレーション / 中止 / その他（自由入力）」を提示
3. 自動マイグレーション選択時:
   - `schema_version: 1 → 2` に書き換え
   - v2 必須化フィールドが欠落していれば推定/プレースホルダー補完（補完値は `source: migration-v1-to-v2` で記録）
   - 元 manifest を `.bak.v1` として退避
4. マイグレーション後の manifest を Write、ユーザーに「補完したフィールド一覧」を報告

### 5.5 未知の schema_version 検出（エラー E9）

`frontmatter.schema_version` が現行 Skill の受理範囲外（v1 Skill が v2 / v3 等を読み込んだ場合、または `source_screen_flow_schema_version` が不一致の場合）:

1. Skill 読み込みを **停止**
2. ユーザーにエラー報告:
   - 検出した `schema_version` 値
   - 現行 Skill の受理範囲（v1 Skill は `1` のみ）
   - Skill バージョン更新の促し（`@einja-inc/dev-cli` の sync コマンド案内）
3. 後続処理に進まず終了

**エラー E9 の発火条件まとめ**:
- `frontmatter.schema_version` が受理範囲外
- `frontmatter.source_screen_flow_schema_version` が受理範囲外
- `frontmatter.file_key` ≠ `frontmatter.source_screen_flow_file_key`
- `frontmatter.file_key` ≠ 現行 `screen-flow-url.md` の `file_key`
- `screens[].linked_screen_stable_id` が `screen-flow-url.md` の `screens[].stable_id` に存在しない
