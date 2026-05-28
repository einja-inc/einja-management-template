<!--
本ファイルはサンプル用の screen-flow-url.md です。
本来の出力先は docs/project/screen-flow-url.md（1リポジトリ1プロジェクト前提）。
einja-project-screen-flow-drawio Skill により生成されるマニフェストの実例として配置しています。
3 層 fixture 構造（v1 grid / v2 swim-lane / v3 user-flow）の v1 grid 側として、`normalizeManifestV1` + `hasV1Signature` 自動判定の動作確認用 fixture を兼ねる。

**本 fixture は einja-project-screen-flow-drawio Skill の `normalizeManifestV1or2` 関数の動作確認用です。schema_version: 1 を保持しており、v2 reader（drawio Skill 現行版）が読むと「再生成して drawio 化 / 中止 / その他（自由入力）」の AskUserQuestion 警告が出るのが期待動作です。詳細: references/manifest-schema.md §5。**
schema_version: 1 のまま据置し、旧 Figma 時代のフィールド構造（figma_url / file_key / plan_key / node_id）を保持する。

- 入力サンプル: ./requirements.md
- Skill 定義: .claude/skills/einja-project-screen-flow-drawio/
- スキーマ定義: .claude/skills/einja-project-screen-flow-drawio/references/manifest-schema.md

サンプル簡略化のため省略している画面（ヒアリング Step 4 項目A での確定経緯を含む）:
- MFA 入力画面（§4.2 Auth.js + 多要素認証由来）→ login 画面に統合
- F-08 監査ログ閲覧画面 → hearing-checklist §3.2 で暫定推定だが、Step 4 ヒアリングにて管理者専用機能として省略確定
- ホーム / メニュー画面（hearing-checklist §3.3 共通画面候補）→ dashboard が HOME 相当のため統合
- 設定画面 / プロフィール（hearing-checklist §3.3 共通画面候補）→ 本サンプルのスコープ外（v2 想定）
- B3 差し戻しコメント入力画面 → approval 画面内モーダル操作として統合
- S3 未打刻アラート通知画面（§2.1.2 mermaid S3 由来）→ メール/push通知のため画面化対象外

position 注記: 各 screen の position はプレースホルダー値（260px × 200px 間隔の格子）。
実際の Figma FrameNode サイズ（例: モバイル 375px 幅、デスクトップ 1440px 幅）に合わせて
間隔を調整すること。Skill 再生成時もユーザー手動レイアウトを保持する設計（manifest-schema.md §3.1）。

注意: 下記 figma_url / file_key / plan_key はサンプル用プレースホルダーであり、
実在の Figma ファイルではありません（実ファイル添付は Figma MCP 復旧後の
別 Issue で対応予定）。
-->
---
figma_url: https://www.figma.com/design/PLACEHOLDER_FILE_KEY/sample-attendance-saas-screen-flow
file_key: PLACEHOLDER_FILE_KEY
plan_key: PLACEHOLDER_PLAN_KEY
schema_version: 1
generated_at: 2026-05-19
project_name: sample-attendance-saas
---

## screens

- name: login
  stable_id: sample-attendance-saas__login
  node_id: "1:2"
  role: 共通
  status: active
  position: { x: 0, y: 0 }

- name: dashboard
  stable_id: sample-attendance-saas__dashboard
  node_id: "1:3"
  role: 人事部
  status: active
  position: { x: 260, y: 0 }

- name: punch
  stable_id: sample-attendance-saas__punch
  node_id: "1:4"
  role: 従業員
  status: active
  position: { x: 520, y: 0 }

- name: request
  stable_id: sample-attendance-saas__request
  node_id: "1:5"
  role: 従業員
  status: active
  position: { x: 780, y: 0 }

- name: approval-list
  stable_id: sample-attendance-saas__approval-list
  node_id: "1:6"
  role: 上長
  status: active
  position: { x: 0, y: 200 }

- name: approval
  stable_id: sample-attendance-saas__approval
  node_id: "1:7"
  role: 上長
  status: active
  position: { x: 260, y: 200 }

- name: monthly-report
  stable_id: sample-attendance-saas__monthly-report
  node_id: "1:8"
  role: 人事部
  status: active
  position: { x: 520, y: 200 }

- name: export
  stable_id: sample-attendance-saas__export
  node_id: "1:9"
  role: 人事部
  status: active
  position: { x: 780, y: 200 }

- name: shift-mgmt
  stable_id: sample-attendance-saas__shift-mgmt
  node_id: "1:10"
  role: 人事部
  status: active
  position: { x: 0, y: 400 }

- name: user-mgmt
  stable_id: sample-attendance-saas__user-mgmt
  node_id: "1:11"
  role: システム管理者
  status: active
  position: { x: 260, y: 400 }

## edges

- from: login
  to: dashboard
  trigger: ログイン成功
  stable_id: login__to__dashboard
  node_id: "1:20"
  status: active

- from: dashboard
  to: punch
  trigger: 打刻ボタンクリック
  stable_id: dashboard__to__punch
  node_id: "1:21"
  status: active

- from: dashboard
  to: request
  trigger: 申請ボタンクリック
  stable_id: dashboard__to__request
  node_id: "1:22"
  status: active

- from: dashboard
  to: monthly-report
  trigger: 月次レポートボタンクリック
  stable_id: dashboard__to__monthly-report
  node_id: "1:23"
  status: active

- from: dashboard
  to: shift-mgmt
  trigger: シフト管理ボタンクリック
  stable_id: dashboard__to__shift-mgmt
  node_id: "1:24"
  status: active

- from: dashboard
  to: user-mgmt
  trigger: ユーザー管理ボタンクリック
  stable_id: dashboard__to__user-mgmt
  node_id: "1:25"
  status: active

- from: monthly-report
  to: export
  trigger: エクスポートボタンクリック
  stable_id: monthly-report__to__export
  node_id: "1:26"
  status: active

- from: request
  to: approval-list
  trigger: 申請送信ボタンクリック
  stable_id: request__to__approval-list
  node_id: "1:27"
  status: active

- from: approval-list
  to: approval
  trigger: 申請項目クリック
  stable_id: approval-list__to__approval
  node_id: "1:28"
  status: active

- from: approval
  to: request
  trigger: 差し戻しボタンクリック
  stable_id: approval__to__request
  node_id: "1:29"
  status: active

- from: punch
  to: dashboard
  trigger: 打刻完了後の自動遷移
  stable_id: punch__to__dashboard
  node_id: "1:30"
  status: active

- from: request
  to: dashboard
  trigger: 申請完了後の自動遷移
  stable_id: request__to__dashboard
  node_id: "1:31"
  status: active
