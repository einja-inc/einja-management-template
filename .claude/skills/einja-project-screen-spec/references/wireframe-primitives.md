# wireframe-primitives: mid-fi ワイヤーフレーム描画パターン集

`einja-project-screen-spec` Skill の **最も重要な実装リファレンス**。mid-fi（mono / uncolored）ワイヤーフレームを構成する **Core 15 プリミティブ** の Figma Plugin API 実装パターン、配色・サイズ規約、二層 auto-layout 方針、状態バリエーション展開、文字数試算と動的バッチ分割戦略をまとめる。

参照元:
- canonical enum 定義: [`./canonical-enums.md`](./canonical-enums.md)（kind / layout / state / source / stable_id 命名規約）
- T1 PoC 結果（auto-layout 動作実証済み）: `docs/einja/memory/figma-screen-spec-poc.md`
- 既存 Plugin API パターン: 旧 `einja-project-screen-flow-figma/references/figma-arrow-rules.md`（drawio 化に伴い廃止。動的バッチ分割・nodeId 再解決パターンは本ファイル §5 に内包し、本Skill 側で完結する）

## 重要な前提（MCP server gotcha）

| ルール | 理由 |
|--------|------|
| **`figma.currentPage = page` は使用禁止** | MCP server（claude.ai Figma connector）で明示的に非サポート。`await figma.setCurrentPageAsync(page)` を必須使用する |
| **`loadFontAsync` を各バッチ先頭で必ず呼ぶ** | `use_figma` の複数バッチ実行はプラグインコンテキストを跨ぐため、フォントキャッシュは引き継がれない（呼び忘れると `TextNode.characters` 代入時に例外） |
| **`Inter Semi Bold` は半角スペース** | `"SemiBold"` ではなく `"Semi Bold"`。誤記すると `loadFontAsync` が失敗する |
| **fills/strokes は配列代入** | `node.fills = [...]` 形式（プロパティの個別書き換えは不可。`node.fills[0].color = ...` は反映されない） |
| **色は `{ r, g, b }` 0-1 範囲** | 0-255 ではなく 0.0〜1.0 の小数 |

PoC で実証済みの動作:
- `await figma.setCurrentPageAsync(wireframesPage)` 成功
- `frame.layoutMode = "VERTICAL"` + `primaryAxisSizingMode/counterAxisSizingMode: "FIXED"` で完全に縦積み
- `setSharedPluginData("einja.screenSpec", ...)` + `findAll` で冪等性管理可能
- 1画面コード長 約 2,500 字 → Core 15 全要素入りで推定 約 10,000 字（動的バッチ閾値 30,000 字に余裕）

---

## §1. 配色サイズ規約（mid-fi mono）

mid-fi（mono / uncolored）ワイヤーフレームは **色情報を持たず、グレースケール + 白** のみで構成する。視覚デザインフェーズ（hi-fi）で別途配色が追加される前提のため、ここでは**情報構造を伝えることに専念**する。

### 1.1 配色パレット

| 用途 | 色（RGB 0-1） | 備考 |
|------|--------------|------|
| 画面背景 | `{ r: 1, g: 1, b: 1 }`（白） | screen frame の fills |
| 矩形枠線（汎用） | `{ r: 0.85, g: 0.85, b: 0.85 }`（薄グレー） | `strokeWeight: 1` |
| プライマリボタン fill | `{ r: 0.2, g: 0.2, b: 0.2 }`（濃グレー） | mono の最も濃い色 |
| プライマリボタンテキスト | `{ r: 1, g: 1, b: 1 }`（白） | プライマリボタン上 |
| セカンダリボタン枠 | `{ r: 0.2, g: 0.2, b: 0.2 }`（濃グレー） | fill 透明、stroke 1 |
| セカンダリボタンテキスト | `{ r: 0.2, g: 0.2, b: 0.2 }` | セカンダリボタン上 |
| ヘッダー fill | `{ r: 0.95, g: 0.95, b: 0.95 }`（極薄グレー） | header 専用、画面背景との微差 |
| 入力欄枠 | `{ r: 0.8, g: 0.8, b: 0.8 }`（標準グレー） | `strokeWeight: 1` |
| プレースホルダーテキスト | `{ r: 0.65, g: 0.65, b: 0.65 }`（中グレー） | input-text の placeholder |
| ラベル / page-title | `{ r: 0.1, g: 0.1, b: 0.1 }`（ほぼ黒） | 主要テキスト |
| セカンダリテキスト | `{ r: 0.55, g: 0.55, b: 0.55 }`（中グレー寄り） | パンくず・補足テキスト |
| validation-error テキスト | `{ r: 0.3, g: 0.3, b: 0.3 }`（濃グレー） | **mono なので赤は使わない** |
| empty-state テキスト | `{ r: 0.55, g: 0.55, b: 0.55 }` | 「データがありません」 |
| 必須マーク `*` | `{ r: 0.3, g: 0.3, b: 0.3 }`（濃グレー） | 赤ではなく濃グレーで表現 |
| ローディング枠 | `{ r: 0.7, g: 0.7, b: 0.7 }` | loading-indicator の輪郭代替 |

### 1.2 サイズ規約

| 要素 | 推奨サイズ |
|------|----------|
| screen frame（desktop） | 1440 × 900 |
| screen frame（mobile） | 375 × 812 |
| screen frame（modal） | 800 × 600 |
| ヘッダー | 親幅 × 60 |
| サイドナビ | 240 × （親高 - 60） |
| ページタイトル（高さ） | 48 |
| プライマリ・セカンダリボタン | 160 × 40 |
| input-text / input-select / input-date 矩形 | 320 × 40 |
| input ラベル領域高さ | 20 |
| input 全体（ラベル + 枠 + error 余地） | 88（フォーム1項目の標準縦幅） |
| table 行高 | 40 |
| error-banner | 親幅 × 40 |
| empty-state テキスト枠 | 親幅 × 80（中央配置） |
| loading-indicator | 40 × 40（円形矩形） |

### 1.3 フォント規約

| family | style | 用途 |
|--------|-------|------|
| Inter | Regular | 通常テキスト（プレースホルダー・補足テキスト・empty-state） |
| Inter | Medium | ラベル・ボタンテキスト・ヘッダー |
| Inter | Semi Bold | page-title（強調表示が必要なケース） |

| フォントサイズ | 用途 |
|--------------|------|
| 24 | page-title |
| 16 | ヘッダー内プロジェクト名、セクション見出し |
| 14 | 通常テキスト・ボタン・ラベル・プレースホルダー |
| 12 | breadcrumb、validation-error、補足 |

**事前ロード（バッチ先頭で必須）**:
```javascript
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });
await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
```

**フォールバック手順**（Inter が利用できない環境）:
1. `Inter Regular/Medium/Semi Bold` → 2. `Roboto Regular/Medium/Bold` → 3. `figma.listAvailableFontsAsync()` 先頭

```javascript
async function ensureFont(family, style) {
  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch {
    try {
      const fb = style === "Semi Bold" ? "Bold" : style;
      await figma.loadFontAsync({ family: "Roboto", style: fb });
      return { family: "Roboto", style: fb };
    } catch {
      const fonts = await figma.listAvailableFontsAsync();
      return fonts[0].fontName;
    }
  }
}
```

---

## §2. 二層 auto-layout 方針 + clipsContent / padding / overflow 縮退 + fallback 座標

### 2.1 二層 auto-layout（PoC 実証済み主軸方式）

**outer screen frame** はサイズ固定（layout enum で決まる）、**inner content frame** は AUTO で子要素サイジングに追従させる**二層構造**を採用する。PoC で `child2.y - child1.y = 48 = 40 + 8` の縦積み動作を確認済み。

#### outer screen frame の作成

```javascript
async function createScreenFrame({ projectName, screenName, layout, state }) {
  // layout enum によるサイズ決定（canonical-enums.md §2）
  const sizes = {
    desktop: { w: 1440, h: 900 },
    mobile:  { w: 375,  h: 812 },
    modal:   { w: 800,  h: 600 },
  };
  const { w, h } = sizes[layout];

  const screenFrame = figma.createFrame();
  screenFrame.name = `wf-${screenName}-${layout}-${state}`;
  screenFrame.resize(w, h);
  screenFrame.layoutMode = "VERTICAL";
  screenFrame.primaryAxisSizingMode = "FIXED";   // 高さ固定
  screenFrame.counterAxisSizingMode = "FIXED";   // 幅固定
  screenFrame.itemSpacing = 0;                    // outer は区切りなし
  screenFrame.paddingTop = 0;
  screenFrame.paddingBottom = 0;
  screenFrame.paddingLeft = 0;
  screenFrame.paddingRight = 0;
  screenFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  screenFrame.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  screenFrame.strokeWeight = 1;
  screenFrame.clipsContent = true;                // overflow 防止

  // 冪等性管理（canonical-enums.md §6.1 / §7）
  const stableId = `${projectName}__wf__${screenName}__${layout}__${state}`;
  screenFrame.setSharedPluginData("einja.screenSpec", "stable_id", stableId);
  screenFrame.setSharedPluginData("einja.screenSpec", "role", "screen-frame");
  screenFrame.setSharedPluginData("einja.screenSpec", "screen_stable_id",
    `${projectName}__wf__${screenName}`);

  return screenFrame;
}
```

#### inner content frame の作成

```javascript
function createContentFrame(screenFrame) {
  const contentFrame = figma.createFrame();
  contentFrame.name = "content";
  contentFrame.layoutMode = "VERTICAL";
  contentFrame.primaryAxisSizingMode = "AUTO";    // 子要素の合計高さに追従
  contentFrame.counterAxisSizingMode = "AUTO";    // 子要素の最大幅に追従
  contentFrame.itemSpacing = 16;                   // mid-fi デフォルト（PoC は 8、画面要素間は 16）
  contentFrame.paddingTop = 24;
  contentFrame.paddingBottom = 24;
  contentFrame.paddingLeft = 24;
  contentFrame.paddingRight = 24;
  contentFrame.fills = [];                         // 透明（screen frame の白が透ける）
  screenFrame.appendChild(contentFrame);
  return contentFrame;
}
```

**mid-fi デフォルト値**（PoC ベースで本Skill が採用）:
- outer screen frame: `padding 0`, `itemSpacing 0`（区切りなし、フル幅 header / side-nav を直置きできる）
- inner content frame: `padding 24`, `itemSpacing 16`（フォーム要素間の標準間隔）
- 同一 group 内（例: input-text のラベル + 枠 + error）: `padding 0`, `itemSpacing 4`（密接結合）

### 2.2 overflow 縮退ルール

outer screen frame は **常に FIXED** で layout enum サイズに固定する。inner content frame の合計高さが outer を超える場合は `clipsContent: true` により **視覚的に切り落とす**（実 frame には子が残るため、ユーザーが Figma 内で手動調整可能）。

警告ログを manifest に記録:
```json
{
  "stable_id": "sample-attendance-saas__wf__form__desktop__normal",
  "overflow_warning": true,
  "estimated_content_height": 1080,
  "screen_height": 900
}
```

実装側で overflow を検知するには、子要素の `height` を積算してから比較する:
```javascript
const contentHeight = contentFrame.children.reduce(
  (sum, c) => sum + c.height + contentFrame.itemSpacing,
  contentFrame.paddingTop + contentFrame.paddingBottom
);
if (contentHeight > screenFrame.height) {
  // manifest に overflow_warning を記録
}
```

### 2.3 fallback 座標方式（参考扱い・通常不要）

T1 PoC で auto-layout の動作は実証済み（R1 リスク潰し完了）のため、通常は §2.1 の二層 auto-layout を主軸とする。ごく稀に auto-layout が機能しない環境（極端に古い Figma サンドボックス等）では、手動座標で配置する fallback コードを以下に残す:

```javascript
// fallback: 手動座標方式（通常は使用しない）
let cursorY = 0;
const items = [
  { kind: "header", height: 60 },
  { kind: "page-title", height: 48 },
  { kind: "table", height: 200 },
];
for (const item of items) {
  const node = createPrimitive(item.kind);   // 通常の生成関数を流用
  node.x = 0;
  node.y = cursorY;
  screenFrame.appendChild(node);
  cursorY += item.height + 16;                // itemSpacing 16 相当
}
```

本 Skill 実装では §2.1 auto-layout を主軸とし、§2.3 は **トラブルシュート時の参考**として残置するのみ。

---

## §3. Core 15 プリミティブ JS 関数テンプレ

Core 15 各 kind を生成する JS テンプレ関数集。各関数は次の規約に従う:

- **引数**: `parent`（appendChild 先 = content frame など）+ 要素固有データ
- **戻り値**: 生成ノード（既に parent に appendChild 済み）
- **共通処理**: `setSharedPluginData("einja.screenSpec", "kind", "<kind>")` で kind タグ付け
- **前提**: バッチ先頭で `loadFontAsync` 済み

**element_stable_id の付与責務**: 各 createX 関数は `kind` の setSharedPluginData は内部で実行するが、`element_stable_id` および `role=element` の setSharedPluginData は**呼び出し側（パス2 Step 9 のバッチ生成ロジック）の責務**とする。理由: element_stable_id は manifest との対応関係で発行されるため、呼び出し側が一元管理する方が冪等性管理が確実。

呼び出し例:
```javascript
const button = createButtonPrimary(parent, { text: "保存" });
button.setSharedPluginData("einja.screenSpec", "role", "element");
button.setSharedPluginData("einja.screenSpec", "element_stable_id",
  "sample-attendance-saas__wf__dashboard__desktop__normal__el__button-primary__save");
```

### 3.1 createHeader

```javascript
function createHeader(parent, projectName, userPlaceholder = "User") {
  const header = figma.createFrame();
  header.name = "header";
  header.resize(parent.width, 60);
  header.layoutMode = "HORIZONTAL";
  header.primaryAxisAlignItems = "SPACE_BETWEEN";
  header.counterAxisAlignItems = "CENTER";
  header.paddingLeft = 24; header.paddingRight = 24;
  header.paddingTop = 12; header.paddingBottom = 12;
  header.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];

  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Medium" };
  title.fontSize = 16;
  title.characters = projectName;
  title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  header.appendChild(title);

  const userBox = figma.createRectangle();
  userBox.resize(120, 32);
  userBox.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  header.appendChild(userBox);

  header.setSharedPluginData("einja.screenSpec", "kind", "header");
  parent.appendChild(header);
  return header;
}
```

### 3.2 createSideNav

```javascript
function createSideNav(parent, screens, activeScreenId) {
  const nav = figma.createFrame();
  nav.name = "side-nav";
  nav.resize(240, parent.height - 60);   // header 下に配置
  nav.layoutMode = "VERTICAL";
  nav.itemSpacing = 4;
  nav.paddingTop = 16; nav.paddingBottom = 16;
  nav.paddingLeft = 12; nav.paddingRight = 12;
  nav.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];

  for (const screen of screens) {
    const item = figma.createText();
    item.fontName = {
      family: "Inter",
      style: screen.id === activeScreenId ? "Medium" : "Regular",
    };
    item.fontSize = 14;
    item.characters = screen.name;
    item.fills = [{
      type: "SOLID",
      color: screen.id === activeScreenId
        ? { r: 0.1, g: 0.1, b: 0.1 }
        : { r: 0.55, g: 0.55, b: 0.55 },
    }];
    nav.appendChild(item);
  }

  nav.setSharedPluginData("einja.screenSpec", "kind", "side-nav");
  parent.appendChild(nav);
  return nav;
}
```

### 3.3 createPageTitle

```javascript
function createPageTitle(parent, text) {
  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Medium" };
  title.fontSize = 24;
  title.characters = text;
  title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  title.setSharedPluginData("einja.screenSpec", "kind", "page-title");
  parent.appendChild(title);
  return title;
}
```

### 3.4 createBreadcrumb

```javascript
function createBreadcrumb(parent, items) {
  // items: ["Home", "画面A", "画面B"]
  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 12;
  text.characters = items.join(" > ");
  text.fills = [{ type: "SOLID", color: { r: 0.55, g: 0.55, b: 0.55 } }];
  text.setSharedPluginData("einja.screenSpec", "kind", "breadcrumb");
  parent.appendChild(text);
  return text;
}
```

### 3.5 createInputText

```javascript
function createInputText(parent, { label, required, placeholder }) {
  const wrap = figma.createFrame();
  wrap.name = `input-text-${label}`;
  wrap.layoutMode = "VERTICAL";
  wrap.primaryAxisSizingMode = "AUTO";
  wrap.counterAxisSizingMode = "AUTO";
  wrap.itemSpacing = 4;
  wrap.fills = [];

  // ラベル行（HORIZONTAL でラベル + 必須マーク）
  const labelRow = figma.createFrame();
  labelRow.layoutMode = "HORIZONTAL";
  labelRow.primaryAxisSizingMode = "AUTO";
  labelRow.counterAxisSizingMode = "AUTO";
  labelRow.itemSpacing = 4;
  labelRow.fills = [];

  const labelNode = figma.createText();
  labelNode.fontName = { family: "Inter", style: "Medium" };
  labelNode.fontSize = 14;
  labelNode.characters = label;
  labelNode.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  labelRow.appendChild(labelNode);

  if (required) {
    const mark = figma.createText();
    mark.fontName = { family: "Inter", style: "Medium" };
    mark.fontSize = 14;
    mark.characters = "*";
    mark.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
    labelRow.appendChild(mark);
  }
  wrap.appendChild(labelRow);

  // 入力枠
  const box = figma.createFrame();
  box.resize(320, 40);
  box.layoutMode = "HORIZONTAL";
  box.primaryAxisAlignItems = "MIN";
  box.counterAxisAlignItems = "CENTER";
  box.paddingLeft = 12; box.paddingRight = 12;
  box.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  box.strokes = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
  box.strokeWeight = 1;

  const ph = figma.createText();
  ph.fontName = { family: "Inter", style: "Regular" };
  ph.fontSize = 14;
  ph.characters = placeholder || "";
  ph.fills = [{ type: "SOLID", color: { r: 0.65, g: 0.65, b: 0.65 } }];
  box.appendChild(ph);
  wrap.appendChild(box);

  wrap.setSharedPluginData("einja.screenSpec", "kind", "input-text");
  parent.appendChild(wrap);
  return wrap;
}
```

### 3.6 createInputSelect

```javascript
function createInputSelect(parent, { label, required, options }) {
  // input-text と同じ構造で、入力枠の右端に "▼" を追加
  const wrap = createInputText(parent, {
    label,
    required,
    placeholder: options && options[0] ? options[0] : "選択してください",
  });

  // 入力枠（wrap.children[1] = box）を取得し ▼ を追加
  const box = wrap.children[1];
  const caret = figma.createText();
  caret.fontName = { family: "Inter", style: "Regular" };
  caret.fontSize = 12;
  caret.characters = "▼";
  caret.fills = [{ type: "SOLID", color: { r: 0.55, g: 0.55, b: 0.55 } }];
  // 右端寄せのため box の primaryAxisAlignItems を SPACE_BETWEEN に変更
  box.primaryAxisAlignItems = "SPACE_BETWEEN";
  box.appendChild(caret);

  wrap.setSharedPluginData("einja.screenSpec", "kind", "input-select");
  return wrap;
}
```

### 3.7 createInputDate

```javascript
function createInputDate(parent, { label, required }) {
  const wrap = createInputText(parent, {
    label,
    required,
    placeholder: "YYYY/MM/DD",
  });

  // 右端にカレンダーアイコン代替の小矩形を追加
  const box = wrap.children[1];
  const icon = figma.createRectangle();
  icon.resize(24, 24);
  icon.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  box.primaryAxisAlignItems = "SPACE_BETWEEN";
  box.appendChild(icon);

  wrap.setSharedPluginData("einja.screenSpec", "kind", "input-date");
  return wrap;
}
```

### 3.8 createRequiredMark

```javascript
// 注: input-* 系では labelRow に直接追加するため、本関数は単独利用時のみ
function createRequiredMark(parent) {
  const mark = figma.createText();
  mark.fontName = { family: "Inter", style: "Medium" };
  mark.fontSize = 14;
  mark.characters = "*";
  mark.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
  mark.setSharedPluginData("einja.screenSpec", "kind", "required-mark");
  parent.appendChild(mark);
  return mark;
}
```

### 3.9 createButtonPrimary

```javascript
function createButtonPrimary(parent, text) {
  const btn = figma.createFrame();
  btn.name = `btn-primary-${text}`;
  btn.resize(160, 40);
  btn.layoutMode = "HORIZONTAL";
  btn.primaryAxisAlignItems = "CENTER";
  btn.counterAxisAlignItems = "CENTER";
  btn.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  btn.cornerRadius = 4;

  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Medium" };
  label.fontSize = 14;
  label.characters = text;
  label.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  btn.appendChild(label);

  btn.setSharedPluginData("einja.screenSpec", "kind", "button-primary");
  parent.appendChild(btn);
  return btn;
}
```

### 3.10 createButtonSecondary

```javascript
function createButtonSecondary(parent, text) {
  const btn = figma.createFrame();
  btn.name = `btn-secondary-${text}`;
  btn.resize(160, 40);
  btn.layoutMode = "HORIZONTAL";
  btn.primaryAxisAlignItems = "CENTER";
  btn.counterAxisAlignItems = "CENTER";
  btn.fills = [];                                  // 透明
  btn.strokes = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  btn.strokeWeight = 1;
  btn.cornerRadius = 4;

  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Medium" };
  label.fontSize = 14;
  label.characters = text;
  label.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  btn.appendChild(label);

  btn.setSharedPluginData("einja.screenSpec", "kind", "button-secondary");
  parent.appendChild(btn);
  return btn;
}
```

### 3.11 createTable

```javascript
function createTable(parent, columns, sampleRowCount = 3) {
  const table = figma.createFrame();
  table.name = "table";
  table.layoutMode = "VERTICAL";
  table.primaryAxisSizingMode = "AUTO";
  table.counterAxisSizingMode = "AUTO";
  table.itemSpacing = 0;
  table.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  table.strokeWeight = 1;
  table.fills = [];

  // ヘッダー行
  const header = figma.createFrame();
  header.layoutMode = "HORIZONTAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "AUTO";
  header.itemSpacing = 0;
  header.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
  for (const col of columns) {
    const cell = figma.createFrame();
    cell.resize(120, 40);
    cell.layoutMode = "HORIZONTAL";
    cell.primaryAxisAlignItems = "MIN";
    cell.counterAxisAlignItems = "CENTER";
    cell.paddingLeft = 12;
    cell.fills = [];
    cell.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
    cell.strokeWeight = 1;
    const t = figma.createText();
    t.fontName = { family: "Inter", style: "Medium" };
    t.fontSize = 14;
    t.characters = col;
    t.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
    cell.appendChild(t);
    header.appendChild(cell);
  }
  table.appendChild(header);

  // ダミーデータ行
  for (let i = 0; i < sampleRowCount; i++) {
    const row = figma.createFrame();
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "AUTO";
    row.itemSpacing = 0;
    row.fills = [];
    for (const col of columns) {
      const cell = figma.createFrame();
      cell.resize(120, 40);
      cell.layoutMode = "HORIZONTAL";
      cell.primaryAxisAlignItems = "MIN";
      cell.counterAxisAlignItems = "CENTER";
      cell.paddingLeft = 12;
      cell.fills = [];
      cell.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
      cell.strokeWeight = 1;
      const t = figma.createText();
      t.fontName = { family: "Inter", style: "Regular" };
      t.fontSize = 14;
      t.characters = "—";
      t.fills = [{ type: "SOLID", color: { r: 0.55, g: 0.55, b: 0.55 } }];
      cell.appendChild(t);
      row.appendChild(cell);
    }
    table.appendChild(row);
  }

  table.setSharedPluginData("einja.screenSpec", "kind", "table");
  parent.appendChild(table);
  return table;
}
```

### 3.12 createValidationError

```javascript
function createValidationError(parent, messageTemplate) {
  // 対応 input 要素の直下に配置する想定
  const err = figma.createText();
  err.fontName = { family: "Inter", style: "Regular" };
  err.fontSize = 12;
  err.characters = messageTemplate;
  err.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];  // mono, 赤は使わない
  err.setSharedPluginData("einja.screenSpec", "kind", "validation-error");
  parent.appendChild(err);
  return err;
}
```

### 3.13 createErrorBanner

```javascript
function createErrorBanner(parent, messageTemplate) {
  const banner = figma.createFrame();
  banner.name = "error-banner";
  banner.resize(parent.width - 48, 40);            // content padding 24 を考慮
  banner.layoutMode = "HORIZONTAL";
  banner.primaryAxisAlignItems = "MIN";
  banner.counterAxisAlignItems = "CENTER";
  banner.paddingLeft = 16; banner.paddingRight = 16;
  banner.fills = [];
  banner.strokes = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
  banner.strokeWeight = 1;
  banner.dashPattern = [4, 4];                      // dashed stroke

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Medium" };
  text.fontSize = 14;
  text.characters = messageTemplate;
  text.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
  banner.appendChild(text);

  banner.setSharedPluginData("einja.screenSpec", "kind", "error-banner");
  parent.appendChild(banner);
  return banner;
}
```

### 3.14 createEmptyState

```javascript
function createEmptyState(parent, message = "データがありません") {
  const wrap = figma.createFrame();
  wrap.name = "empty-state";
  wrap.resize(parent.width - 48, 80);
  wrap.layoutMode = "HORIZONTAL";
  wrap.primaryAxisAlignItems = "CENTER";
  wrap.counterAxisAlignItems = "CENTER";
  wrap.fills = [];

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 14;
  text.characters = message;
  text.fills = [{ type: "SOLID", color: { r: 0.55, g: 0.55, b: 0.55 } }];
  wrap.appendChild(text);

  wrap.setSharedPluginData("einja.screenSpec", "kind", "empty-state");
  parent.appendChild(wrap);
  return wrap;
}
```

### 3.15 createLoadingIndicator

```javascript
function createLoadingIndicator(parent, message = "読み込み中…") {
  const wrap = figma.createFrame();
  wrap.name = "loading-indicator";
  wrap.layoutMode = "VERTICAL";
  wrap.primaryAxisSizingMode = "AUTO";
  wrap.counterAxisSizingMode = "AUTO";
  wrap.primaryAxisAlignItems = "CENTER";
  wrap.counterAxisAlignItems = "CENTER";
  wrap.itemSpacing = 12;
  wrap.fills = [];

  // 円形矩形（cornerRadius でスピナー外形を表現）
  const circle = figma.createEllipse();
  circle.resize(40, 40);
  circle.fills = [];
  circle.strokes = [{ type: "SOLID", color: { r: 0.7, g: 0.7, b: 0.7 } }];
  circle.strokeWeight = 3;
  wrap.appendChild(circle);

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 14;
  text.characters = message;
  text.fills = [{ type: "SOLID", color: { r: 0.55, g: 0.55, b: 0.55 } }];
  wrap.appendChild(text);

  wrap.setSharedPluginData("einja.screenSpec", "kind", "loading-indicator");
  parent.appendChild(wrap);
  return wrap;
}
```

---

## §4. 状態バリエーション（normal / loading / error / empty）

`state` enum（canonical-enums.md §3）ごとに、screen frame に追加で配置する要素のルールを定義する。

| state | 追加要素 | 配置先 | 備考 |
|-------|---------|-------|------|
| `normal` | なし | — | デフォルト状態。すべての要素を通常表示 |
| `loading` | `loading-indicator` | content frame 中央 | 既存の table 等は残してオーバーレイ的に追加。表示優先度: 中央配置 |
| `error` | `error-banner` | content frame 先頭（page-title の下） | breadcrumb / page-title の直下に挿入。固定メッセージテンプレ「処理中にエラーが発生しました」を採用 |
| `empty` | `empty-state` | content frame 中央 | table がある画面では table を空状態に置換、それ以外は中央配置の単独要素として追加 |

### 4.1 複数 state 指定時の挙動

複数 state が指定された場合（例: `normal` + `error`）は **state ごとに別 frame を作成**する。`stable_id` 末尾を `__normal` / `__error` 等で区別し、canonical-enums.md §6.1 / §6.4 と整合させる。

```javascript
async function createScreenVariants({ projectName, screenName, layout, states, elements }) {
  const frames = [];
  for (const state of states) {  // states: ["normal", "error", "empty"]
    const screenFrame = await createScreenFrame({ projectName, screenName, layout, state });
    const contentFrame = createContentFrame(screenFrame);
    // 通常要素を全部配置
    for (const el of elements) {
      buildPrimitive(contentFrame, el);
    }
    // state ごとの追加要素
    if (state === "loading") {
      createLoadingIndicator(contentFrame);
    } else if (state === "error") {
      // page-title の直後に挿入したい場合は index 操作
      const banner = createErrorBanner(contentFrame, "処理中にエラーが発生しました");
      // contentFrame 内の page-title 直下に再配置
      const titleIdx = contentFrame.children.findIndex(
        (c) => c.getSharedPluginData("einja.screenSpec", "kind") === "page-title"
      );
      if (titleIdx >= 0) {
        contentFrame.insertChild(titleIdx + 1, banner);
      }
    } else if (state === "empty") {
      // table を空状態に置換
      const tableIdx = contentFrame.children.findIndex(
        (c) => c.getSharedPluginData("einja.screenSpec", "kind") === "table"
      );
      if (tableIdx >= 0) {
        contentFrame.children[tableIdx].remove();
      }
      createEmptyState(contentFrame);
    }
    frames.push(screenFrame);
  }
  return frames;
}
```

### 4.2 state バリエーション横並び配置

複数 state frame は **Wireframes ページ上で水平方向に並べる**ことを推奨（同一画面の状態比較が直感的になる）:

```javascript
// 配置例: x = 画面幅 + 80 のオフセット
const SCREEN_GAP_X = 80;
let cursorX = 0;
for (const frame of frames) {
  frame.x = cursorX;
  frame.y = 0;
  cursorX += frame.width + SCREEN_GAP_X;
}
```

---

## §5. 文字数試算と動的バッチ分割

### 5.1 文字数試算（PoC 結果ベース）

T1 PoC で 1画面（screen frame + 子矩形2個 + setSharedPluginData round-trip 検証コード）が **約 2,500 字**。これをベースに本Skill の生成コード長を試算:

| 画面パターン | 推定字数 | 備考 |
|------------|--------|------|
| シンプル画面（header + page-title + button × 2 = 4要素） | 約 3,500 字 | PoC × 1.4 倍 |
| 標準フォーム画面（5-10 要素: header + page-title + input × 5 + button × 2） | 約 5,000〜8,000 字 | 中央値 6,500 |
| 一覧画面（header + page-title + table + button × 2 = ~5 要素 + table 内部 10 行） | 約 7,000〜10,000 字 | table の動的展開で増える |
| Core 15 全要素フル装備（極端ケース） | 約 10,000 字 | 動的バッチ閾値 30,000 字に余裕 |

→ **基本ルール: 1画面 = 1 use_figma バッチ**。

### 5.2 動的バッチ分割ルール

`use_figma` の入出力制限（旧 figma-arrow-rules.md §5 由来。drawio 化に伴い本ファイルが SSoT）:
- 入力（`code` パラメータ）: **50,000 字**
- 出力（レスポンス全体）: **20kb**

本Skill のバッチ分割ルール:

1. **基本**: 1画面 = 1 use_figma バッチ（最も多い 10,000 字程度で十分余裕）
2. **大規模画面**: 子要素が 20 を超える画面では、以下のように分割
   - バッチ1: outer screen frame + content frame + 最初の 10 要素
   - バッチ2: 残り要素を appendChild（content frame を `findAll` で再解決）
3. **閾値**: 初期 40,000 字、超過時 30,000 字に縮小（screen-flow-figma と同じ動的縮小ロジック）
4. **20kb 出力上限対策**: 各バッチの戻り値は `{ count: N, lastStableId: "..." }` に削減し、生成ノードの詳細情報は manifest 側で別途管理する

### 5.3 バッチ構築の擬似コード

```javascript
// オーケストレーター側（JS）
const elements = screen.elements;  // 例: 25 要素
const baseCode = generateScreenFrameCode(screen);   // outer + content frame
const reloadCode = generateReloadContentFrameCode(screen.stable_id);  // findAll で content frame 取得

let currentBatch = baseCode;
const batches = [];
let isFirst = true;
for (const element of elements) {
  const snippet = generateElementCode(element);
  const candidate = isFirst ? currentBatch + snippet : currentBatch + snippet;

  if (candidate.length > 40000) {
    batches.push(currentBatch);
    currentBatch = reloadCode + snippet;            // バッチ先頭で content frame 再解決
    isFirst = false;
  } else {
    currentBatch = candidate;
  }
}
batches.push(currentBatch);

// 順次 use_figma に投入
for (const batch of batches) {
  await mcp_figma.use_figma({ code: batch });
}
```

### 5.4 バッチ間 nodeId 引き継ぎ

バッチを跨ぐ場合、JS 側の変数は破棄されるため、**バッチ先頭で stable_id から `findAll` でノードを再解決する**。PoC ④ で動作確認済みのパターン（旧 figma-arrow-rules.md §4 由来、drawio 化後は本Skill 側で完結）:

```javascript
// バッチ2 先頭の reloadCode 例
const targetStableId = "sample-attendance-saas__wf__form__desktop__normal";
const matches = figma.currentPage.findAll(
  (n) => n.getSharedPluginData("einja.screenSpec", "stable_id") === targetStableId
);
if (matches.length === 0) {
  throw new Error(`screen frame not found: ${targetStableId}`);
}
const screenFrame = matches[0];

// content frame は screen frame の子として name 検索（screen frame 内で一意）
const contentFrame = screenFrame.children.find((c) => c.name === "content");
if (!contentFrame) {
  throw new Error(`content frame not found in ${targetStableId}`);
}

// 以降、contentFrame.appendChild(...) で要素追加を継続
```

### 5.5 各バッチ先頭の必須処理

各バッチの先頭で以下を必ず実行する:

```javascript
// 1. setCurrentPageAsync（複数バッチ間でカレントページが保証されないため）
const wireframesPage = figma.root.children.find((p) => p.name === "Wireframes");
if (!wireframesPage) throw new Error("Wireframes page not found");
await figma.setCurrentPageAsync(wireframesPage);

// 2. loadFontAsync（フォントキャッシュは引き継がれない）
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });
await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
```

### 5.6 出力サイズ対策（20kb 制限）

各バッチの末尾の `return` 文では大量データを返さない:

```javascript
// 良い例: 件数と最後の stable_id のみ
return {
  processed_count: 12,
  last_element_stable_id: "sample-attendance-saas__wf__form__desktop__normal__el__button-primary__submit",
};

// 悪い例: 全要素の id 配列を返すと 20kb 超過リスク
return {
  all_node_ids: contentFrame.children.map((c) => c.id),   // ❌
};
```

詳細な要素一覧は **manifest（`docs/project/wireframe-url.md` の `## screens` / `## elements` セクション、manifest-schema.md §1 参照）で管理**する。Figma 側からの戻り値は最小限に留めること。

---

## 関連リソース

- canonical enum 定義: [`./canonical-enums.md`](./canonical-enums.md)
- T1 PoC 結果（auto-layout / setSharedPluginData 動作実証）: `docs/einja/memory/figma-screen-spec-poc.md`
- ヒアリング項目: [`./hearing-checklist.md`](./hearing-checklist.md)
- manifest スキーマ: [`./manifest-schema.md`](./manifest-schema.md)
- 既存 Plugin API パターン（動的バッチ・nodeId 再解決の根拠）: 旧 `einja-project-screen-flow-figma/references/figma-arrow-rules.md`（drawio 化に伴い廃止、本ファイル §5 内に内包）
- MCP server 仕様: `claude.ai Figma` connector（`setCurrentPageAsync` 必須）
