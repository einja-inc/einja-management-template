# PDF用HTML/CSSテンプレート参考ドキュメント

## 1. 概要

このドキュメントは、仕様書PDF生成のためのHTMLテンプレート + CSS設計を定義します。

### 対象

- **用紙サイズ**: A4縦（210mm × 297mm）
- **用途**: 仕様書・設計書・報告書などのビジネス文書PDF

### 参照元

`md_to_html.mjs` の `--template` オプションで指定するCSSとして使用します。

```bash
node md_to_html.mjs input.md --template custom.css
```

---

## 2. デザイン要件

| 項目 | 値 |
|------|-----|
| 用紙サイズ | A4縦（210mm × 297mm） |
| 余白（上下） | 18mm |
| 余白（左右） | 15mm |
| 日本語フォント | Hiragino Sans |
| フォールバック | Helvetica Neue, Arial, sans-serif |
| 行間（本文） | 1.7 |
| 印刷最適化 | 改ページ制御あり |

---

## 3. タイポグラフィ仕様

| 要素 | フォントサイズ | 太さ | 行間 | その他 |
|------|------------|------|------|--------|
| 本文 | 11pt | 400 | 1.7 | - |
| h1 | 24pt | 700 | 1.4 | 下線 2px solid #2563eb |
| h2 | 18pt | 700 | 1.4 | 下線 1px solid #d1d5db |
| h3 | 14pt | 700 | 1.4 | - |
| h4 | 12pt | 700 | 1.4 | - |
| code（インライン） | 0.9em（相対） | 400 | - | Menlo, monospace |
| pre code | 10pt | 400 | 1.5 | Menlo, monospace |
| table | 10pt | 400 | 1.5 | - |
| blockquote | 11pt | 400 | 1.7 | 左罫線 4px #2563eb |

---

## 4. 配色

| 用途 | 色 |
|------|-----|
| 本文テキスト | #1f2937 |
| 見出し下線（主・h1） | #2563eb |
| 見出し下線（副・h2） | #d1d5db |
| 罫線 | #d1d5db |
| 強調 | #2563eb |
| コード背景（インライン） | #f3f4f6 |
| コードブロック背景 | #f9fafb |
| コードブロック枠線 | #e5e7eb |
| テーブルヘッダー背景 | #f3f4f6 |
| テーブル偶数行 | #fafafa |
| リンク | #2563eb |
| 引用テキスト | #4b5563 |
| 水平線 | #d1d5db |

**色覚多様性への配慮**: 赤・緑の同時使用を回避し、青（#2563eb）とグレー系を基調としています。

---

## 5. 改ページ制御

| 要素 | 制御 | 理由 |
|------|------|------|
| テーブル | `break-inside: avoid` | 小さい表は分断しない |
| コードブロック | `break-inside: auto` | 長い場合は分断許容 |
| 見出し（h1〜h6） | `page-break-after: avoid` | 見出し直後に改ページ発生を防ぐ |
| 画像 | `break-inside: avoid` | 画像は分断しない |

---

## 6. mermaid SVG表示

mermaid で生成された SVG 画像を A4 幅にフィットさせ、中央寄せで表示します。

```css
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.5em auto;
  break-inside: avoid;
}

/* mermaid svg特化（data URIで埋め込まれたSVG） */
img[src^="data:image/svg+xml"] { max-width: 90%; }
```

---

## 7. 完全なCSS（コピペ可能）

```css
@page { size: A4 portrait; margin: 18mm 15mm; }

* { box-sizing: border-box; }

body {
  font-family: 'Hiragino Sans', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.7;
  color: #1f2937;
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.4;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

h1 { font-size: 24pt; border-bottom: 2px solid #2563eb; padding-bottom: 0.3em; }
h2 { font-size: 18pt; border-bottom: 1px solid #d1d5db; padding-bottom: 0.2em; }
h3 { font-size: 14pt; }
h4 { font-size: 12pt; }

p { margin: 0.6em 0; }

ul, ol { margin: 0.6em 0; padding-left: 1.5em; }

code {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  background: #f3f4f6;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}

pre {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 0.8em;
  border-radius: 4px;
  overflow-x: auto;
  break-inside: auto;
  margin: 0.8em 0;
  line-height: 1.5;
}

pre code {
  background: none;
  padding: 0;
  font-size: 10pt;
  border-radius: 0;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  break-inside: avoid;
  font-size: 10pt;
}

th, td {
  border: 1px solid #d1d5db;
  padding: 0.5em 0.8em;
  text-align: left;
  vertical-align: top;
}

th {
  background: #f3f4f6;
  font-weight: 700;
}

tr:nth-child(even) td { background: #fafafa; }

img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.5em auto;
  break-inside: avoid;
}

blockquote {
  border-left: 4px solid #2563eb;
  padding-left: 1em;
  margin: 1em 0;
  color: #4b5563;
}

a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }

hr { border: none; border-top: 1px solid #d1d5db; margin: 2em 0; }

/* mermaid svg特化 */
img[src^="data:image/svg+xml"] { max-width: 90%; }
```

---

## 8. カスタマイズ方法

### フォントを変更したい場合

`body` の `font-family` を変更します。

```css
body {
  font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
}
```

### 余白を変更したい場合

```css
@page {
  size: A4 portrait;
  margin: 25mm 20mm;
}
```

### カラースキーマを変更したい場合

```css
h1 { border-bottom-color: #16a34a; }
h2 { border-bottom-color: #d1d5db; }
blockquote { border-left-color: #16a34a; }
a { color: #16a34a; }
```

---

## 9. 既知の制限

### Chrome Headless 固有の改ページ挙動

- `break-inside: avoid` を指定しても、要素が1ページを超える場合は分断されます
- 長いテーブルや長いコードブロックは分断を完全に防げません

### フォント埋め込みなし（macOS依存）

- このCSSはシステムフォント（Hiragino Sans）を参照しています
- macOS 以外の環境では Hiragino Sans が存在せず、フォールバックフォントが使用されます

```css
body {
  font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif;
}
```
