# Plan: サンプル用 `screen-flow-url.md`（sample-attendance-saas）追加

## Context

PR #148 で導入した `einja-project-screen-flow-figma` Skill の**出力サンプル（manifest）が未配備**で、初めて使う下流ユーザーが生成後の YAML 構造を実例で確認できない。同 Skill の `references/hearing-checklist.md §3` が `sample-attendance-saas/requirements.md` を例示入力として明記しているのに、対応する出力サンプルが揃っていない。

親PR `feat/einja-project-requirements` で既に `docs/einja/example/specs/projects/sample-attendance-saas/requirements.md`（939行）が追加されているため、その隣に **`screen-flow-url.md` を 1 ファイル追加**して「要件 → 画面遷移マニフェスト」の 1 セットサンプルを完成させる。

## 現状

### 既存サンプル構成
```
docs/einja/example/specs/projects/sample-attendance-saas/
└── requirements.md   (939 行、commit e860d26 で追加済み・親PR配下)
```

### 関連
- `.claude/skills/einja-project-screen-flow-figma/SKILL.md` Step 10 で `docs/project/screen-flow-url.md` 出力を規定
- `.claude/skills/einja-project-screen-flow-figma/references/manifest-schema.md` でスキーマ確定（`schema_version: 1`）
- `.claude/skills/einja-project-screen-flow-figma/references/hearing-checklist.md §3` が `sample-attendance-saas/requirements.md` を例示入力としている

### CLI 配布
`packages/cli/scripts/copy-presets.mjs` L61-64 で `docs/einja` → `packages/cli/presets/default/docs/einja` 全体コピー。`docs/einja/example/specs/projects/sample-attendance-saas/` 配下に追加するファイルは**自動的に配布対象**（ホワイトリスト追加不要）。

### Figma MCP 復旧状況（2026-05-19 時点）
依然として proxy エラー継続中（昨日からほぼ24時間以上）。**Figma 実ファイル添付は現実的でない** → プレースホルダー URL 方針確定。実ファイル添付は PR #148 マージ後の別 Issue で対応。

## 変更内容

### 追加ファイル（1ファイルのみ）

**`docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md`**

#### 構造
- 先頭に HTML コメント（サンプル明示・プレースホルダー注記）
- YAML frontmatter（6 必須フィールド + コメント）
- `## screens` セクション（10件）
- `## edges` セクション（12件）

#### frontmatter
```yaml
figma_url: https://www.figma.com/design/PLACEHOLDER_FILE_KEY/sample-attendance-saas-screen-flow
file_key: PLACEHOLDER_FILE_KEY
plan_key: PLACEHOLDER_PLAN_KEY
schema_version: 1
generated_at: 2026-05-19
project_name: sample-attendance-saas
```

#### screens（10件、要件 §2 TO-BE 由来）

| name | role | 由来（章・ノードID） |
|------|------|------|
| login | 共通 | hearing-checklist §3.3 共通画面 |
| dashboard | 人事部 | requirements.md §2.1.2 TO-BE `H1[ダッシュボードで状況確認]`（人事部用。上長 B1 とは別画面とする設計判断） |
| punch | 従業員 | requirements.md §2.1.2 TO-BE `A2[アプリで打刻]` |
| request | 従業員 | requirements.md §2.1.2 TO-BE `A3[アプリで有給/残業申請]` |
| approval-list | 上長 | requirements.md §2.1.2 TO-BE `B1[アプリで申請通知受領]` |
| approval | 上長 | requirements.md §2.1.2 TO-BE `B2{承認判定}`（B3 差し戻しコメントは本画面のモーダル内操作として統合） |
| monthly-report | 人事部 | requirements.md §2.1.2 TO-BE `H2[月次集計を自動取得]`（F-05 勤怠集計の表示画面も内包） |
| export | 人事部 | requirements.md §2.1.2 TO-BE `H3[CSV/PDFで給与システムへ連携]` |
| shift-mgmt | 人事部 | requirements.md §6.1 機能一覧 F-02 シフト管理 |
| user-mgmt | システム管理者 | requirements.md §6.1 機能一覧 F-07 ユーザー管理 |

`stable_id` 規則: `sample-attendance-saas__{name}`、`node_id` は `"1:2"` から連番（プレースホルダー）、`status: active`、`position` は格子レイアウト想定で `{x, y}` を含む。

**サンプル簡略化のため省略する画面**（frontmatter HTML コメントに明示する）:
- MFA 入力画面（§4.2 「Auth.js + 多要素認証」由来）→ login 画面に統合
- F-08 監査ログ閲覧画面 → 管理者専用機能のためサンプルから省略
- B3 差し戻しコメント入力画面 → approval 画面内モーダル操作として統合

#### edges（12件、想定遷移）

**`trigger` 表記方針**: 「{要素名}ボタンクリック型」に統一（hearing-checklist §3 の例示に整合）。ただしイベント駆動の遷移（ログイン成功・打刻完了等）はそのまま自然語で記述（hearing-checklist 項目C「自動遷移」分類）。

| from | to | trigger | 分類 |
|------|----|---------|------|
| login | dashboard | ログイン成功 | 自動遷移 |
| dashboard | punch | 打刻ボタンクリック | クリック |
| dashboard | request | 申請ボタンクリック | クリック |
| dashboard | monthly-report | 月次レポートボタンクリック | クリック |
| dashboard | shift-mgmt | シフト管理ボタンクリック | クリック |
| dashboard | user-mgmt | ユーザー管理ボタンクリック | クリック |
| monthly-report | export | エクスポートボタンクリック | クリック |
| request | approval-list | 申請送信ボタンクリック | クリック |
| approval-list | approval | 申請項目クリック | クリック |
| approval | request | 差し戻しボタンクリック | クリック |
| punch | dashboard | 打刻完了後の自動遷移 | 自動遷移 |
| request | dashboard | 申請完了後の自動遷移 | 自動遷移 |

`stable_id` 規則: `{from}__to__{to}`、`node_id` は `"1:20"`〜`"1:31"` の連番プレースホルダー、`status: active`。

**Note**: edges の `from`/`to` には screen の `name` フィールド値（kebab-case、例: `login`）を使用する。screen の `stable_id` 値（例: `sample-attendance-saas__login`）ではない。

**Note**: `generated_at` は実装時のタスク1実行日を YYYY-MM-DD で正確に記入する（Plan 作成日の値はあくまで暫定）。

### 冒頭 HTML コメント例

```html
<!--
本ファイルはサンプル用の screen-flow-url.md です。
本来の出力先は docs/project/screen-flow-url.md（1リポジトリ1プロジェクト前提）。
einja-project-screen-flow-figma Skill により生成されるマニフェストの実例として配置しています。

- 入力サンプル: ./requirements.md
- Skill 定義: .claude/skills/einja-project-screen-flow-figma/
- スキーマ定義: .claude/skills/einja-project-screen-flow-figma/references/manifest-schema.md

サンプル簡略化のため省略している画面:
- MFA 入力画面（§4.2 Auth.js + 多要素認証由来）→ login 画面に統合
- F-08 監査ログ閲覧画面 → 管理者専用機能のため省略
- B3 差し戻しコメント入力画面 → approval 画面内モーダル操作として統合

注意: 下記 figma_url / file_key / plan_key はサンプル用プレースホルダーであり、
実在の Figma ファイルではありません（実ファイル添付は Figma MCP 復旧後の
別 Issue で対応予定）。
-->
```

### 変更しないもの
- `requirements.md`: 変更禁止（併設で要件は維持）
- Skill 本体・references: 変更不要（既に sample 参照記載済み）
- `figma-design-management.md` 等の steering: 変更不要
- `copy-presets.mjs` ホワイトリスト: 変更不要（`docs/einja/` 全体コピーで自動対応）
- `docs/einja/example/README.md`: スコープ外（必要なら別 PR で更新）

### 配布制御
- `docs/einja/example/` 配下は `copy-presets.mjs` で `docs/einja/` 全体コピー対象（`memory`/`cli` のみ除外）→ **追加ファイルは自動的に下流リポジトリへ配布される**
- ホワイトリスト更新不要

## タスク概要

| ID | 内容 | 委託先/Skill | 依存 |
|----|------|------------|------|
| 0-0 | TaskCreate でタスク一括登録 | オーケストレーター | - |
| 0-1 | Plan ファイルを現作業環境の保存先・命名規則で配置（既存 worktree 内 `docs/plans/202605/20260519-sample-screen-flow-manifest.plan.md` 等） | Bash | 0-0 |
| 0-2 | worktree 状態確認（既存 `feat/einja-project-screen-flow-figma` ブランチで作業継続、PR #148 へ追加コミット予定）+ `copy-presets.mjs` の除外ロジック確認（`memory`/`cli` 以外に除外条件がないこと、L61-64 を Read で確認） | Bash + Read | 0-0 |
| 1 | サンプル `screen-flow-url.md` ドラフト作成（10 screens + 12 edges、frontmatter コメント、node_id 連番、generated_at は実装日を記入） | general-purpose | 0-1, 0-2 |
| 2 | YAML 構文・スキーマ準拠の自己検証（HTML コメントを除外して frontmatter 抽出 → `python3 -c "import yaml; yaml.safe_load(...)"` で frontmatter／screens／edges を**3段階分けて**パース、必須フィールド存在チェック、stable_id 命名、node_id 形式 `^\d+:\d+$`、status 値域） | Bash + general-purpose | 1 |
| 3 | `requirements.md` §2 TO-BE / §6 機能一覧との要件整合性確認（10 screens + 12 edges のトレース表） | general-purpose | 1（タスク2と並列可） |
| 99-1 | レビュー [`einja-review-code`]（観点 A=要件適合 / D=スキーマ準拠 / G=配布影響 + codex-agent） | einja-review-code | 1〜3 完了後 |
| 99-2 | 動作確認: ① YAML パース（`python3 -c "import yaml; yaml.safe_load(...)"`） ② `pnpm --filter @einja-inc/dev-cli build` → `presets/default/docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` の出力確認 ③ プレースホルダー URL が外部リクエスト発生しないことを目視確認 | Bash | 99-1 |
| 99-G | コミット承認ゲート [`AskUserQuestion`]: 完了報告（修正概要・レビュー結果サマリ・動作確認結果）+ **`--no-verify` 継続可否を3択で確認**（「継続（推奨・既存リグレッション理由）」「`--no-verify` 解除して prepush 実行」「中止」） | AskUserQuestion | 99-2 |
| 99-3 | コミット・プッシュ [`einja-task-commit`]（PR #148 への追加コミット、`--no-verify` 方針は 99-G 結果に従う。解除選択時 prepush 失敗は再度 99-G に戻る） | einja-task-commit | 99-G 承認後 |

## 並列実行計画

```
0-0 → 0-1 / 0-2 [並列]
      ↓
      1（直列）
      ↓
      2 / 3 [並列]
      ↓
      99-1（einja-review-code 内部で観点A/D/G + codex 並列）
      ↓
      99-2 → 99-G → 99-3
```

## リスク・不明点

| 区分 | 内容 | 影響 | 対策 |
|------|------|------|------|
| 環境 | Figma MCP proxy エラー継続（24時間以上） | 高 | 本Planはプレースホルダー URL で完結。実ファイル添付は別Issue |
| 仕様 | プレースホルダー URL の妥当性（URL リテラルとして valid か） | 低 | `manifest-schema.md §1.1` は型 string 規定のみで URL 妥当性は要求しない → スキーマ準拠維持。frontmatter コメントで「サンプル」と明示 |
| 運用 | CLI sync で下流リポジトリにサンプルが配布される影響 | 中 | docs/einja/ は読み取り専用マネージドディレクトリ規約のため下流ユーザーは編集しない前提。frontmatter コメントで「サンプル」と強く明示 |
| 配布 | 下流ユーザーが本サンプルを誤って自プロジェクトで参照するリスク | 低 | コメント内に「本来の出力先は docs/project/screen-flow-url.md」と明記 |
| CI/CD | prepush の `@einja-inc/create-app#test` 既存リグレッション（`tests/integration/create.test.ts:72` の package.json 存在チェック失敗、`tests/unit/generators/template.test.ts:158` の template 展開失敗。親ブランチ `feat/einja-project-requirements` でも再現するため**本Skill変更とは無関係**） | 中 | 本Plan は Markdown 1ファイル追加のみでコード変更なし → `--no-verify` の副作用（lint/test スキップ）は実害小。PR #148 時点で `--no-verify` 継続済み、本Planも同方針、99-G で3択（継続/解除/中止）確認 |
| ブランチ | PR #148 (`feat/einja-project-screen-flow-figma`) が親PR `feat/einja-project-requirements` の派生 stacked PR | 低 | 本変更も同ブランチへの追加コミットなので影響なし |

## 検証・動作確認方法

### 静的検証（タスク 2）
- YAML パース手順（**HTML コメント混在対応**）:
  1. ファイル全文を読み込む
  2. 先頭の `<!--` 〜 `-->` ブロックを正規表現で除去（`re.sub(r'^<!--.*?-->\s*', '', content, flags=re.DOTALL)` 相当）
  3. 残りを `---` で split し、`[1]` を frontmatter、`[2]` を本体（`## screens` / `## edges` セクション含む）として処理
  4. frontmatter は `python3 -c "import yaml; yaml.safe_load(...)"` でパース
  5. 本体は `## screens` / `## edges` で分割 → 各 YAML リストを個別にパース
- スキーマ準拠チェックリスト（`manifest-schema.md §1.1〜§1.3`）:
  - frontmatter 6 必須フィールド存在
  - 全 screens に `name`/`stable_id`/`node_id`/`status` 必須
  - 全 edges に `from`/`to`/`trigger`/`stable_id`/`node_id`/`status` 必須
  - `stable_id` 命名: screens=`sample-attendance-saas__{name}`、edges=`{from}__to__{to}`
  - **edges の `from`/`to` は screen の `name` フィールド値（kebab-case）であること**（`stable_id` 値ではない）
  - `node_id` 形式: 正規表現 `^\d+:\d+$`
  - `status` ∈ `{active, orphan}`

### 要件整合性検証（タスク 3）
- screens 10 件・edges 12 件すべてが `requirements.md` のいずれかの章にトレース可能な表を生成
- 矛盾箇所があれば指摘

### 配布検証（タスク 99-2）
- `pnpm --filter @einja-inc/dev-cli build` 実行 → `packages/cli/presets/default/docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` が出力されることを `ls` 確認
- 既存 `requirements.md` も同時にコピーされていること
- ホワイトリスト更新不要を再確認

### レビュー（タスク 99-1）
- `einja-review-code` 観点 A（要件適合）/ D（スキーマ準拠）/ G（配布影響）+ codex-agent 並列レビュー
- MAJOR 指摘ゼロを目指し、MINOR 指摘は対応 or 不対応理由を明記

## 完了判定

- タスク 1〜3 完了
- 99-1: `einja-review-code` で **MAJOR ゼロ**
- 99-2: build 成功 + 配布パスに新ファイル存在
- 99-G: ユーザー承認
- 99-3: `einja-task-commit` 経由で PR #148 (`feat/einja-project-screen-flow-figma`) に追加コミット push 済み
- `gh pr view 148 --json files` で `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` が含まれることを確認
