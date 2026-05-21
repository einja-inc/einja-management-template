# Marp フロントマター + テーマCSS テンプレート参考ドキュメント

## 1. 概要

このドキュメントは、Markdownファイル（.md）を Google Slides 用 .pptx に変換するための Marp フロントマターとカスタムテーマCSSの設計を定義する参考資料です。

**参照元:**
- `marp_frontmatter.py` - Markdownファイルへのフロントマター自動注入スクリプト
- `marp-cli` - フロントマター付き .md を .pptx へ変換する CLI ツール

---

## 2. Marp 基本仕様

| キー | 説明 | 設定例 |
|-----|------|-------|
| `marp: true` | Marp 処理を有効化する必須キー | `marp: true` |
| `theme` | スライドテーマ。組み込みは `default` / `gaia` / `uncover`、自前CSSも指定可 | `theme: default` |
| `headingDivider` | 指定した見出しレベルの直前で自動改ページ | `headingDivider: [1, 2]` |
| `paginate` | `true` にするとスライド右下にページ番号を表示 | `paginate: true` |
| `size` | スライドサイズ。省略時は 16:9（1280×720）が標準 | `size: 16:9` |

---

## 3. 標準フロントマター（marp_frontmatter.py が注入する内容）

```yaml
---
marp: true
theme: default
headingDivider: [1, 2]
paginate: true
---
```

---

## 4. テーマ別の見た目

| theme | 特徴 | 用途 |
|-------|------|------|
| `default` | 白背景、シンプルなレイアウト、日本語フォント対応 | 仕様書スライド向け（推奨） |
| `gaia` | やや装飾的、グラデーション背景対応 | プレゼンテーション向け |
| `uncover` | センター配置、余白を広く取る | 短いステートメント向け |

---

## 5. mermaid SVG（data URI）の埋め込み

### 動作フロー

1. `preprocess_mermaid.mjs` が .md 内の mermaid コードブロックを SVG に変換する
2. 変換された SVG は Base64 エンコードされ `data:image/svg+xml;base64,...` 形式の data URI になる
3. Marp がその data URI を `<img src="...">` タグとして展開する

### ポイント

- Marp の `--allow-local-files` フラグは**不要**（data URI はローカルファイル参照ではない）
- data URI なので `marp-cli` の実行環境にファイルが存在しなくても表示される
- スライド内での表示サイズ調整は CSS で `img` に最大幅・高さを設定して対応する

### CSS での img サイズ制御

```css
img {
  max-width: 80%;
  max-height: 70%;
  display: block;
  margin: 0.5em auto;
}
```

---

## 6. カスタムテーマCSS（仕様書スライド向け）

```css
/* @theme einja-spec */
@import 'default';

section {
  font-family: 'Hiragino Sans', 'Helvetica Neue', sans-serif;
  font-size: 22pt;
  color: #1f2937;
  background: #ffffff;
  padding: 60px 70px;
}

h1 {
  font-size: 36pt;
  color: #1f2937;
  border-bottom: 3px solid #2563eb;
  padding-bottom: 0.2em;
  margin-bottom: 0.5em;
}

h2 {
  font-size: 28pt;
  color: #2563eb;
  margin-bottom: 0.4em;
}

h3 {
  font-size: 22pt;
  color: #1f2937;
}

p, li {
  font-size: 20pt;
  line-height: 1.6;
}

code {
  font-family: 'Menlo', 'Monaco', monospace;
  background: #f3f4f6;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 18pt;
}

pre {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 0.6em;
  border-radius: 4px;
  font-size: 16pt;
  overflow: auto;
}

table {
  font-size: 16pt;
  border-collapse: collapse;
  margin: 0.5em auto;
}

th, td {
  border: 1px solid #d1d5db;
  padding: 0.4em 0.6em;
}

th { background: #f3f4f6; font-weight: 700; }

img {
  max-width: 80%;
  max-height: 70%;
  display: block;
  margin: 0.5em auto;
}

section.title h1 {
  font-size: 48pt;
  text-align: center;
  border: none;
}
```

### カスタムテーマの適用方法

```yaml
---
marp: true
theme: einja-spec
headingDivider: [1, 2]
paginate: true
---
```

```bash
npx --yes @marp-team/marp-cli@latest \
  --pptx \
  --theme path/to/einja-spec.css \
  --output docs/exports/spec.pptx \
  input.md
```

---

## 7. headingDivider の挙動詳細

| 設定値 | 改ページが発生するタイミング |
|--------|--------------------------|
| `headingDivider: 1` | h1 の直前のみ |
| `headingDivider: 2` | h1 と h2 の直前 |
| `headingDivider: [1, 2]` | h1 と h2 の両方の直前（推奨） |
| `headingDivider: [1, 2, 3]` | h1 / h2 / h3 すべての直前 |

### 強制改ページ

.md 内に `---`（水平線）を明示的に書くと、その位置で改ページが発生します。`headingDivider` より明示的な `---` が優先されます。

---

## 8. marp-cli 実行例

### 基本（data URI SVG 使用時）

```bash
npx --yes @marp-team/marp-cli@latest \
  --pptx \
  --output docs/exports/spec.pptx \
  input.md
```

### カスタムテーマ指定

```bash
npx --yes @marp-team/marp-cli@latest \
  --pptx \
  --theme .claude/skills/einja-md-export/references/einja-spec.css \
  --output docs/exports/spec.pptx \
  input.md
```

### ローカル Chrome を指定して変換（推奨）

```bash
CHROME_PATH=$(which google-chrome || which chromium-browser) \
npx --yes @marp-team/marp-cli@latest \
  --pptx \
  --output docs/exports/spec.pptx \
  input.md
```

---

## 9. 既知の制限

| 制限 | 詳細 | 回避策 |
|------|------|-------|
| mermaid 非対応 | Marp は mermaid コードブロックをネイティブにレンダリングしない | `preprocess_mermaid.mjs` で事前に data URI へ変換する（必須） |
| コンテンツオーバーフロー | 1スライドの文字量が多いと自動縮小されず内容が溢れる | ユーザー側でスライドあたりの内容を簡潔にする |
| 複雑なテーブル | 列数・行数が多いテーブルはスライドで読みづらい | 図や箇条書きに変換、または複数スライドに分割 |
| ネストリスト | 深いネスト（3階層以上）はスライドで視認性が低下 | 最大2階層までに抑える |

---

## 10. ユーザー向けTips

### スライド設計の基本原則

- **1スライド = 1メッセージ**: 1枚のスライドに伝えたいことは1つに絞る
- **図表中心、文章は最小限**: 長文は読まれない。箇条書き・図・表を優先する
- **フローや構造は mermaid 図で**: 手順・依存関係・状態遷移は mermaid で視覚化する

### スライド数の目安

| ドキュメント種別 | 推奨スライド数 |
|----------------|--------------|
| 機能仕様書 | 15〜25枚 |
| 設計ドキュメント | 10〜20枚 |
| 全体仕様書 | 20〜30枚 |
