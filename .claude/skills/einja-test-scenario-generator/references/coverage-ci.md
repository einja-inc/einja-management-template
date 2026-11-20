# カバレッジ計測 + CI 参考スニペット — einja-test-scenario-generator

> **このリファレンスの境界**: 本ファイルが扱うのは Vitest のカバレッジ計測と、CI で回すための**参考雛形（example）生成のみ**。CI ログの解析・失敗診断・原因特定は扱わない。実際の `.github/workflows/` や `package.json` を本 Skill が書き換えることはない。

## 目次

1. [coverage-degraded（degraded-mode のサブ状態）](#coverage-degradeddegraded-mode-のサブ状態)
2. [カバレッジツール検出](#カバレッジツール検出)
3. [カバレッジ目標プリセット](#カバレッジ目標プリセット)
4. [被テスト実装ファイル（impl_path）の特定](#被テスト実装ファイルimpl_pathの特定)
5. [実行コマンドと reporter 役割分担](#実行コマンドと-reporter-役割分担)
6. [達成判定と再生成ループ予算](#達成判定と再生成ループ予算)
7. [CI 参考スニペット生成](#ci-参考スニペット生成)

## 適用範囲

- **対象は Vitest（ユニット）のカバレッジのみ**。Playwright（E2E）はコードカバレッジ計測の対象外とする。
- 既存の Step 7（テスト実行）・Step 8（レポート）に上乗せする形で動作する。テスト実行が走らないケース（degraded-mode / 「.work/ に残すのみ」）ではカバレッジ計測も走らない。

## coverage-degraded（degraded-mode のサブ状態）

`coverage-degraded` は既存 `degraded-mode` の**サブ状態**である。テスト生成・実行は通常どおり行うが、**カバレッジ計測だけをスキップ**して理由を明記する状態を指す。下記いずれかで coverage-degraded に入る:

- カバレッジツールが未導入（[カバレッジツール検出](#カバレッジツール検出)で false）
- 被テスト実装ファイル `impl_path` が特定できない（[impl_path の特定](#被テスト実装ファイルimpl_pathの特定)で確定不能）

coverage-degraded 時は、テスト失敗の有無に関わらず `run-result.md` の `## カバレッジ` セクションに `スキップ理由` を 1 行で書く（例: `@vitest/coverage-v8 が未インストールのため。pnpm add -D @vitest/coverage-v8 後に再実行してください`）。**自動インストールはしない**（既存 degraded-mode と一貫）。

## カバレッジツール検出

以下の **両方** を満たすときのみ coverage available とする。片方でも欠ければ coverage-degraded。

1. **宣言の存在**: 対象パッケージ `package.json` の `devDependencies` / `dependencies` に `@vitest/coverage-v8` または `@vitest/coverage-istanbul` が記載されている（Read + 文字列一致）。
2. **実体の存在**: `{対象パッケージ}/node_modules/@vitest/coverage-v8`（または `-istanbul`）ディレクトリが実在する（Glob）。モノレポの `node_modules` hoisting により、リポジトリルートの `node_modules/@vitest/coverage-v8` も確認対象に含める。

> 宣言だけ確認して実体を見ないと、`pnpm install` 未実行のリポで `--coverage` がランタイム失敗する。必ず両方を確認する。

provider は検出したパッケージに合わせる（`coverage-v8` → `v8`、`coverage-istanbul` → `istanbul`）。両方あれば `v8` を優先する。

## カバレッジ目標プリセット

Step 0 付近で目標を確定する。AskUserQuestion は **プリセット名で提示**し、生のパーセント値は Note に括弧書きで添える（einja 大原則: 低スキルユーザーに技術判断を強制しない）。選択肢の最後は必ず「その他（自由入力）」。

| 選択肢ラベル | Note（判断材料） | line | branch |
|---|---|---|---|
| 標準（推奨） | 一般的な目安。まずはこれで十分（行80%/分岐70%） | 80 | 70 |
| きびしめ | しっかり網羅したいとき（行90%/分岐80%） | 90 | 80 |
| ゆるめ | まず最低限から始めたいとき（行60%/分岐50%） | 60 | 50 |
| その他（自由入力） | 数値を直接指定 | — | — |

何も選ばなければ「標準」で進む。確定した `{line_target, branch_target}` を内部状態に保持する。

## 被テスト実装ファイル（impl_path）の特定

`--coverage.include` に渡す**被テスト実装ファイル**を確定する。これを省くとパッケージ全体が計測対象になりカバレッジ値が無意味になる。**特定は 2 段階**で行う（生成テストは Step 5 で初めて作られるため、Step 4 時点では確定しない）:

**段階 1 — 候補収集（Step 4）**: 以下から `impl_path` の候補を集める。
1. **git diff 入力**: `git diff --name-only --diff-filter=AM` の非 test ファイルをそのまま候補にする。
2. **自然言語入力**: シナリオが言及する対象モジュール名・機能名から、対象パッケージ内の実装ファイルを Glob で探索（例: 機能名 `validation` → `**/validation.{ts,tsx}`、`node_modules` 除外）。

**段階 2 — 最終確定（Step 5 のテスト生成後 / Step 7 の実行前）**: 生成した各テストファイルの import 文（`from "../lib/validation"` 等）を解析し、解決先の実装ファイルを候補に合流させて `impl_path` を確定する。

- 段階 2 まで終えても 1 件も確定できなければ **coverage-degraded**（パッケージ全体を計測しない）。Step 4 の候補が空でも、生成テストの import から確定できることがあるため、**Step 4 時点で coverage-degraded に落とさない**。
- 複数ファイルが該当する場合は `--coverage.include` を複数回指定する。`impl_path` は対象パッケージルート起点の相対 glob で保持する。

## 実行コマンドと reporter 役割分担

Step 7 の Vitest 実行コマンドに以下を付与する（coverage available 時のみ）:

```bash
pnpm exec vitest run {test相対パス} \
  --coverage \
  --coverage.provider={v8|istanbul} \
  --coverage.reporter=text \
  --coverage.reporter=json-summary \
  --coverage.include={impl_path}
```

- `coverage.include` は、テストから一度も import されていないファイルも計測対象に含める。本リポは Vitest 3.2 系のため `coverage.all`（デフォルト true）により未到達ファイルも集計される。Vitest 4 以降は `coverage.all` が廃止され `coverage.include` の指定だけで同等に振る舞う。いずれのバージョンでも上記コマンドで未到達ファイルは集計される（明示的な `--coverage.all` 付与は不要）。
- 複数 `impl_path` は `--coverage.include` を繰り返す。

**reporter の役割分担**（両方必要）:

| reporter | 出力 | 用途 |
|---|---|---|
| `json-summary` | `{対象パッケージ}/coverage/coverage-summary.json` | **合否判定**。`total.lines.pct` / `total.branches.pct` を読む。**行番号・分岐の詳細は含まない** |
| `text` | 標準出力のテーブル（`Uncovered Line #s` 列） | **未カバー行の列挙**。ANSI 除去してパースする。**分岐は pct 判定のみ**で、どのケースが未カバーかは行番号として案内する（行レベルのガイドに留める） |

`coverage-summary.json` の形（抜粋）:

```json
{ "total": {
  "lines":    { "total": 50, "covered": 41, "skipped": 0, "pct": 82 },
  "branches": { "total": 20, "covered": 13, "skipped": 0, "pct": 65 }
} }
```

## 達成判定と再生成ループ予算

1. **判定**: `total.lines.pct >= line_target` かつ `total.branches.pct >= branch_target` なら **達成**、いずれか下回れば **未達成**。
2. **未カバー列挙**: text reporter の `Uncovered Line #s` から、未カバー行をファイル別にガイド情報として `## カバレッジ` に列挙する（分岐は pct の合否のみ判定し、該当行を案内するに留める）。修正コードは出力しない（目視判断に委ねる）。
3. **再生成ループ予算（統合）**: 「テスト失敗による再生成」と「テスト全 pass だがカバレッジ未達による追加生成」を **通算で最大 1 回**（`regeneration_attempts_total <= 1`）とする。
   - 1 回目: 失敗 or 未達のとき、ユーザーが希望すれば Step 5 に戻り、未カバー箇所を埋めるシナリオを追加生成して再実行。
   - 2 回目以降は行わず、残った未カバー箇所を完了報告に残して Step 9 へ強制遷移する（既存の無限ループ防止と整合）。

## CI 参考スニペット生成

CI で自動実行できるようにするための**参考雛形を `ci-snippet/` に出力するのみ**。実際の CI 設定・`package.json` への書き込み・適用提案はしない。

1. **互換性チェック（読み取りのみ）**: 対象パッケージ `package.json` の `scripts` に test 実行系（`test` / `test:coverage`）があるかを Read で確認する。不足していても書き換えず、出力する案内に「適用は手動で」と明記する。
2. **`ci-snippet/test.yml.example`** を出力する:

```yaml
# 参考: .github/workflows/ に手動で配置してください
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # package.json に "packageManager": "pnpm@<ver>" がある場合は version 指定不要。
      # 無い場合は version を明示しないと action-setup が失敗するため version を入れる。
      - uses: pnpm/action-setup@v4
        # with:
        #   version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # カバレッジ付き実行には @vitest/coverage-v8 が devDependencies に必要。
      # 未導入なら下行を `pnpm exec vitest run` に変えるか、先に追加すること。
      - run: pnpm exec vitest run --coverage
```

> 雛形は coverage available を前提に `--coverage` 付きで出力する。対象パッケージに `@vitest/coverage-v8` が無い（coverage-degraded）場合は、上記コメントのとおり `--coverage` を外すか依存追加が必要な旨を、生成時にユーザーへ案内する。

3. **`ci-snippet/package-json-test-coverage.patch`** を出力する（`scripts.test:coverage` 追記の参考。適用は手動）:

```
"scripts": {
  "test:coverage": "vitest run --coverage"
}
```

4. ログ解析・失敗診断・ワークフローの自動配置は**行わない**。生成した雛形のパスを Step 9 の完了報告に含め、「適用は手動」とユーザーに案内する。
