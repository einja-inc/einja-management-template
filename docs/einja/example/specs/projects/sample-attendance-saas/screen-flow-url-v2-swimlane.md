<!--
本ファイルはサンプル用の screen-flow-url.md です（Plan v2.1: swim-lane レイアウト前提）。
本来の出力先は docs/project/screen-flow-url.md（1リポジトリ1プロジェクト前提）。
einja-project-screen-flow-drawio Skill により生成されるマニフェストの実例として配置しています。

**本 fixture は einja-project-screen-flow-drawio Skill の `normalizeManifestV1or2` 関数の動作確認用です。schema_version: 1 を保持しており、v2 reader（drawio Skill 現行版）が読むと「再生成して drawio 化 / 中止 / その他（自由入力）」の AskUserQuestion 警告が出るのが期待動作です。詳細: references/manifest-schema.md §5。**
schema_version: 1 のまま据置し、旧 Figma 時代のフィールド構造（figma_url / file_key / plan_key / node_id）を保持する。

- 入力サンプル: ./requirements.md
- Skill 定義: .claude/skills/einja-project-screen-flow-drawio/
- スキーマ定義: .claude/skills/einja-project-screen-flow-drawio/references/manifest-schema.md
- レーン enum / 同義語: .claude/skills/einja-project-screen-flow-drawio/references/canonical-enums.md
- 矢印ルーティング規約: .claude/skills/einja-project-screen-flow-drawio/references/drawio-style-rules.md

本ファイルは swim-lane レイアウト前提のサンプル成果物です。
v3 user-flow（現行 default、`screen-flow-url.md`）と v1 grid（`screen-flow-url-v1-grid.md`）に対する、**明示 swim-lane 指定時の参考 fixture** として保持する。3 層 fixture 構造（v1 grid / v2 swim-lane / v3 user-flow）の v2 swim-lane 側。
v1 後方互換 fixture（schema_version: 1 のままの旧格子レイアウト）は
同ディレクトリの screen-flow-url-v1-grid.md を参照してください。

サンプル簡略化のため省略している画面（ヒアリング Step 4 項目A での確定経緯を含む）:
- MFA 入力画面（§4.2 Auth.js + 多要素認証由来）→ login 画面に統合
- F-08 監査ログ閲覧画面 → hearing-checklist §3.2 で暫定推定だが、Step 4 ヒアリングにて管理者専用機能として省略確定
- ホーム / メニュー画面（hearing-checklist §3.3 共通画面候補）→ dashboard が HOME 相当のため統合
- 設定画面 / プロフィール（hearing-checklist §3.3 共通画面候補）→ 本サンプルのスコープ外（v2 想定）
- B3 差し戻しコメント入力画面 → approval 画面内モーダル操作として統合
- S3 未打刻アラート通知画面（§2.1.2 mermaid S3 由来）→ メール/push通知のため画面化対象外

クロスチェック由来の補完画面（権限マトリクス推定 / source_confidence: high）:
- forbidden-403: 認可エラー（403）共通画面。権限マトリクス（Manager/HR/Admin 限定機能への
  Employee アクセス時など）から補完。Common lane に配置。

position 算出ルール (drawio-style-rules.md §3.1):
- `x = LANE_HEADER_W (160) + x_order * (FRAME_W (240) + FRAME_SPACING_X (80)) = 160 + x_order * 320`
- `y = lane_index * LANE_HEIGHT (240) + FRAME_SPACING_Y (40)`
- `lane_index` は role_canonical_map 適用後の **usedLanes**（実利用 lane のみ）における canonical 出現順
  （canonical-enums §5 のデフォルト辞書順 `Common→Employee→Manager→HR→Admin→Ext` を維持）
- 本サンプルでは Ext 未使用のため Common=0, Employee=1, Manager=2, HR=3, Admin=4
- x_order は業務フロー順の topological sort 結果（同一 lane 内で 0 始まり）
- Skill 再生成時もユーザー手動レイアウトを保持する設計（manifest-schema.md §3.1）

注意: 下記 figma_url / file_key / plan_key / node_id はサンプル用プレースホルダーであり、
実在の Figma ファイルではありません（実ファイル添付は Figma MCP 復旧後の
別 Issue で対応予定）。
-->
---
figma_url: https://www.figma.com/design/PLACEHOLDER_FILE_KEY/sample-attendance-saas-screen-flow
file_key: PLACEHOLDER_FILE_KEY
plan_key: PLACEHOLDER_PLAN_KEY
schema_version: 1
generated_at: 2026-05-25
project_name: sample-attendance-saas
layout_strategy: swim-lane
role_canonical_map:
  共通: Common
  従業員: Employee
  上長: Manager
  管理者: Manager
  人事部: HR
  システム管理者: Admin
---

## screens

- name: login
  stable_id: sample-attendance-saas__login
  node_id: "PLACEHOLDER_NODE_ID_login"
  role: 共通
  lane_id: Common
  source_confidence: high
  status: active
  position: { x: 160, y: 40 }

- name: forbidden-403
  stable_id: sample-attendance-saas__forbidden-403
  node_id: "PLACEHOLDER_NODE_ID_forbidden_403"
  role: 共通
  lane_id: Common
  source_confidence: high
  status: active
  position: { x: 480, y: 40 }  # Common lane の x_order=1 として配置
                               # ※ edges を持たない共通画面は lane 内出現順で詰める（topological sort 対象外）

- name: punch
  stable_id: sample-attendance-saas__punch
  node_id: "PLACEHOLDER_NODE_ID_punch"
  role: 従業員
  lane_id: Employee
  source_confidence: high
  status: active
  position: { x: 480, y: 280 }

- name: request
  stable_id: sample-attendance-saas__request
  node_id: "PLACEHOLDER_NODE_ID_request"
  role: 従業員
  lane_id: Employee
  source_confidence: high
  status: active
  position: { x: 800, y: 280 }

- name: approval-list
  stable_id: sample-attendance-saas__approval-list
  node_id: "PLACEHOLDER_NODE_ID_approval_list"
  role: 上長
  lane_id: Manager
  source_confidence: high
  status: active
  position: { x: 1120, y: 520 }

- name: approval
  stable_id: sample-attendance-saas__approval
  node_id: "PLACEHOLDER_NODE_ID_approval"
  role: 上長
  lane_id: Manager
  source_confidence: high
  status: active
  position: { x: 1440, y: 520 }

- name: dashboard
  stable_id: sample-attendance-saas__dashboard
  node_id: "PLACEHOLDER_NODE_ID_dashboard"
  role: 人事部
  lane_id: HR
  # dashboard は全ロール (Common/Employee/Manager/HR/Admin) からアクセスされる multi-role ハブ画面。
  # drawio-style-rules.md §3.1 multi-role 主 lane 判定ルール 1（manifest 明示 lane_id 最優先）により HR に配置。
  source_confidence: high
  status: active
  position: { x: 160, y: 760 }

- name: monthly-report
  stable_id: sample-attendance-saas__monthly-report
  node_id: "PLACEHOLDER_NODE_ID_monthly_report"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 480, y: 760 }

- name: export
  stable_id: sample-attendance-saas__export
  node_id: "PLACEHOLDER_NODE_ID_export"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 800, y: 760 }

- name: shift-mgmt
  stable_id: sample-attendance-saas__shift-mgmt
  node_id: "PLACEHOLDER_NODE_ID_shift_mgmt"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 1120, y: 760 }

- name: user-mgmt
  stable_id: sample-attendance-saas__user-mgmt
  node_id: "PLACEHOLDER_NODE_ID_user_mgmt"
  role: システム管理者
  lane_id: Admin
  source_confidence: high
  status: active
  position: { x: 160, y: 1000 }

## edges

- from: login
  to: dashboard
  trigger: ログイン成功
  stable_id: login__to__dashboard
  node_id: "PLACEHOLDER_NODE_ID_edge_login_to_dashboard"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: punch
  trigger: 打刻ボタンクリック
  stable_id: dashboard__to__punch
  node_id: "PLACEHOLDER_NODE_ID_edge_dashboard_to_punch"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: request
  trigger: 申請ボタンクリック
  stable_id: dashboard__to__request
  node_id: "PLACEHOLDER_NODE_ID_edge_dashboard_to_request"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: monthly-report
  trigger: 月次レポートボタンクリック
  stable_id: dashboard__to__monthly-report
  node_id: "PLACEHOLDER_NODE_ID_edge_dashboard_to_monthly_report"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: shift-mgmt
  trigger: シフト管理ボタンクリック
  stable_id: dashboard__to__shift-mgmt
  node_id: "PLACEHOLDER_NODE_ID_edge_dashboard_to_shift_mgmt"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: user-mgmt
  trigger: ユーザー管理ボタンクリック
  stable_id: dashboard__to__user-mgmt
  node_id: "PLACEHOLDER_NODE_ID_edge_dashboard_to_user_mgmt"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: monthly-report
  to: export
  trigger: エクスポートボタンクリック
  stable_id: monthly-report__to__export
  node_id: "PLACEHOLDER_NODE_ID_edge_monthly_report_to_export"
  edge_kind: primary
  routing: straight
  label_collision_warning: false
  status: active

- from: request
  to: approval-list
  trigger: 申請送信ボタンクリック
  stable_id: request__to__approval-list
  node_id: "PLACEHOLDER_NODE_ID_edge_request_to_approval_list"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: approval-list
  to: approval
  trigger: 申請項目クリック
  stable_id: approval-list__to__approval
  node_id: "PLACEHOLDER_NODE_ID_edge_approval_list_to_approval"
  edge_kind: primary
  routing: straight
  label_collision_warning: false
  status: active

- from: approval
  to: request
  trigger: 差し戻しボタンクリック
  stable_id: approval__to__request
  node_id: "PLACEHOLDER_NODE_ID_edge_approval_to_request"
  edge_kind: back
  routing: l-shape
  label_collision_warning: false
  status: active

- from: punch
  to: dashboard
  trigger: 打刻完了後の自動遷移
  stable_id: punch__to__dashboard
  node_id: "PLACEHOLDER_NODE_ID_edge_punch_to_dashboard"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: request
  to: dashboard
  trigger: 申請完了後の自動遷移
  stable_id: request__to__dashboard
  node_id: "PLACEHOLDER_NODE_ID_edge_request_to_dashboard"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active
