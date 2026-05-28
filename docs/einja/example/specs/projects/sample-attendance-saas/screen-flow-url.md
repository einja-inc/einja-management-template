<!--
本ファイルはサンプル用の screen-flow-url.md です（Plan v3: user-flow レイアウト前提のサンプル）。
本来の出力先は docs/project/screen-flow-url.md（1リポジトリ1プロジェクト前提）。
einja-project-screen-flow-drawio Skill により生成されるマニフェストの実例として配置しています。

drawio 化（2026-05-28 以降）: 本ファイルは Figma → drawio 移行に伴い schema_version: 2 に更新。
旧 figma_url / file_key / plan_key / node_id フィールドは廃止され、
drawio_file_path / drawio_url / cell_id へリネームされた。

- 入力サンプル: ./requirements.md
- Skill 定義: .claude/skills/einja-project-screen-flow-drawio/
- スキーマ定義: .claude/skills/einja-project-screen-flow-drawio/references/manifest-schema.md
- レーン enum / 同義語: .claude/skills/einja-project-screen-flow-drawio/references/canonical-enums.md
- 矢印ルーティング規約: .claude/skills/einja-project-screen-flow-drawio/references/drawio-style-rules.md

本ファイルは v3 user-flow レイアウト前提のサンプル成果物です。
v1 後方互換 fixture（schema_version: 1 のままの旧格子レイアウト）は
同ディレクトリの screen-flow-url-v1-grid.md を参照してください。
v2 swim-lane fixture は `screen-flow-url-v2-swimlane.md` として別途保存（v2 swim-lane PoC の固定版 fixture、layout_strategy 明示指定時の参照用）。

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

position 算出ルール (v3 user-flow / drawio-style-rules.md §3.3、座標式 §3.3.4、クラスタリング §3.3.3):
- `x = LEFT_MARGIN(80) + depth * (FRAME_W(240) + HORIZONTAL_GAP(160)) = 80 + depth * 400`
- `y = median(parents.map(p => p.y))`（衝突回避は VERTICAL_GAP=80px の下方向 stable sort）
- `depth` はエントリ画面（`is_entry_point: true`）から primary edge のみで BFS した最短到達深さ。
  back エッジ（`edge_kind: back`）は BFS から除外、shortcut（既到達ノードへの再エッジ）は深さ変更なし
- root（depth=0）の y は基準値 160px、以降は親 y の中央値を継承
- 同一 depth で y が重複する場合は YAML screens[] 出現順 stable sort で VERTICAL_GAP=80px ずつ下方シフト
- 未到達ノード（unreachable）は `depth = maxDepth + 1` として末尾に配置、y は基準値 160 を割り当て
- Skill 再生成時もユーザー手動レイアウトを保持する設計（manifest-schema.md §3.1）

注意: 下記 drawio_file_path / drawio_url / cell_id はサンプル用プレースホルダーであり、
実在の drawio ファイルではありません（実ファイル添付は drawio 描画 PoC 完了後の
別 Issue で対応予定）。
-->
---
drawio_file_path: docs/project/screen-flow.drawio
drawio_url: PLACEHOLDER_DRAWIO_URL
schema_version: 2
generated_at: 2026-05-28
project_name: sample-attendance-saas
layout_strategy: user-flow
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
  cell_id: "screen__login"
  role: 共通
  lane_id: Common
  is_entry_point: true
  source_confidence: high
  status: active
  position: { x: 80, y: 160 }

- name: forbidden-403
  stable_id: sample-attendance-saas__forbidden-403
  cell_id: "screen__forbidden_403"
  role: 共通
  lane_id: Common
  source_confidence: high
  status: active
  position: { x: 2080, y: 160 }  # unreachable（primary edge の入辺なし）
                                 # depth = maxDepth(4) + 1 = 5、y は基準値 160 を割り当て
                                 # unreachable サンプル（drawio-style-rules.md §3.3.2 reachable 不能ノード扱い、Phase 2 で確認 UI 追加予定）

- name: punch
  stable_id: sample-attendance-saas__punch
  cell_id: "screen__punch"
  role: 従業員
  lane_id: Employee
  source_confidence: high
  status: active
  position: { x: 880, y: 0 }

- name: request
  stable_id: sample-attendance-saas__request
  cell_id: "screen__request"
  role: 従業員
  lane_id: Employee
  source_confidence: high
  status: active
  position: { x: 880, y: 80 }

- name: approval-list
  stable_id: sample-attendance-saas__approval-list
  cell_id: "screen__approval_list"
  role: 上長
  lane_id: Manager
  source_confidence: high
  status: active
  position: { x: 1280, y: 80 }

- name: approval
  stable_id: sample-attendance-saas__approval
  cell_id: "screen__approval"
  role: 上長
  lane_id: Manager
  source_confidence: high
  status: active
  position: { x: 1680, y: 80 }

- name: dashboard
  stable_id: sample-attendance-saas__dashboard
  cell_id: "screen__dashboard"
  role: 人事部
  lane_id: HR
  # dashboard は全ロール (Common/Employee/Manager/HR/Admin) からアクセスされる multi-role ハブ画面。
  # drawio-style-rules.md §3.1 multi-role 主 lane 判定ルール 1（manifest 明示 lane_id 最優先）により HR に配置。
  # v3 user-flow では lane_id は表示には使われないが、参考情報として残置。
  source_confidence: high
  status: active
  position: { x: 480, y: 160 }

- name: monthly-report
  stable_id: sample-attendance-saas__monthly-report
  cell_id: "screen__monthly_report"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 880, y: 160 }

- name: export
  stable_id: sample-attendance-saas__export
  cell_id: "screen__export"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 1280, y: 160 }

- name: shift-mgmt
  stable_id: sample-attendance-saas__shift-mgmt
  cell_id: "screen__shift_mgmt"
  role: 人事部
  lane_id: HR
  source_confidence: high
  status: active
  position: { x: 880, y: 240 }

- name: user-mgmt
  stable_id: sample-attendance-saas__user-mgmt
  cell_id: "screen__user_mgmt"
  role: システム管理者
  lane_id: Admin
  source_confidence: high
  status: active
  position: { x: 880, y: 320 }

## edges

- from: login
  to: dashboard
  trigger: ログイン成功
  stable_id: login__to__dashboard
  cell_id: "edge__login__to__dashboard"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: punch
  trigger: 打刻ボタンクリック
  stable_id: dashboard__to__punch
  cell_id: "edge__dashboard__to__punch"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: request
  trigger: 申請ボタンクリック
  stable_id: dashboard__to__request
  cell_id: "edge__dashboard__to__request"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: monthly-report
  trigger: 月次レポートボタンクリック
  stable_id: dashboard__to__monthly-report
  cell_id: "edge__dashboard__to__monthly_report"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: shift-mgmt
  trigger: シフト管理ボタンクリック
  stable_id: dashboard__to__shift-mgmt
  cell_id: "edge__dashboard__to__shift_mgmt"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: dashboard
  to: user-mgmt
  trigger: ユーザー管理ボタンクリック
  stable_id: dashboard__to__user-mgmt
  cell_id: "edge__dashboard__to__user_mgmt"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: monthly-report
  to: export
  trigger: エクスポートボタンクリック
  stable_id: monthly-report__to__export
  cell_id: "edge__monthly_report__to__export"
  edge_kind: primary
  routing: straight
  label_collision_warning: false
  status: active

- from: request
  to: approval-list
  trigger: 申請送信ボタンクリック
  stable_id: request__to__approval-list
  cell_id: "edge__request__to__approval_list"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: approval-list
  to: approval
  trigger: 申請項目クリック
  stable_id: approval-list__to__approval
  cell_id: "edge__approval_list__to__approval"
  edge_kind: primary
  routing: straight
  label_collision_warning: false
  status: active

- from: approval
  to: request
  trigger: 差し戻しボタンクリック
  stable_id: approval__to__request
  cell_id: "edge__approval__to__request"
  edge_kind: back
  routing: l-shape
  label_collision_warning: false
  status: active

- from: punch
  to: dashboard
  trigger: 打刻完了後の自動遷移
  stable_id: punch__to__dashboard
  cell_id: "edge__punch__to__dashboard"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active

- from: request
  to: dashboard
  trigger: 申請完了後の自動遷移
  stable_id: request__to__dashboard
  cell_id: "edge__request__to__dashboard"
  edge_kind: primary
  routing: l-shape
  label_collision_warning: false
  status: active
