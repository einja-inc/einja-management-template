<!--
**2026-05-28 注釈**: einja-project-screen-flow Skill は drawio 化された（einja-project-screen-flow-drawio にリネーム）。
本メモ内で screen-flow に関する記述は Figma 時代の経緯記録であり、現行実装の参照ではない。
screen-spec（ワイヤーフレーム）側は引き続き Figma を使用しているため、Phase 4 の中心テーマである screen-spec 関連の記述は現行有効。
-->

# Phase 4 (einja-project-screen-spec) 責務再設計の別Plan化メモ

## 実装ステータス（2026-05-25 更新）

| スコープ | 状態 |
|---------|------|
| 画面単位ワイヤーフレーム（mid-fi、uncolored/mono） | **実装済み**（`einja-project-screen-spec` Skill） |
| フォーム項目定義（項目名/型/桁/必須/選択肢/初期値） | 未実装（後続別 Skill 予定） |
| バリデーションエラー・業務エラーの表示位置・メッセージ文言 | 未実装（後続別 Skill 予定） |
| UI 状態（ローディング/無効化/ハイライト） | 未実装（manifest 記録のみ可、Figma 描画は normal state） |
| 画面単位の挙動詳細（タブ切り替え、モーダル開閉、遅延ロード等） | 未実装 |

本ファイルは **実装完了済みのワイヤーフレーム部分以外** の Phase 4 スコープ（フォーム項目定義・メッセージ文言・UI 状態・画面単位挙動）を扱う申し送りメモ。

## 概要

受託開発ドキュメント生成パイプラインの Phase 4 (`einja-project-screen-spec`, 画面単位のワイヤーフレーム + 項目定義 + 画面挙動を扱う Skill) のうち、**ワイヤーフレーム部分は 2026-05-25 時点で実装済み**。残りスコープ（フォーム項目定義 / メッセージ文言 / UI 状態 / 画面単位挙動）は未実装。

PR #149 で Phase 3 (`einja-project-function-spec`) を「業務フロー観点中心」→「業務フロー + 詳細システムフロー」にスコープ拡張した（cf. .claude/skills/einja-project-function-spec/SKILL.md の「Phase 4 との責務境界」セクション）。これに伴い Phase 3/Phase 4 の責務分担マトリックスを Phase 3 SKILL.md に明記しているが、**Phase 4 残スコープの Skill 設計（hearing-checklist / output-template / manifest-schema 等）は別 Plan で扱うことが合意済み**。

## Phase 3 / Phase 4 責務境界マトリックス（Phase 3 SKILL.md と整合）

| 観点 | Phase 3 機能仕様 (`einja-project-function-spec`) | Phase 4 画面仕様 (`einja-project-screen-spec`) |
|------|--------------------------------------------|----------------------------------------|
| 画面 | stable_id で参照のみ | ワイヤーフレーム + 項目定義 |
| フォーム項目 | 業務的に必要な入力概念 | 項目名 / 型 / 桁 / 必須 / 選択肢 / 初期値 |
| バリデーション | 業務ルール + 主要技術制約 (必須/桁/重複/権限) | 入力時の表示位置・メッセージ文言 |
| 画面遷移 | 業務フロー上の宛先 stable_id | 遷移ボタンの配置・遷移条件 |
| 画面挙動 | データ取得・送信タイミング | UI 状態 (ローディング / 無効化 / ハイライト) |

## 別Plan着手の起点

Phase 4 Skill 設計に着手する際は、以下を起点とすること:

1. **Phase 3 SKILL.md の「Phase 4 との責務境界」セクション** （`.claude/skills/einja-project-function-spec/SKILL.md`）を読み、責務境界マトリックスを Phase 4 Skill の出発点として活用する
2. **Phase 3 サンプル7本** (`docs/einja/example/specs/projects/sample-attendance-saas/function-specs/function-spec-*.md`) の §2.2 システムフロー / §3.2 機能カードで参照されている stable_id 一覧を Phase 4 のヒアリング対象画面候補として利用する
3. **screen-flow-url.md** (`docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md`) の screens[] が Phase 4 ヒアリングの起点となる
4. 既存パイプライン Skill (`einja-project-requirements` / `einja-project-screen-flow-drawio` / `einja-project-function-spec`) の構造を参考に Phase 4 を設計する

## Phase 4 で扱う内容（想定スコープ）

- 画面単位（stable_id ごと）のワイヤーフレーム — **実装済み** (`einja-project-screen-spec`)
- 各画面のフォーム項目定義（項目名 / 型 / 桁 / 必須 / 選択肢 / 初期値） — 未実装
- バリデーションエラー・業務エラーの表示位置・メッセージ文言 — 未実装
- 画面遷移ボタンの配置・遷移条件 — 未実装
- UI 状態（ローディング / 無効化 / ハイライト） — 未実装
- 画面単位の挙動詳細（タブ切り替え、モーダル開閉、遅延ロード等） — 未実装

## Phase 4 で扱わない内容（Phase 3 で扱う、または design.md / Issue 仕様）

- 業務フロー全体のシーケンス（→ Phase 3 §2.1）
- システムコンポーネント間のシーケンス（→ Phase 3 §2.2）
- FN-XXX 機能の処理ステップ・業務エラー（→ Phase 3 §3.2）
- 主要技術制約の業務ルール起点記述（→ Phase 3 §5.4）
- 具体的 API パス・テーブル名・カラム名（→ design.md / Issue 仕様）

## 関連リソース

- Phase 3 SKILL.md: `.claude/skills/einja-project-function-spec/SKILL.md`
- Phase 3 サンプル: `docs/einja/example/specs/projects/sample-attendance-saas/function-specs/`
- screen-flow-url.md: `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md`
- 本 PR: GitHub PR #149 (https://github.com/einja-inc/einja-management-template/pull/149)（Phase 3 機能仕様）、ワイヤーフレーム実装 PR: TBD（本 PR）
