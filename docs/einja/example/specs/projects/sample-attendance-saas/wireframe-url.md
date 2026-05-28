<!--
本ファイルはサンプル用の wireframe-url.md です。
本来の出力先は docs/project/wireframe-url.md（1リポジトリ1プロジェクト前提）。
einja-project-screen-spec Skill (Phase 4) により生成されるマニフェストの実例として配置しています。

- 入力サンプル: ./requirements.md, ./screen-flow-url.md, ./function-specs/*.md
- Skill 定義: .claude/skills/einja-project-screen-spec/
- スキーマ定義: .claude/skills/einja-project-screen-spec/references/manifest-schema.md
- 共通 enum: .claude/skills/einja-project-screen-spec/references/canonical-enums.md

このファイルは Phase 4 (einja-project-screen-spec) Skill のサンプル成果物です。
file_key/plan_key/node_id は PLACEHOLDER。実 Figma 描画は別 Issue で対応予定。
screen-flow-url.md の 10 active screens すべてに対し、mid-fi ワイヤーフレームを生成想定。
Core 15 プリミティブを各1回以上使用、Optional 9 は推定で出現したもののみ
（modal-dialog / pagination / checkbox / textarea / badge-status を採用、
 tabs / radio / toast / search-filter は v2 想定でスコープ外）。

注意: 下記 figma_url / file_key / plan_key / node_id はサンプル用プレースホルダーであり、
実在の Figma ファイルではありません（実ファイル添付は Figma MCP 復旧後の
別 Issue で対応予定）。
-->
---
schema_version: 1
figma_url: https://www.figma.com/design/PLACEHOLDER_FILE_KEY/sample-attendance-saas-wireframe?node-id=PLACEHOLDER_PAGE_ID
file_key: PLACEHOLDER_FILE_KEY
project_name: sample-attendance-saas
generated_at: 2026-05-25
source_screen_flow_drawio_path: docs/project/screen-flow.drawio
source_screen_flow_schema_version: 2
plan_key: PLACEHOLDER_PLAN_KEY
linked_screen_flow: docs/project/screen-flow-url.md
wireframes_page_id: "PLACEHOLDER_PAGE_ID"
fidelity: mid-fi
color_mode: mono
---

## screens

- name: login
  linked_screen_stable_id: sample-attendance-saas__login
  screen_stable_id: sample-attendance-saas__wf__login
  stable_id: sample-attendance-saas__wf__login__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S01_login"
  size: { width: 1440, height: 900 }
  position: { x: 0, y: 0 }
  status: active

- name: dashboard
  linked_screen_stable_id: sample-attendance-saas__dashboard
  screen_stable_id: sample-attendance-saas__wf__dashboard
  stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S02_dashboard"
  size: { width: 1440, height: 900 }
  position: { x: 1500, y: 0 }
  status: active

- name: punch
  linked_screen_stable_id: sample-attendance-saas__punch
  screen_stable_id: sample-attendance-saas__wf__punch
  stable_id: sample-attendance-saas__wf__punch__mobile__normal
  layout: mobile
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S03_punch"
  size: { width: 375, height: 812 }
  position: { x: 3000, y: 0 }
  status: active

- name: request
  linked_screen_stable_id: sample-attendance-saas__request
  screen_stable_id: sample-attendance-saas__wf__request
  stable_id: sample-attendance-saas__wf__request__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S04_request"
  size: { width: 1440, height: 900 }
  position: { x: 4500, y: 0 }
  status: active

- name: request
  linked_screen_stable_id: sample-attendance-saas__request
  screen_stable_id: sample-attendance-saas__wf__request
  stable_id: sample-attendance-saas__wf__request__desktop__error
  layout: desktop
  state: error
  node_id: "PLACEHOLDER_NODE_ID_S05_request_error"
  size: { width: 1440, height: 900 }
  position: { x: 6000, y: 0 }
  status: active

- name: approval-list
  linked_screen_stable_id: sample-attendance-saas__approval-list
  screen_stable_id: sample-attendance-saas__wf__approval-list
  stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S06_approval_list"
  size: { width: 1440, height: 900 }
  position: { x: 0, y: 1000 }
  status: active

- name: approval-list
  linked_screen_stable_id: sample-attendance-saas__approval-list
  screen_stable_id: sample-attendance-saas__wf__approval-list
  stable_id: sample-attendance-saas__wf__approval-list__desktop__empty
  layout: desktop
  state: empty
  node_id: "PLACEHOLDER_NODE_ID_S07_approval_list_empty"
  size: { width: 1440, height: 900 }
  position: { x: 1500, y: 1000 }
  status: active

- name: approval
  linked_screen_stable_id: sample-attendance-saas__approval
  screen_stable_id: sample-attendance-saas__wf__approval
  stable_id: sample-attendance-saas__wf__approval__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S08_approval"
  size: { width: 1440, height: 900 }
  position: { x: 3000, y: 1000 }
  status: active

- name: monthly-report
  linked_screen_stable_id: sample-attendance-saas__monthly-report
  screen_stable_id: sample-attendance-saas__wf__monthly-report
  stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S09_monthly_report"
  size: { width: 1440, height: 900 }
  position: { x: 4500, y: 1000 }
  status: active

- name: monthly-report
  linked_screen_stable_id: sample-attendance-saas__monthly-report
  screen_stable_id: sample-attendance-saas__wf__monthly-report
  stable_id: sample-attendance-saas__wf__monthly-report__desktop__loading
  layout: desktop
  state: loading
  node_id: "PLACEHOLDER_NODE_ID_S10_monthly_loading"
  size: { width: 1440, height: 900 }
  position: { x: 6000, y: 1000 }
  status: active

- name: export
  linked_screen_stable_id: sample-attendance-saas__export
  screen_stable_id: sample-attendance-saas__wf__export
  stable_id: sample-attendance-saas__wf__export__modal__normal
  layout: modal
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S11_export"
  size: { width: 800, height: 600 }
  position: { x: 0, y: 2000 }
  status: active

- name: shift-mgmt
  linked_screen_stable_id: sample-attendance-saas__shift-mgmt
  screen_stable_id: sample-attendance-saas__wf__shift-mgmt
  stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S12_shift_mgmt"
  size: { width: 1440, height: 900 }
  position: { x: 1500, y: 2000 }
  status: active

- name: user-mgmt
  linked_screen_stable_id: sample-attendance-saas__user-mgmt
  screen_stable_id: sample-attendance-saas__wf__user-mgmt
  stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  layout: desktop
  state: normal
  node_id: "PLACEHOLDER_NODE_ID_S13_user_mgmt"
  size: { width: 1440, height: 900 }
  position: { x: 3000, y: 2000 }
  status: active

## elements

# ===== login (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS
  node_id: "PLACEHOLDER_NODE_ID_E001_login_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__page-title__main
  kind: page-title
  text: ログイン
  node_id: "PLACEHOLDER_NODE_ID_E002_login_title"
  source: screen-flow-url.md (screens[].name=login)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__input-text__email
  kind: input-text
  label: メールアドレス
  required: true
  placeholder: 例)user@example.com
  node_id: "PLACEHOLDER_NODE_ID_E003_login_email"
  source: requirements.md (§4.2 Auth.js)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__required-mark__email
  kind: required-mark
  parent_element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__input-text__email
  node_id: "PLACEHOLDER_NODE_ID_E004_login_email_required"
  source: requirements.md (§4.2 Auth.js)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__input-text__password
  kind: input-text
  label: パスワード
  required: true
  placeholder: 8文字以上
  node_id: "PLACEHOLDER_NODE_ID_E005_login_password"
  source: requirements.md (§4.2 Auth.js)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__validation-error__password
  kind: validation-error
  parent_element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__input-text__password
  message_template: パスワードが正しくありません
  node_id: "PLACEHOLDER_NODE_ID_E006_login_pw_err"
  source: requirements.md (§4.2 Auth.js + MFA)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__login__desktop__normal
  element_stable_id: sample-attendance-saas__wf__login__desktop__normal__el__button-primary__login
  kind: button-primary
  text: ログイン
  target_edge_stable_id: login__to__dashboard
  node_id: "PLACEHOLDER_NODE_ID_E007_login_btn"
  source: screen-flow-url.md (edges[] login__to__dashboard)
  status: active

# ===== dashboard (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | 人事 太郎
  node_id: "PLACEHOLDER_NODE_ID_E010_dash_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__side-nav__main
  kind: side-nav
  items: [打刻, 申請, 承認一覧, 月次レポート, シフト管理, ユーザー管理]
  node_id: "PLACEHOLDER_NODE_ID_E011_dash_sidenav"
  source: screen-flow-url.md (screens[] active 集合)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__page-title__main
  kind: page-title
  text: ダッシュボード
  node_id: "PLACEHOLDER_NODE_ID_E012_dash_title"
  source: screen-flow-url.md (screens[].name=dashboard)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__button-primary__punch
  kind: button-primary
  text: 打刻
  target_edge_stable_id: dashboard__to__punch
  node_id: "PLACEHOLDER_NODE_ID_E013_dash_btn_punch"
  source: screen-flow-url.md (edges[] dashboard__to__punch)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__button-secondary__request
  kind: button-secondary
  text: 申請
  target_edge_stable_id: dashboard__to__request
  node_id: "PLACEHOLDER_NODE_ID_E014_dash_btn_req"
  source: screen-flow-url.md (edges[] dashboard__to__request)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__button-secondary__report
  kind: button-secondary
  text: 月次レポート
  target_edge_stable_id: dashboard__to__monthly-report
  node_id: "PLACEHOLDER_NODE_ID_E015_dash_btn_rep"
  source: screen-flow-url.md (edges[] dashboard__to__monthly-report)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal
  element_stable_id: sample-attendance-saas__wf__dashboard__desktop__normal__el__table__today
  kind: table
  columns: [日付, 出勤, 退勤, 状態]
  sample_row_count: 3
  data_source: function-spec-flow_time_punch.md (§4.2 内部データフロー)
  node_id: "PLACEHOLDER_NODE_ID_E016_dash_table"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§4.2)
  status: active

# ===== punch (mobile / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__header__main
  kind: header
  text: 打刻
  node_id: "PLACEHOLDER_NODE_ID_E020_punch_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__page-title__main
  kind: page-title
  text: 打刻
  node_id: "PLACEHOLDER_NODE_ID_E021_punch_title"
  source: screen-flow-url.md (screens[].name=punch)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__input-text__name
  kind: input-text
  label: 従業員名
  required: true
  placeholder: 例)山田太郎
  node_id: "PLACEHOLDER_NODE_ID_E022_punch_name"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§3.2 入力)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__required-mark__name
  kind: required-mark
  parent_element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__input-text__name
  node_id: "PLACEHOLDER_NODE_ID_E023_punch_name_req"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§5.4 必須制約)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__input-select__kind
  kind: input-select
  label: 打刻種別
  required: true
  options: [出勤, 退勤, 休憩開始, 休憩終了]
  node_id: "PLACEHOLDER_NODE_ID_E024_punch_kind"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§5.4 enum)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__input-date__date
  kind: input-date
  label: 打刻日
  required: true
  placeholder: YYYY-MM-DD
  node_id: "PLACEHOLDER_NODE_ID_E025_punch_date"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§3.2 入力)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__validation-error__kind
  kind: validation-error
  parent_element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__input-select__kind
  message_template: 打刻種別を選択してください
  node_id: "PLACEHOLDER_NODE_ID_E026_punch_kind_err"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§5.4 制約違反)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__button-primary__save
  kind: button-primary
  text: 打刻する
  target_edge_stable_id: punch__to__dashboard
  node_id: "PLACEHOLDER_NODE_ID_E027_punch_save"
  source: function-spec-sample-attendance-saas__flow__time_punch.md (§3.2 最終アクション)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__punch__mobile__normal
  element_stable_id: sample-attendance-saas__wf__punch__mobile__normal__el__button-secondary__cancel
  kind: button-secondary
  text: キャンセル
  node_id: "PLACEHOLDER_NODE_ID_E028_punch_cancel"
  source: screen-flow-url.md (edges[] cancel pattern)
  status: active

# ===== request (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | 申請
  node_id: "PLACEHOLDER_NODE_ID_E030_req_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__side-nav__main
  kind: side-nav
  items: [打刻, 申請, 承認一覧, 月次レポート, シフト管理, ユーザー管理]
  node_id: "PLACEHOLDER_NODE_ID_E031_req_sidenav"
  source: screen-flow-url.md (screens[] active 集合)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__breadcrumb__main
  kind: breadcrumb
  items: [ダッシュボード, 申請]
  node_id: "PLACEHOLDER_NODE_ID_E032_req_bread"
  source: screen-flow-url.md (edges[] dashboard__to__request 逆引き)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__page-title__main
  kind: page-title
  text: 申請
  node_id: "PLACEHOLDER_NODE_ID_E033_req_title"
  source: screen-flow-url.md (screens[].name=request)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__input-select__type
  kind: input-select
  label: 申請種別
  required: true
  options: [打刻修正, 有給, 残業]
  node_id: "PLACEHOLDER_NODE_ID_E034_req_type"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§5.4 enum)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__input-date__target
  kind: input-date
  label: 対象日
  required: true
  placeholder: YYYY-MM-DD
  node_id: "PLACEHOLDER_NODE_ID_E035_req_date"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§3.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__textarea__reason
  kind: textarea
  label: 申請理由
  required: true
  placeholder: 申請理由を入力してください
  max_length: 500
  node_id: "PLACEHOLDER_NODE_ID_E036_req_reason"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§3.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__normal
  element_stable_id: sample-attendance-saas__wf__request__desktop__normal__el__button-primary__submit
  kind: button-primary
  text: 申請する
  target_edge_stable_id: request__to__approval-list
  node_id: "PLACEHOLDER_NODE_ID_E037_req_submit"
  source: screen-flow-url.md (edges[] request__to__approval-list)
  status: active

# ===== request (desktop / error) =====

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__error
  element_stable_id: sample-attendance-saas__wf__request__desktop__error__el__error-banner__submit
  kind: error-banner
  message_template: 申請の送信に失敗しました。時間をおいて再度お試しください
  node_id: "PLACEHOLDER_NODE_ID_E040_req_err_banner"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§5.3 例外)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__error
  element_stable_id: sample-attendance-saas__wf__request__desktop__error__el__page-title__main
  kind: page-title
  text: 申請
  node_id: "PLACEHOLDER_NODE_ID_E041_req_err_title"
  source: screen-flow-url.md (screens[].name=request)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__request__desktop__error
  element_stable_id: sample-attendance-saas__wf__request__desktop__error__el__button-secondary__retry
  kind: button-secondary
  text: 再試行
  node_id: "PLACEHOLDER_NODE_ID_E042_req_err_retry"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§5.3 例外)
  status: active

# ===== approval-list (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | 承認一覧
  node_id: "PLACEHOLDER_NODE_ID_E050_appl_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal__el__side-nav__main
  kind: side-nav
  items: [打刻, 申請, 承認一覧, 月次レポート, シフト管理, ユーザー管理]
  node_id: "PLACEHOLDER_NODE_ID_E051_appl_sidenav"
  source: screen-flow-url.md (screens[] active 集合)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal__el__page-title__main
  kind: page-title
  text: 承認一覧
  node_id: "PLACEHOLDER_NODE_ID_E052_appl_title"
  source: screen-flow-url.md (screens[].name=approval-list)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal__el__table__main
  kind: table
  columns: [申請日, 申請者, 申請種別, ステータス, 操作]
  sample_row_count: 5
  data_source: function-spec-attendance_approval.md (§4.2 内部データフロー)
  node_id: "PLACEHOLDER_NODE_ID_E053_appl_table"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§4.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal__el__badge-status__pending
  kind: badge-status
  text: 承認待ち
  variant: warning
  node_id: "PLACEHOLDER_NODE_ID_E054_appl_badge"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§5.4 enum)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__normal__el__pagination__main
  kind: pagination
  total_pages: 5
  page_size: 20
  node_id: "PLACEHOLDER_NODE_ID_E055_appl_paginate"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§6 一覧)
  status: active

# ===== approval-list (desktop / empty) =====

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__empty
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__empty__el__page-title__main
  kind: page-title
  text: 承認一覧
  node_id: "PLACEHOLDER_NODE_ID_E060_apel_title"
  source: screen-flow-url.md (screens[].name=approval-list)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval-list__desktop__empty
  element_stable_id: sample-attendance-saas__wf__approval-list__desktop__empty__el__empty-state__none
  kind: empty-state
  message: 承認待ちの申請はありません
  node_id: "PLACEHOLDER_NODE_ID_E061_apel_empty"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§6 一覧)
  status: active

# ===== approval (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | 承認詳細
  node_id: "PLACEHOLDER_NODE_ID_E070_apv_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__breadcrumb__main
  kind: breadcrumb
  items: [ダッシュボード, 承認一覧, 承認詳細]
  node_id: "PLACEHOLDER_NODE_ID_E071_apv_bread"
  source: screen-flow-url.md (edges[] approval-list__to__approval 逆引き)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__page-title__main
  kind: page-title
  text: 承認詳細
  node_id: "PLACEHOLDER_NODE_ID_E072_apv_title"
  source: screen-flow-url.md (screens[].name=approval)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__table__detail
  kind: table
  columns: [項目, 内容]
  sample_row_count: 4
  node_id: "PLACEHOLDER_NODE_ID_E073_apv_detail"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§4.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__button-primary__approve
  kind: button-primary
  text: 承認
  node_id: "PLACEHOLDER_NODE_ID_E074_apv_approve"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§3.2 最終アクション)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__button-secondary__reject
  kind: button-secondary
  text: 差し戻し
  target_edge_stable_id: approval__to__request
  node_id: "PLACEHOLDER_NODE_ID_E075_apv_reject"
  source: screen-flow-url.md (edges[] approval__to__request)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__approval__desktop__normal
  element_stable_id: sample-attendance-saas__wf__approval__desktop__normal__el__modal-dialog__reject
  kind: modal-dialog
  title: 差し戻し確認
  body_text: コメントを入力して差し戻しますか？
  confirm_button_text: 差し戻す
  cancel_button_text: キャンセル
  node_id: "PLACEHOLDER_NODE_ID_E076_apv_modal"
  source: function-spec-sample-attendance-saas__flow__attendance_approval.md (§3.2 B3)
  status: active

# ===== monthly-report (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | 月次レポート
  node_id: "PLACEHOLDER_NODE_ID_E080_mr_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal__el__page-title__main
  kind: page-title
  text: 月次レポート
  node_id: "PLACEHOLDER_NODE_ID_E081_mr_title"
  source: screen-flow-url.md (screens[].name=monthly-report)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal__el__input-date__month
  kind: input-date
  label: 対象月
  required: true
  placeholder: YYYY-MM
  node_id: "PLACEHOLDER_NODE_ID_E082_mr_month"
  source: function-spec-sample-attendance-saas__flow__monthly_aggregation.md (§3.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal__el__table__main
  kind: table
  columns: [従業員, 出勤日数, 総労働時間, 残業時間, 有給取得]
  sample_row_count: 10
  data_source: function-spec-monthly_aggregation.md (§4.2)
  node_id: "PLACEHOLDER_NODE_ID_E083_mr_table"
  source: function-spec-sample-attendance-saas__flow__monthly_aggregation.md (§4.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__normal__el__button-primary__export
  kind: button-primary
  text: エクスポート
  target_edge_stable_id: monthly-report__to__export
  node_id: "PLACEHOLDER_NODE_ID_E084_mr_export"
  source: screen-flow-url.md (edges[] monthly-report__to__export)
  status: active

# ===== monthly-report (desktop / loading) =====

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__loading
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__loading__el__page-title__main
  kind: page-title
  text: 月次レポート
  node_id: "PLACEHOLDER_NODE_ID_E090_mrl_title"
  source: screen-flow-url.md (screens[].name=monthly-report)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__monthly-report__desktop__loading
  element_stable_id: sample-attendance-saas__wf__monthly-report__desktop__loading__el__loading-indicator__agg
  kind: loading-indicator
  message: 月次集計を計算中です…
  node_id: "PLACEHOLDER_NODE_ID_E091_mrl_loading"
  source: function-spec-sample-attendance-saas__flow__monthly_aggregation.md (§3.2 集計処理)
  status: active

# ===== export (modal / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__export__modal__normal
  element_stable_id: sample-attendance-saas__wf__export__modal__normal__el__page-title__main
  kind: page-title
  text: エクスポート
  node_id: "PLACEHOLDER_NODE_ID_E100_exp_title"
  source: screen-flow-url.md (screens[].name=export)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__export__modal__normal
  element_stable_id: sample-attendance-saas__wf__export__modal__normal__el__input-select__format
  kind: input-select
  label: 出力形式
  required: true
  options: [CSV, Excel, PDF]
  node_id: "PLACEHOLDER_NODE_ID_E101_exp_format"
  source: function-spec-sample-attendance-saas__flow__monthly_aggregation.md (§5.4 enum)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__export__modal__normal
  element_stable_id: sample-attendance-saas__wf__export__modal__normal__el__checkbox__include-resigned
  kind: checkbox
  label: 退職者を含める
  checked_by_default: false
  node_id: "PLACEHOLDER_NODE_ID_E102_exp_chk"
  source: function-spec-sample-attendance-saas__flow__monthly_aggregation.md (§3.2 オプション)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__export__modal__normal
  element_stable_id: sample-attendance-saas__wf__export__modal__normal__el__button-primary__download
  kind: button-primary
  text: ダウンロード
  node_id: "PLACEHOLDER_NODE_ID_E103_exp_dl"
  source: function-spec-sample-attendance-saas__flow__monthly_aggregation.md (§3.2 最終アクション)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__export__modal__normal
  element_stable_id: sample-attendance-saas__wf__export__modal__normal__el__button-secondary__cancel
  kind: button-secondary
  text: キャンセル
  node_id: "PLACEHOLDER_NODE_ID_E104_exp_cancel"
  source: screen-flow-url.md (edges[] modal cancel)
  status: active

# ===== shift-mgmt (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | シフト管理
  node_id: "PLACEHOLDER_NODE_ID_E110_sh_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__side-nav__main
  kind: side-nav
  items: [打刻, 申請, 承認一覧, 月次レポート, シフト管理, ユーザー管理]
  node_id: "PLACEHOLDER_NODE_ID_E111_sh_sidenav"
  source: screen-flow-url.md (screens[] active 集合)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__page-title__main
  kind: page-title
  text: シフト管理
  node_id: "PLACEHOLDER_NODE_ID_E112_sh_title"
  source: screen-flow-url.md (screens[].name=shift-mgmt)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__input-date__week
  kind: input-date
  label: 対象週
  required: true
  placeholder: YYYY-MM-DD
  node_id: "PLACEHOLDER_NODE_ID_E113_sh_week"
  source: function-spec-sample-attendance-saas__flow__shift_management.md (§3.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__table__shift
  kind: table
  columns: [従業員, 月, 火, 水, 木, 金, 土, 日]
  sample_row_count: 8
  data_source: function-spec-shift_management.md (§4.2)
  node_id: "PLACEHOLDER_NODE_ID_E114_sh_table"
  source: function-spec-sample-attendance-saas__flow__shift_management.md (§4.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__button-primary__save
  kind: button-primary
  text: 保存
  node_id: "PLACEHOLDER_NODE_ID_E115_sh_save"
  source: function-spec-sample-attendance-saas__flow__shift_management.md (§3.2 最終アクション)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__shift-mgmt__desktop__normal__el__error-banner__conflict
  kind: error-banner
  message_template: シフト重複が検出されました。割当を調整してください
  node_id: "PLACEHOLDER_NODE_ID_E116_sh_err"
  source: function-spec-sample-attendance-saas__flow__shift_management.md (§5.3 例外)
  status: active

# ===== user-mgmt (desktop / normal) =====

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__header__main
  kind: header
  text: 勤怠SaaS | ユーザー管理
  node_id: "PLACEHOLDER_NODE_ID_E120_um_header"
  source: requirements.md (§3 アクター)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__side-nav__main
  kind: side-nav
  items: [打刻, 申請, 承認一覧, 月次レポート, シフト管理, ユーザー管理]
  node_id: "PLACEHOLDER_NODE_ID_E121_um_sidenav"
  source: screen-flow-url.md (screens[] active 集合)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__page-title__main
  kind: page-title
  text: ユーザー管理
  node_id: "PLACEHOLDER_NODE_ID_E122_um_title"
  source: screen-flow-url.md (screens[].name=user-mgmt)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__input-text__name
  kind: input-text
  label: 氏名
  required: true
  placeholder: 例)山田太郎
  node_id: "PLACEHOLDER_NODE_ID_E123_um_name"
  source: function-spec-sample-attendance-saas__flow__master_management.md (§3.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__checkbox__role-admin
  kind: checkbox
  label: 管理者ロール
  checked_by_default: false
  node_id: "PLACEHOLDER_NODE_ID_E124_um_chk"
  source: function-spec-sample-attendance-saas__flow__master_management.md (§5.4 ロール)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__table__list
  kind: table
  columns: [氏名, メール, 部署, ロール, 状態]
  sample_row_count: 8
  data_source: function-spec-master_management.md (§4.2)
  node_id: "PLACEHOLDER_NODE_ID_E125_um_table"
  source: function-spec-sample-attendance-saas__flow__master_management.md (§4.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__button-primary__create
  kind: button-primary
  text: 新規作成
  node_id: "PLACEHOLDER_NODE_ID_E126_um_create"
  source: function-spec-sample-attendance-saas__flow__master_management.md (§3.2)
  status: active

- screen_frame_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal
  element_stable_id: sample-attendance-saas__wf__user-mgmt__desktop__normal__el__pagination__main
  kind: pagination
  total_pages: 3
  page_size: 20
  node_id: "PLACEHOLDER_NODE_ID_E127_um_paginate"
  source: function-spec-sample-attendance-saas__flow__master_management.md (§6 一覧)
  status: active
