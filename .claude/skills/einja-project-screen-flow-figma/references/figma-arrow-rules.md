# Figma 矢印描画ルール

SKILL.md ワークフロー **Step 7（パス1 FrameNode 配置）/ Step 8（パス2 エッジ描画）/ §8 エラー処理** から参照される、画面遷移図の矢印・ノード描画パターン集。Figma Plugin API 上で「片方向矢印 + ラベル + グルーピング」を冪等に生成するための実装パターン・StrokeCap 仕様・バッチ分割戦略をまとめる。

## 目次

1. [設計判断の根拠（PoC 結果）](#1-設計判断の根拠poc-結果)
2. [VectorNode + setVectorNetworkAsync の実装パターン](#2-vectornode--setvectornetworkasync-の実装パターン)
3. [2 パス生成戦略](#3-2-パス生成戦略)
4. [Plugin Data Key 移行](#4-plugin-data-key-移行)
5. [setSharedPluginData による nodeId 再解決](#5-setsharedplugindata-による-nodeid-再解決)
6. [use_figma の入出力制限と動的バッチ分割](#6-use_figma-の入出力制限と動的バッチ分割)
7. [LineNode 代替経路（フォールバック・将来用）](#7-linenode-代替経路フォールバック将来用)
8. [エラー処理パターン](#8-エラー処理パターン)

---

## 1. 設計判断の根拠（PoC 結果）

**第一選択は `LineNode` ではなく `VectorNode` + `setVectorNetworkAsync`。**

- 2026-05-18 PoC #1（実機検証済み）で、`LineNode.strokeCap = "ARROW_LINES"` は **vectorNetwork 全体に一括適用される = 両端矢印固定** になることを確認した。Figma 公式ドキュメント（developers.figma.com）でも「On a vector network, the value is set on the whole vector network」と明記されており、頂点ごとの個別指定はできない。
- 画面遷移図は「始点 → 終点」の片方向表現が必須のため、`LineNode` 単独では要件を満たせない。
- PoC #2（実機検証済み）で、`VectorNode` を作って `setVectorNetworkAsync` の `vertices[].strokeCap` を `"NONE"`（始点）/ `"ARROW_LINES"`（終点）に個別指定することで **片方向矢印** が描画できることを確認した。
- 採用方針: 矢印描画は VectorNode を主軸とし、LineNode は採用しない（PoC 検証済み。社内 Figma 環境で実施、PoC 結果は plan v0.5.2 変更履歴を参照）。

将来 Figma Plugin API が `LineNode` でも頂点別 `strokeCap` を直接サポートした場合の差し替え方法は §7 を参照。

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

### 2.0 Edge 描画の処理順序（cycle 対応）

エッジ単位の座標計算（§2.1 以降）に先立ち、**全 edges を一括スキャンして primary/back を確定**してから topological sort で `x_order` を決める。これは cycle（A→B→A 等）が存在しても落ちないようにするための前処理であり、座標計算前に edge_kind が確定している必要がある。

```
1. 全 edges について「暫定 back 判定」を先行実施
   - trigger テキストに「差し戻し」「キャンセル」「戻る」「エラー」「失敗」含む → back
   - その他は primary 候補
2. primary 候補のみで topological sort
   - cycle 検出時は Tarjan's SCC 分解、各 SCC 内は「入力順 = manifest edges 配列の記載順（YAML 出現順）」で fallback
   - sort 結果で x_order を確定
3. 確定後、追加判定: x_order[to] < x_order[from] → back（同一 lane 内のみ適用、lane 跨ぎは除外）
4. final edge_kind 決定後、座標計算（§2.1〜§2.4）へ
```

**完了系自動遷移の扱い**: trigger に「完了」「自動遷移」を含む lane 跨ぎ edge（例: `punch → dashboard`, `request → dashboard`）は `primary` を維持する（§2.5 と整合）。

---

### 2.1 辺判定（最近辺マッチング）

始点 FrameNode / 終点 FrameNode のどの辺（上下左右）にアンカーを置くかは、**両者の中心点の dx / dy の絶対値比較**で決定する。`|dx| >= |dy|` なら水平接続（右辺↔左辺）、そうでなければ垂直接続（下辺↔上辺）。

```javascript
function pickAnchor(fromBB, toBB) {
  const fc = { x: fromBB.x + fromBB.w/2, y: fromBB.y + fromBB.h/2 };
  const tc = { x: toBB.x + toBB.w/2, y: toBB.y + toBB.h/2 };
  const dx = tc.x - fc.x, dy = tc.y - fc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      fromAnchor: dx >= 0 ? { x: fromBB.x + fromBB.w, y: fc.y } : { x: fromBB.x, y: fc.y },
      toAnchor: dx >= 0 ? { x: toBB.x, y: tc.y } : { x: toBB.x + toBB.w, y: tc.y },
      axis: "H",
    };
  }
  return {
    fromAnchor: dy >= 0 ? { x: fc.x, y: fromBB.y + fromBB.h } : { x: fc.x, y: fromBB.y },
    toAnchor: dy >= 0 ? { x: tc.x, y: toBB.y } : { x: tc.x, y: toBB.y + toBB.h },
    axis: "V",
  };
}
```

`axis` 戻り値は §2.3 の折れ点計算で利用する。

---

### 2.2 往復オフセット（L字往復フォールバック含む）

同一ペア間の往復（`A__to__B` と `B__to__A` が共存）はラベルや線が重ならないよう **`EDGE_OFFSET = 16px`（canonical-enums §9）で平行シフト**する。

- **直線 edge（`routing: straight`、canonical-enums §3）のみ対応**:
  - 法線方向に 16px シフト
  - 方向符号は stable_id の辞書順で固定（`e.from < e.to` なら +1、逆なら -1）
  - これにより 2 回目以降の再生成でも同じ方向にずれて idempotent
- **L字 edge（`routing: l-shape`）の往復**:
  - 当面は **片方を `routing: straight` にフォールバック** + 警告ログ + 警告フラグ書き込み
  - L字往復の正規対応（折れ点シフト + 中央セグメント分離）は Phase 2 の別 Issue として計画

> **警告フラグ書き込み先（明示）**: L字往復の片方を `routing: straight` にフォールバックする場合、対応する **edge group ノード**に `setSharedPluginData("einja.screenFlow", "label_collision_warning", "true")` を書き込む（manifest `edges[].label_collision_warning: true` と同期）。manifest を SSoT としつつ、Figma 側のフラグも併記して再生成時の冪等性を確保する。書き込み対象は VectorNode 単独ではなく、§3.4 で生成する edge group ノードに統一する。

```javascript
// 直線往復シフトの擬似コード
function applyRoundTripOffset(edge, fromAnchor, toAnchor) {
  const sign = edge.from < edge.to ? +1 : -1;
  const dx = toAnchor.x - fromAnchor.x;
  const dy = toAnchor.y - fromAnchor.y;
  const len = Math.hypot(dx, dy) || 1;
  // 線の法線（90度回転）
  const nx = -dy / len;
  const ny = dx / len;
  const shift = 16 * sign;
  return {
    fromAnchor: { x: fromAnchor.x + nx * shift, y: fromAnchor.y + ny * shift },
    toAnchor: { x: toAnchor.x + nx * shift, y: toAnchor.y + ny * shift },
  };
}
```

---

### 2.3 L字ルーティング（座標原点正規化）

L字 edge は **3 頂点（始点 + 折れ点 + 終点）** の VectorNode で描画する。`setVectorNetworkAsync` の `vertices` は VectorNode 自身の `(x, y)` を原点とした **相対座標** なので、絶対座標で計算してから origin 正規化する必要がある。

```javascript
const points = [fromAnchor, elbow, toAnchor];  // 絶対座標
const origin = {
  x: Math.min(...points.map(p => p.x)),
  y: Math.min(...points.map(p => p.y)),
};
const arrow = figma.createVector();
arrow.x = origin.x;
arrow.y = origin.y;
await arrow.setVectorNetworkAsync({
  vertices: points.map((p, i) => ({
    x: p.x - origin.x,
    y: p.y - origin.y,
    strokeCap: i === points.length - 1 ? "ARROW_LINES" : "NONE",
  })),
  segments: [{ start: 0, end: 1 }, { start: 1, end: 2 }],
  regions: [],
});
```

**L字判定**（canonical-enums §3 `routing` enum 参照）:
- lane を跨ぐ場合: `l-shape` 必須
- 同一 lane 内: 標準 320px 隣接でも `straight`（**L字判定を `|dy| > 0` に変更**）
- 同一 lane 内非隣接（飛び越え）: `|dx| > 2 * (FRAME_W + FRAME_SPACING_X)` で `l-shape` 許容

> **判定基準の SSoT**: 上記の L字判定条件は `canonical-enums.md §3 routing enum` を参照。本セクションの条件は SSoT の言い換えであり、矛盾時は canonical-enums.md を優先する。

**折れ点の計算**: §2.1 で得た `axis` に応じて以下を採用する。

| axis | elbow（折れ点） | 意味 |
|------|----------------|------|
| `"H"`（水平接続） | `{ x: toAnchor.x, y: fromAnchor.y }` | 始点の高さを維持して横移動 → 終点へ縦移動 |
| `"V"`（垂直接続） | `{ x: fromAnchor.x, y: toAnchor.y }` | 始点の横位置を維持して縦移動 → 終点へ横移動 |

---

### 2.4 ラベル衝突回避（6段階探索）

エッジラベル（TextNode）は **最長セグメントの中点をラベル基準点**とし、`LABEL_OFFSET = 8px`（canonical-enums §9）で線の **法線方向** にオフセットする。既存ラベルと bounding box が衝突する場合は **6段階の候補オフセット** を順に試す。

```javascript
const OFFSET_CANDIDATES = [+8, -8, +24, -24, +40, -40];  // 6段階
let placed = false;
for (const offset of OFFSET_CANDIDATES) {
  // bounding box 衝突チェック
  if (!hasCollision(labelBBox, existingLabels)) {
    label.x = baseX + offset * normalX;
    label.y = baseY + offset * normalY;
    placed = true;
    break;
  }
}
if (!placed) {
  // 不可時は警告フラグを edge group ノードに書き込む
  // （manifest-schema.md §1.3 edges[].label_collision_warning と key 名を完全一致させる）
  // findAll で node_kind === "edge" の group をスキャンして読めるようにするため、
  // VectorNode 単独ではなく group ノードを対象とする。
  group.setSharedPluginData("einja.screenFlow", "label_collision_warning", "true");
  console.warn(`Label collision unresolved: ${edge.stable_id}`);
}
```

- 直線 edge: セグメントが 1 本しかないので、そのまま中点を採用
- L字 edge: `|p0→p1|` と `|p1→p2|` を比較し、長い方の中点を採用
- `normalX, normalY` は採用セグメントの法線単位ベクトル

---

### 2.5 後方フロー検出

`edge_kind: back`（canonical-enums §2）の主判定条件:

1. **trigger テキストに以下のキーワードを含む**: `差し戻し` / `キャンセル` / `戻る` / `エラー` / `失敗`
2. **`x_order[to] < x_order[from]`**（§2.0 の topological sort 結果で判定）
   - **同一 lane 内のみ適用**、lane 跨ぎ業務遷移は除外

**完了系自動遷移の扱い**: trigger に「完了」「自動遷移」を含む lane 跨ぎ edge（例: `punch → dashboard`, `request → dashboard`）は `primary` を維持する。

#### dashPattern と stroke color の適用

dashPattern と strokes は **VectorNode に直接設定**する（GroupNode には dashPattern プロパティが存在しない）。

```javascript
// VectorNode に直接設定（GroupNode ではなく VectorNode）
arrow.dashPattern = edge.edge_kind === "back" ? [4, 4] : [];
arrow.strokes = [{
  type: "SOLID",
  color: edge.edge_kind === "back"
    ? { r: 0.6, g: 0.6, b: 0.6 }   // back: 薄グレー
    : { r: 0.3, g: 0.3, b: 0.3 },  // primary: 濃グレー
}];
arrow.strokeWeight = 2;
```

色値は canonical-enums §2 `edge_kind` enum の「視覚表現」列と一致させること。

---

## 3. 2 パス生成戦略

50000 字制限・出力 20kb 制限の双方を満たすため、**1 回の `use_figma` で全部描かず、パス 1（画面配置）/ パス 2（エッジ描画）に分離する**。

### 3.0 layout_strategy 分岐ロジック

パス 1 の冒頭で manifest の `layout_strategy`（canonical-enums §1）に応じて配置戦略を分岐する。未指定（v1 manifest）の場合は `grid` を暗黙適用し、後方互換を維持する。

```javascript
// パス1 の冒頭で layout_strategy に応じて分岐
const layoutStrategy = manifest.layout_strategy ?? "user-flow"; // v3 default
if (layoutStrategy === "user-flow") {
  // §3.3 user-flow 配置（v3 推奨デフォルト）へ
} else if (layoutStrategy === "swim-lane") {
  // §3.1 swim-lane 配置へ
} else {
  // §3.2 grid 配置（v1 legacy / fallback）へ
}
```

- `user-flow`: §3.3 へ。エントリ検出 + BFS 深さ算出 + 親中央値クラスタリングで自動配置（v3 推奨デフォルト）。
- `swim-lane`: §3.1 へ。role 別 lane を縦方向に並べ、画面は `lane_id` に応じて該当 lane 内に配置。x_order は §2.0 の topological sort 結果。
- `grid`: §3.2 へ。`cols = ceil(sqrt(N))` の格子配置（v1 後方互換）。

### 3.1 swim-lane レイアウト（role 軸明示時に採用）

`layout_strategy: swim-lane` で動作する戦略（role 軸を明示したい場合に採用）。role 別 lane を縦方向に積み上げ、画面 FrameNode を該当 lane 内に左から `x_order` 順で配置する。

#### lane 配置パラメータ

canonical-enums §9 を引用:

| 定数 | 値 | 用途 |
|------|-----|------|
| `LANE_HEIGHT` | 240px | 1 lane の縦方向占有 |
| `LANE_HEADER_W` | 160px | lane 左端のラベル領域 |
| `FRAME_W` | 240px | 画面 FrameNode 幅 |
| `FRAME_H` | 160px | 画面 FrameNode 高さ |
| `FRAME_SPACING_X` | 80px | 同一 lane 内の画面間隔 |
| `FRAME_SPACING_Y` | 40px | lane top と frame top のオフセット |

#### lane 順序

canonical-enums §5 引用、デフォルト固定: **`Common → Employee → Manager → HR → Admin → Ext`**

#### lane 描画コード

lane ラベル表示用に、manifest の `role_canonical_map`（`{ 表示名: canonical }` 形式）を転置した逆引きマップ `role_canonical_map_inverse`（`{ canonical: 表示名 }` 形式）を lane 描画直前に生成する。

```javascript
// canonical 識別子 → 表示名 の逆引きマップを生成
// role_canonical_map は { 表示名: canonical } 形式なので転置する
const role_canonical_map_inverse = Object.fromEntries(
  Object.entries(manifest.role_canonical_map ?? {}).map(([k, v]) => [v, k])
);

const LANE_DEFAULTS = [
  { id: "Common",   label: "共通",         color: { r: 0.95, g: 0.95, b: 0.95 } },
  { id: "Employee", label: "従業員",       color: { r: 0.92, g: 0.96, b: 0.99 } },
  { id: "Manager",  label: "上長/管理者",  color: { r: 0.98, g: 0.95, b: 0.90 } },
  { id: "HR",       label: "人事部",       color: { r: 0.94, g: 0.98, b: 0.92 } },
  { id: "Admin",    label: "システム管理者", color: { r: 0.97, g: 0.92, b: 0.97 } },
  { id: "Ext",      label: "外部利用者",   color: { r: 0.95, g: 0.95, b: 0.90 } },
];

// 使われている lane だけ描画（screens[].lane_id から集合算出）
const usedLanes = LANE_DEFAULTS.filter(l => screens.some(s => s.lane_id === l.id));
const totalW = Math.max(1600, screens.length * (240 + 80) + 160);

await figma.loadFontAsync({ family: "Inter", style: "Regular" });
for (let i = 0; i < usedLanes.length; i++) {
  const lane = usedLanes[i];
  const bg = figma.createFrame();
  bg.name = `lane-${lane.id}`;
  bg.resize(totalW, 240);
  bg.x = 0;
  bg.y = i * 240;
  bg.fills = [{ type: "SOLID", color: lane.color }];
  bg.locked = true;  // ユーザー誤操作防止
  writeNodeKind(bg, "lane");  // §4 ユーティリティ
  bg.setSharedPluginData("einja.screenFlow", "stable_id", `lane__${lane.id}`);
  bg.setSharedPluginData("einja.screenFlow", "business_role", lane.id);

  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Regular" };
  label.characters = role_canonical_map_inverse[lane.id] ?? lane.label;
  label.fontSize = 14;
  label.x = 16;
  label.y = i * 240 + 16;
  figma.currentPage.appendChild(bg);
  figma.currentPage.appendChild(label);
  bg.sendToBack();  // z-order: lane → screen → edge の順
}
```

#### screen frame 配置（lane 内 x_order に従う）

`x_order` は §2.0 topological sort 結果から取得。同一 lane 内では x_order の昇順、lane 間では canonical-enums §5 のデフォルト辞書順を維持する。

```javascript
// x_order は §2.0 topological sort 結果から取得
for (const screen of screens) {
  const laneIdx = usedLanes.findIndex(l => l.id === screen.lane_id);
  const frame = figma.createFrame();
  frame.name = `screen-${screen.name}`;
  frame.resize(240, 160);
  frame.x = LANE_HEADER_W + screen.x_order * (FRAME_W + FRAME_SPACING_X);
  frame.y = laneIdx * LANE_HEIGHT + FRAME_SPACING_Y;
  // ... fills/strokes/title 設定
  writeNodeKind(frame, "screen");
  frame.setSharedPluginData("einja.screenFlow", "stable_id", screen.stable_id);
  writeBusinessRole(frame, screen.lane_id);
  figma.currentPage.appendChild(frame);
}
```

#### multi-role 主 lane 判定

canonical-enums §5 を引用。複数 role を持つ画面の主 lane は次の順で決定する:

1. **manifest の明示 `lane_id` を最優先**: ヒアリング項目 A 等で確定済みの場合はそのまま採用
2. **Common 優先の特例画面のみ Common に寄せる**: `login` / `error` / `not-found-404` / `session-expired` / `forbidden-403` / `maintenance`
3. **それ以外の Common 含む multi-role 画面**: `in-degree + out-degree` 最多の業務ロール（Common 以外）を採用
4. 上記で決まらない場合は canonical-enums §5 のデフォルト辞書順で最も先のロールを採用

#### `inferLane` ヘルパー（v1 後方互換）

manifest に明示 `lane_id` がない v1 manifest や、role 文字列のみ提供された場合の fallback。

```javascript
function inferLane(roleDisplay, roleCanonicalMap) {
  if (!roleDisplay) return "Common";
  // 1. role_canonical_map ヒット
  if (roleCanonicalMap[roleDisplay]) return roleCanonicalMap[roleDisplay];
  // 2. canonical-enums §5 デフォルト辞書ヒット
  const defaultMap = {
    "共通": "Common",
    "従業員": "Employee", "一般従業員": "Employee", "利用者": "Employee",
    "上長": "Manager", "管理者": "Manager", "部門長": "Manager",
    "人事部": "HR", "人事担当": "HR",
    "システム管理者": "Admin", "情シス": "Admin", "管理": "Admin",
    "外部利用者": "Ext",
  };
  if (defaultMap[roleDisplay]) return defaultMap[roleDisplay];
  // 3. 辞書外: hash 動的生成
  return `Role_${simpleHash(roleDisplay).slice(0, 8)}`;
}
```

### 3.2 grid レイアウト（後方互換）

`layout_strategy: grid`（または未指定 v1 manifest）の場合の動作。**既存 v1 manifest を壊さないための後方互換経路** として維持する。新規生成では §3.3 user-flow を推奨（role 軸明示時は §3.1 swim-lane）。

- 全画面候補を `FrameNode` で配置する。名前は kebab-case（例: `"screen-dashboard"`, `"screen-login"`）。
- 格子レイアウト: 列数 `cols = ceil(sqrt(N))`、画面間隔 `200`〜`400px`（FrameNode サイズに応じて調整）。
- 各 FrameNode に **`setSharedPluginData` で識別情報を付与**:

```javascript
const cols = Math.ceil(Math.sqrt(screens.length));
for (let i = 0; i < screens.length; i++) {
  const screen = screens[i];
  const col = i % cols;
  const row = Math.floor(i / cols);
  const frame = figma.createFrame();
  frame.name = `screen-${screen.name}`;
  frame.resize(240, 160);
  frame.x = col * 320;
  frame.y = row * 220;
  writeNodeKind(frame, "screen");  // §4 ユーティリティ（旧 key `role` も自動で互換書き込み不要、新 key のみ）
  frame.setSharedPluginData(
    "einja.screenFlow",
    "stable_id",
    `${projectName}__screen-${screen.name}`,
  );
  figma.currentPage.appendChild(frame);
}
```

- パス 1 のレスポンスでは、オーケストレーター側で `{ stable_id: nodeId }` の Map を保持する（次バッチでの再解決に備える）。
- grid 経路では `lane_id` / `business_role` を書き込まない（v1 互換のため）。読み込み時に `business_role` が空ノードは `Common` 扱い。

### 3.3 user-flow レイアウト（v3 推奨デフォルト）

`layout_strategy: user-flow`（v3 デフォルト）で動作するレイアウト戦略。エントリ画面を自動検出し、BFS で各画面の深さを算出、親の y 中央値でクラスタリングすることで、フロー構造を直感的に可視化する。

canonical-enums §9 / §10 参照（定数・enum はそちらを SSoT とする）:

| 参照定数 | 値 | 用途 |
|----------|-----|------|
| `LEFT_MARGIN` (§9) | 80px | ページ左端からの余白 |
| `HORIZONTAL_GAP` (§9) | 160px | depth 間の水平ギャップ |
| `DEPTH_SPACING_X` (§9) | 400px | `FRAME_W + HORIZONTAL_GAP` に相当する depth 単位幅 |
| `VERTICAL_GAP` (§9) | 80px | 同 depth 内の縦間隔 |
| `ENTRY_STROKE_WEIGHT` (§9) | 4px | エントリ画面の枠線太さ |
| `ENTRY_FILL_COLOR` (§9) | `{r:0.96, g:0.98, b:1.0}` | エントリ画面の背景色 |
| `ENTRY_BADGE_W` (§9) | 56px | Entry バッジ幅 |
| `ENTRY_BADGE_H` (§9) | 20px | Entry バッジ高さ |
| `entry-detection-method` (§10) | 5 値 enum | エントリ検出手法の記録 |

#### 3.3.1 エントリ検出（3-method priority chain）

3 段階の優先度チェーンで最高位の結果のみを採用する（union 不要）。

```javascript
// method 1: manifest 明示（最優先）
const m1 = screens.filter(s => s.is_entry_point === true);
if (m1.length > 0) return { entries: m1, method: "manifest" };

// method 2: 名前 heuristics
const ENTRY_NAME_RE = /^(login|signin|sign-in|entry|top|landing|splash)(-|$)/i;
const m2 = screens.filter(s => ENTRY_NAME_RE.test(s.name));
if (m2.length > 0) return { entries: m2, method: "heuristics-name" };

// method 3: primary in-degree 0
const primaryEdges = edges.filter(e => e.edge_kind !== "back");
const inDegree = new Map(screens.map(s => [s.id, 0]));
primaryEdges.forEach(e => inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1));
const m3 = screens.filter(s => inDegree.get(s.id) === 0);
if (m3.length > 0) return { entries: m3, method: "topology-indegree-zero" };

// 全 0 件 → 項目F escalation
// AskUserQuestion でユーザー選択 → user-confirmed
// 拒否 → fallback-grid（manifest.layout_strategy = "grid" に書き換えて §3.2 へ）
```

method ごとの `entry-detection-method` enum 値（canonical-enums §10）:
- `manifest`: is_entry_point 明示
- `heuristics-name`: 名前パターン一致
- `topology-indegree-zero`: primary in-degree 0
- `user-confirmed`: ユーザー手動選択
- `fallback-grid`: grid にフォールバック

#### 3.3.2 BFS 深さ算出

- 入力: primary edges（`edge_kind !== "back"` フィルタ後）、**`status === "orphan"` 画面は BFS 対象から完全除外**（depth 計算・unreachable 配置の両方とも対象外）
- BFS でエントリ画面から各画面の `depth` を計算
- 同深さ tie-break: YAML `edges[]` 出現順
- cycle 対処: **BFS の `depthMap.has(e.to)` 訪問済みチェックがサイクルを防止する**。primary-DAG-only フィルタは back edge による無意味な深さ計算を除外する役割。残存 primary cycle は §2.0 既存ロジック（Tarjan SCC 結果の YAML 順 fallback）で SCC 内順序が決定される
- **reachable 不能ノード**: orphan 以外で primary edges から到達できない画面を `depth = maxDepth + 1` の集約グループに配置。グループ内 screen は y 軸に `VERTICAL_GAP=80px` で縦積み。ラベル「unreachable」付きの薄グレー帯として可視化（Phase 2 で確認 UI 追加予定）

```javascript
function calcDepths(entries, primaryEdges, screens) {
  // orphan status の画面は BFS 対象から完全除外（depth 計算・unreachable 配置の両方とも対象外）
  const activeScreens = screens.filter(s => s.status !== "orphan");

  const depthMap = new Map();
  const queue = [];
  entries.forEach(s => { depthMap.set(s.id, 0); queue.push(s.id); });

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depthMap.get(current);
    primaryEdges
      .filter(e => e.from === current && !depthMap.has(e.to))
      .forEach(e => {
        depthMap.set(e.to, currentDepth + 1);
        queue.push(e.to);
      });
  }

  // reachable 不能ノードを maxDepth + 1 に配置（orphan は activeScreens から除外済みのため対象外）
  const maxDepth = Math.max(0, ...depthMap.values());
  activeScreens.forEach(s => {
    if (!depthMap.has(s.id)) depthMap.set(s.id, maxDepth + 1);
  });

  return depthMap;
}
```

#### 3.3.3 親-中央値クラスタリング

**処理順序**: ① 各 screen の `tentativeY = clusterY(parent median)` を計算 → ② 同 depth グループの中央 y を parent median に合わせる **center-align ステップ**（`centerAlignAroundMedian`）→ ③ `resolveCollisions` で VERTICAL_GAP 下方シフトによる衝突回避（保険）。

center-align ステップにより、同 depth グループは parent median を中心とした **左右対称配置（上下対称）** になる（例: depth=2 の 5 screen で parent median y=240 の場合、各 screen は y = 80, 160, 240, 320, 400 に配置される）。

```javascript
// 親 set 定義（一意化）
// 親 = 「self.depth - 1」に位置する primary edge の入力ノード全件
// shortcut edge（複数 depth スキップ）は depth - 1 に該当しないため除外
// 引数化（テスト容易性・実装可読性向上のためクロージャ外参照を廃止）
function getParents(screen, primaryEdges, depthMap, screens) {
  return primaryEdges
    .filter(e => e.to === screen.id && depthMap.get(e.from) === depthMap.get(screen.id) - 1)
    .map(e => screens.find(s => s.id === e.from));
}

// y = median(parents.y)
// root（親なし）= 中央集合（root 群の y を画面領域中央に配置）
function clusterY(screen, primaryEdges, depthMap, placedY, screens) {
  const parents = getParents(screen, primaryEdges, depthMap, screens).filter(Boolean);
  if (parents.length === 0) {
    // root: 後で root 群全体を中央揃えするため 0 で仮置き
    return 0;
  }
  const ys = parents.map(p => placedY.get(p.id) ?? 0).sort((a, b) => a - b);
  const mid = Math.floor(ys.length / 2);
  return ys.length % 2 === 1 ? ys[mid] : (ys[mid - 1] + ys[mid]) / 2;
}

// center-align: 同 depth グループ内で、parent median = 中央 y となるよう各 screen の y を再分配
// 出現順は §3.3.2 で確定した tie-break（YAML edges[] 出現順、screens[] 配列の元 index で stable）に従う
function centerAlignAroundMedian(group, parentMedianY, VERTICAL_GAP) {
  const n = group.length;
  if (n === 0) return;
  const totalHeight = (n - 1) * VERTICAL_GAP;
  const startY = parentMedianY - totalHeight / 2;
  group.forEach((s, i) => { s.y = startY + i * VERTICAL_GAP; });
}

// 衝突回避（保険）: 同 depth 内で y が VERTICAL_GAP=80px 未満で重なる場合は stable sort で下方向シフト
// center-align で位置が確定するため理論的に衝突は発生しないが、shortcut edge による親-子間 depth スキップや
// parent median の重複等のエッジケースに備えた保険。VERTICAL_GAP のみで判定（FRAME_H は canonical-enums §9 を参照）。
function resolveCollisions(depthGroups, VERTICAL_GAP) {
  for (const [, group] of depthGroups) {
    // 出現順を維持した stable sort
    group.sort((a, b) => (a.tentativeY - b.tentativeY) || (a.order - b.order));
    for (let i = 1; i < group.length; i++) {
      const minY = group[i - 1].tentativeY + FRAME_H + VERTICAL_GAP;
      if (group[i].tentativeY < minY) group[i].tentativeY = minY;
    }
  }
}
```

**shortcut edge の扱い**: 複数 depth をスキップする shortcut edge（例: depth=0 → depth=3）の入力側ノードは parent set に含めない（`self.depth - 1` に該当しないため自動除外）。y 座標が視覚的に離れる副作用が生じうるが、Phase 1 では許容（force-directed post-processing は Phase 2 送り）。

#### 3.3.4 座標式

```
x = LEFT_MARGIN + depth * DEPTH_SPACING_X
  = 80 + depth * 400

y = clusterY（3.3.3 で計算。root 群は画面領域中央に事後補正）
```

```javascript
for (const screen of screens) {
  const depth = depthMap.get(screen.id);
  const frame = figma.createFrame();
  frame.name = `screen-${screen.name}`;
  frame.resize(FRAME_W, FRAME_H);
  frame.x = LEFT_MARGIN + depth * DEPTH_SPACING_X;  // 80 + depth * 400
  frame.y = placedY.get(screen.id);
  writeNodeKind(frame, "screen");
  frame.setSharedPluginData("einja.screenFlow", "stable_id", screen.stable_id);
  figma.currentPage.appendChild(frame);
}
```

#### 3.3.5 エントリビジュアル強調

エントリ画面の Frame に枠線・背景色・Entry バッジを付与する。

```javascript
// エントリ画面の Frame に対して
frame.strokes = [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 } }];
frame.strokeWeight = ENTRY_STROKE_WEIGHT; // 4px（canonical-enums §9）
frame.fills = [{ type: "SOLID", color: ENTRY_FILL_COLOR }]; // {r:0.96, g:0.98, b:1.0}（canonical-enums §9）
frame.setSharedPluginData("einja.screenFlow", "is_entry", "true");

// Entry バッジ TextNode を Frame 左上に配置
// badge.characters 設定前に await figma.loadFontAsync(badge.fontName) が必要（既存パターン踏襲）。
// エントリ強調バッチの先頭で一括 loadFontAsync を呼ぶこと
// （use_figma バッチ単位でフォントキャッシュ非保証のため、各バッチで再ロードが必要 §6 参照）。
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const badge = figma.createText();
badge.fontName = { family: "Inter", style: "Regular" };
badge.characters = "Entry";
badge.fontSize = 11;
badge.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 } }];
badge.resize(ENTRY_BADGE_W, ENTRY_BADGE_H); // 56 x 20（canonical-enums §9）
badge.x = frame.x + 8;
badge.y = frame.y + 8;
figma.currentPage.appendChild(badge);
```

#### 3.3.6 ヘルパー再利用

以下は §3.3 専用の変更不要で既存実装を流用する:

| ヘルパー | 定義場所 | 再利用内容 |
|---------|---------|----------|
| `pickAnchor(fromBB, toBB)` | §2.1 | 辺判定（最近辺マッチング） |
| `applyRoundTripOffset()` | §2.2 | 往復エッジの平行シフト |
| `writeNodeKind() / readNodeKind()` | §4 | Plugin Data Key の読み書き |

座標渡しのみ §3.3 で決定した値（`frame.x`, `frame.y`）に差し替えること。エッジ描画処理自体は §3.4 を再利用する（§3.3.8 参照）。

#### 3.3.7 Page 命名

- v3 SSoT page: `Screen-Flow-v3-userflow`
- v1/v2 旧 Page（`Screen-Flow-v1-grid`, `Screen-Flow-v2-swimlane` 等）は読取対象外（既存ロジック踏襲）

#### 3.3.8 エッジ描画は §3.4 を再利用

§3.4（旧 §3.3）の VectorNode + TextNode + Group 描画ロジックをそのまま再利用する。座標決定は §3.3.1〜3.3.5 で完結しており、エッジ描画時には FrameNode の `absoluteBoundingBox` を `pickAnchor` に渡すだけでよい。

#### 3.3.9 Phase 2 送り項目（v3 user-flow 関連）

以下は Phase 2 で追加予定の改善項目（本 Phase 1 では未実装）:

- **Tarjan SCC の明示的可視化**: SCC グループ描画 / バッジ表示 / 循環フロー通知 UI（§2.0 で内部利用済、ユーザー向け可視化は Phase 2）
- **force-directed post-processing**: edge-length 最適化（§3.3.3 shortcut edge による y 座標離散の緩和）
- **reachable 不能ノード確認 UI**: §3.3.2 の `unreachable` グループ帯に対する削除/承認確認 UI

---

### 3.4 パス 2: エッジ描画（矢印 + ラベル + グルーピング）

`layout_strategy` に依存しない共通処理。§3.1 / §3.2 / §3.3 で配置済みの FrameNode を `stable_id` で再解決し（§5）、各エッジを VectorNode + TextNode + Group で描画する。

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
writeNodeKind(group, "edge");  // §4 ユーティリティ（新 key `node_kind`）
// stable_id は manifest-schema.md §1.3 の edges[].stable_id 形式（`{from}__to__{to}`）に揃える
group.setSharedPluginData(
  "einja.screenFlow",
  "stable_id",
  `${fromName}__to__${toName}`,
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
  writeNodeKind(group, "edge");  // §4 ユーティリティ（新 key `node_kind`）
  // stable_id は manifest-schema.md §1.3 の edges[].stable_id 形式（`{from}__to__{to}`）に揃える
  group.setSharedPluginData(
    "einja.screenFlow",
    "stable_id",
    `${fromName}__to__${toName}`,
  );
  // ... 以下省略（ラベルあり経路と同じ後処理）
}
```

---

## 4. Plugin Data Key 移行

旧 v1 manifest 由来の Figma ファイルとの互換性確保のため、Plugin Data key を旧 → 新へ移行する。**書き込みは新 key のみ、読み込みは旧 key への fallback を許容**する。`manifest-schema.md §4` と同内容を Plugin API 視点で明記する。

### Key の対応

| 旧 key | 新 key | 値 | 意味 |
|-------|-------|----|------|
| `role` | `node_kind` | `screen` / `edge` / `lane` | ノード種別 |
| (なし) | `business_role` | `Common` / `Employee` / `Manager` / `HR` / `Admin` / `Ext` / `Role_xxxxxxxx` | 業務ロール canonical（canonical-enums §5） |

- 旧 key `role` は `screen` / `edge` の 2 値のみだったが、新 key `node_kind` では `lane` を追加した。
- `business_role` は v2 で新規追加（v1 manifest には存在しない）。

### 読み込み互換性ユーティリティ

新規実装ではこれらヘルパーを必ず経由すること（旧 key の直接参照は禁止）。

```javascript
function readNodeKind(node) {
  return node.getSharedPluginData("einja.screenFlow", "node_kind")
    || node.getSharedPluginData("einja.screenFlow", "role")  // 旧 key fallback
    || null;
}
function writeNodeKind(node, kind) {
  node.setSharedPluginData("einja.screenFlow", "node_kind", kind);
}
function readBusinessRole(node) {
  return node.getSharedPluginData("einja.screenFlow", "business_role") || null;
}
function writeBusinessRole(node, canonicalRole) {
  node.setSharedPluginData("einja.screenFlow", "business_role", canonicalRole);
}
```

- `readNodeKind`: 新 key 優先、なければ旧 key で fallback、両方なければ `null`
- `writeNodeKind`: **新 key のみ書き込み**（旧 key への二重書き込みは行わない）
- `readBusinessRole`: 新 key のみ参照（v1 manifest には存在しないため fallback 不要）。null の場合は呼び出し側で `Common` 扱い等のデフォルトを適用
- `writeBusinessRole`: 新 key に canonical role を書き込む

### findAll フィルタ条件

旧実装と新実装でフィルタ式を以下のように差し替える:

- **旧**: `node.getSharedPluginData("einja.screenFlow", "role") === "screen"`
- **新**: `readNodeKind(node) === "screen"` （旧 key も自動 fallback）

```javascript
// 例: screen ノードを全列挙
const screens = figma.currentPage.findAll(n => readNodeKind(n) === "screen");

// 例: lane ノードを全列挙
const lanes = figma.currentPage.findAll(n => readNodeKind(n) === "lane");

// 例: 特定 lane に属する screen を列挙
const employeeScreens = figma.currentPage.findAll(n =>
  readNodeKind(n) === "screen" && readBusinessRole(n) === "Employee"
);
```

### 移行時の注意

- 旧 v1 manifest 由来の既存ノードは `role` のみ持つ。再生成時、新 key `node_kind` を追加書き込みすれば次回以降は新 key が優先される（旧 key 削除は不要、無視される）。
- `business_role` 未設定の screen は §3.2 grid レイアウトの後方互換経路で生成されたものとみなし、再描画時に `inferLane`（§3.1）で補完する。

---

## 5. setSharedPluginData による nodeId 再解決

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
// Figma Plugin API 公式仕様: findAll はコールバックが true を返したノードの配列を返す。
// 副作用で idMap に集約しつつ、戻り値で対象ノードの配列も取得する正攻法。
const found = figma.currentPage.findAll((n) => {
  const sid = n.getSharedPluginData("einja.screenFlow", "stable_id");
  if (targets.has(sid)) idMap.set(sid, n);
  return targets.has(sid);  // 仕様準拠、戻り値も活用
});
// 各エッジで idMap.get(stable_id) を使用
```

---

## 6. use_figma の入出力制限と動的バッチ分割

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

- パス 1 完了後に得た `{stable_id, nodeId}` Map は **JS 側にも保持するが、パス 2 では `findAll` で再解決**（§5）。
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

## 7. LineNode 代替経路（フォールバック・将来用）

### 7-1. 将来 LineNode が頂点別 strokeCap をサポートした場合

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

### 7-2. 矢印を諦めて双方向で代用する場合

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

## 8. エラー処理パターン

| 事象 | 原因 | 対処 |
|------|------|------|
| `loadFontAsync` 失敗 | フォントがファイルに含まれない | `Inter Regular` → `Roboto Regular` → `figma.listAvailableFontsAsync()` 先頭 の順でフォールバック |
| `planKey` 不明 | 認証直後で context 未取得 | `mcp__claude_ai_Figma__whoami` を呼び直し planKey を取得し直す |
| `code` 文字列が 50000 字超 | エッジが多い / ラベルが長い | §6 の動的分割で 40000 字閾値を 30000 字まで下げて再試行 |
| 出力 20kb 超 | 戻り値で大量配列を返している | バッチ末尾で件数・最後の `stable_id` のみ返す形に整形 |
| `setVectorNetworkAsync` で頂点座標エラー | 始点と終点が同一座標 | 構築前に `dx === 0 && dy === 0` を弾く（同一画面遷移は無効） |
| `findAll` で `stable_id` 0 件 | パス 1 の書き込み失敗 / namespace 不一致 | namespace が `"einja.screenFlow"` か確認、必要なら名前ベース fallback（同名衝突警告付き） |
| グループ作成失敗 | 子ノードが既に別の親に属している | `appendChild` の二重実行を疑い、構築済みフラグを JS 側で管理 |
