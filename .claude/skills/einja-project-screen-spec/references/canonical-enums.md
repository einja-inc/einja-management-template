# canonical-enums: einja-project-screen-spec 共通 enum 定義

このファイルは `references/wireframe-primitives.md` / `references/hearing-checklist.md` / `references/manifest-schema.md` / `SKILL.md` から参照される **canonical（正準）enum 定義**です。これら5ファイル間で enum 値の表記ゆれを防ぐため、本ファイルが Single Source of Truth です。

`SKILL.md` の Step 5/6/8/9/11/12 と `manifest-schema.md` §2、`hearing-checklist.md` §2、`wireframe-primitives.md` §3 は、本ファイルで定義した識別子を **lowercase + ハイフン形式** でそのまま使用してください。

## §1. element kind enum（24 + 1 = 25種）

mid-fi ワイヤーフレームを構成する要素プリミティブ。`manifest-schema.md` §2 で各 kind の必須フィールドが定義される。

### Core 15（今回スコープ必須実装、wireframe-primitives.md §3 でJS関数テンプレ）

| kind | 用途 | 主な推定ソース（function-spec / screen-flow / requirements） |
|------|------|---------------------------------------------------------|
| `header` | 画面上部の共通ヘッダー（プロジェクト名・ユーザー識別） | requirements §3 アクター |
| `side-nav` | 左サイドナビゲーション（画面間遷移） | screen-flow-url.md screens[] active 集合 |
| `page-title` | 画面タイトル（大型テキスト） | screen-flow-url.md screens[].name |
| `breadcrumb` | パンくずリスト | screen-flow-url.md edges[] 逆引き |
| `input-text` | テキスト入力欄（短文） | function-spec §3.2 入力（汎用） |
| `input-select` | セレクトボックス | function-spec §3.2 入力（「区分」「ステータス」キーワード）/ §5.4 enum 制約 |
| `input-date` | 日付入力欄 | function-spec §3.2 入力（「日付」「期間」キーワード） |
| `required-mark` | 必須マーク（入力ラベル右の `*`） | function-spec §5.4 必須制約 |
| `button-primary` | プライマリボタン（保存・送信系） | function-spec §3.2 処理ステップ最終アクション |
| `button-secondary` | セカンダリボタン（遷移・キャンセル系） | screen-flow-url.md edges[] トリガー |
| `table` | 一覧表（ヘッダー行 + データ行） | function-spec §4.2 内部データフロー / §6 一覧画面 |
| `validation-error` | 入力欄直下のエラーテキスト位置 | function-spec §5.4 制約違反挙動 |
| `error-banner` | ページ上部の業務エラーバナー | function-spec §3.2 業務エラー / §5.3 例外処理 |
| `empty-state` | 空状態プレースホルダー | UI 状態ヒアリング（一覧画面） |
| `loading-indicator` | ローディング表示 | UI 状態ヒアリング |

### Optional 9（Phase 4.1 で JS関数追加予定、今回は manifest 記録のみで Figma 描画は placeholder-block 代替）

| kind | 用途 |
|------|------|
| `modal-dialog` | モーダル/ダイアログ |
| `tabs` | タブ切替 |
| `pagination` | ページネーション |
| `checkbox` | チェックボックス |
| `radio` | ラジオボタン |
| `textarea` | 複数行テキスト入力 |
| `badge-status` | ステータスバッジ |
| `toast` | トースト通知 |
| `search-filter` | 検索・絞り込みUI |

### Fallback 1

| kind | 用途 |
|------|------|
| `placeholder-block` | 推定不能・スコープ外要素の代替（中央配置のグレー矩形 + ラベル「TBD」）。`source: unrecognized` で manifest 記録 |

## §2. layout enum

画面フレームの寸法・基本構成を決定する。

| value | サイズ目安 | 想定構成 |
|-------|----------|---------|
| `desktop` | 1440 × 900 | header + side-nav + content + footer |
| `mobile` | 375 × 812 | header + content + bottom-tabs |
| `modal` | 任意（800×600 推奨） | header 省略可、content のみ |

## §3. state enum

同一画面の状態バリエーション。複数指定時は state ごとに別 Frame を生成し、`stable_id` の末尾セグメントで区別する。

| value | 表現 |
|-------|------|
| `normal` | 通常状態（必須、デフォルト） |
| `loading` | ローディング中（loading-indicator を中央配置） |
| `error` | エラー表示（error-banner をページ上部に配置） |
| `empty` | 空状態（empty-state を中央配置） |

## §4. status enum

manifest 内のライフサイクル状態。再生成時の冪等性管理に使用。

| value | 意味 |
|-------|------|
| `active` | 現行構成に含まれる |
| `orphan` | 再生成で要件から削除された（自動削除はしない、ユーザーに手動削除を促す） |

## §5. source enum

要素の推定根拠を manifest に記録するためのカテゴリ。trace 可能性のため必須記録。

実際の manifest 記述では `source` フィールドに**enum 値 prefix + 出典詳細**を併記する形式とする。enum 値はファイル名・章番号と組み合わせて拡張される（例: `function-spec-{flow_id}.md (§3.2 FN-001 入力)` は `function-spec` enum のインスタンス）。

| value | 由来 |
|-------|------|
| `function-spec` | function-specs/function-spec-{flow_id}.md の §2/§3.2/§4.2/§5.3/§5.4/§6/§7 のいずれか |
| `requirements` | requirements.md の §3/§5/§6 のいずれか |
| `screen-flow` | screen-flow-url.md の screens[]/edges[] |
| `manual` | AskUserQuestion で手動追加された要素 |
| `unrecognized` | 推定不能（placeholder-block で代替） |

例:
- `function-spec-flow_time_punch.md (§3.2 FN-001 入力)` ← enum: function-spec
- `requirements.md (§3 アクター)` ← enum: requirements
- `screen-flow-url.md (edges[])` ← enum: screen-flow
- `manual` ← AskUserQuestion 由来
- `unrecognized` ← 推定不能・placeholder-block

## §6. stable_id 命名規約

### 6.1 screen-frame の stable_id（物理Frame識別子）

書式: `{project_name}__wf__{screen_name}__{layout}__{state}`

例: `sample-attendance-saas__wf__dashboard__desktop__normal`

- `project_name`: ASCII 英数ハイフン32字以内（Figma `setSharedPluginData` の key 100字制限予防のため Step 1 で正規化）
- `screen_name`: screen-flow-url.md の `screens[].name` をそのまま使用（kebab-case 推奨）
- `layout`: §2 layout enum
- `state`: §3 state enum

### 6.2 screen_stable_id（論理 wireframe 画面ID、layout/state 非依存）

書式: `{project_name}__wf__{screen_name}`

例: `sample-attendance-saas__wf__dashboard`

screen frame の `screen_stable_id` として manifest に保持。layout/state バリエーション横断の論理ID。

### 6.3 linked_screen_stable_id（上流 screen-flow 参照キー）

書式: `{project_name}__{screen_name}` （`__wf__` を含まない）

例: `sample-attendance-saas__dashboard`

screen-flow-url.md の `screens[].stable_id` と一致。

### 6.4 element_stable_id

書式: `{screen_frame_stable_id}__el__{kind}__{slug_or_index}`

例: `sample-attendance-saas__wf__dashboard__desktop__normal__el__input-text__employee-name`

- `kind`: §1 element kind enum
- `slug_or_index`: kebab-case のスラッグ（例: `employee-name`）、推定不能時は連番（`01`, `02`）

### 6.5 100字超過時の truncate ルール

`setSharedPluginData` の key が 100字を超える場合は SHA-256 ハッシュの先頭 16進 12桁に truncate する。元の stable_id は manifest の `stable_id_full` 任意フィールドに保持し、`stable_id` には truncate 値を記録。

擬似コード:
```javascript
function truncateStableId(rawId) {
  if (rawId.length <= 100) return rawId;
  const hash = sha256(rawId).slice(0, 12);  // SHA-256 を hex 表現で先頭 12 文字
  return rawId.slice(0, 83) + "__h__" + hash;  // 83 + 5 + 12 = 100
}
```

衝突検知: truncate 後の stable_id が既存と衝突した場合は警告ログ + 連番付与。

## §7. Skill 内 namespace

Figma `setSharedPluginData` の namespace は `einja.screenSpec` 固定。`einja.screenFlow`（screen-flow-figma）とは厳密に分離。`findAll` のスコープも `figma.currentPage = wireframesPage` 切替後に限定。
