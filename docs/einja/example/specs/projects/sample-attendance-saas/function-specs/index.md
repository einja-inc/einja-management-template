---
schema_version: 1
generated_at: "2026-05-21T17:00:00Z"
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
---

<!--
本ファイルは einja-project-function-spec Skill の動作確認用サンプル（index.md / マニフェスト）です。
本来の出力先は docs/project/function-specs/index.md（1リポジトリ1プロジェクト前提）。

- 入力サンプル1: ../requirements.md（einja-project-requirements 出力）
- 入力サンプル2: ../screen-flow-url.md（einja-project-screen-flow-figma 出力）
- Skill 定義: .claude/skills/einja-project-function-spec/
- スキーマ定義: .claude/skills/einja-project-function-spec/references/manifest-schema.md

サンプルの注目ポイント:
- N対N関係の実証: FN-005「通知配信機能」が『打刻フロー』『勤怠承認フロー』の両方に登場している
  （下記「機能ID別 所属フロー逆引き表」を参照）。共通基盤機能を業務フロー横断で参照する典型例。
- 双方向トレーサビリティ: 画面 stable_id → function-spec → FN-XXX の双方向逆引きを2表で表現。
-->

# プロジェクト機能仕様書 一覧（sample-attendance-saas）

## 概要

本プロジェクト「中小企業向け勤怠管理SaaS（A社向け）」の業務フロー単位の機能仕様書一覧。
[../requirements.md](../requirements.md) §2 TO-BE 業務フロー / §6 機能要件サマリ と
[../screen-flow-url.md](../screen-flow-url.md) を入力ソースとして、業務フローごとに
sequenceDiagram・機能一覧（FN-XXX 独立採番）・業務ルール・関連画面を整理する。

サンプル本数は2業務フロー。実プロジェクトでは requirements.md §2 から導出される
全業務フロー（フェーズ1〜3で5〜10件想定）を列挙する。

## 業務フロー一覧

| flow_id | タイトル | ステータス | 詳細 |
|---------|---------|----------|------|
| sample-attendance-saas__flow__time_punch | 打刻フロー | draft | [→](./function-spec-sample-attendance-saas__flow__time_punch.md) |
| sample-attendance-saas__flow__attendance_approval | 勤怠承認フロー（残業・有給申請の承認） | draft | [→](./function-spec-sample-attendance-saas__flow__attendance_approval.md) |

## 画面別 関連機能逆引き表

`../screen-flow-url.md` の `screens[]` 全件に対して、関連する function-spec と FN-XXX を列挙する。

| 画面 stable_id | 画面名 | ロール | 関連 function-spec | 関連 FN-XXX |
|---------------|--------|--------|------------------|------------|
| sample-attendance-saas__login | ログイン画面 | 共通 | time_punch | FN-007 |
| sample-attendance-saas__dashboard | ダッシュボード | 人事部 | - | - |
| sample-attendance-saas__punch | 打刻画面 | 従業員 | time_punch | FN-001 |
| sample-attendance-saas__request | 申請画面 | 従業員 | attendance_approval | FN-003 |
| sample-attendance-saas__approval-list | 承認一覧画面 | 上長 | attendance_approval | FN-006 |
| sample-attendance-saas__approval | 承認画面 | 上長 | attendance_approval | FN-004 |
| sample-attendance-saas__monthly-report | 月次レポート画面 | 人事部 | （本サンプルでは未着手 / 月次集計フロー想定） | - |
| sample-attendance-saas__export | エクスポート画面 | 人事部 | （本サンプルでは未着手 / 月次集計フロー想定） | - |
| sample-attendance-saas__shift-mgmt | シフト管理画面 | 人事部 | （本サンプルでは未着手 / シフト管理フロー想定） | - |
| sample-attendance-saas__user-mgmt | ユーザー管理画面 | システム管理者 | （本サンプルでは未着手 / マスタ管理フロー想定） | - |

注: `dashboard` は導線・サマリ表示画面のため固有の機能が紐づかない（各function-specのステップ別表でも関連機能IDは `-` 扱い）。

注: 「未着手」と記載された画面は本サンプル簡略化のため対象外。実プロジェクトでは
requirements.md §6.1 F-05 / F-06 / F-02 / F-07 等に対応する業務フローを追加生成して埋める。

## 機能ID別 所属フロー逆引き表

各 `FN-XXX` がどの function-spec に登場するかを示す。**FN-005 は2業務フローに登場（N対N関係の実証）**。

| FN-XXX | 機能名 | 所属 function-spec | 関連画面 stable_id |
|--------|--------|-----------------|------------------|
| FN-001 | 打刻機能 | time_punch | sample-attendance-saas__punch |
| FN-002 | 未打刻検知バッチ | time_punch | - |
| FN-003 | 申請機能 | attendance_approval | sample-attendance-saas__request |
| FN-004 | 承認・差し戻し機能 | attendance_approval | sample-attendance-saas__approval |
| **FN-005** | **通知配信機能（共通基盤）** | **time_punch, attendance_approval** | - |
| FN-006 | 承認一覧表示機能 | attendance_approval | sample-attendance-saas__approval-list |
| FN-007 | 認証機能 | time_punch | sample-attendance-saas__login |

### N対N関係の補足（FN-005 共有機能）

`FN-005 通知配信機能` は、システムからのメール・アプリ内push通知を一元配信する **共通基盤機能**。
打刻フロー（未打刻リマインド通知）と勤怠承認フロー（承認依頼通知・結果通知・催促/エスカレーション通知）の
両方で利用されており、業務フロー横断の共通機能を独立採番 FN-XXX で表現する典型例として配置している。

この N対N関係は以下の意義を持つ:

- **設計重複の回避**: 通知配信ロジックを業務フローごとに重複設計せず、共通基盤として一度設計すれば全フローで再利用できる
- **影響範囲の可視化**: FN-005 の仕様変更が打刻 + 勤怠承認の両フローに波及することが、本逆引き表から即座に判断できる
- **設計フェーズへの申し送り**: design.md / Issue 仕様では FN-005 を独立した共通モジュールとして実装する方針が導きやすくなる

#### FN-XXX 採番ポリシー

`FN-XXX` はプロジェクト全体で一意採番される。同一機能を複数フローで参照する場合は **同一 ID を使用**する（例: FN-005 通知配信機能は本サンプルで `time_punch` / `attendance_approval` の両フローから同一 ID で参照されている）。

## 参照

- **上位要件**: [../requirements.md](../requirements.md) §6 機能要件サマリへの**書き戻しは行わない**（独立採番 FN-XXX で運用）
- **画面遷移図**: [../screen-flow-url.md](../screen-flow-url.md) — `stable_id` 参照キーの正本
- **Skill 定義**: `.claude/skills/einja-project-function-spec/SKILL.md`
- **スキーマ定義**: `.claude/skills/einja-project-function-spec/references/manifest-schema.md`
- **セクション構成**: `.claude/skills/einja-project-function-spec/references/output-template.md`
- **ヒアリングチェックリスト**: `.claude/skills/einja-project-function-spec/references/hearing-checklist.md`
