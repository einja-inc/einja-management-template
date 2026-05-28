# function-specs manifest スキーマ

`docs/project/function-specs/index.md` と `function-spec-{flow_id}.md` のスキーマ仕様を定義する。SKILL.md ワークフロー Step 2.1（function-spec ファイル初期化）、Step 3.1（index.md 生成・更新）、Step 3.2（画面別逆引き表再生成）、Step 3.5（stable_id 存在チェック）から参照される。`screen-flow-url.md` の `stable_id` と互換性を持ち、双方向トレーサビリティを担保する。

## 目次

- [1. index.md 完全スキーマ](#1-indexmd-完全スキーマ)
- [2. function-spec-{flow_id}.md frontmatter スキーマ](#2-function-spec-flow_idmd-frontmatter-スキーマ)
- [3. flow_id 命名規則](#3-flow_id-命名規則)
- [4. screen-flow-url.md との連携・差分](#4-screen-flow-urlmd-との連携差分)
- [5. 拡張性（schema_version 互換性管理）](#5-拡張性schema_version-互換性管理)
- [6. 完全サンプル参照](#6-完全サンプル参照)

---

## 1. index.md 完全スキーマ

YAML frontmatter + body 3セクション（業務フロー一覧 / 画面別逆引き表 / 機能ID別逆引き表）の構成。

### 1.1 frontmatter

```yaml
---
schema_version: 1
generated_at: "2026-05-21T10:30:00Z"
project_name: "attendance-saas"
source:
  requirements: "../requirements.md"
  screen_flow: "../screen-flow-url.md"
function_specs:
  - flow_id: "attendance-saas__flow__time_punch_approval"
    file: "./function-spec-attendance-saas__flow__time_punch_approval.md"
    title: "打刻・申請・承認フロー"
    status: "draft"          # draft | review | approved
    system_flow: included    # 任意（function-spec frontmatter と同期）: included | omitted（既定: included）
    related_screens:
      - "attendance-saas__punch"
      - "attendance-saas__request"
      - "attendance-saas__approval-list"
      - "attendance-saas__approval"
    related_function_ids:
      - "FN-001"
      - "FN-002"
      - "FN-003"
  - flow_id: "attendance-saas__flow__monthly_aggregation"
    file: "./function-spec-attendance-saas__flow__monthly_aggregation.md"
    title: "月次集計フロー"
    status: "review"
    system_flow: included    # 任意（function-spec frontmatter と同期）
    related_screens:
      - "attendance-saas__dashboard"
      - "attendance-saas__monthly-report"
      - "attendance-saas__export"
    related_function_ids:
      - "FN-010"
      - "FN-011"
---
```

#### frontmatter フィールド定義

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `schema_version` | ✅ | integer | スキーマバージョン（integer。現行 v1（v1.x の後方互換を維持、v2 で破壊的変更）） |
| `generated_at` | ✅ | string (ISO 8601) | 最終生成日時（タイムゾーン付き）。例: `"2026-05-21T10:30:00Z"` |
| `project_name` | ✅ | string | プロジェクト名（kebab-case、`flow_id` プレフィックスと整合） |
| `source.requirements` | ✅ | string | requirements.md への相対パス（既定: `"../requirements.md"`） |
| `source.screen_flow` | ⚠️ | string | screen-flow-url.md への相対パス。未存在時は省略可 |
| `function_specs[]` | ✅ | array | 業務フロー単位の function-spec entry 配列 |

#### function_specs[] フィールド定義

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `flow_id` | ✅ | string | `{project_name}__flow__{snake_case_flow_name}` 形式 |
| `file` | ✅ | string | function-spec ファイルへの相対パス（同一ディレクトリ内、`./` プレフィックス） |
| `title` | ✅ | string | 業務フロー表示名（日本語可、自由形式） |
| `status` | ✅ | string | `draft`（未完了プレースホルダあり） / `review`（プレースホルダ0件、ユーザーレビュー待ち） / `approved`（合意完了） |
| `system_flow` | ⚠️ | string | `included`（§2.2 システム観点 sequenceDiagram あり、既定値） / `omitted`（§2.2 を `<!-- SKIPPED: 該当なし -->` で省略）。function-spec frontmatter の `system_flow` と同期する。欠損時は `included` 扱い（後方互換） |
| `related_screens[]` | ⚠️ | array | 関連画面の `stable_id` ユニーク集合。screen-flow-url.md 未存在時は空配列 |
| `related_function_ids[]` | ✅ | array | 当該フロー内で採番された `FN-XXX` ユニーク集合 |

### 1.2 body 構造

frontmatter の後に以下 3 セクションを記述する（順序固定）:

```markdown
# プロジェクト機能仕様書 一覧

## 業務フロー一覧

| flow_id | タイトル | ステータス | §2.2 包含 | 詳細 |
|---------|---------|----------|----------|------|
| attendance-saas__flow__time_punch_approval | 打刻・申請・承認フロー | draft | ◯ | [→](./function-spec-attendance-saas__flow__time_punch_approval.md) |
| attendance-saas__flow__monthly_aggregation | 月次集計フロー | review | ◯ | [→](./function-spec-attendance-saas__flow__monthly_aggregation.md) |
| attendance-saas__flow__audit_log | 監査ログフロー | draft | − | [→](./function-spec-attendance-saas__flow__audit_log.md) |

> 注: `§2.2 包含` 列は `function_specs[].system_flow` と同期する（`◯` = included / `−` = omitted）。`omitted` の場合は §2.2 が `<!-- SKIPPED: 該当なし -->` で省略され、システム観点記述は呼び出し元の各業務フロー §2.2 に組み込まれる方針となる。

## 画面別 関連機能逆引き表

| 画面 stable_id | 画面名 | ロール | 関連 function-spec | 関連 FN-XXX |
|---------------|--------|--------|------------------|------------|
| attendance-saas__punch | 打刻画面 | 従業員 | time_punch_approval | FN-001 |
| attendance-saas__request | 申請画面 | 従業員 | time_punch_approval | FN-002 |
| attendance-saas__dashboard | ダッシュボード | 人事 | monthly_aggregation | FN-010 |
| ...（screen-flow-url.md の screens[] 全件） | ... | ... | ... | ... |

> ロール列は `screen-flow-url.md` の `screens[].role` から自動引用する。`role` 未定義の画面は空欄。

## 機能ID別 所属フロー逆引き表

| FN-XXX | 機能名 | 所属 function-spec | 関連画面 stable_id |
|--------|--------|-----------------|------------------|
| FN-001 | 打刻機能 | time_punch_approval | attendance-saas__punch |
| FN-002 | 申請機能 | time_punch_approval | attendance-saas__request |
| FN-010 | 月次集計機能 | monthly_aggregation | attendance-saas__dashboard |

## 参照

- 要件定義書: [../requirements.md](../requirements.md) — §6 機能要件サマリへの**書き戻しは行わない**（独立採番）
- 画面遷移図: [../screen-flow-url.md](../screen-flow-url.md) — `stable_id` 参照キーの正本
```

### 1.3 body 生成ルール

| セクション | 生成タイミング | データソース |
|---------|--------------|----------|
| 業務フロー一覧 | Step 3.1 で全 function-spec 走査時 | `function_specs[]` |
| 画面別逆引き表 | Step 3.2 で screen-flow-url.md と突合時 | `screen-flow-url.md screens[]` + `function_specs[].related_screens[]` |
| 機能ID別逆引き表 | Step 3.1 で全 function-spec 走査時 | `function_specs[].related_function_ids[]` + 各 function-spec §3 機能一覧 |

screen-flow-url.md 未存在時は「画面別逆引き表」セクションを以下のプレースホルダで生成する:

```markdown
## 画面別 関連機能逆引き表

<!-- screen-flow-url.md が未生成です。/einja-project-screen-flow-drawio を実行後、本Skillをモード D（逆引き再生成モード）で再実行してください。 -->
```

---

## 2. function-spec-{flow_id}.md frontmatter スキーマ

```yaml
---
schema_version: 1
flow_id: "attendance-saas__flow__time_punch_approval"
project_name: "attendance-saas"
title: "打刻・申請・承認フロー"
status: "draft"
system_flow: included    # 任意フィールド: included | omitted（既定: included）
generated_at: "2026-05-21T10:30:00Z"
source:
  requirements: "../requirements.md"
  screen_flow: "../screen-flow-url.md"
related_screens:
  - "attendance-saas__punch"
  - "attendance-saas__request"
related_function_ids:
  - "FN-001"
  - "FN-002"
---
```

### 2.1 frontmatter フィールド定義（function-spec 側）

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `schema_version` | ✅ | integer | スキーマバージョン（integer。現行 v1（v1.x の後方互換を維持、v2 で破壊的変更）、index.md と一致させる） |
| `flow_id` | ✅ | string | `{project_name}__flow__{snake_case_flow_name}` 形式 |
| `project_name` | ✅ | string | プロジェクト名（kebab-case） |
| `title` | ✅ | string | 業務フロー表示名 |
| `status` | ✅ | string | `draft` / `review` / `approved` |
| `system_flow` | ⚠️ | string | `included`（§2.2 システム観点 sequenceDiagram あり、既定値） / `omitted`（§2.2 を `<!-- SKIPPED: 該当なし -->` で省略）。本フィールドが SSoT であり、index.md の `function_specs[]` 内対応 entry へ同期する。欠損時は `included` 扱い（後方互換） |
| `generated_at` | ✅ | string (ISO 8601) | 最終生成日時 |
| `source.requirements` | ✅ | string | requirements.md への相対パス |
| `source.screen_flow` | ⚠️ | string | screen-flow-url.md への相対パス（未存在時は省略可） |
| `related_screens[]` | ⚠️ | array | 関連画面 stable_id ユニーク集合 |
| `related_function_ids[]` | ✅ | array | 当該フロー内 `FN-XXX` ユニーク集合 |

### 2.2 frontmatter と index.md の同期ルール

- 各 function-spec の frontmatter は **index.md の `function_specs[]` 内対応 entry と完全一致** させる
- Step 3.1（index.md 生成）で各 function-spec の frontmatter を Read し、`function_specs[]` を構築する（function-spec 側が正本）
- ユーザーが function-spec 側 frontmatter を手動編集した場合、次回 Skill 実行時の Step 3.1 で index.md に反映される

---

## 3. flow_id 命名規則

### 3.1 形式

```
{project_name}__flow__{snake_case_flow_name}
```

- `project_name` 部分: kebab-case（例: `attendance-saas`）
- `flow_name` 部分: snake_case（例: `time_punch_approval`）
- 区切り: `__`（アンダースコア2つ）
- `screen-flow-url.md` の `stable_id`（`{project_name}__{name}`）と整合性を保つため、`flow` 識別子を中間に挟む

### 3.2 命名例

| flow_id | 業務フロー名 |
|---------|------------|
| `attendance-saas__flow__time_punch_approval` | 打刻・申請・承認フロー |
| `attendance-saas__flow__monthly_aggregation` | 月次集計フロー |
| `attendance-saas__flow__shift_management` | シフト管理フロー |
| `ec-platform__flow__order_fulfillment` | 受注・出荷フロー |
| `ec-platform__flow__customer_inquiry` | 顧客問い合わせ対応フロー |

### 3.3 衝突回避

- 同一 `project_name` 内で `flow_name` が衝突した場合、Skill は AskUserQuestion で別名指定を促す
- 別プロジェクト（`project_name` が異なる）の `flow_name` は衝突しない（プレフィックスで分離）

---

## 4. screen-flow-url.md との連携・差分

### 4.1 stable_id 参照キーの整合性

`function-spec.related_screens[]` の各要素は `screen-flow-url.md` の `screens[].stable_id` と完全一致する必要がある。

- 一致 → index.md の画面別逆引き表に当該機能が表示される
- 不一致（typo・削除済み） → Step 3.5 で警告ログ + AskUserQuestion で修正 or そのまま（後で screen-flow を更新予定）を確認

### 4.2 ID形式の差分表

| ID種別 | 形式 | 採番元 | 用途 |
|--------|------|--------|------|
| `stable_id`（screen-flow-url.md） | `{project_name}__{name}` | einja-project-screen-flow-drawio | 画面参照キー |
| `cell_id`（screen-flow-url.md / `.drawio` 内部） | `screen__{...}` / `edge__{...}` （`stable_id` の不正文字 `:` / `/` 等を `__` に置換した drawio mxCell ID） | einja-project-screen-flow-drawio | drawio mxCell の冪等性照合キー（参照のみ） |
| `flow_id`（本Skill） | `{project_name}__flow__{snake_case_flow_name}` | einja-project-function-spec | 業務フロー参照キー |
| `FN-XXX`（本Skill） | `FN-{3桁数字}` | einja-project-function-spec | 機能参照キー |

> 注: `cell_id` は `einja-project-screen-flow-drawio` Skill が `.drawio` XML の `mxCell` 単位での冪等再生成のために使う内部識別子。本 Skill (`einja-project-function-spec`) は **`stable_id` のみを参照する**（`cell_id` への直接参照は行わない）。

### 4.3 双方向トレーサビリティ

```
requirements.md §2 業務フロー
        ↓ (参照のみ、書き戻し禁止)
function-spec.flow_id ←→ screen-flow-url.screens.stable_id
        ↓                          ↑
        └→ function-spec.related_screens[]
        ↓
        FN-XXX
        ↓
        index.md 逆引き表 ←─── screen-flow-url.screens (画面別表で逆引き)
```

- requirements.md §6 機能要件サマリへの**書き戻しは絶対に禁止**（einja-project-requirements の独立性保持）
- screen-flow-url.md への**書き戻しも禁止**（einja-project-screen-flow-drawio の冪等性保持）
- 本Skillは `stable_id` を**読み取り専用**で利用し、`related_screens[]` 配列に列挙するのみ

---

## 5. 拡張性（schema_version 互換性管理）

### 5.1 現行バージョン

`schema_version: 1` 時の必須フィールドは §1.1 / §2.1 のテーブルで ✅ マーク付き全項目。

### 5.2 マイグレーションパス

- **v1 → v1.x**: 新フィールド追加のみの後方互換（v1 manifest は v1.x reader が読み取り可。v1.x 内ではすべて `schema_version: 1` のまま運用）
- **v1 → v2**: 必須フィールド追加・既存フィールド削除は破壊的変更。Skill 側で `schema_version` 判定し、未満バージョンは AskUserQuestion で「自動マイグレーション / 中止」を確認
- **未知の schema_version 検出時**: Skill 読み込みを停止し、ユーザーに Skill バージョン更新を促す

### 5.3 schema_version 不一致時の挙動

| 既存 schema_version | 本Skill対応 | 挙動 |
|------|------|------|
| `1` | `1` | 通常実行 |
| なし（旧形式） | `1` | AskUserQuestion で「自動マイグレーション（フィールド補完） / 中止」を確認 |
| 未知（例: `2`） | `1` | エラー停止、ユーザーに Skill 更新を促す |

### 5.4 任意フィールド `system_flow` の正本・同期ルール

`system_flow` は §2.2 システム観点 sequenceDiagram の有無を表す任意フィールドである。schema_version の互換ポリシー上は **v1.x で後方互換を維持する** 拡張フィールドとして扱う。

| 項目 | 内容 |
|------|------|
| 正本（SSoT） | function-spec frontmatter の `system_flow` |
| 同期先 | `index.md` の `function_specs[]` 内対応 entry の `system_flow` |
| 既定値（欠損時） | `included`（後方互換: 既存の v1 manifest に `system_flow` が無くても通常実行可能） |
| 取りうる値 | `included`（§2.2 あり） / `omitted`（§2.2 を `<!-- SKIPPED: 該当なし -->` で省略） |
| 生成・更新タイミング | Skill 実行時に function-spec frontmatter を更新したら、同セッション内で Step 3.1 で index.md `function_specs[]` を同期更新する |
| v1 → v1.x 互換 | `system_flow` は任意フィールドのため欠落しても OK（reader は `included` として扱う） |

#### 同期手順（Skill 内部の責務）

1. function-spec を Write / Edit する際、frontmatter に `system_flow` を必ず明記する（`included` でも省略せず書く）
2. index.md を Write / Edit する Step 3.1 で、各 function-spec の frontmatter から `system_flow` を Read し、`function_specs[]` 内対応 entry の `system_flow` に転記する
3. 既存 v1 manifest を読み込む際、`system_flow` フィールドが無い場合は `included` として扱う（migration prompt は出さない）

---

## 6. 完全サンプル参照

`docs/einja/example/specs/projects/sample-attendance-saas/function-specs/` 配下に、index.md + 複数 function-spec-{flow_id}.md の完全サンプルが配置されている（実装済み・完全サンプル）。

サンプル構成:
- `docs/einja/example/specs/projects/sample-attendance-saas/function-specs/index.md`
- `docs/einja/example/specs/projects/sample-attendance-saas/function-specs/function-spec-sample-attendance-saas__flow__time_punch.md`
- `docs/einja/example/specs/projects/sample-attendance-saas/function-specs/function-spec-sample-attendance-saas__flow__attendance_approval.md`

サンプル入力（既存）:
- `docs/einja/example/specs/projects/sample-attendance-saas/requirements.md`
- `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md`
