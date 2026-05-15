---
name: einja-md-export
description: "単一の Markdown 仕様書ファイルを PDF / Google Docs / Google Slides の3形式から選択して出力する。mermaid 図は視認性を考慮した配色（青・橙ベース）で SVG 化して埋め込む。「mdをPDFにして」「仕様書をPDF化」「Markdownを Slides にして」「Google Docs にエクスポート」「md export」等で呼び出す。Do NOT use for: 複数 .md の結合出力、HTMLスライドのPDF化（→ einja-dev:html-to-pdf）"
user-invocable: true
allowed-tools:
  - AskUserQuestion
  - Read
  - Write
  - Bash
  - Glob
---

<!-- 参考: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices -->
<!-- ベース: ~/.claude/plugins/marketplaces/einja-skills/plugins/einja-dev/skills/html-to-pdf/SKILL.md -->
<!-- 参考: https://marpit.marp.app/directives (Marpit headingDivider) -->
<!-- 参考: https://github.com/mermaid-js/mermaid-cli (mmdc CLI) -->
<!-- 参考: https://github.com/markdown-it/markdown-it (Node API) -->

# einja-md-export — Markdown 仕様書を PDF / Docs / Slides にエクスポート

## 概要

`docs/specs/issues/*/` や `docs/plans/` 配下に蓄積される Markdown 仕様書（requirements.md / design.md / plan.md など）を、配布・共有用途で **PDF / Google Docs / Google Slides** に出力する。mermaid 図は事前に SVG レンダリングして data URI で埋め込むため、コードフェンスが残らず可読性の高い成果物が得られる。**macOS 専用**。

## Examples

**ユーザー**: 「docs/specs/issues/cli/issue21-sync-command/requirements.md をPDFにして」
→ ファイルパス特定 → mermaid SVG 化 → HTML 化 → Chrome Headless で PDF → `docs/exports/requirements.pdf` を生成

**ユーザー**: 「この仕様書をスライドにして」
→ 形式選択 (gslides) を AskUserQuestion で確認 → mermaid SVG 化 → Marp フロントマター注入 → `.pptx` 生成 → Drive アップロード手順を案内

## 使い方

```
/einja-md-export <input.md> --format pdf|gdocs|gslides|all [--output dir] [--keep-intermediate]
```

| 引数 | デフォルト | 説明 |
|------|----------|------|
| `<input.md>` | 必須 | 入力 .md パス |
| `--format` | `pdf` | `pdf` / `gdocs` / `gslides` / `all`（カンマ区切り可）|
| `--output` | `docs/exports/` | 出力ディレクトリ |
| `--keep-intermediate` | `false` | デバッグ用に中間 HTML / SVG / .md を残す |

引数で十分に指定されている場合は AskUserQuestion による確認を省略してよい。引数が不足する場合のみ対話的に確認する。

## 前提条件

| ツール | 確認方法 | 入手先 |
|--------|---------|--------|
| macOS | `uname` が `Darwin` | - |
| Node.js | `node --version` | https://nodejs.org/ |
| Python3 | `python3 --version` | https://www.python.org/downloads/ |
| Google Chrome.app | `test -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` | https://www.google.com/chrome/ |

依存パッケージ（`@mermaid-js/mermaid-cli` / `markdown-it` / `@marp-team/marp-cli`）はリポジトリにインストールせず、すべて `npx --yes` で都度実行する。初回のみキャッシュ DL のため数十秒〜数分かかる。

## ワークフロー

### Step 1: 入力検証

1. `<input.md>` の存在確認（`test -f`）。不存在ならエラー報告して終了
2. 拡張子が `.md` 以外なら警告 → AskUserQuestion で続行確認
3. `--format` をパースして実行対象を確定（`all` の場合は pdf / gdocs / gslides の3形式すべて）

引数が未指定の場合のみ AskUserQuestion で確認する。選択肢の末尾には必ず「その他（自由入力）」を含めること。

### Step 2: 出力ディレクトリ確保

```bash
OUTPUT_DIR="${OUTPUT_DIR:-docs/exports}"
mkdir -p "${OUTPUT_DIR}"
```

`.gitignore` に `docs/exports/` が含まれているかチェック。含まれていない場合は追記の可否を AskUserQuestion で確認する（成果物をコミットしたくないケースが多いため）。

同名出力ファイルが既に存在する場合は AskUserQuestion で上書き確認。

| 選択肢 | description | Note |
|--------|-------------|------|
| 上書き | 既存ファイルを上書きして再生成 | Note: 元ファイルは復元できない |
| キャンセル | 中止 | Note: 既存ファイルは保持される |
| その他（自由入力） | 別名を指定する等 | - |

### Step 3: 初回 DL の UX 告知

`mmdc`（mermaid-cli）や `marp-cli` の初回実行は数十〜数百MB級のキャッシュ DL が発生する。`~/.npm/_npx` を確認して未キャッシュなら AskUserQuestion で続行確認する。

```bash
# mmdc キャッシュ確認の例
ls ~/.npm/_npx 2>/dev/null | grep -q mermaid && echo cached || echo not-cached
```

未キャッシュかつ続行確認が必要な場合のみ次の選択肢を提示する:

| 選択肢 | description | Note |
|--------|-------------|------|
| 続行 | 初回 DL を許可して変換を実行 | Note: 数十秒〜数分かかる場合がある |
| キャンセル | 中止 | Note: 何も生成されない |
| その他（自由入力） | - | - |

### Step 4: mermaid 前処理

`scripts/preprocess_mermaid.mjs` を実行し、Markdown 内の ```mermaid フェンスを mmdc で SVG にレンダリングして data URI に変換した中間 .md を生成する。

```bash
INPUT_MD="${1}"
INTERMEDIATE_MD="/tmp/einja-md-export-$(date +%s)-$(basename "${INPUT_MD}")"

node .claude/skills/einja-md-export/scripts/preprocess_mermaid.mjs \
  --input "${INPUT_MD}" \
  --output "${INTERMEDIATE_MD}" \
  --config .claude/skills/einja-md-export/references/mermaid-config.json
```

技術前提:
- mmdc の `.md→.md` モードは外部 SVG ファイル参照（`![](./xxx.svg)`）を生成するため、後処理で読み込んで `data:image/svg+xml;base64,...` に置換する
- mermaid テーマ・配色・フォントは `references/mermaid-config.json` で統一管理（青 #2563eb / 緑 #10b981 / 橙 #f59e0b ベース、Hiragino Sans 14px）
- 配色根拠やノード形状ガイドは `references/mermaid-design-guide.md` を参照

### Step 5: 形式分岐

`--format` の値に応じて以下のいずれか（または複数）を実行する。

#### 5-A: PDF 出力（`--format pdf`）

```bash
# 中間 HTML パスを変数化（同一秒内の衝突回避に PID も付与）
HTML_PATH="/tmp/einja-md-export-$(date +%s)-$$.html"

# HTML 化（pdf モード：A4縦CSS）
# 注: --template は省略。md_to_html.mjs の内蔵デフォルト CSS（A4縦・Hiragino Sans・改ページ制御）を使用する
node .claude/skills/einja-md-export/scripts/md_to_html.mjs \
  --mode pdf \
  --input "${INTERMEDIATE_MD}" \
  --output "${HTML_PATH}"

# Chrome Headless で PDF 生成（名前付き引数で渡す）
python3 .claude/skills/einja-md-export/scripts/html_to_pdf.py \
  --input "${HTML_PATH}" \
  --output "${OUTPUT_DIR}/${BASENAME}.pdf"
```

技術前提:
- `markdown-it` は **Node API として `md_to_html.mjs` から import** する（CLIは存在しない）
- Chrome Headless は `--print-to-pdf` を使い、`@page { size: A4 portrait; margin: 18mm 15mm }` + `--no-pdf-header-footer` を指定
- 詳細 CSS デザインの参考は `references/pdf-template.md`（Markdown ドキュメント、CSS そのものではないため `--template` には渡さない）。CSS をカスタマイズする場合は別途 `.css` ファイルを作って `--template` に渡す

#### 5-B: Google Docs 用 HTML 出力（`--format gdocs`）

```bash
# HTML 化（gdocs モード：Web向けCSS、Drive にコピペでインポート可能）
# 注: --template は省略。md_to_html.mjs の内蔵デフォルト CSS（Web向け、Docs変換親和的）を使用する
node .claude/skills/einja-md-export/scripts/md_to_html.mjs \
  --mode gdocs \
  --input "${INTERMEDIATE_MD}" \
  --output "${OUTPUT_DIR}/${BASENAME}.html"
```

#### 5-C: Google Slides 用 .pptx 出力（`--format gslides`）

```bash
# Marp フロントマターを注入（marp: true, headingDivider: [1, 2], theme: default）
SLIDES_MD="/tmp/einja-md-export-slides-$(date +%s)-$$.md"
python3 .claude/skills/einja-md-export/scripts/marp_frontmatter.py \
  --input "${INTERMEDIATE_MD}" \
  --output "${SLIDES_MD}" \
  --theme default

# Marp で .pptx 生成
npx --yes @marp-team/marp-cli \
  --pptx "${SLIDES_MD}" \
  -o "${OUTPUT_DIR}/${BASENAME}.pptx"
```

技術前提:
- スライド分割は Marpit 公式の `headingDivider: [1, 2]` を使用（h1/h2 の前で自動改ページ。明示的な `---` も尊重される）
- data URI SVG なら `--allow-local-files` 不要（参照ではなくインラインのため）
- Marp テーマ・フロントマターは `references/marp-template.md` を参照

### Step 6: 出力ファイル検証

各出力ファイルについてサイズを確認し、5KB（5120バイト）未満なら破損として削除＋エラー報告する。

```bash
SIZE=$(wc -c < "${OUTPUT_PATH}")
if [ "${SIZE}" -lt 5120 ]; then
  rm -f "${OUTPUT_PATH}"
  echo "ERROR: 生成された ${OUTPUT_PATH} が 5KB 未満のため破損とみなして削除しました"
  exit 1
fi
```

PDF の場合はページ数も取得して報告する:

```bash
mdls -name kMDItemNumberOfPages "${OUTPUT_PATH}" 2>/dev/null | awk '{print $NF}'
```

`--keep-intermediate` が指定されていない場合は `/tmp/einja-md-export-*` の中間ファイルを削除する。

### Step 7: Google 系の手動アップロード案内

`--format gdocs` または `--format gslides` を選択した場合、`references/gdrive-upload-guide.md` を Read で読み込み、その内容に従ってユーザーへ手順を案内する。SKILL.md 本体には手順を書かない（参照ファイルに分離）。

完了報告フォーマット:

```
Markdown エクスポートが完了しました。

| 形式 | 保存先 | サイズ | 備考 |
|------|--------|--------|------|
| PDF | docs/exports/requirements.pdf | 234KB | 12ページ |
| HTML (Google Docs用) | docs/exports/requirements.html | 89KB | 手動アップロード手順を案内 |
| PPTX (Google Slides用) | docs/exports/requirements.pptx | 156KB | 手動アップロード手順を案内 |
```

## エラーハンドリング早見表

| 状況 | 対処 |
|------|------|
| 入力 .md が存在しない | エラー報告して終了 |
| 拡張子が `.md` 以外 | AskUserQuestion で続行確認 |
| Chrome 未インストール（PDF時） | インストールURL案内して該当形式をスキップ |
| Python3 未インストール（PDF/Slides時） | インストールURL案内して該当形式をスキップ |
| Node.js 未インストール | インストールURL案内して終了 |
| mmdc / marp-cli 初回 DL 必要 | AskUserQuestion で続行確認 |
| mermaid フェンス内に構文エラー | 該当フェンスをそのまま残し、コンソールに警告を出して処理続行 |
| 同名出力が既存 | AskUserQuestion で上書き確認 |
| 出力ファイルが 5KB 未満 | 破損として削除＋原因を平易に説明してエラー報告 |
| Chrome Headless タイムアウト | エラー内容を平易に報告 |

## 依存ファイル

```
.claude/skills/einja-md-export/
├── SKILL.md                          # 本ファイル（500行以内）
├── references/
│   ├── pdf-template.md               # 仕様書 PDF 用 HTML/CSS テンプレート
│   ├── marp-template.md              # Slides 用 Marp フロントマター・テーマ
│   ├── mermaid-config.json           # mermaid テーマ・配色・フォント設定
│   ├── mermaid-design-guide.md       # mermaid 配色根拠・ユーザー向けデザインガイド
│   └── gdrive-upload-guide.md        # Google Docs / Slides 手動アップロード手順
└── scripts/
    ├── preprocess_mermaid.mjs        # mmdc 呼出 + 出力SVGを data URI 化
    ├── md_to_html.mjs                # markdown-it を Node API で利用、pdf/gdocs両モード
    ├── marp_frontmatter.py           # Marp フロントマター注入
    └── html_to_pdf.py                # Chrome Headless で A4縦PDF生成
```

各ファイルの詳細仕様は対応する参照ファイルを開いて確認すること。SKILL.md 本体では参照ファイル名のみを示し、内容は重複させない（Progressive disclosure）。

## 既知の制約

- **macOS 専用**: Chrome Headless パスが macOS 固定。Linux / Windows 対応は別 issue
- **Google Docs / Slides は半自動**: MVPはHTML / PPTX 書き出しまで。Drive アップロードはユーザーがブラウザで手動実施（手順は `references/gdrive-upload-guide.md` を参照）
- **単一ファイル変換のみ**: 複数 .md の結合出力は非対応（フェーズ2）
- **mermaid 図のテーマは固定**: 配色・フォントは `references/mermaid-config.json` で統一管理。カスタムテーマ差し替えはフェーズ2
- **Marp 以外のスライドエンジン非対応**: Reveal.js 等は非対応

## 重要事項

- AskUserQuestion の選択肢の最後には必ず「その他（自由入力）」を含めること
- ユーザーへの説明は技術用語を使わない平易な言葉で
- 一時ファイル（`/tmp/einja-md-export-*`）は `--keep-intermediate` 指定がない限り成功・失敗いずれの場合も削除する
- 出力先は `--output` 指定がなければ `docs/exports/` に固定
- 過剰な実装をしない。詳細CSSやMarpテーマやDrive手順は `references/` を参照すること

<!-- @einja:project-private:start id="einja-md-export-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
