---
name: einja-uat-workbook
description: "人手E2E（UAT: 人間受け入れテスト）シナリオを story{N}.md（Markdown）から Excel ワークブック（.xlsx）に一方向生成する。マージ / デプロイ後に人間が実環境で打鍵記録するための雛形を作る。手順のSSOTは story{N}.md であり、xlsx には実施結果（OK/NG・証跡）を記入する。「UATワークブック」「人手E2EをExcelに」「手動シナリオテストのxlsx」「受け入れテスト Excel 生成」等で呼び出す。Do NOT use for: 自動テストの実行・記録、QAテスト仕様(story{N}.md)そのものの作成（→ qa-generator）、Markdownの他形式エクスポート（→ einja-md-export）"
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Glob
---

<!-- 参考: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices -->
<!-- 参考: Anthropic公式 xlsx スキル https://github.com/anthropics/skills (skills/xlsx, openpyxl使用) のアプローチを参考にしたが、コードは再配布不可のため流用せず独自実装 -->

# einja-uat-workbook — 人手E2E（UAT）シナリオを Excel ワークブックに生成

## 目的

マージ / デプロイ後に人間が実施する **`人手E2E`** シナリオを、Excel で打鍵記録できるワークブック（.xlsx）として生成する。

- **手順のSSOT（Single Source of Truth）は `story{N}.md`（Markdown）**であり、本Skillはそこから **一方向** で xlsx を生成する。
- 手順そのものを変更したい場合は `story{N}.md` を直し、xlsx を再生成する（xlsx 側で手順を書き換えても次回再生成で失われる）。
- 実施結果（OK/NG・証跡ファイル名）は **xlsx に記入** する。

## 前提

| ツール | 確認方法 | 入手先 / 対処 |
|--------|---------|--------------|
| Python3 | `python3 --version` | https://www.python.org/downloads/ |
| openpyxl | `python3 -c "import openpyxl"` | `pip install --user openpyxl`（グローバル汚染を避けるなら venv 内で `pip install openpyxl`）|
| soffice（任意） | `which soffice` | 内容検証用。なくても生成は可能 |

openpyxl が未導入の場合、スクリプトは stderr に明確なエラー（`pip install openpyxl` を案内）を出して終了する。**xlsx を作れなくても、手順は `story{N}.md`（Markdown）でそのまま参照・実施できる**（fallback 可能）。

## 使い方

```bash
python3 .claude/skills/einja-uat-workbook/gen-uat-xlsx.py <spec_dir>
```

| 引数 | デフォルト | 説明 |
|------|----------|------|
| `<spec_dir>` | 必須 | 仕様ディレクトリ（例: `docs/specs/issues/issue42-xxx/`）|
| `--out <path>` | `<spec_dir>/qa-tests/手動シナリオテスト_Issue{N}.xlsx` | 出力先xlsxを上書き |
| `--issue <N>` | パスから自動抽出 | Issue番号をパスから取得できない場合に明示指定 |

例:

```bash
# 標準（出力は <spec_dir>/qa-tests/手動シナリオテスト_Issue42.xlsx）
python3 .claude/skills/einja-uat-workbook/gen-uat-xlsx.py docs/specs/issues/issue42-xxx/

# 出力先を上書き
python3 .claude/skills/einja-uat-workbook/gen-uat-xlsx.py docs/specs/issues/issue42-xxx/ --out /tmp/uat.xlsx
```

## 生成物

`<spec_dir>/qa-tests/手動シナリオテスト_Issue{N}.xlsx`

ワークブック構成:

- **シート①「凡例・記入方法」**: ステータス定義（OK / NG / 保留）、タブ複製手順、証跡の保存先・命名、注意書き。
- **シート②以降「手順マスタ_{SC-ID}」**: 検出した人手E2Eシナリオごとに1シート。ヘッダ部に `実施日 / 実施者 / 環境URL / 全体ステータス` の記入欄。表ヘッダは7列。

## 運用フロー（人間）

1. テンプレ「手順マスタ_{SC-ID}」タブを **複製** して `テスト実施_{名前}_{YYYYMMDD}` タブを作る（例: `テスト実施_山田_20260617`）。
2. ヘッダ部の `実施日 / 実施者 / 環境URL` を記入する。
3. 各手順の **`結果`** 列で `OK / NG / 保留` をドロップダウンから選ぶ。
4. 証跡（スクショ等）を **`qa-tests/evidence/`** に保存し、`証跡ファイル名` 列にファイル名を記入する。
5. 最後に `全体ステータス` を記入する。

> 「手順マスタ」タブは雛形のため、直接記入せず必ず複製してから記入すること。

## パーサーアンカー仕様

- `<spec_dir>/qa-tests/story*.md` を glob し、各ファイルを `## SC-...` 見出し単位のセクションに分割する。
- 各SCセクション本文に **`**種別**: 人手E2E`** を含むものだけをパース対象とする。
- 対象SC直後の **「### テスト手順」テーブル**（`| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |`）を読み取る。
- 区切り行（`|---|---|...`）はスキップする。複数 story / 複数 SC に対応する。
- ヘッダ検出後に非パイプ行（空行・次の見出し等）が来たらテーブル終端とみなす。
- 人手E2Eシナリオが0件の場合は「対象なし」として警告を出して**正常終了(exit 0)**する（生成対象が無いだけで失敗ではないため）。

## Markdown→xlsx 列マッピング

| Markdown（6列） | xlsx（7列） | 備考 |
|----------------|-------------|------|
| No | No | 転記 |
| 手順 | 手順 | 転記 |
| 確認項目 | 確認項目 | 転記 |
| 期待値 | 期待値 | 転記 |
| 結果 | 結果 | **値は転記せず、`OK / NG / 保留` ドロップダウン入力欄にする** |
| （対応列なし） | 証跡ファイル名 | **新規・空欄** で追加 |
| 備考 | 備考 | 転記 |

ドロップダウンは openpyxl の `DataValidation(type="list", formula1='"OK,NG,保留"')` を結果列の該当セル範囲に適用している。

## エラーハンドリング早見表

| 状況 | 対処 |
|------|------|
| openpyxl 未導入 | `pip install openpyxl` を案内して非0終了（手順はMarkdownで参照可と明示）|
| `<spec_dir>` が存在しない | エラー報告して非0終了 |
| 人手E2Eシナリオが0件 | 「対象なし」として警告メッセージを出して**正常終了(exit 0)**（失敗ではない）|
| Issue番号がパスから取れない | basename をフォールバック使用（`--issue` で上書き可）|
| パース / 生成失敗 | トレースバックでなく平易なメッセージ＋非0終了（best-effort）|

## 依存ファイル

```
.claude/skills/einja-uat-workbook/
├── SKILL.md            # 本ファイル
├── gen-uat-xlsx.py     # 生成スクリプト（openpyxl使用）
└── fixtures/
    └── sample-spec/
        └── qa-tests/
            └── story1.md   # 動作確認用フィクスチャ（SC-06が人手E2E）
```

## 自己検証（動作確認）

```bash
python3 .claude/skills/einja-uat-workbook/gen-uat-xlsx.py \
  .claude/skills/einja-uat-workbook/fixtures/sample-spec --out /tmp/uat-test.xlsx
```

人手E2Eシナリオ（SC-06）がパースされ、`/tmp/uat-test.xlsx` が生成されれば成功。

## 既知の制約

- **一方向生成のみ**: xlsx → Markdown の逆同期は非対応（手順のSSOTは常に story{N}.md）。
- **結果の集計は非対応**: OK/NG の自動集計・サマリ生成はフェーズ2（MVPは記入雛形まで）。
- シート名は Excel 制約（使用不可文字の除去・31文字）に合わせてサニタイズする。

## 重要事項

- 手順を変えたいときは story{N}.md を直して再生成する（xlsx を手で書き換えない）。
- 証跡は `qa-tests/evidence/` に保存し、ファイル名を xlsx に記入する。
- best-effort: 失敗時はトレースバックでなく平易なメッセージで報告する。

<!-- @einja:project-private:start id="einja-uat-workbook-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
