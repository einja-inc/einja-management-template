# v0 Prompt Template リファレンス

## 目次

- [1. テンプレート全体構造](#1-テンプレート全体構造)
- [2. v0 プロンプト本文テンプレート（英語）](#2-v0-プロンプト本文テンプレート英語)
- [3. Hearing Summary テーブル雛形](#3-hearing-summary-テーブル雛形)
- [4. 日本語コピペ手順（How to use）](#4-日本語コピペ手順how-to-use)
- [5. プレースホルダ一覧と置換ルール](#5-プレースホルダ一覧と置換ルール)
- [6. v0 向けTips](#6-v0-向けtips)
- [7. 良い例・悪い例](#7-良い例悪い例)

---

## 1. テンプレート全体構造

生成される `.md` ファイル全体は以下の順序でセクションが並ぶ:

```
# {機能名} - v0 Prompt

## v0 Prompt
（英語のプロンプト本文。以下のサブセクション）
### Purpose
### Layout & Content Areas
### Visual Style
### States & Interactions
### Behavior
### Additional Requirements  ← Q6 空欄時は削除

## How to use（日本語コピペ手順）
## Hearing Summary（Q1〜Q6 回答ログ）
```

**未回答セクション削除ルール:**
- Q3 スキップ → `### Layout & Content Areas` は「shadcn/ui defaults」のみ記載（削除はしない、代替文言を挿入）
- Q4 空配列 or I=なし選択 → `### States & Interactions` セクションごと削除
- Q6 空欄 → `### Additional Requirements` セクションごと削除

---

## 2. v0 プロンプト本文テンプレート（英語）

以下をベースに Q1〜Q6 の回答をプレースホルダ `{Q1}` 〜 `{Q6}` に置換する。

```
# {feature_name} - v0 Prompt

## v0 Prompt

Build a {Q2} for {Q1}.

### Purpose
{Q1}

### Layout & Content Areas
{Q3_expanded}

### Visual Style
{Q5_expanded}

### States & Interactions
{Q4_expanded}

### Behavior
Interactions and data flow are inferred from the layout above. Keep components composable and typed.

### Additional Requirements
{Q6}
```

**プレースホルダ展開ルール:**

| プレースホルダ | 展開元 | 展開ルール |
|---|---|---|
| `{feature_name}` | Q1 の要約 | Q1 の主要トピックを Title Case で短縮（例: "Inventory Dashboard"）。日本語主体の場合は英訳を試み、不能なら slug をそのまま使用 |
| `{Q1}` | Q1 回答 | そのまま（英日どちらでも可） |
| `{Q2}` | Q2 選択値 | 英語ラベルに正規化（Landing / Dashboard / Form / List / Chat / Auth / Other） |
| `{Q3_expanded}` | Q3 複数選択 | 各要素を "- {element}: {default hint}" 形式の箇条書きに展開（下記対応表） |
| `{Q4_expanded}` | Q4 複数選択 | 各状態を "- {state}" 形式の箇条書きに展開。`Responsive` 選択時は "Responsive breakpoints (mobile-first, sm/md/lg)" を追加、`Dark Mode` 選択時は "Include a dark mode toggle in the header" を追加 |
| `{Q5_expanded}` | Q5 選択値 | 下記スタイル対応表からフレーズを引用（例: "Modern, minimal, generous whitespace, subtle shadows"） |
| `{Q6}` | Q6 自由入力 | そのまま（空欄時はセクションごと削除） |

**Q3 → default hint 対応表（例）:**

| Q3 選択 | 展開文言 |
|---|---|
| Header | Header: logo, primary nav links, user menu |
| Sidebar | Sidebar (left, ~240px): navigation grouped by domain |
| Footer | Footer: legal links, secondary nav |
| KPI | KPI cards row (3-4 cards) with metric name, value, delta |
| Table | Data table: sortable columns, pagination or infinite scroll |
| Chart | Chart area: choose bar/line based on data shape, include legend |
| Form | Form: labels above inputs, inline validation, primary/secondary buttons |
| Modal | Modal / Dialog for confirmations or focused edits |
| Toast | Toast notifications for async feedback |
| Wizard | Multi-step wizard with progress indicator |
| Search | Search input with clear affordance and result list |

**Q5 → スタイルフレーズ対応表:**

| Q5 選択 | 展開文言 |
|---|---|
| Modern | Modern, minimal, generous whitespace, subtle shadows, rounded corners |
| Enterprise | Enterprise, clean, high-density, neutral grays with a single accent color |
| Playful | Playful, vibrant palette, rounded shapes, friendly typography |
| Minimal | Minimal, monochrome, no gradients, focus on typography and spacing |
| Dark | Dark theme by default, high contrast, colored accents on dark background |

---

## 3. Hearing Summary テーブル雛形

`.md` 末尾に以下を追加する（再ヒアリング時は `Revision` 行を追加）:

```
## Hearing Summary

| Q | 回答 |
|---|---|
| Q1 | {Q1} |
| Q2 | {Q2} |
| Q3 | {Q3 カンマ区切り or "スキップ"} |
| Q4 | {Q4 カンマ区切り or "スキップ"} |
| Q5 | {Q5} |
| Q6 | {Q6 or "なし"} |
| Revision | {再ヒアリング対象Q, 初回は削除} |
| Generated At | {YYYY-MM-DD HH:mm} |
```

---

## 4. 日本語コピペ手順（How to use）

生成される `.md` に以下のブロックを含める:

```
## How to use（コピペ手順）

1. 上記 `## v0 Prompt` ブロック配下（`### Purpose` から `### Additional Requirements` まで）をコピー
2. https://v0.dev を開く（要ログイン）
3. プロンプト入力欄に貼り付け「Generate」ボタンをクリック
4. 生成結果をレビューし、必要なら "Iterate" タブで追加指示を与える
5. 満足したら "Code" タブから React コンポーネントをコピーして実装に活用
```

---

## 5. プレースホルダ一覧と置換ルール

| プレースホルダ | 型 | スキップ時挙動 |
|---|---|---|
| `{feature_name}` | 文字列 | 必須（Q1 由来） |
| `{Q1}` | 自由文 | 必須 |
| `{Q2}` | 単一選択 | 必須 |
| `{Q3_expanded}` | 箇条書き | スキップ時 "Use shadcn/ui default layout patterns." に置換 |
| `{Q4_expanded}` | 箇条書き | スキップ時 `### States & Interactions` セクションごと削除 |
| `{Q5_expanded}` | 文字列 | 必須 |
| `{Q6}` | 自由文 | 空欄時 `### Additional Requirements` セクションごと削除 |

---

## 6. v0 向けTips

**推奨事項:**

- **Behavior + Visual Intent + States + Style Cues の4要素を必ず含める**（v0公式推奨構造）
- 「shadcn/ui components を優先する」ことを暗黙的に前提とする（プロンプトに明記しなくてもv0側で選択される）
- **具体性を持たせる**: 「良いUIにして」ではなく「サイドバー幅240px、KPIカード4枚、その下にsortableテーブル」のように具体的に書く
- **1画面1プロンプト**: 複数画面（例: ログイン + ダッシュボード + 設定）を1つのプロンプトに詰め込まない。各画面ごとに本Skillを呼び出す
- 生成後は v0 の "Iterate" 機能で段階的に改善する前提でプロンプトを書く

**避けるべき:**

- プロジェクト固有のデザイントークン（カラーコード、フォント指定等）を細かく書く → v0 デフォルトを尊重
- 実装ロジック（APIパス、状態管理ライブラリ選定等）をプロンプトに含める → v0 はUI生成専用
- 冗長な前置き（"You are a UI designer..." 等） → v0 は既に UI 生成に特化しており不要

---

## 7. 良い例・悪い例

### 良い例（Dashboard）

```
Build a Dashboard for tracking inventory levels across multiple warehouses.

### Purpose
Enable warehouse managers to monitor stock, spot low-inventory alerts, and drill down per SKU.

### Layout & Content Areas
- Sidebar (left, ~240px): navigation with "Overview", "SKUs", "Warehouses", "Alerts"
- Header: search bar, notifications icon, user avatar dropdown
- Main: 4 KPI cards (Total SKUs, Low Stock, Warehouses, Alerts), sortable data table below

### Visual Style
Enterprise, clean, high-density. Neutral grays with a single blue accent.

### States & Interactions
- Loading skeletons for KPI cards and table
- Empty state when no alerts exist
- Responsive breakpoints (mobile-first, sm/md/lg)
- Include a dark mode toggle in the header

### Behavior
Clicking a KPI card filters the table below to that category.
```

**なぜ良いか**: レイアウトの具体的な数値（240px, 4カード）、スタイル志向の一言（Enterprise/clean/high-density）、状態遷移の網羅、インタラクションの1文説明。すべて v0 が理解しやすい粒度。

### 悪い例（Dashboard）

```
Make me a nice dashboard for inventory. Should look modern and work well.
Use React and Tailwind. Add some charts and stuff. Make it responsive.
Also login should work. And settings page.
```

**なぜ悪いか**:
- 「nice」「modern」「well」が抽象的で v0 が判断できない
- 「some charts and stuff」は要素が曖昧
- 1プロンプトに Dashboard + Login + Settings を詰め込んでいる
- React + Tailwind は暗黙前提なので冗長
- Behavior（何をクリックすると何が起きるか）が全く無い
