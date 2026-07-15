# 出力フォーマット規約 — einja-test-scenario-generator

## 目次

1. [目的](#目的)
2. [ディレクトリ構造](#ディレクトリ構造)
3. [生成テストファイル命名規約](#生成テストファイル命名規約)
4. [リポジトリへの反映先](#リポジトリへの反映先)
5. [実行ログフォーマット（`run-result.md`）](#実行ログフォーマットrun-resultmd)
6. [CI 参考スニペット（`ci-snippet/`）](#ci-参考スニペットci-snippet)
7. [判定結果フォーマット（`judgment.json`）](#判定結果フォーマットjudgmentjson)
8. [不変条件](#不変条件)
9. [関連 references](#関連-references)

## 目的

einja-test-scenario-generator が生成するテストファイル・実行ログ・バックアップの命名と配置を一本化し、Skill 内の各 Step（特に Step 5/6/7）が同じ規約を共有することを保証する。

## ディレクトリ構造

```
.work/test-scenario-generator/
  .input/                 # 入力ファイル原本（git patch、自然言語メモ等のコピー）
  generated/              # 生成テストファイル（リポジトリ書込前の置き場）
  backup/                 # リポジトリ既存ファイルのバックアップ（.bak）
  ci-snippet/             # CI 参考雛形（test.yml.example / package-json-test-coverage.patch）
  run-result.md           # 実行ログ（カバレッジ含む）
  judgment.json           # Step 3 の判定結果
```

ルール:

- `.input/` には Skill 起動時にユーザーが提示した原本ファイルを **必ずコピー** する。move ではなく copy。
- `generated/` / `backup/` は生成・書込前に `mkdir -p` で確実に存在させる。
- `run-result.md` / `judgment.json` は 1 タスク 1 ファイル（同一タスクで再実行された場合は上書き）。
- `.work/` はローカル作業用ディレクトリであり、コミット対象に含めない（`.gitignore` に `.work/` が無ければ Step 0 で追記を提案する）。

## 生成テストファイル命名規約

入力種別ごとに以下の命名規則でファイル名を決める。すべて `generated/` 配下に配置する。

| 入力種別 | Vitest（ユニット） | Playwright（E2E） |
|----------|-------------------|------------------|
| 自然言語入力 | `nl-{n}-{feature-kebab}.test.ts` | `nl-{n}-{feature-kebab}.spec.ts` |
| git diff 入力 | `diff-{n}-{feature-kebab}.test.ts` | `diff-{n}-{feature-kebab}.spec.ts` |

例:

- `nl-1-shopping-cart-total.test.ts`
- `nl-2-login-flow.spec.ts`
- `diff-1-user-profile-update.spec.ts`

詳細ルール:

- **`{n}`**: 同一 Skill 起動内の連番。1 から始め、3 桁ゼロ埋めはしない（`nl-1`, `nl-2`, `nl-10`）。
- **`{feature-kebab}`**: シナリオ要約から 2-4 単語を抜き出し、すべて小文字のケバブケースに正規化する。
  - 日本語の場合は英訳してからケバブケース化（例: 「ログイン入力チェック」→ `login-validation`）。
  - 記号・スペース・キャメル/スネークは禁止。許可文字は `[a-z0-9-]` のみ。
  - 短すぎ（1 単語）・長すぎ（5 単語以上）は避ける。
- 拡張子は **Vitest = `.test.ts`、Playwright = `.spec.ts`** を固定する（混在禁止）。
- 同一 `{scenario-id}` で Vitest と Playwright を両方生成する場合は、上記の通り拡張子だけが異なるペアになる。

## リポジトリへの反映先

Step 6 で「リポジトリに反映」を選択した場合の配置先決定ロジック。

### Vitest

1. 対象パッケージ内で `__tests__/`・`tests/` を Glob で確認する。
2. どちらか一方のみ存在する場合は自動配置（`{ディレクトリ}/{filename}`）。
3. 両方存在する場合は AskUserQuestion で配置先を選択（最後の選択肢は必ず「その他（自由入力）」）。
4. **どちらも存在しない場合**: Skill は配置先ディレクトリを新規作成しない。AskUserQuestion で以下を提示する。
   - `.work/ に残すのみ`（推奨）— Note: 対象パッケージを汚さず、ユーザーが手動で配置する
   - `手動でディレクトリを指定`— Note: 自由入力でパスを受け取り、そのパスへ書き込む
   - `その他（自由入力）`

### Playwright

1. 対象パッケージ内で `e2e/`・`tests/e2e/` を Glob で確認する。
2. 単一存在 → 自動配置。複数存在 → AskUserQuestion。
3. **どちらも存在しない場合**: Vitest と同じく Skill は新規作成せず、ユーザーに 3 択を提示する。

### 配置前の必須チェック

1. `mkdir -p` で `.work/test-scenario-generator/generated/` を確実に作る。
2. `generated/` に**先に**書き込む（直接リポジトリへ書かない）。
3. リポジトリへ反映する直前に、配置先パスを **必ず Read で試行** する。
   - 既存ファイルあり: `.work/test-scenario-generator/backup/{元ファイル名}.{ISO8601-timestamp}.bak` にコピーしてから上書き。
     - 例: `.work/test-scenario-generator/backup/nl-1-login-validation.test.ts.20260611T133045Z.bak`
   - 既存ファイルなし: そのまま Write。
4. バックアップは Skill 起動ごとにユニークな timestamp を持たせる（同名衝突を絶対に避ける）。
5. 書込後に Read で内容一致を確認し、`generated/` 側と差異があれば警告を出す。

## 実行ログフォーマット（`run-result.md`）

Step 7 のテスト実行結果を保存する。失敗・成功問わず必ず生成する。

````markdown
# Test Run Result

## 実行日時
YYYY-MM-DD HH:MM:SS

## 実行コマンド
pnpm exec vitest run __tests__/nl-1-login-validation.test.ts

## サマリ
- Pass: 3
- Fail: 1
- Skip: 0

## カバレッジ
- 行: 82% / 目標 80% → 達成
- 分岐: 65% / 目標 70% → 未達成
- 未カバー行: packages/core/src/validation.ts 42-45

## 失敗テスト詳細

### nl-1-login-validation.test.ts > 空文字を渡すとエラーになる

```
{失敗ログの抜粋（最大 50 行）}
```

- 考えられる原因: テスト期待値 / 実装ロジック / モック設定
- 確認ポイント: packages/core/src/validation.ts:42 周辺
````

ルール:

- **実行日時** は対象パッケージでテストを起動した時刻（ISO 8601 もしくはローカルタイム + タイムゾーン）。
- **実行コマンド** は実際に Bash で実行したコマンドそのまま。`pnpm exec vitest run <file>`（カバレッジ時は `--coverage ...` 付き）または `pnpm exec playwright test <file>`。
- **サマリ** は Pass / Fail / Skip / Duration（任意）の整数値。
- **カバレッジ**（Vitest のみ）: 行 % / 分岐 % をそれぞれ目標と比較し `達成` / `未達成` を記す。未カバー箇所はファイル別に行・分岐を列挙する（修正コードは出さない）。合否は `coverage-summary.json`、未カバー行は `text` reporter 由来。算出元・判定詳細は [coverage-ci.md](coverage-ci.md) を正とする。**coverage-degraded 時**はこのセクションに `スキップ理由` を 1 行だけ書く（例: `@vitest/coverage-v8 未導入のため`）。Playwright のみの実行ではセクションごと省略可。
- **失敗テスト詳細** は失敗テストごとに `### {ファイル名} > {テスト名}` の見出しで列挙する。失敗 0 件なら見出しごと省略可。
- ログ抜粋は最大 50 行。長い場合は前後を `...` で省略。ANSI カラーは除去する。
- 「考えられる原因」「確認ポイント」は **Step 8 のガイド情報のみ**。自動修正案コードは含めない。
- 実行スキップ時（degraded-mode・依存未インストール）は、サマリの代わりに「## 実行スキップ理由」セクションを置き、理由（例: `node_modules/ 不在のため。pnpm install 後に再実行してください`）を明記する。

## CI 参考スニペット（`ci-snippet/`）

CI で自動実行できるようにするための **参考雛形を出力するのみ**。実際の CI 設定（`.github/workflows/`）・`package.json` には書き込まない。

- `test.yml.example`: `pnpm install --frozen-lockfile` + `pnpm exec vitest run --coverage` を実行する GitHub Actions ワークフロー雛形。
- `package-json-test-coverage.patch`: `scripts.test:coverage` 追記の参考パッチ。
- 適用は手動である旨をユーザー報告に明記する。テンプレート本文は [coverage-ci.md §CI 参考スニペット生成](coverage-ci.md) を参照する。

## 判定結果フォーマット（`judgment.json`）

Step 3 のテスト種別自動判定結果を保存する。`references/judgment-rules.md` のロジック出力をそのまま JSON 化する。

スキーマ概要（正規スキーマは `references/judgment-rules.md` を正とし、本ファイルは追従する）:

```json
{
  "version": "1",
  "generated_at": "2026-06-11T13:30:45Z",
  "scenarios": [
    {
      "scenario_id": "nl-1",
      "type": "vitest",
      "confidence": "high",
      "signals": ["バリデーション", "action:pure-fn"],
      "feature_kebab": "login-validation"
    },
    {
      "scenario_id": "nl-2",
      "type": "playwright",
      "confidence": "high",
      "signals": ["クリック", "画面遷移", "action:ui-verb"],
      "feature_kebab": "login-flow"
    },
    {
      "scenario_id": "diff-1",
      "type": "both",
      "confidence": "medium",
      "signals": ["送信", "メッセージ表示", "path:apps/web/login/page.tsx", "path:packages/core/validators.ts"],
      "feature_kebab": "admin-summary"
    }
  ]
}
```

ルール:

- フィールド名・型は `references/judgment-rules.md` の出力フォーマットと一致させる。乖離が出た場合は **judgment-rules.md を正** とし本ファイルを追従させる。
- `scenarios[].type` は `vitest` / `playwright` / `both` のいずれか。
- `scenarios[].scenario_id` は生成テストファイル命名の `nl-{n}` / `diff-{n}` と一致させる。
- `scenarios[].feature_kebab` は生成テストファイル名の `{feature-kebab}` 部分と一致させる（小文字ケバブケース、`[a-z0-9-]` のみ）。
- 本ファイルは Step 3 で生成し、Step 5 が読み込んで対応するテンプレートを選択する入力になる。

## 不変条件

以下は必ず満たすこと。違反は実装バグ扱い。

1. **生成テストの直書き禁止**: テストファイルは必ず一度 `generated/` に書き込んでからリポジトリへ移される。`generated/` を経由しない直接書込は禁止。
2. **バックアップの一意性**: `backup/{元ファイル名}.{timestamp}.bak` の `{timestamp}` は同 Skill 起動内でユニーク。秒精度で衝突する場合はミリ秒またはサフィックスで一意化する。
3. **出力先固定**: 出力先は `.work/test-scenario-generator/` から逸脱しない。
4. **`.input/` への原本コピー**: ユーザー提供のファイル（git patch、自然言語メモ等）は作業開始前に `.input/` へコピーする。move 不可。
5. **`run-result.md` と `judgment.json` の整合**: `run-result.md` の対象ファイル名と `judgment.json` の `scenarios[].scenario_id`・`scenarios[].feature_kebab` は必ず対応関係を保つ。
6. **リポジトリ書込前の Read**: リポジトリへの書込前に必ず Read で存在チェックを行う。Read 省略禁止。
7. **拡張子の固定**: Vitest = `.test.ts`、Playwright = `.spec.ts`。逆転や混在は禁止。

## 関連 references

- `input-routing.md` — 2 種入力（git diff / 自然言語）の判定木と `.input/` 配置ルール
- `judgment-rules.md` — `judgment.json` のスキーマ定義元（このファイルは出力先規約のみ管理）
- `test-patterns.md` — 生成テストの中身（テンプレート）に関する規約。本ファイルはファイル名と配置のみを管理する
- `coverage-ci.md` — カバレッジ計測（検出・目標・判定・reporter 役割分担）と CI 雛形テンプレートの定義元。本ファイルは `## カバレッジ` セクションと `ci-snippet/` の配置のみを管理する
