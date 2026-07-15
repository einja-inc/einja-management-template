---
name: test-scenario-generator
description: "git diffまたは自然言語からeinja標準スタック（Vitest + Playwright）向けのテストコードを生成し、対象コードで実行してpass/fail結果とカバレッジ（行/分岐）まで報告する。入力内容からユニット/E2Eを自動判定して両方生成可能。CIで回すための参考ワークフロー雛形も.work内に生成する。出力は.work配下に必ず保存され、ユーザー確認後にリポジトリへの反映を選択できる。「テストを書いて」「テスト生成」「test scenario generator」「diffからテスト作って」「Vitest書いて」「Playwrightテスト生成」「テストコード生成」「カバレッジ取って」「coverage」「CIで回るテスト」等で起動。Do NOT use for: テスト戦略・テストプラン策定（テストケース生成ではなくテスト方針の議論。→ einja-coding-standards の testing-strategy.md）、CI設定の生成（提供するのは.work内の参考雛形のみ。CIの構築・運用・失敗診断は対象外）、テスト失敗時のデバッグ専任。"
user-invocable: true
metadata:
  author: einja-inc
allowed-tools:
  - AskUserQuestion
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - mcp__playwright__*
---

# test-scenario-generator — Vitest/Playwright テスト自動生成

## 概要

git diff・自然言語のいずれかを入力に、einja 標準スタックである Vitest（ユニット）/ Playwright（E2E）向けのテストコードを生成し、対象コードで実行して pass/fail と **カバレッジ（行/分岐、Vitest のみ）** を報告する。CI で回すための参考ワークフロー雛形も `.work/` 内に生成する（実際の CI 設定は書き換えない）。

主経路は **自然言語 → テスト生成**。補助経路として git diff（既存実装への後付けテスト）も受け付ける。入力内容からユニット / E2E を自動判定し、混在シナリオでは両方を生成する。

出力は必ず `.work/test-scenario-generator/generated/` にいったん保存し、ユーザー確認後にのみリポジトリへ反映する。テスト実行はリポジトリへの反映後にのみ走る（degraded-mode 時は実行をスキップする）。

## 前提

- 対象は本リポジトリ（Turborepo モノレポ）。`apps/*` / `packages/*` を含む複数パッケージ構成のため、対象パッケージの特定を Step 1 で行う
- 対象パッケージには `package.json` と、`vitest.config.{ts,js,mjs}` または `playwright.config.{ts,js,mjs}` のいずれかが存在することを期待する。検出ロジックと degraded-mode は Step 1 で扱う
- テストスタイル・TDD ワークフローの規約は `einja-coding-standards` の `references/testing-strategy.md` を正とする。矛盾があれば `testing-strategy.md` を優先する
- カバレッジ計測（Vitest のみ）・CI 参考スニペット生成の詳細は [coverage-ci.md](references/coverage-ci.md) を参照する。カバレッジツール（`@vitest/coverage-v8` 等）未導入時は coverage-degraded（生成・実行は通常どおり、カバレッジのみスキップ）で進める

## ワークフロー

### Step 0: 作業ディレクトリ準備

1. `mkdir -p .work/test-scenario-generator/{.input,generated,backup,ci-snippet}` を実行してディレクトリ一式を作成する
2. **カバレッジ目標の確定**: AskUserQuestion でプリセット（標準（推奨）/ きびしめ / ゆるめ / その他（自由入力））を提示し `{line_target, branch_target}` を確定する。生のパーセント値は質問本文に出さず Note に括弧書きで添える。何も選ばなければ「標準（行80%/分岐70%）」で進む。詳細は [coverage-ci.md §カバレッジ目標プリセット](references/coverage-ci.md) を参照

ユーザー提供ファイル（git patch、自然言語メモ等）は作業開始前に `.work/test-scenario-generator/.input/` に **コピー** する（move 不可）。詳細は [output-format.md](references/output-format.md) を参照。

### Step 1: 対象パッケージ特定

被テスト対象パッケージを特定する。テスト実行は対象パッケージ内で走るため、入力収集より先に確定させる必要がある。

1. 起動時カレントディレクトリを最優先候補とする。ユーザーが明示指定したパス（`apps/xxx` / `packages/xxx` 等）があればそれを優先する
2. 候補ディレクトリで以下を順に確認する:
   - `package.json` の存在と `scripts.test` / `scripts.e2e` の有無
   - `vitest.config.{ts,js,mjs}` の存在（Glob で検索）
   - `playwright.config.{ts,js,mjs}` の存在
3. カレントディレクトリで判定できない場合は `Glob: apps/*/vitest.config.*`, `Glob: packages/*/vitest.config.*` 等でモノレポ内の候補を列挙し、AskUserQuestion で対象パッケージを確認する（選択肢の最後は必ず「その他（自由入力）」）
4. 設定種別から対象スタックを判定する:
   - vitest のみ → Vitest 単独生成可
   - playwright のみ → Playwright 単独生成可
   - 両方あり → Vitest + Playwright 両対応
5. **degraded-mode 判定**: 上記すべて不在のときは degraded-mode に入る。テスト生成は行うが Step 7 の実行をスキップし、`.work/test-scenario-generator/generated/` への保存のみで完了する。ユーザーに「対象パッケージに Vitest / Playwright 設定が見つからないため、テストは生成のみ行います」と明示通知する
6. **カバレッジツール検出**: 対象パッケージ `package.json` に `@vitest/coverage-v8`（または `-istanbul`）の記載があり、かつ `node_modules/@vitest/coverage-v8` が実在するか確認する。両方満たすときのみ coverage available。片方でも欠ければ **coverage-degraded**（テスト生成・実行は通常どおり、カバレッジのみスキップ。自動 install しない）。判定ロジックは [coverage-ci.md §カバレッジツール検出](references/coverage-ci.md) を参照
7. 確定した対象パッケージの絶対パスと coverage 可否を内部状態として保持し、以降の Step で参照する

### Step 2: 入力収集

入力ソースを 2 種（git diff / 自然言語）に振り分ける。詳細な判定木・ルート別手順・fail-closed 挙動は [input-routing.md](references/input-routing.md) を参照する。

1. ユーザー発話・引数・カレントディレクトリ状態を解析する
2. 判定木に従って経路を確定する（git diff の指示があれば優先、無ければ自然言語）
3. 各ルートの主処理:
   - **git diff**: 対象パッケージで `git diff --name-only --diff-filter=AM` で変更ファイルを抽出し、test ファイルと非 test ファイルに仕分けする
   - **自然言語**: 自由入力をそのままシナリオ材料として保持する
4. 入力種別を 1 つに絞れない場合は AskUserQuestion で確認する（選択肢の最後は必ず「その他（自由入力）」）
5. 取得不能時は fail-closed で停止し、[input-routing.md §fail-closed の挙動](references/input-routing.md) の代替案テンプレを提示する

### Step 3: テスト種別の自動判定

Step 2 で確定したシナリオ群を unit (Vitest) / E2E (Playwright) / both に分類する。判定アルゴリズム・キーワード・既定値・例外パターンは [judgment-rules.md](references/judgment-rules.md) を参照する。

1. 各シナリオを「キーワードスコア」「文構造シグナル」「ファイルパスシグナル（git diff 入力時のみ）」で評価する
2. 出力フォーマットは `{ scenario_id, type, confidence, signals, feature_kebab }` を要素とする `scenarios` 配列を含む JSON 構造とし、`.work/test-scenario-generator/judgment.json` に保存する（正規スキーマは [judgment-rules.md §判定結果の出力フォーマット](references/judgment-rules.md)、ファイル配置は [output-format.md §判定結果フォーマット](references/output-format.md) を参照）
3. `type: both` のシナリオは Vitest と Playwright の両方を生成対象とする
4. `confidence: low` のシナリオは Step 5 に進む前に AskUserQuestion で「Playwright で生成 / Vitest で生成 / 両方生成 / その他（自由入力）」を提示する
5. Step 1 で degraded-mode が確定している場合は、対象スタックに該当する種別のみを生成対象に絞り込む（例: Vitest 設定のみ存在ならシナリオを Vitest に丸めるか、`confidence: low` 扱いで確認に回す）

### Step 4: 既存テスト・スタイル取り込み

対象パッケージ内の既存テストを最大 3 件 Read し、命名規約・import スタイル・モック方針を踏襲する。`einja-coding-standards` の `testing-strategy.md` を既定値とし、既存が無い／矛盾しないときのデフォルトとして適用する。

1. `Glob: {対象パッケージ}/**/*.{test,spec}.{ts,tsx}` で既存テストを探索する（`node_modules` を除外）
2. 更新日時順または重要度順で最大 3 件を Read する
3. 以下の観点を抽出する: import スタイル（名前付き / default）、describe/it の言語（日本語 / 英語）、Given/When/Then コメントの有無、モック方針（`vi.mock` / `vi.resetModules` + 動的 import）、ファイル配置（`__tests__/` / `tests/` / 隣接）、Playwright のロケータ優先順
4. einja 標準（`testing-strategy.md`）と既存スタイルが矛盾する場合は **既存を優先** する（ESLint で禁止された書式の持ち込みを防ぐため）
5. **重複検出**: 生成予定シナリオが既存テスト名と一致する場合は AskUserQuestion で「追記 / スキップ / 個別選択 / その他（自由入力）」を提示する
6. **被テスト実装ファイル（impl_path）の候補収集**（coverage available 時のみ）: git diff の非 test ファイル / シナリオが指す対象モジュールから `impl_path` 候補（対象パッケージルート起点の相対 glob）を集める。**ここでは確定せず**、Step 5 でテスト生成後に生成テストの import 先解析を合流させて確定する（生成テストは Step 5 で初めて作られるため）。詳細は [coverage-ci.md §被テスト実装ファイル（impl_path）の特定](references/coverage-ci.md) を参照

詳細な観点表は [test-patterns.md §5 既存テストスタイルへの適合](references/test-patterns.md) を参照する。

### Step 5: テストコード生成 + 意味検証

Step 3 の判定結果と Step 4 のスタイル情報を元に、テンプレートに沿ったテストコードを生成する。テンプレートと einja 慣例の詳細は [test-patterns.md](references/test-patterns.md) を参照する。

1. シナリオごとに [test-patterns.md](references/test-patterns.md) の該当テンプレートを選択する:
   - Vitest: 基本構造 / モジュールモック / 非同期 / 表駆動
   - Playwright: 基本 E2E / フォーム入力 / ログイン状態 / スクリーンショット
2. ファイル名は `{scenario-id}-{feature-kebab}.test.ts`（Vitest）または `.spec.ts`（Playwright）。詳細は [output-format.md §生成テストファイル命名規約](references/output-format.md) を参照
3. 出力先: `.work/test-scenario-generator/generated/` （リポジトリへは Step 6 で初めて反映する）
4. **passing-by-accident チェック**を必ず実行する:
   - 生成ファイルごとに `Grep "expect(" {file}` でヒット数を取得する
   - 0 件 → **再生成必須**（テストとして成立していない）
   - `it(` の出現数 > `expect(` の出現数 → **警告強調** してユーザーに該当ファイルを表示する
   - 通過後も「生成テストは目視レビュー必須」を Step 9 の完了報告に必ず記載する
5. einja 共通慣例（名前付き import、日本語 describe/it、`// Given:` `// When:` `// Then:` コメント、`expect(true).toBe(true)` 等の常成立アサーション禁止）を必ず満たす

### Step 6: 書き込みポリシー確認 + 上書き保護

リポジトリへの反映可否をユーザーに確認し、書込前に必ず存在チェック・バックアップを実施する。

1. AskUserQuestion で反映先を選択（**最後の選択肢は必ず「その他（自由入力）」**）:
   - **リポジトリに反映**（推奨）— Note: テスト実行まで一気通貫。リポジトリを書き換える
   - **.work/ に残すのみ**— Note: リポジトリを汚さない。テスト実行はスキップされる
   - **差分プレビューのみ表示**— Note: 内容を確認してから反映可否を再判断する
   - **その他（自由入力）**
2. 「.work/ に残すのみ」を選んだ場合は Step 7 をスキップし Step 8 へ進む（degraded-mode と同じ扱い）
3. 「リポジトリに反映」を選んだ場合の配置先決定:
   - Vitest: `__tests__/` / `tests/` を Glob 検索。単一存在 → 自動配置、複数存在 → AskUserQuestion、両方不在 → 「.work/ に残すのみ / 手動指定 / その他（自由入力）」を再提示（Skill 側で新規ディレクトリを勝手に作らない）
   - Playwright: `e2e/` / `tests/e2e/` を同じロジックで判定する
   - 詳細は [output-format.md §リポジトリへの反映先](references/output-format.md) を参照
4. **書込前に必ず Read で対象パスを試行**する（Read 省略禁止）:
   - 既存ファイルあり → `.work/test-scenario-generator/backup/{元ファイル名}.{ISO8601-timestamp}.bak` にコピーしてから `Write` で上書き
   - 既存ファイルなし → そのまま `Write`
5. 書込後に Read で内容一致を確認し、`.work/test-scenario-generator/generated/` と差異があれば警告する

### Step 7: テスト実行

リポジトリへ反映済みの場合のみテストを実行する。`.work/test-scenario-generator/generated/` 単体での実行は Playwright が `playwright.config.*` をプロジェクトルートから探すため不可。

1. **実行前提チェック**:
   - Step 6 で「.work/ に残すのみ」を選択 → 実行スキップ（Step 8 で `## 実行スキップ理由` セクションを書く）
   - Step 1 で degraded-mode → 実行スキップ
   - 対象パッケージに `node_modules/` が無い、または `package.json` に vitest/playwright が無い → 実行スキップし `pnpm install` を促すメッセージを表示する（`pnpm install` の自動実行はしない）
2. **実行コマンド**（Bash でタイムアウト 120 秒）:
   ```bash
   # Vitest（coverage available のとき --coverage を付与。impl_path は複数なら繰り返す）
   # 実行前に Step 4 の候補へ生成テストの import 先を合流させ impl_path を確定する
   # （確定できなければ coverage-degraded に切り替える）
   pnpm exec vitest run {対象パッケージ起点の相対パス} \
     --coverage --coverage.provider={v8|istanbul} \
     --coverage.reporter=text --coverage.reporter=json-summary \
     --coverage.include={impl_path}

   # coverage-degraded のときは --coverage を付けずに実行
   pnpm exec vitest run {対象パッケージ起点の相対パス}

   # Playwright（カバレッジ対象外）
   pnpm exec playwright test {対象パッケージ起点の相対パス}
   ```
3. 標準出力・標準エラーを取得し、ANSI カラーを除去して Step 8 の入力に渡す。coverage available 時は `{対象パッケージ}/coverage/coverage-summary.json` も読み込む
4. タイムアウト時はその旨を記録し失敗扱いとする
5. **CI 参考スニペット生成**: `.work/test-scenario-generator/ci-snippet/` に `test.yml.example` と `package-json-test-coverage.patch` を出力する（実際の CI 設定・package.json は書き換えない。適用は手動）。テンプレートは [coverage-ci.md §CI 参考スニペット生成](references/coverage-ci.md) を参照

### Step 8: pass/fail レポート

実行結果を `.work/test-scenario-generator/run-result.md` に保存し、失敗時はガイド情報のみ生成する。**自動修正は行わない**（passing-by-accident を新たに生む危険があるため）。

1. [output-format.md §実行ログフォーマット](references/output-format.md) に従い `.work/test-scenario-generator/run-result.md` を生成する:
   - 実行日時 / 実行コマンド / サマリ（Pass / Fail / Skip）
   - 失敗テストごとに `### {ファイル名} > {テスト名}` 見出しでログ抜粋（最大 50 行、前後省略可）と「考えられる原因」「確認ポイント」のガイド情報
   - 実行スキップ時はサマリの代わりに `## 実行スキップ理由` セクションを書く
2. **カバレッジ判定**（coverage available 時）: `coverage-summary.json` の `total.lines.pct` / `total.branches.pct` を目標と比較して達成 / 未達成を判定し、`text` reporter の `Uncovered Line #s` から未カバー行をガイド列挙する（分岐は pct の合否のみ、該当行として案内）。結果を `.work/test-scenario-generator/run-result.md` の `## カバレッジ` セクション（行 % / 分岐 % / 目標 / 達成可否 / 未カバー箇所）に書く。coverage-degraded 時は同セクションに `スキップ理由` を 1 行記す。reporter の役割分担・判定詳細は [coverage-ci.md §達成判定と再生成ループ予算](references/coverage-ci.md) を参照
3. **テストコードの自動書き換えは禁止**。Step 5 で生成したテストの修正案コードを出力しない（ユーザーに目視判断を委ねる）
4. **再生成ループ予算（統合）**: 「テスト失敗による再生成」と「テスト全 pass だがカバレッジ未達による追加生成」を **通算で最大 1 回**（`regeneration_attempts_total <= 1`）とする。失敗 or 未達があり、かつユーザーが希望する場合のみ Step 5 に戻る。AskUserQuestion で「再生成する / このまま完了 / その他（自由入力）」を提示する
5. 通算ループ回数が 1 を超える場合は強制的に Step 9 へ進む（残った未カバー箇所は完了報告に残す。無限ループ防止）

### Step 9: 成果物確認ループ + 完了報告

1. **成果物確認ループ**:
   - 成果物の概要（生成ファイル一覧、リポジトリ反映先、`run-result.md` のサマリ、必要なら差分スクショ）を表示する
   - AskUserQuestion で「OK / 修正したい箇所がある / その他（自由入力）」を提示する
   - 「修正したい箇所がある」→ 修正を実施 → Step 5 に戻る
   - 「OK」→ ループ終了
2. **完了報告**: `_einja-output-format` の標準出力構造に従い、以下を必ず含めてユーザーに報告する（ファイルへの自動保存は行わない）:
   - 生成ファイル一覧とリポジトリ反映先
   - `run-result.md` のサマリ（Pass/Fail/カバレッジ達成可否）
   - 「生成テストは目視レビュー必須。`expect(` 出現回数を自動チェックしても、アサーションが意図と一致しているかは人間の確認が必要」という注記
   - CI 参考スニペットの出力先パス
3. Skill を終了する

## references/

- [`input-routing.md`](references/input-routing.md) — 2 種入力（git diff / 自然言語）の判定木と fail-closed 挙動。Step 2 から参照
- [`judgment-rules.md`](references/judgment-rules.md) — unit (Vitest) / E2E (Playwright) / both の自動分類ルール集。Step 3 から参照
- [`test-patterns.md`](references/test-patterns.md) — Vitest / Playwright のテンプレート集と einja 慣例チェックリスト。Step 4・5 から参照
- [`output-format.md`](references/output-format.md) — 出力ファイル命名・配置・実行ログ・カバレッジフォーマット規約。Step 0・5・6・7・8 から参照
- [`coverage-ci.md`](references/coverage-ci.md) — カバレッジ計測（検出・目標プリセット・impl_path・reporter 役割分担・達成判定）と CI 参考スニペット生成。Step 0・1・4・7・8 から参照
