# Phase 4 (einja-project-screen-spec) 責務再設計の別Plan化メモ

## 概要

受託開発ドキュメント生成パイプラインの Phase 4 (`einja-project-screen-spec`, 画面単位のワイヤーフレーム + 項目定義 + 画面挙動を扱う Skill) は **2026-05-22 時点で未実装**。

PR #149 で Phase 3 (`einja-project-function-spec`) を「業務フロー観点中心」→「業務フロー + 詳細システムフロー」にスコープ拡張した（cf. .claude/skills/einja-project-function-spec/SKILL.md の「Phase 4 との責務境界」セクション）。これに伴い Phase 3/Phase 4 の責務分担マトリックスを Phase 3 SKILL.md に明記しているが、**Phase 4 自体の Skill 設計（hearing-checklist / output-template / manifest-schema 等）は別 Plan で扱うことが合意済み**。

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
4. 既存パイプライン Skill (`einja-project-requirements` / `einja-project-screen-flow-figma` / `einja-project-function-spec`) の構造を参考に Phase 4 を設計する

## Phase 4 で扱う内容（想定スコープ）

- 画面単位（stable_id ごと）のワイヤーフレーム
- 各画面のフォーム項目定義（項目名 / 型 / 桁 / 必須 / 選択肢 / 初期値）
- バリデーションエラー・業務エラーの表示位置・メッセージ文言
- 画面遷移ボタンの配置・遷移条件
- UI 状態（ローディング / 無効化 / ハイライト）
- 画面単位の挙動詳細（タブ切り替え、モーダル開閉、遅延ロード等）

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
- 本 PR: GitHub PR #149 (https://github.com/einja-inc/einja-management-template/pull/149)
