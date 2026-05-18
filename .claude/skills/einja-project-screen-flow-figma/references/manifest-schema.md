# screen-flow-url.md スキーマ

`docs/project/screen-flow-url.md` の完全スキーマ仕様と冪等性ポリシーを定義する。SKILL.md ワークフロー Step 10（Figma URL + manifest 記録）および Step 11（再生成時の冪等性照合）、§5 エラー処理パターン から参照される。`ui-design-url.md` とフィールド互換だが用途が異なる（プロジェクト全体の画面遷移 vs Issue単位の画面モックアップ）。

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
---

## screens

- name: dashboard
  stable_id: <project>__dashboard
  node_id: "1:23"
  role: 管理者/従業員
  status: active   # active | orphan
  position:
    x: 0
    y: 0

## edges

- from: dashboard
  to: settings
  trigger: 設定ボタンクリック
  stable_id: dashboard__to__settings
  node_id: "1:45"
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

### 1.2 screens[] フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `name` | ✅ | string | 画面名（kebab-case、Figma FrameNode 名と一致） |
| `stable_id` | ✅ | string | 冪等性照合用ID。`{project_name}__{name}` 形式 |
| `node_id` | ✅ | string | Figma ノードID（`"1:23"` コロン形式） |
| `role` | ⚠️ | string | 対象ユーザー/ロール（要件§3由来。複数は `/` 区切り） |
| `status` | ✅ | string | `active`（要件にあり） / `orphan`（要件から削除済み） |
| `position` | ⚠️ | object | `{x, y}` 座標。ユーザー手動編集を尊重して保持 |

### 1.3 edges[] フィールド

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `from` | ✅ | string | 遷移元画面の `name` |
| `to` | ✅ | string | 遷移先画面の `name` |
| `trigger` | ✅ | string | 遷移トリガー（例: 「設定ボタンクリック」） |
| `stable_id` | ✅ | string | `{from}__to__{to}` 形式 |
| `node_id` | ✅ | string | Figma VectorNode（矢印）のノードID |
| `status` | ✅ | string | `active` / `orphan` |

**Note**: `edges` の `stable_id` には `screens` と異なり `project_name` プレフィックスを付けていない。これは本 Skill が「1 Figma ファイル = 1 プロジェクト」を前提としており、ファイル内で `{from}__to__{to}` だけで一意に識別できるため。複数プロジェクトを同一ファイルに混在させる場合は SKILL.md レベルで AskUserQuestion による衝突回避が必要。

## 2. ui-design-url.md とのフィールド差分

| フィールド | screen-flow-url.md | ui-design-url.md | 互換性 |
|----------|--------------------|-------------------|--------|
| `figma_url` | ✅ | ✅ | 共通 |
| `file_key` | ✅ | ✅ | 共通 |
| `plan_key` | ✅ | ❌ | 本Skill固有 |
| `schema_version` | ✅ | ❌ | 本Skill固有 |
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

## 4. YAML 最小実例（screens 1件、edges 1件）

**完全実例**: 10画面 + 12エッジを含む完全な manifest 実例は `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` を参照。

```yaml
---
figma_url: https://www.figma.com/design/abc123
file_key: abc123
plan_key: team::1152187400294529955
schema_version: 1
generated_at: 2026-05-18
project_name: attendance-saas
---

## screens

- name: dashboard
  stable_id: attendance-saas__dashboard
  node_id: "1:2"
  role: 人事部
  status: active
  position: { x: 0, y: 0 }

## edges

- from: dashboard
  to: monthly-report
  trigger: 月次レポートボタンクリック
  stable_id: dashboard__to__monthly-report
  node_id: "1:8"
  status: active
```

## 5. 拡張性（schema_version 互換性管理）

`schema_version: 1` 時の必須フィールドは §1.1〜§1.3 のテーブルで✅マーク付き全項目。将来スキーマ変更時のマイグレーションパス:

- **v1 → v2**: 新フィールド追加は後方互換（v1 manifest は v2 reader が読み取り可）。必須フィールド追加・既存フィールド削除は破壊的変更となるため、Skill 側で `schema_version` 判定し、未満バージョンは AskUserQuestion で「自動マイグレーション / 中止」を確認する
- **未知の schema_version 検出時**: Skill は読み込みを停止し、ユーザーに Skill バージョン更新を促す
