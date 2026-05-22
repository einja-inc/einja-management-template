---
schema_version: 1
generated_at: "2026-05-22T10:10:00Z"
project_name: "sample-attendance-saas"
source:
  requirements: "../requirements.md"
  screen_flow: "../screen-flow-url.md"
function_specs:
  - flow_id: "sample-attendance-saas__flow__time_punch"
    file: "./function-spec-sample-attendance-saas__flow__time_punch.md"
    title: "打刻フロー"
    status: "draft"
    related_screens:
      - "sample-attendance-saas__login"
      - "sample-attendance-saas__dashboard"
      - "sample-attendance-saas__punch"
    related_function_ids:
      - "FN-001"
      - "FN-002"
      - "FN-005"
      - "FN-007"
  - flow_id: "sample-attendance-saas__flow__attendance_approval"
    file: "./function-spec-sample-attendance-saas__flow__attendance_approval.md"
    title: "勤怠承認フロー（残業・有給申請の承認）"
    status: "draft"
    related_screens:
      - "sample-attendance-saas__dashboard"
      - "sample-attendance-saas__request"
      - "sample-attendance-saas__approval-list"
      - "sample-attendance-saas__approval"
    related_function_ids:
      - "FN-003"
      - "FN-004"
      - "FN-005"
      - "FN-006"
  - flow_id: "sample-attendance-saas__flow__monthly_aggregation"
    file: "./function-spec-sample-attendance-saas__flow__monthly_aggregation.md"
    title: "月次集計フロー"
    status: "draft"
    related_screens:
      - "sample-attendance-saas__dashboard"
      - "sample-attendance-saas__monthly-report"
      - "sample-attendance-saas__export"
    related_function_ids:
      - "FN-008"
      - "FN-009"
      - "FN-010"
      - "FN-011"
      - "FN-012"
  - flow_id: "sample-attendance-saas__flow__missed_punch_alert"
    file: "./function-spec-sample-attendance-saas__flow__missed_punch_alert.md"
    title: "未打刻アラートフロー"
    status: "draft"
    related_screens: []
    related_function_ids:
      - "FN-002"
      - "FN-005"
  - flow_id: "sample-attendance-saas__flow__audit_log"
    file: "./function-spec-sample-attendance-saas__flow__audit_log.md"
    title: "監査ログフロー"
    status: "draft"
    related_screens: []
    related_function_ids:
      - "FN-013"
      - "FN-014"
  - flow_id: "sample-attendance-saas__flow__shift_management"
    file: "./function-spec-sample-attendance-saas__flow__shift_management.md"
    title: "シフト管理フロー"
    status: "draft"
    related_screens:
      - "sample-attendance-saas__dashboard"
      - "sample-attendance-saas__shift-mgmt"
    related_function_ids:
      - "FN-015"
      - "FN-016"
  - flow_id: "sample-attendance-saas__flow__master_management"
    file: "./function-spec-sample-attendance-saas__flow__master_management.md"
    title: "マスタ管理フロー（ユーザー管理）"
    status: "draft"
    related_screens:
      - "sample-attendance-saas__dashboard"
      - "sample-attendance-saas__user-mgmt"
    related_function_ids:
      - "FN-017"
      - "FN-018"
---

<!--
本ファイルは einja-project-function-spec Skill の動作確認用サンプル（index.md / マニフェスト）です。
本来の出力先は docs/project/function-specs/index.md（1リポジトリ1プロジェクト前提）。

- 入力サンプル1: ../requirements.md（einja-project-requirements 出力）
- 入力サンプル2: ../screen-flow-url.md（einja-project-screen-flow-figma 出力）
- Skill 定義: .claude/skills/einja-project-function-spec/
- スキーマ定義: .claude/skills/einja-project-function-spec/references/manifest-schema.md

サンプルの注目ポイント:
- N対N関係の実証:
  - FN-005「通知配信機能」が『打刻フロー』『勤怠承認フロー』『未打刻アラートフロー』の **3フロー共有**
  - FN-002「未打刻検知バッチ」が『打刻フロー』『未打刻アラートフロー』の **2フロー共有**
  - FN-013「監査ログ記録機能」は全フロー横断の暗黙呼び出し（§3 機能一覧には監査ログフローのみで列挙）
  （下記「機能ID別 所属フロー逆引き表」「N対N関係の補足」を参照）
- 双方向トレーサビリティ: 画面 stable_id → function-spec → FN-XXX の双方向逆引きを2表で表現。
-->

# プロジェクト機能仕様書 一覧（sample-attendance-saas）

## 概要

本プロジェクト「中小企業向け勤怠管理SaaS（A社向け）」の業務フロー単位の機能仕様書一覧。
[../requirements.md](../requirements.md) §2 TO-BE 業務フロー / §6 機能要件サマリ と
[../screen-flow-url.md](../screen-flow-url.md) を入力ソースとして、業務フローごとに
sequenceDiagram・機能一覧（FN-XXX 独立採番）・業務ルール・関連画面を整理する。

サンプル本数は7業務フロー（打刻 / 勤怠承認 / 月次集計 / 未打刻アラート / 監査ログ / シフト管理 / マスタ管理）。
requirements.md §2 から導出されるフェーズ1〜3の主要業務フローを網羅し、画面なしフロー（通知のみ・横断機能）も含めて N対N関係を実証する。

## 業務フロー一覧

| flow_id | タイトル | ステータス | 詳細 |
|---------|---------|----------|------|
| sample-attendance-saas__flow__time_punch | 打刻フロー | draft | [→](./function-spec-sample-attendance-saas__flow__time_punch.md) |
| sample-attendance-saas__flow__attendance_approval | 勤怠承認フロー（残業・有給申請の承認） | draft | [→](./function-spec-sample-attendance-saas__flow__attendance_approval.md) |
| sample-attendance-saas__flow__monthly_aggregation | 月次集計フロー | draft | [→](./function-spec-sample-attendance-saas__flow__monthly_aggregation.md) |
| sample-attendance-saas__flow__missed_punch_alert | 未打刻アラートフロー | draft | [→](./function-spec-sample-attendance-saas__flow__missed_punch_alert.md) |
| sample-attendance-saas__flow__audit_log | 監査ログフロー | draft | [→](./function-spec-sample-attendance-saas__flow__audit_log.md) |
| sample-attendance-saas__flow__shift_management | シフト管理フロー | draft | [→](./function-spec-sample-attendance-saas__flow__shift_management.md) |
| sample-attendance-saas__flow__master_management | マスタ管理フロー（ユーザー管理） | draft | [→](./function-spec-sample-attendance-saas__flow__master_management.md) |

## 画面別 関連機能逆引き表

`../screen-flow-url.md` の `screens[]` 全件（10画面）に対して、関連する function-spec と FN-XXX を列挙する。

| 画面 stable_id | 画面名 | ロール | 関連 function-spec | 関連 FN-XXX |
|---------------|--------|--------|------------------|------------|
| sample-attendance-saas__login | ログイン画面 | 共通 | time_punch | FN-007 |
| sample-attendance-saas__dashboard | ダッシュボード | 人事部 | time_punch, attendance_approval, monthly_aggregation, shift_management, master_management | - |
| sample-attendance-saas__punch | 打刻画面 | 従業員 | time_punch | FN-001 |
| sample-attendance-saas__request | 申請画面 | 従業員 | attendance_approval | FN-003 |
| sample-attendance-saas__approval-list | 承認一覧画面 | 上長 | attendance_approval | FN-006 |
| sample-attendance-saas__approval | 承認画面 | 上長 | attendance_approval | FN-004 |
| sample-attendance-saas__monthly-report | 月次レポート画面 | 人事部 | monthly_aggregation | FN-010 |
| sample-attendance-saas__export | エクスポート画面 | 人事部 | monthly_aggregation | FN-011 |
| sample-attendance-saas__shift-mgmt | シフト管理画面 | 人事部 | shift_management | FN-015 |
| sample-attendance-saas__user-mgmt | ユーザー管理画面 | システム管理者 | master_management | FN-017, FN-018 |

注: `dashboard` は5フローの導線・サマリ表示画面のため、固有機能（画面別逆引きでの FN-XXX 列）は `-` 扱い。各フローの機能（例: FN-010 月次レポート / FN-016 シフト表示）が dashboard 上にウィジェット表示される場合もあるが、画面別逆引き表では各機能の主担当画面（monthly-report / shift-mgmt 等）に集約する。各 function-spec のステップ別表でも dashboard の関連機能IDは `-` 扱い。

## 機能ID別 所属フロー逆引き表

各 `FN-XXX` がどの function-spec に登場するかを示す。**FN-002 / FN-005 は明示的に複数フロー共有（N対N関係の実証）、FN-013 は全フロー横断の暗黙呼び出し**。

| FN-XXX | 機能名 | 所属 function-spec | 関連画面 stable_id |
|--------|--------|-----------------|------------------|
| FN-001 | 打刻機能 | time_punch | sample-attendance-saas__punch |
| **FN-002** | **未打刻検知バッチ** | **time_punch, missed_punch_alert（2フロー共有）** | - |
| FN-003 | 申請機能 | attendance_approval | sample-attendance-saas__request |
| FN-004 | 承認・差し戻し機能 | attendance_approval | sample-attendance-saas__approval |
| **FN-005** | **通知配信機能（共通基盤）** | **time_punch, attendance_approval, missed_punch_alert（3フロー共有）** | - |
| FN-006 | 承認一覧表示機能 | attendance_approval | sample-attendance-saas__approval-list |
| FN-007 | 認証機能 | time_punch | sample-attendance-saas__login |
| FN-008 | 日次集計バッチ機能 | monthly_aggregation | - |
| FN-009 | 月次集計バッチ機能 | monthly_aggregation | - |
| FN-010 | 月次レポート表示機能 | monthly_aggregation | sample-attendance-saas__dashboard, sample-attendance-saas__monthly-report |
| FN-011 | CSV/PDF/Excelエクスポート機能 | monthly_aggregation | sample-attendance-saas__export |
| FN-012 | 有給残高更新バッチ機能 | monthly_aggregation | - |
| **FN-013** | **監査ログ記録機能（横断・暗黙呼び出し）** | **audit_log** | - ※全フロー横断（暗黙的に呼ばれる。各フロー §3 機能一覧には記載しない方針） |
| FN-014 | 監査ログ閲覧機能 | audit_log | -（実装フェーズで画面追加検討） |
| FN-015 | シフト登録・編集機能 | shift_management | sample-attendance-saas__shift-mgmt |
| FN-016 | シフト表示機能 | shift_management | sample-attendance-saas__dashboard |
| FN-017 | ユーザー登録・編集機能 | master_management | sample-attendance-saas__user-mgmt |
| FN-018 | 権限ロール管理機能 | master_management | sample-attendance-saas__user-mgmt |

### N対N関係の補足

業務フロー横断で共有される機能を独立採番 FN-XXX で表現することで、設計重複の回避・影響範囲の可視化・設計フェーズへの申し送りが容易になる。本サンプルでは以下の3パターンで N対N関係を実証している。

- **FN-005 通知配信機能**: 打刻フロー（未打刻リマインド通知）/ 勤怠承認フロー（承認依頼通知・結果通知・催促/エスカレーション通知）/ 未打刻アラートフロー（未打刻アラート通知）の **3フロー共有**。通知配信の一元基盤として複数業務フローから参照される共通機能の典型例。
- **FN-002 未打刻検知バッチ**: 打刻フロー（未打刻リマインドのトリガとして言及）/ 未打刻アラートフロー（検知バッチの主実行フロー）の **2フロー共有**。同じ機能が異なる時系列・役割で参照される事例（前日打刻アクション中心の打刻フロー vs 翌朝検知バッチ起点の未打刻アラートフロー）。
- **FN-013 監査ログ記録機能**: 全業務フロー（打刻・承認・月次集計・シフト管理・マスタ管理 等）からの **暗黙的呼び出し**。監査ログフロー §3 機能一覧にのみ独立採番して列挙し、各業務フローでは明示参照しない方針（最小変更原則）。記録失敗は Best-effort + Datadog アラートで運用する。

この N対N関係は以下の意義を持つ:

- **設計重複の回避**: 通知配信ロジック・監査ログ記録ロジックを業務フローごとに重複設計せず、共通基盤として一度設計すれば全フローで再利用できる
- **影響範囲の可視化**: FN-005 / FN-002 / FN-013 の仕様変更が複数フローに波及することが、本逆引き表から即座に判断できる
- **設計フェーズへの申し送り**: design.md / Issue 仕様では FN-005・FN-013 を独立した共通モジュール（通知サービス / 監査ログサービス）として実装する方針が導きやすくなる

#### FN-XXX 採番ポリシー

`FN-XXX` はプロジェクト全体で一意採番される。同一機能を複数フローで参照する場合は **同一 ID を使用**する。

- 現在の採番範囲: **FN-001〜FN-018（全18機能、連続採番）**
- **欠番なし**（FN-001〜FN-018 連続採番）
- 複数フロー共有 ID: **FN-002（2フロー）/ FN-005（3フロー）/ FN-013（全フロー横断・暗黙呼び出し）**
- 新規業務フロー追加時は次番（FN-019〜）から採番する

## 参照

- **上位要件**: [../requirements.md](../requirements.md) §6 機能要件サマリへの**書き戻しは行わない**（独立採番 FN-XXX で運用）
- **画面遷移図**: [../screen-flow-url.md](../screen-flow-url.md) — `stable_id` 参照キーの正本
- **Skill 定義**: `.claude/skills/einja-project-function-spec/SKILL.md`
- **スキーマ定義**: `.claude/skills/einja-project-function-spec/references/manifest-schema.md`
- **セクション構成**: `.claude/skills/einja-project-function-spec/references/output-template.md`
- **ヒアリングチェックリスト**: `.claude/skills/einja-project-function-spec/references/hearing-checklist.md`
