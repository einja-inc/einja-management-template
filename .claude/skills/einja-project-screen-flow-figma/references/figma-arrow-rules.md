# Figma 矢印描画ルール

SKILL.md ワークフロー **Step 7（パス1 FrameNode 配置）/ Step 8（パス2 エッジ描画）/ §5 エラー処理** から参照される、画面遷移図の矢印・ノード描画パターン集。Figma Plugin API 上で「片方向矢印 + ラベル + グルーピング」を冪等に生成するための実装パターン・StrokeCap 仕様・バッチ分割戦略をまとめる。

## 目次

1. [設計判断の根拠（PoC 結果）](#1-設計判断の根拠poc-結果)
2. [VectorNode + setVectorNetworkAsync の実装パターン](#2-vectornode--setvectornetworkasync-の実装パターン)
3. [2 パス生成戦略](#3-2-パス生成戦略)
4. [setSharedPluginData による nodeId 再解決](#4-setsharedplugindata-による-nodeid-再解決)
5. [use_figma の入出力制限と動的バッチ分割](#5-use_figma-の入出力制限と動的バッチ分割)
6. [LineNode 代替経路（フォールバック・将来用）](#6-linenode-代替経路フォールバック将来用)
7. [エラー処理パターン](#7-エラー処理パターン)

---

## 1. 設計判断の根拠（PoC 結果）

**第一選択は `LineNode` ではなく `VectorNode` + `setVectorNetworkAsync`。**

- 2026-05-18 PoC #1（実機検証済み）で、`LineNode.strokeCap = "ARROW_LINES"` は **vectorNetwork 全体に一括適用される = 両端矢印固定** になることを確認した。Figma 公式ドキュメント（developers.figma.com）でも「On a vector network, the value is set on the whole vector network」と明記されており、頂点ごとの個別指定はできない。
- 画面遷移図は「始点 → 終点」の片方向表現が必須のため、`LineNode` 単独では要件を満たせない。
- PoC #2（実機検証済み）で、`VectorNode` を作って `setVectorNetworkAsync` の `vertices[].strokeCap` を `"NONE"`（始点）/ `"ARROW_LINES"`（終点）に個別指定することで **片方向矢印** が描画できることを確認した。
- 採用方針: 矢印描画は VectorNode を主軸とし、LineNode は採用しない（PoC 検証済み。社内 Figma 環境で実施、PoC 結果は plan v0.5.2 変更履歴を参照）。

将来 Figma Plugin API が `LineNode` でも頂点別 `strokeCap` を直接サポートした場合の差し替え方法は §6 を参照。

---

## 2. VectorNode + setVectorNetworkAsync の実装パターン

PoC #2 と同等の最小コード例。**`setVectorNetworkAsync` は async** なので `await` 必須。

```javascript
// fromX, fromY: 始点（FrameNode の右端中央など）
// toX, toY:   終点（次画面 FrameNode の左端中央など）
const dx = toX - fromX;
const dy = toY - fromY;

const arrow = figma.createVector();
arrow.x = fromX;
arrow.y = fromY;

await arrow.setVectorNetworkAsync({
  vertices: [
    { x: 0,  y: 0,  strokeCap: "NONE" },          // 始点: キャップなし
    { x: dx, y: dy, strokeCap: "ARROW_LINES" },   // 終点: 矢印キャップ
  ],
  segments: [{ start: 0, end: 1 }],
  regions: [],
});

arrow.strokes = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
arrow.strokeWeight = 2;
// ※ 単独利用時。エッジとして group 化する場合は appendChild せず group() に直接渡す（§3 参照）
figma.currentPage.appendChild(arrow);
```

### StrokeCap 値の選択ガイド

| 値 | 形状 | 用途・推奨度 |
|----|------|------------|
| `"ARROW_LINES"` | 2 本線の標準矢印（V 字） | **画面遷移図の推奨デフォルト**。視覚的に矢印と認識しやすい |
| `"ARROW_EQUILATERAL"` | 等辺三角形の塗り矢印 | より太く強調したい場合。線色＝矢印色 |
| `"TRIANGLE_FILLED"` | 塗り三角形 | デザイン上の強調マーカー向け。画面遷移図では過剰 |
| `"NONE"` | キャップなし | 始点・通過点で使用 |

本 Skill は **`ARROW_LINES`** を標準採用する（情報密度の高い遷移図で線が混み合っても矢印形状が崩れにくい）。

### 注意事項

- `figma.createVector()` 直後の `vectorNetwork` プロパティは空。**必ず `setVectorNetworkAsync` で頂点とセグメントを定義してから** `appendChild` する。
- `vertices` の座標は VectorNode 自体の `x, y` を原点とした相対座標。FrameNode の絶対座標とは別物。
- `strokeWeight` は数値（px）。視認性のため画面遷移図では `2`〜`3` を推奨。

---

## 3. 2 パス生成戦略

50000 字制限・出力 20kb 制限の双方を満たすため、**1 回の `use_figma` で全部描かず、パス 1（画面配置）/ パス 2（エッジ描画）に分離する**。

### パス 1: FrameNode 配置（画面ノード生成）

- 全画面候補を `FrameNode` で配置する。名前は kebab-case（例: `"screen-dashboard"`, `"screen-login"`）。
- 格子レイアウト: 列数 `cols = ceil(sqrt(N))`、画面間隔 `200`〜`400px`（FrameNode サイズに応じて調整）。
- 各 FrameNode に **`setSharedPluginData` で識別情報を付与**:

```javascript
const frame = figma.createFrame();
frame.name = "screen-dashboard";
frame.resize(240, 160);
frame.x = col * 320;
frame.y = row * 220;
frame.setSharedPluginData("einja.screenFlow", "role", "screen");
frame.setSharedPluginData(
  "einja.screenFlow",
  "stable_id",
  `${projectName}__screen-dashboard`,
);
figma.currentPage.appendChild(frame);
```

- パス 1 のレスポンスでは、オーケストレーター側で `{ stable_id: nodeId }` の Map を保持する（次バッチでの再解決に備える）。

### パス 2: エッジ描画（矢印 + ラベル + グルーピング）

各エッジを 3 要素グループで構成する:

1. **VectorNode**: §2 のパターンで片方向矢印
2. **TextNode**: トリガーラベル（線の中点 ±10px に配置、`loadFontAsync` 必須）
3. **`figma.group([vector, text], figma.currentPage)`**: Undo 単位を 1 つにまとめる

```javascript
// 注意: arrow と label は appendChild せず直接 group() に渡す。
// figma.group() が暗黙的に第2引数の親（figma.currentPage）に追加する。
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

const label = figma.createText();
label.fontName = { family: "Inter", style: "Regular" };
label.characters = "ログイン成功";
label.textAutoResize = "WIDTH_AND_HEIGHT";  // characters設定後に呼ばないと width/height が 0 になる
label.fontSize = 12;
label.x = fromX + dx / 2 - label.width / 2;
label.y = fromY + dy / 2 - label.height / 2;

const group = figma.group([arrow, label], figma.currentPage);
group.name = `edge__${fromName}__to__${toName}`;
group.setSharedPluginData("einja.screenFlow", "role", "edge");
group.setSharedPluginData(
  "einja.screenFlow",
  "stable_id",
  `${projectName}__${fromName}__to__${toName}`,
);
```

- `figma.group()` は引数の親（第2引数）に自動でグループを追加するため、別途 `appendChild` は不要。
- TextNode 配置は線の中点 ±10px 以内を許容（厳密一致は不要）。
- グループ名規約: `edge__<from-kebab>__to__<to-kebab>`。

#### label が空の場合（VectorNode 単体描画）

`hearing-checklist` の項目 C で「ラベルなし」が選択されたエッジでは、TextNode を作らず VectorNode 単体で group 化する:

```javascript
// label が空の場合は TextNode を作らず VectorNode 単体で group 化
if (!labelText) {
  const group = figma.group([arrow], figma.currentPage);
  group.name = `edge__${fromName}__to__${toName}`;
  group.setSharedPluginData("einja.screenFlow", "role", "edge");
  group.setSharedPluginData(
    "einja.screenFlow",
    "stable_id",
    `${projectName}__${fromName}__to__${toName}`,
  );
  // ... 以下省略（ラベルあり経路と同じ後処理）
}
```

---

## 4. setSharedPluginData による nodeId 再解決

### なぜ `setSharedPluginData` か（`setPluginData` ではない理由）

- `setPluginData` はそのプラグイン内からしか読めず、本 Skill のように `use_figma` を複数回（複数バッチ）またいで再アクセスする場合、**書き込み主体が同一プラグインスコープか保証できない**。
- `setSharedPluginData(namespace, key, value)` は **ファイル横断・プラグイン横断で読める**（本 Skill は `namespace = "einja.screenFlow"` を統一使用）。
- 冪等な再生成（Skill を 2 回目以降に呼んだとき、既存ノードと突合して差分のみ反映）にも必須。

### nodeId 消失への備え

パス 1 で得た `nodeId` は、パス 2 開始までの間に Figma 内部状態（vectorNetwork 更新 / `appendChild` 後の async 操作）で **値が変わる事例** がある。Map を頼らず、各バッチで `stable_id` から検索し直す:

```javascript
const target_id = `${projectName}__screen-dashboard`;
const matches = figma.currentPage.findAll(
  (n) =>
    n.getSharedPluginData("einja.screenFlow", "stable_id") === target_id,
);
if (matches.length === 0) throw new Error(`stable_id not found: ${target_id}`);
const frame = matches[0];
```

- **名前検索（`findAll(n => n.name === "screen-dashboard")`）は同名衝突リスク**があるため最終フォールバックのみ。
- `findAll` はページ全体走査でコスト高なので、1 バッチ内では先頭で必要分だけ走査して結果を JS 側で再利用する。

### バッチ先頭で stable_id を一括取得して Map に格納するパターン

各エッジで個別に `findAll` を呼ぶとページ全体走査が N 回発生する。バッチ単位で必要な `stable_id` をまとめて 1 回の走査で集約し、Map に格納してから各エッジ処理で参照すること:

```javascript
// バッチ先頭で必要な stable_id を一括取得
const targets = new Set(
  currentBatch.map((e) => `${projectName}__${e.from}`)
    .concat(currentBatch.map((e) => `${projectName}__${e.to}`)),
);
const idMap = new Map();
figma.currentPage.findAll((n) => {
  const sid = n.getSharedPluginData("einja.screenFlow", "stable_id");
  if (targets.has(sid)) idMap.set(sid, n);
  return false;  // findAll が走査するため戻り値は無視されてOK、副作用で集約
});
// 各エッジで idMap.get(stable_id) を使用
```

---

## 5. use_figma の入出力制限と動的バッチ分割

`use_figma` には **二重の制約** がある:

| 方向 | 上限 | 出典 |
|------|------|------|
| 入力（`code` パラメータの文字列長） | **50000 字** | `use_figma` ツール仕様 |
| 出力（レスポンス全体） | **20kb** | Figma MCP `write-to-canvas.md` ガイド |

### 動的バッチ分割

バッチサイズは「N エッジ固定」ではなく、**コード文字列を構築しながら 40000 字を超えそうになったら次バッチへ送る** 動的方式とする（日本語ラベル長によりサイズが変動するため）。

- 目安: 1 バッチあたり 10 エッジ前後。日本語ラベルが長い場合は 6〜7 エッジで切れることもある。
- 各バッチの末尾で `figma.currentPage.findAll(...)` のような大量列挙を返さない（20kb 出力上限を超える）。返却は「処理件数」「最後のグループ名」程度の最小情報のみ。

### バッチ間連携

- パス 1 完了後に得た `{stable_id, nodeId}` Map は **JS 側にも保持するが、パス 2 では `findAll` で再解決**（§4）。
- バッチ間で参照したい付加情報は `setSharedPluginData` に書き込み、次バッチで `getSharedPluginData` で読み出す。

### 各バッチ先頭で `loadFontAsync` を必ず呼ぶ

`use_figma` が複数回呼ばれると各バッチが別プラグイン実行コンテキストになる可能性があるため、フォントキャッシュの引き継ぎは保証されない。**各バッチの先頭で必ず `loadFontAsync` を呼ぶ**こと（呼び忘れると TextNode の `characters` 代入時に例外で停止する）。

```javascript
// 各バッチの先頭で必ず呼ぶ
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
```

### バッチ構築の擬似コード

```javascript
// 構築側の擬似コード（オーケストレーター側 / JS）
let buf = "";
const batches = [];
for (const edge of edges) {
  const snippet = renderEdgeCode(edge); // setVectorNetworkAsync 1 件分
  if ((buf + snippet).length > 40000) {
    batches.push(buf);
    buf = "";
  }
  buf += snippet;
}
if (buf) batches.push(buf);
// → batches を順次 use_figma に投入
```

---

## 6. LineNode 代替経路（フォールバック・将来用）

### 6-1. 将来 LineNode が頂点別 strokeCap をサポートした場合

現状の `LineNode.strokeCap` は単一プロパティで vectorNetwork 全体に適用される。将来 API が「個別頂点 strokeCap」を `LineNode` で直接公開した場合、§2 を以下のように差し替えれば矢印 1 本あたりのコード量が削減できる:

```javascript
// ⚠️⚠️⚠️ DO NOT IMPLEMENT - 将来仕様の参考のみ ⚠️⚠️⚠️
// 以下のプロパティは現状の Figma Plugin API には存在しない
// 将来の仮想 API（現状は動作しない）
const line = figma.createLine();
line.x = fromX; line.y = fromY;
line.resize(Math.hypot(dx, dy), 0);
line.rotation = Math.atan2(dy, dx) * (180 / Math.PI);
// 仮想プロパティ（実在しない）: 頂点別 strokeCap
// line.strokeCapStart = "NONE";
// line.strokeCapEnd = "ARROW_LINES";
```

差し替え判定は SKILL.md の PoC ゲート（0-2.5 / 0-2.6 と同等の再評価）で行うこと。

### 6-2. 矢印を諦めて双方向で代用する場合

レビュー観点で「片方向必須要件を緩めても良い」と合意できた場合のみ、LineNode の標準矢印で双方向表現する:

```javascript
const line = figma.createLine();
line.x = fromX; line.y = fromY;
line.resize(Math.hypot(dx, dy), 0);
line.rotation = Math.atan2(dy, dx) * (180 / Math.PI);
line.strokeCap = "ARROW_LINES"; // 両端矢印固定
line.strokes = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
line.strokeWeight = 2;
```

ただし本 Skill のデフォルトでは **採用しない**（画面遷移の意味論が崩れるため）。

---

## 7. エラー処理パターン

| 事象 | 原因 | 対処 |
|------|------|------|
| `loadFontAsync` 失敗 | フォントがファイルに含まれない | `Inter Regular` → `Roboto Regular` → `figma.listAvailableFontsAsync()` 先頭 の順でフォールバック |
| `planKey` 不明 | 認証直後で context 未取得 | `mcp__claude_ai_Figma__whoami` を呼び直し planKey を取得し直す |
| `code` 文字列が 50000 字超 | エッジが多い / ラベルが長い | §5 の動的分割で 40000 字閾値を 30000 字まで下げて再試行 |
| 出力 20kb 超 | 戻り値で大量配列を返している | バッチ末尾で件数・最後の `stable_id` のみ返す形に整形 |
| `setVectorNetworkAsync` で頂点座標エラー | 始点と終点が同一座標 | 構築前に `dx === 0 && dy === 0` を弾く（同一画面遷移は無効） |
| `findAll` で `stable_id` 0 件 | パス 1 の書き込み失敗 / namespace 不一致 | namespace が `"einja.screenFlow"` か確認、必要なら名前ベース fallback（同名衝突警告付き） |
| グループ作成失敗 | 子ノードが既に別の親に属している | `appendChild` の二重実行を疑い、構築済みフラグを JS 側で管理 |
