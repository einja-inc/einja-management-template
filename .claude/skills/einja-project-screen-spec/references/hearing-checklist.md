# 入力ソース章識別 + element kind 推定 + ヒアリング項目チェックリスト

本ファイルは `einja-project-screen-spec` Skill の **Step 6（要素候補推定）** および **Step 7（AskUserQuestion ヒアリング A→B→C→D→E）** から参照される（SKILL.md §4 のワークフロー定義と整合）。`docs/project/requirements.md` / `docs/project/screen-flow-url.md` / `docs/project/function-specs/function-spec-*.md` の3ソースから wireframe を構成する画面リストと element kind 集合を確定させるための識別ルール・推定マッピング・質問テンプレを定義する。

参照: `./canonical-enums.md`（kind/layout/state/source/status の Single Source of Truth）。本ファイルの enum 表記は同ファイルの **lowercase + ハイフン形式** をそのまま引用する。

---

## §1. 入力ソース3種の章識別

ワイヤーフレーム生成に必要な情報を3ファイルから抽出する。章番号はスキーマ変更で揺れるため、**見出し名ベース**の正規表現で識別する。

### 1.1 requirements.md（業務要件・アクター・スコープ）

| 抽出対象 | 主要シグナル | 識別パターン（正規表現） | 用途 |
|---------|------------|----------------------|------|
| アクター一覧 | §3 対象ユーザー / §3.1 主要ロール | `/^##\s+(\d+\.\s*)?対象ユーザー/m` | `header` のユーザー識別表示 / `side-nav` のロール別表示 |
| スコープ境界 | §5 スコープ境界 / §5.1 機能スコープ | `/^##\s+(\d+\.\s*)?スコープ境界/m` | 「含まない」表で画面除外（manifest 記録対象外） |
| 機能サマリ | §6 機能要件サマリ / §6.1 機能一覧 | `/^##\s+(\d+\.\s*)?機能要件/m`、サブ表 `/^###\s+(\d+(\.\d+)*\s*)?機能一覧/im` | function-spec 未生成機能のフォールバック要素推定 |
| アーキテクチャ方針 | §4 システム化方針（モバイル前提か等） | `/^##\s+(\d+\.\s*)?システム化方針/m` | layout 既定値判定（§3 参照） |

**抽出規則**: 章が見つからない場合は警告ログ出力後フォールバック（§6 機能一覧のみで画面要素推定）。requirements.md は **読み取り専用**として扱う（編集禁止）。

### 1.2 screen-flow-url.md（画面定義・遷移）

frontmatter + `## screens` + `## edges` の3ブロック構造。

| 抽出対象 | 位置 | 識別パターン | 用途 |
|---------|------|------------|------|
| プロジェクト識別子 | frontmatter | `^project_name:\s*(\S+)$` | `stable_id` 生成（canonical-enums §6） |
| Figma file_key / plan_key | frontmatter | `^file_key:\s*(\S+)$` / `^plan_key:\s*(\S+)$` | 同一 Figma ファイルへの WireFrames ページ追加判定 |
| 画面リスト | `## screens` 配下 | `^- name:\s*(\S+)$` 行 + 後続 `stable_id` / `role` / `status` / `position` フィールド | wireframe 画面候補（status: active のみ採用） |
| 画面間遷移 | `## edges` 配下 | `^- from:` / `^- to:` ペア + `trigger:` フィールド | `button-secondary`（遷移系ボタン）推定 / breadcrumb 逆引き |

**抽出規則**:
- `status: active` のみ wireframe 化対象。`status: orphan` はスキップ（manifest 記録もしない）。
- `name` を `screens[].name` として保持し、canonical-enums §6 の `linked_screen_stable_id` 生成キーに使う。
- `role` フィールドが存在する画面は `header` のロール表示推定に使用。

### 1.3 function-spec-{flow_id}.md（機能仕様・データフロー・例外）

function-specs/ ディレクトリ配下の各ファイル。**§2 / §3.2 / §4.2 / §5.3 / §5.4 / §6 / §7** が主要シグナル。

| 抽出対象 | セクション | 識別パターン | 用途 |
|---------|----------|------------|------|
| 業務ステップ一覧 | §2.3 ステップ別表 | `/^##\s+2\.\s+業務フロー詳細/m` 配下の `/^###\s+2\.3\s+ステップ別表/m` | アクション系ボタン推定 |
| 画面イベント sequenceDiagram | §2.2 システム観点 | `/^###\s+2\.2\s+システム観点/m` 配下の ```mermaid sequenceDiagram` | 画面表示時のデータ取得 / フォーム送信トリガー |
| 機能カード（MUST 機能） | §3.2 機能カード | `/^###\s+3\.2\s+機能カード/m` 配下の `**FN-\d+**` ブロック | 入力フィールド・ボタンの主要推定源 |
| 内部データフロー | §4.2 内部システム間データフロー | `/^###\s+4\.2\s+内部システム間データフロー/m` | `table`（一覧画面）の有無判定 |
| 例外処理 | §5.3 例外処理 | `/^###\s+5\.3\s+例外処理/m` | `error-banner` / `validation-error` 推定 |
| 主要技術制約 | §5.4 主要技術制約 | `/^###\s+5\.4\s+主要技術制約/m` | 必須制約 → `required-mark`、enum 制約 → `input-select` 推定 |
| 関連画面一覧 | §6 関連画面一覧 | `/^##\s+6\.\s+関連画面一覧/m` | screen-flow-url.md の `screens[]` との突合（traceability） |
| 未確定事項 | §7 未確定事項 | `/^##\s+7\.\s+未確定事項/m` | placeholder-block 生成判定 / ヒアリング項目E 補強 |

**読み取り規則**: 1機能 = 1 function-spec ファイル前提。`function-specs/index.md` の manifest から対象ファイル一覧を取得し、各ファイルを上記パターンで Read + 章単位で grep。

---

## §2. function-spec → element kind 推定マッピング

`canonical-enums.md` §1 の **Core 15 + Optional 9 + placeholder-block** の各 kind について、function-spec のどのセクション・どのキーワードから推定するかを定義。

### 2.1 Core 15（必須実装、wireframe-primitives.md §3 の JS 関数で Figma 描画）

| kind | 推定セクション | キーワード / パターン | 備考 |
|------|--------------|-------------------|------|
| `header` | requirements.md §3 アクター | 全画面共通生成 | screen-flow-url.md `role` で表示テキスト切替 |
| `side-nav` | screen-flow-url.md `screens[]` (active) | layout: desktop のみ自動生成 | mobile/modal では非生成 |
| `page-title` | screen-flow-url.md `screens[].name` | name を Title Case 変換して使用 | 全画面共通生成 |
| `breadcrumb` | screen-flow-url.md `edges[]` 逆引き | 1階層以上の親画面が存在する場合のみ | layout: desktop のみ |
| `input-text` | function-spec §3.2 機能カードの入力項目 | デフォルト（他の input-* に該当しない入力） | 「自由入力」「テキスト」「コメント」（textarea候補も） |
| `input-select` | function-spec §3.2 + §5.4 | 「区分」「ステータス」「種別」「カテゴリ」を含む / §5.4 で enum 制約 (`列挙`/`値は X, Y, Z`) | enum 値が4個以下なら `radio` 推奨 |
| `input-date` | function-spec §3.2 | 「日付」「期間」「日時」「タイムスタンプ」「from～to」を含む | 期間指定は2フィールド生成 |
| `required-mark` | function-spec §5.4 必須制約 | 「必須」「required」「NOT NULL」 | input-* と組で配置 |
| `button-primary` | function-spec §3.2 処理ステップ最終アクション | 「保存」「登録」「送信」「承認」「実行」「打刻」 | 1画面1個推奨 |
| `button-secondary` | screen-flow-url.md `edges[]` | 「キャンセル」「戻る」「閉じる」/ 遷移トリガー | 複数可 |
| `table` | function-spec §4.2 / §6 関連画面 | 「一覧」「集計」「履歴」「リスト」 / 画面名に `-list` 含む | ヘッダー行 + データ行3行 |
| `validation-error` | function-spec §5.4 制約違反挙動 | 「エラー」「拒否」「リジェクト」「不正」 + 入力欄に紐づく | input-* 直下配置 |
| `error-banner` | function-spec §3.2 業務エラー / §5.3 例外処理 | パターン → 画面メッセージ系（「失敗時にメッセージ表示」） | state: error フレームに必須 |
| `empty-state` | （function-spec から直接推定せず） | ヒアリング項目E で確認 | 一覧画面 + state: empty で生成 |
| `loading-indicator` | （function-spec から直接推定せず） | ヒアリング項目E で確認 | state: loading フレームに必須 |

### 2.2 Optional 9（Phase 4.1 で JS 関数追加予定。今回は manifest に kind 記録のみ → Figma 上は placeholder-block で代替描画）

| kind | 推定セクション | キーワード / パターン |
|------|--------------|-------------------|
| `modal-dialog` | function-spec §3.2 / §5.3 例外処理 | 「確認ダイアログ」「ポップアップ」「モーダル」 / 削除・承認系の確認ステップ |
| `tabs` | screen-flow-url.md `screens[]` + §6 関連画面 | 同一 role の関連画面が3件以上 → 集約候補 |
| `pagination` | function-spec §4.2 内部データフロー | 「大量データ」「N件以上」「ページネーション」「ページ分け」 |
| `checkbox` | function-spec §3.2 | 「複数選択」「複数指定」「フラグ」（複数値） |
| `radio` | function-spec §3.2 + §5.4 enum | enum 値が4個以下の選択 |
| `textarea` | function-spec §3.2 | 「複数行」「コメント」「備考」「自由記述」 |
| `badge-status` | function-spec §5.4 + §4.2 | enum 制約のステータス値（「承認中」「却下」等） |
| `toast` | function-spec §3.2 業務完了通知 | 「保存しました」「完了通知」（一時表示） |
| `search-filter` | function-spec §4.2 + 画面名 `-list` / §6 一覧画面 | 「検索」「絞り込み」「フィルタ」 |

### 2.3 Fallback（placeholder-block）

| kind | 推定セクション | 用途 |
|------|--------------|------|
| `placeholder-block` | （function-spec / screen-flow から推定不能な要素） | Optional 9 の Figma 描画代替 / ヒアリングで「TBD」回答時 / `source: unrecognized` |

**重要**: function-spec から推定不能な要素は **AskUserQuestion で都度確認せず placeholder-block を生成**してヒアリング数を削減する（§5 アンチパターン参照）。

---

## §3. 画面 layout 判定ヒューリスティック

screen-flow-url.md の `screens[]` から `layout: desktop | mobile | modal` を推定するルール。canonical-enums §2 参照。

### 3.1 判定優先順位

1. **screen name パターン優先**:
   - `confirm-*` / `preview-*` / `dialog-*` を含む → `modal`
   - `mobile-*` / `*-mobile` を含む → `mobile`
2. **role フィールドで補強**:
   - role が「現場作業員」「外勤」「ドライバー」等の移動系 → `mobile`
3. **requirements.md §4 システム化方針**:
   - 「モバイル前提」「スマートフォンアプリ」「現場での利用」を含む → プロジェクト全体の既定値を `mobile` に変更
4. **デフォルト**: `desktop`

### 3.2 layout バリエーション複数生成判定

同一 screen に対し `desktop` + `mobile` 両方を生成するケースは原則なし（プロジェクト既定値1つに統一）。**ヒアリング項目B でユーザーが明示的に要求した画面のみ複数生成**する。

---

## §4. AskUserQuestion 項目 A〜E 質問テンプレ

ヒアリングは **項目を分割**し A → B → C → D → E の順で実施する（A の回答で B 以降の対象画面・選択肢が確定するため、依存関係順守必須）。

各選択肢は **description（What: 何をするか）** と **Note（So What: メリット・デメリット・注意事項）** の2層構成。最後は必ず **「その他（自由入力）」** を含める。

### 項目A: ワイヤーフレーム生成対象の画面リスト確定

**質問文**: ワイヤーフレーム生成対象の画面リストを確定してください。`screen-flow-url.md` の `status: active` な画面 {N}件（{names}）が候補です。

| 選択肢 | description | Note |
|--------|------------|------|
| (a) 全画面を採用 | 候補 {N}件すべてをワイヤーフレーム化対象とする | メリット: 最も網羅的。デメリット: 所要時間 約 {N × 4.5}分（平均8要素 × 4 state）。Optional 9 種は placeholder-block で代替描画される |
| (b) 一部除外して採用 | 候補から除外する画面名を自由入力で指定し、残りを採用 | 例: `login,error` のようにカンマ区切り。除外画面は manifest に含まれない（screen-flow 側 status は変更しない） |
| (c) 共通画面を追加 | 候補にない汎用画面（login, error, 404, profile 等）を追加採用 | screen-flow-url.md には記録されないが wireframe-url.md には `source: manual` として記録。後工程で screen-flow への手動追加を推奨 |
| (d) 主要画面のみ採用（人数上位3） | role 別に主要画面 3件のみ採用 | メリット: 短時間で動作確認可能（約15分）。デメリット: 後で追加生成時に冪等性検証が必要 |
| (e) その他（自由入力） | 上記以外の選別方針 | 自由入力で具体的指示（例: 「フェーズ1スコープのみ」） |

### 項目B: 各画面の layout / state バリエーション

**質問文**: 採用画面ごとに layout と state バリエーションを確定してください。デフォルトは全画面 `desktop` + `normal` のみ生成です。

| 選択肢 | description | Note |
|--------|------------|------|
| (a) デフォルト（desktop × normal のみ） | 全画面 `layout: desktop` × `state: normal` の1フレームのみ生成 | 最速。後から再実行で state バリエーション追加可能（冪等性により既存フレーム保持） |
| (b) 一覧画面のみ4 state 生成 | `-list` を含む画面 + table を含む画面で `normal / loading / error / empty` の4フレーム生成 | UX 設計レビューに有用。所要時間 +30%。state ごとに `stable_id` 末尾が変わる（canonical-enums §6.1） |
| (c) 全画面 × 全 state（4倍生成） | 全画面で `normal / loading / error / empty` の4フレーム生成 | フル網羅。所要時間 4倍。modal レイアウトはこの対象外 |
| (d) layout を mobile 既定に変更 | プロジェクト全体の layout 既定値を `mobile` (375 × 812) に切替 | requirements.md §4 が「モバイル前提」の場合に推奨。side-nav は非生成 |
| (e) 画面ごとに個別指定 | 画面名と layout/state の組合せを自由入力で指定 | 例: `punch:mobile:normal,dashboard:desktop:normal+loading`。表形式での提示が望ましい |
| (f) その他（自由入力） | 上記以外の指定 | - |

### 項目C: フォーム項目・要素一覧の確定（表形式提示）

**質問文**: 各画面の推定要素一覧を以下の表で確認してください。差分のみ自由入力で指示してください（個別画面ごとの再質問は行いません）。

**推定要素一覧テーブル例（提示形式）**:

| 画面 | 推定要素一覧（kind と概要） |
|------|--------------------------|
| dashboard | header / side-nav / page-title「ダッシュボード」 / table（直近打刻3件） / button-primary「打刻へ」 |
| punch | header / page-title「打刻」 / input-select「打刻種別」 / input-date「日付」 / required-mark × 2 / button-primary「打刻実行」 / button-secondary「キャンセル」 |
| request | header / page-title「申請」 / input-select「申請種別」 / input-date「期間 from」 / input-date「期間 to」 / textarea「理由」（placeholder-block で代替） / button-primary「申請」 |
| approval-list | header / side-nav / page-title「申請一覧」 / search-filter（placeholder-block） / table（申請一覧） / pagination（placeholder-block） |
| approval | header / page-title「申請承認」 / table（申請詳細） / button-primary「承認」 / button-secondary「差し戻し」 |

**選択肢**:

| 選択肢 | description | Note |
|--------|------------|------|
| (a) すべて承認 | 推定要素一覧をそのまま採用 | 最速。Optional 9 種は placeholder-block で代替描画される |
| (b) 一部画面のみ差分指定 | 差分指定したい画面名と変更内容を自由入力 | 例: `punch: input-text「メモ」追加 / button-primary を「打刻」に変更`。指定がない画面は (a) と同等扱い |
| (c) 全画面で共通要素を追加 | 全画面に同じ要素（例: footer, logout-button）を追加 | 自由入力で kind と配置を指定。`source: manual` として記録 |
| (d) Optional 9 種を実体描画に格上げ | placeholder-block 代替対象の kind を Figma 描画対象に変更 | Note: Phase 4.1 で実装予定の JS 関数が必要。今回はスコープ外（実体描画不可）→ 自動的に (a) と同等扱いに |
| (e) その他（自由入力） | 表形式以外の指示 | - |

### 項目D: ロール別表示（header / side-nav の出し分け）

**質問文**: `header` のユーザー識別表示と `side-nav` のメニュー項目をロール別に出し分けますか？

| 選択肢 | description | Note |
|--------|------------|------|
| (a) 出し分けあり（screen-flow `role` フィールド準拠） | screen-flow-url.md `screens[].role` で header テキスト・side-nav メニューを切替 | requirements §3.3 権限マトリクスとの整合性確保。manifest に `role` を併記 |
| (b) 出し分けなし（汎用） | 全画面で同一 header / side-nav を生成 | 最速。プレースホルダーテキスト「{Role}」のままになる |
| (c) header のみ出し分け | header のユーザー識別はロール別、side-nav は共通 | layout: desktop で side-nav を全画面共通化したい場合に推奨 |
| (d) その他（自由入力） | 出し分けロジックを自由入力 | 例: 「人事部のみ全メニュー、それ以外は3項目」 |

### 項目E: UI 状態（loading / empty / error）の表示内容

**質問文**: 項目B で `loading` / `empty` / `error` state を生成する画面について、表示内容を確認してください。

| 選択肢 | description | Note |
|--------|------------|------|
| (a) デフォルト文言で生成 | loading: 「読み込み中...」 / empty: 「データがありません」 / error: 「エラーが発生しました」 | 最速。後から Figma 上で手動編集可能（冪等性により再実行で保持） |
| (b) function-spec §5.3 例外処理の文言を参照 | function-spec §5.3 から error 文言を抽出して使用 | メリット: 実装時の文言と一致。デメリット: §5.3 未記述時は (a) フォールバック |
| (c) 画面ごとに個別文言指定 | 自由入力で画面名と各 state の文言を指定 | 例: `approval-list: empty=「承認待ち申請はありません」` |
| (d) state バリエーション自体を生成しない | 項目B の選択を取り消し、`normal` のみに戻す | 項目B の選択肢 (a) と同等になる |
| (e) その他（自由入力） | 上記以外の指示 | - |

---

## §5. ヒアリング・アンチパターン

ヒアリング設計時に守るべきルール。違反するとユーザー負担増・冪等性破綻・スコープ逸脱を招く。

### 5.1 質問数爆発の防止

- **「画面ごと × 項目ごと」の組合せ爆発を禁止**: 10画面 × 5項目 × 個別質問 = 50問のような展開は禁止。項目C で **表形式一括提示 + 差分のみ自由入力**で集約する。
- **AskUserQuestion を一度に5問以上連続で出さない**: 項目 A〜E の5問で打ち止め。追加質問が必要な場合は項目C/E の自由入力選択肢で吸収する。
- **「全画面」「全項目」のような大規模選択は description で工数を明示**: 「所要時間 約45分」「placeholder-block で代替」等を必ず Note に記載。

### 5.2 推定不能要素の扱い

- **function-spec から推定不能な要素は AskUserQuestion で確認せず placeholder-block を生成する**: 質問数削減のため。`source: unrecognized` として manifest 記録 + Figma 上は中央配置のグレー矩形 + ラベル「TBD」。
- **Optional 9 種は実体描画せず placeholder-block 代替**: Phase 4.1 で JS 関数追加予定のため、今回は manifest に kind 記録のみ。
- **ユーザー回答後の追加質問は差分指定があった画面のみ**: 項目C で「(b) 一部画面のみ差分指定」を選んだ場合のみ、指定画面の詳細を確認する。指定外画面の再質問は禁止。

### 5.3 スコープ逸脱の防止

- **UI 詳細（色・フォントサイズ・余白）は本 Skill のスコープ外**: 「ボタンの色は？」「フォントは？」等は禁止。mid-fi ワイヤーフレームのため一律グレースケール + 標準フォントで描画する（→ 詳細デザインは `ui-design-generator` Skill 範疇）。
- **画面遷移ロジックの詳細は問わない**: 「クリック後の挙動」「APIレスポンス」等は function-spec / design.md の責務。本 Skill は画面構成要素の配置のみ。
- **要件定義書を逸脱した新規機能の提案を避ける**: 「この画面に通知機能も付けますか？」等は禁止。requirements.md / screen-flow-url.md / function-specs のみを情報源とする。

### 5.4 ユーザー入力の表記揺れ防止

- **「未確定で先に進む」を必ず提供**: 後から再実行 / 手動編集で修正可能であることを Note に明記し、ヒアリングのブロッキングを防ぐ。
- **タイポ警戒**: 「PEDING_QUESTIONS」は誤り。正しくは **`PENDING_QUESTIONS`**（`_einja-subagent-question-protocol` 準拠）。
- **enum 値の表記は canonical-enums.md の lowercase + ハイフン形式に統一**: `Desktop` / `LOADING` / `Active` などの揺れは Skill 側で正規化する（ユーザー入力をそのまま信用しない）。
- **stable_id はユーザーに見せない**: 内部識別子のため、ヒアリングでは `screens[].name` のみを使用する。

---

## §6. 関連リファレンス

- `./canonical-enums.md` — kind / layout / state / source / status の Single Source of Truth
- `./manifest-schema.md` — wireframe-url.md 完全スキーマ + 冪等性ポリシー + screen-flow-url.md 差分 + v1→v2 マイグレーション
- `./wireframe-primitives.md` — Core 15 プリミティブ JS 関数テンプレ + 二層 auto-layout 方針 + 動的バッチ分割
- `../../einja-project-function-spec/references/output-template.md` — function-spec の §2/§3.2/§4.2/§5.3/§5.4/§6/§7 章構造（推定マッピングの根拠）
- `../../einja-project-screen-flow-figma/references/hearing-checklist.md` — 前 Phase（screen-flow）のヒアリング構造（本ファイルの参考実装）
- `../../_einja-subagent-question-protocol/SKILL.md` — PENDING_QUESTIONS 返却プロトコル
