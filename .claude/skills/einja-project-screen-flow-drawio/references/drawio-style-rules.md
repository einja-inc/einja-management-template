# drawio スタイルルール

SKILL.md ワークフロー **Step 6（drawio XML テンプレート生成）/ Step 7（Pass1 画面配置）/ Step 8（Pass2 エッジ描画）/ Step 9（確認）/ Step 11（冪等性照合）** から参照される、画面遷移図の drawio XML 生成パターン集。drawio mxCell / mxGeometry / style 属性を使って「画面ノード + 矢印エッジ + ラベル + lane 背景」を冪等に生成するための実装パターン・スタイル定義・レイアウト戦略をまとめる。

## 目次

1. [drawio XML 基本構造](#1-drawio-xml-基本構造)
2. [エッジ処理](#2-エッジ処理)
3. [layout_strategy 分岐](#3-layout_strategy-分岐)
4. [drawio スタイル定義](#4-drawio-スタイル定義)
5. [ラベル配置](#5-ラベル配置)
6. [冪等性照合（cell_id ベース）](#6-冪等性照合cell_id-ベース)
7. [Phase 2 送り項目（歴史的注釈）](#7-phase-2-送り項目歴史的注釈)

---

## 1. drawio XML 基本構造

### 1.1 ネスト構造

drawio XML は以下のネスト構造を持つ。

```xml
<mxfile>
  <diagram name="Screen-Flow-v3-userflow">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- 以降にすべての vertex / edge の mxCell を挿入 -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

- `mxCell id="0"` はルートセル（必須、変更禁止）
- `mxCell id="1" parent="0"` はデフォルトレイヤーセル（必須）
- すべての画面・エッジ・lane 背景は `parent="1"` で挿入する

### 1.2 vertex と edge の区別

| 種別 | 属性 | 用途 |
|------|------|------|
| vertex | `vertex="1"` | 画面ノード / lane 背景矩形 |
| edge | `edge="1" source="srcId" target="tgtId"` | 遷移矢印 |

```xml
<!-- vertex 例 -->
<mxCell id="screen__dashboard" value="ダッシュボード" vertex="1" parent="1"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666">
  <mxGeometry x="480" y="160" width="240" height="160" as="geometry"/>
</mxCell>

<!-- edge 例 -->
<mxCell id="edge__login__to__dashboard" value="ログイン成功" edge="1"
        source="screen__login" target="screen__dashboard" parent="1"
        style="endArrow=classic;strokeColor=#4D4D4D;strokeWidth=2;edgeStyle=orthogonalEdgeStyle">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### 1.3 mxGeometry

| 用途 | 属性 | 説明 |
|------|------|------|
| vertex | `x, y, width, height` | 絶対座標・サイズ（px）|
| edge | `relative="1"` | エッジはソース・ターゲット間を drawio router が自動計算 |
| edge waypoints（Phase 2） | `<Array as="points"><mxPoint x= y=/></Array>` | 手動折れ点（Phase 1 では使用しない） |

### 1.4 style 属性

style はセミコロン区切りの `key=value` 形式で記述する。

```
style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666"
```

末尾のセミコロンは有無いずれでも動作するが、一貫性のため **末尾セミコロン省略** を推奨。

### 1.5 id 生成規約（cell_id SSoT）

> **SSoT**: `cell_id` の命名規則はこのセクションが唯一の正式定義。SKILL.md 内の `cell_id` 言及および manifest-schema.md 内の `cell_id` フィールド説明は、このセクションを参照すること。

- cell_id は manifest の `stable_id` と 1:1 対応させる
- **manifest 内の stable_id は変更しない**（cell_id 変換はレンダリング時のみ）
- stable_id に含まれる `:`, `/` 以外にも `<`, `>`, `&`, `"`, `'`, 空白、制御文字が XML 属性として不正。日本語サブ識別子や将来の業務ロール表示名にコロン/スラッシュが入る可能性も防御するため、非 ASCII および XML 特殊文字を `__` に一括置換する

```javascript
function toCellId(stableId) {
  // drawio XML attribute として安全な文字のみ保持。残りは __ に置換
  return String(stableId)
    .replace(/[^A-Za-z0-9_\-]/g, "__")   // 非ASCII / XML特殊文字を一括置換
    .replace(/^([0-9\-])/, "_$1");        // 先頭が数字/ハイフンの場合は防御（XML Name 仕様）
}
// 例: "attendance-saas:screen/login" → "attendance-saas__screen__login"
```

**cell_id 命名規則**（drawio エディタでの可読性のため stable_id の project_name プレフィックスは省略した短縮形を採用）:

画面の cell_id 命名:
- 形式: `cell_id = toCellId("screen__" + simpleSuffix(stable_id))`
- 例: stable_id `{project_name}__screen__login` → cell_id `screen__login`
- 例: stable_id `dashboard` → cell_id `screen__dashboard`
- 例: stable_id `attendance:punch` → cell_id `screen__attendance__punch`

エッジの cell_id 命名:
- 形式: `cell_id = toCellId("edge__" + from_suffix + "__to__" + to_suffix)`
- 例: stable_id `login__to__dashboard` → cell_id `edge__login__to__dashboard`

### 1.6 z-order 戦略

drawio は **root への mxCell 挿入順で z-order が決まる**（後から挿入したものが上に表示される）。

> **用語補足**: drawio は明示的な z-index プロパティを持たず、document order（mxCell の root への挿入順）で表示の重なりが決まる。本 doc では便宜的に「z-order」と呼ぶが、正確には「display order」である。

**必須**: lane 背景 mxCell は画面 mxCell より先に root に挿入すること。

```
挿入順（前が下、後が上）:
1. lane 背景 mxCell（最背面）
2. 画面 mxCell（中間層）
3. エッジ mxCell（最前面）
```

これにより、lane 背景が画面ノードで隠れる問題を防ぐ。

### 1.7 XML 値エスケープ

drawio XML の `mxCell` 属性値（`value=`, `style=`, `id=` 等）にユーザーデータや動的な値を挿入する際は、必ず以下のヘルパー関数でエスケープすること。これを怠ると XML 構造が破壊され、drawio でファイルが開けなくなる。

```javascript
function xmlAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
```

**適用規約**: §3.1 lane label / §3.3.4 screen label / §3.3.5 entry バッジ `value=` / §3.3.8 エッジ `value=` の全 XML 構築サンプルで、`mxCell` の `value=`, `style=`, `id=` に動的な値を注入する際は必ず `xmlAttr()` でラップする。

---

## 2. エッジ処理

### 2.0 処理順序（cycle 対応）

エッジ単位の座標計算（drawio router 任せ）に先立ち、**全 edges を一括スキャンして primary/back を確定**してから topological sort で `x_order` を決める。これは cycle（A→B→A 等）が存在しても落ちないようにするための前処理であり、style 付与前に edge_kind が確定している必要がある。

```
1. 全 edges について「暫定 back 判定」を先行実施
   - trigger テキストに「差し戻し」「キャンセル」「戻る」「エラー」「失敗」含む → back
   - その他は primary 候補
2. primary 候補のみで topological sort
   - cycle 検出時は Tarjan's SCC 分解、各 SCC 内は「入力順 = manifest edges 配列の記載順（YAML 出現順）」で fallback
   - sort 結果で x_order を確定
3. 確定後、追加判定: x_order[to] < x_order[from] → back（同一 lane 内のみ適用、lane 跨ぎは除外）
4. final edge_kind 決定後、mxCell style 付与（§4 スタイル定義参照）へ
```

**完了系自動遷移の扱い**: trigger に「完了」「自動遷移」を含む lane 跨ぎ edge（例: `punch → dashboard`, `request → dashboard`）は `primary` を維持する（§2.5 と整合）。

---

### 2.1〜2.4 削除（drawio router が自動処理）

旧 §2.1（辺判定 pickAnchor）/ §2.2（往復オフセット）/ §2.3（L字ルーティング）/ §2.4（ラベル衝突回避）は drawio 化により不要になった。

| 旧処理 | drawio での対応 |
|--------|----------------|
| 辺判定（pickAnchor） | `edgeStyle=orthogonalEdgeStyle` で drawio router が自動選択 |
| 往復オフセット 16px | drawio router が自動的に往復 edge を分離して描画 |
| L字ルーティング 3頂点計算 | `edgeStyle=orthogonalEdgeStyle;curved=0` 一行で完結 |
| ラベル衝突回避 6段階探索 | edge の `value` 属性を線中央に drawio が自動配置 |

**Phase 1 では drawio router 任せ。Phase 2 で手動 elbow 復活検討**（旧 §2.3 の waypoints XML 化は §7 参照）。

---

### 2.5 後方フロー検出

`edge_kind: back`（canonical-enums §2）の主判定条件:

1. **trigger テキストに以下のキーワードを含む**: `差し戻し` / `キャンセル` / `戻る` / `エラー` / `失敗`
2. **`x_order[to] < x_order[from]`**（§2.0 の topological sort 結果で判定）
   - **同一 lane 内のみ適用**、lane 跨ぎ業務遷移は除外

**完了系自動遷移の扱い**: trigger に「完了」「自動遷移」を含む lane 跨ぎ edge は `primary` を維持する。

#### back エッジのスタイル適用

edge_kind に応じて mxCell の style を切り替える。

```javascript
const edgeStyle = edge.edge_kind === "back"
  ? "endArrow=classic;dashed=1;strokeColor=#999999;strokeWidth=2;edgeStyle=orthogonalEdgeStyle"
  : "endArrow=classic;strokeColor=#4D4D4D;strokeWidth=2;edgeStyle=orthogonalEdgeStyle";
```

色値は canonical-enums §2 `edge_kind` enum の「視覚表現」列と一致させること。

---

## 3. layout_strategy 分岐

### 3.0 分岐ロジック

Pass1（画面配置）の冒頭で manifest の `layout_strategy`（canonical-enums §1）に応じて配置戦略を分岐する。未指定（v1 manifest）の場合は `grid` を暗黙適用し、後方互換を維持する。

```javascript
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

---

### 3.1 swim-lane レイアウト（role 軸明示時に採用）

> **注意**: 本セクションの座標式は `layout_strategy === 'swim-lane'` 時のみ有効。canonical-enums.md §9 参照。

`layout_strategy: swim-lane` で動作する戦略。role 別 lane を縦方向に積み上げ、画面を該当 lane 内に左から `x_order` 順で配置する。

#### lane 配置パラメータ

canonical-enums §9 を引用:

| 定数 | 値 | 用途 |
|------|-----|------|
| `LANE_HEIGHT` | 240px | 1 lane の縦方向占有 |
| `LANE_HEADER_W` | 160px | lane 左端のラベル領域 |
| `FRAME_W` | 240px | 画面 mxCell 幅 |
| `FRAME_H` | 160px | 画面 mxCell 高さ |
| `FRAME_SPACING_X` | 80px | 同一 lane 内の画面間隔 |
| `FRAME_SPACING_Y` | 40px | lane top と frame top のオフセット |

#### lane 順序

canonical-enums §5 引用、デフォルト固定: **`Common → Employee → Manager → HR → Admin → Ext`**

#### lane 描画コード（drawio mxCell 背景矩形）

lane ラベル表示用に、manifest の `role_canonical_map`（`{ 表示名: canonical }` 形式）を転置した逆引きマップ `role_canonical_map_inverse`（`{ canonical: 表示名 }` 形式）を lane 描画直前に生成する。

```javascript
const role_canonical_map_inverse = Object.fromEntries(
  Object.entries(manifest.role_canonical_map ?? {}).map(([k, v]) => [v, k])
);

const LANE_DEFAULTS = [
  { id: "Common",   label: "共通",           color: "#F2F2F2" },
  { id: "Employee", label: "従業員",         color: "#EBF5FF" },
  { id: "Manager",  label: "上長/管理者",    color: "#FFF8F0" },
  { id: "HR",       label: "人事部",         color: "#F0FAF0" },
  { id: "Admin",    label: "システム管理者", color: "#F8F0FA" },
  { id: "Ext",      label: "外部利用者",     color: "#FAFAF0" },
];

// 使われている lane だけ描画（screens[].lane_id から集合算出）
const usedLanes = LANE_DEFAULTS.filter(l => screens.some(s => s.lane_id === l.id));
const totalW = Math.max(1600, screens.length * (240 + 80) + 160);

const laneCells = [];
for (let i = 0; i < usedLanes.length; i++) {
  const lane = usedLanes[i];
  const laneLabel = role_canonical_map_inverse[lane.id] ?? lane.label;
  // §1.6 z-order 戦略: lane 背景は画面より先に挿入（最背面）
  laneCells.push(`
<mxCell id="${xmlAttr(`lane__${lane.id}`)}" value="${xmlAttr(laneLabel)}" vertex="1" parent="1"
        style="rounded=0;fillColor=${xmlAttr(lane.color)};opacity=40;strokeColor=none;fontSize=14;verticalAlign=top;align=left;spacingLeft=16">
  <mxGeometry x="0" y="${i * 240}" width="${totalW}" height="240" as="geometry"/>
</mxCell>`);
}
// XML 生成時: laneCells を screenCells より先に root に追加すること（z-order 厳守）
```

#### screen mxCell 配置（lane 内 x_order に従う）

`x_order` は §2.0 topological sort 結果から取得する。

```javascript
const screenCells = [];
for (const screen of screens) {
  const laneIdx = usedLanes.findIndex(l => l.id === screen.lane_id);
  const cellId = toCellId(`screen__${screen.stable_id}`);
  const style = screen.is_entry_point
    ? "rounded=1;whiteSpace=wrap;html=1;fillColor=#F5FAFF;strokeColor=#3366CC;strokeWidth=4"
    : "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666";
  const x = LANE_HEADER_W + screen.x_order * (FRAME_W + FRAME_SPACING_X);
  const y = laneIdx * LANE_HEIGHT + FRAME_SPACING_Y;

  screenCells.push(`
<mxCell id="${cellId}" value="${screen.label ?? screen.name}" vertex="1" parent="1" style="${style}">
  <mxGeometry x="${x}" y="${y}" width="${FRAME_W}" height="${FRAME_H}" as="geometry"/>
</mxCell>`);
}
```

#### multi-role 主 lane 判定

canonical-enums §5 を引用。複数 role を持つ画面の主 lane は次の順で決定する:

1. **manifest の明示 `lane_id` を最優先**
2. **Common 優先の特例画面のみ Common に寄せる**: `login` / `error` / `not-found-404` / `session-expired` / `forbidden-403` / `maintenance`
3. **それ以外の Common 含む multi-role 画面**: `in-degree + out-degree` 最多の業務ロール（Common 以外）を採用
4. 上記で決まらない場合は canonical-enums §5 のデフォルト辞書順で最も先のロールを採用

#### `inferLane` ヘルパー（v1 後方互換）

manifest に明示 `lane_id` がない v1 manifest や、role 文字列のみ提供された場合の fallback。

```javascript
function inferLane(roleDisplay, roleCanonicalMap) {
  if (!roleDisplay) return "Common";
  if (roleCanonicalMap[roleDisplay]) return roleCanonicalMap[roleDisplay];
  const defaultMap = {
    "共通": "Common",
    "従業員": "Employee", "一般従業員": "Employee", "利用者": "Employee",
    "上長": "Manager", "管理者": "Manager", "部門長": "Manager",
    "人事部": "HR", "人事担当": "HR",
    "システム管理者": "Admin", "情シス": "Admin", "管理": "Admin",
    "外部利用者": "Ext",
  };
  if (defaultMap[roleDisplay]) return defaultMap[roleDisplay];
  return `Role_${simpleHash(roleDisplay).slice(0, 8)}`;
}
```

---

### 3.2 grid レイアウト（後方互換）

`layout_strategy: grid`（または未指定 v1 manifest）の場合の動作。**既存 v1 manifest を壊さないための後方互換経路** として維持する。新規生成では §3.3 user-flow を推奨（role 軸明示時は §3.1 swim-lane）。

```javascript
const cols = Math.ceil(Math.sqrt(screens.length));
const screenCells = [];
for (let i = 0; i < screens.length; i++) {
  const screen = screens[i];
  const col = i % cols;
  const row = Math.floor(i / cols);
  const cellId = toCellId(`screen__${screen.stable_id}`);

  screenCells.push(`
<mxCell id="${cellId}" value="${screen.label ?? screen.name}" vertex="1" parent="1"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666">
  <mxGeometry x="${col * 320}" y="${row * 220}" width="240" height="160" as="geometry"/>
</mxCell>`);
}
```

- grid 経路では `lane_id` / 背景矩形は生成しない（v1 互換のため）
- 各 mxCell に `cell_id` と `stable_id` の対応を manifest に記録すること

---

### 3.3 user-flow レイアウト（v3 推奨デフォルト）

> **注意**: 本セクションの座標式は `layout_strategy === 'user-flow'` 時のみ有効。canonical-enums.md §9 参照。

`layout_strategy: user-flow`（v3 デフォルト）で動作するレイアウト戦略。エントリ画面を自動検出し、BFS で各画面の深さを算出、親の y 中央値でクラスタリングすることで、フロー構造を直感的に可視化する。

canonical-enums §9 / §10 参照（定数・enum はそちらを SSoT とする）:

| 参照定数 | 値 | 用途 |
|----------|-----|------|
| `LEFT_MARGIN` (§9) | 80px | ページ左端からの余白 |
| `HORIZONTAL_GAP` (§9) | 160px | depth 間の水平ギャップ |
| `DEPTH_SPACING_X` (§9) | 400px | `FRAME_W + HORIZONTAL_GAP` に相当する depth 単位幅 |
| `VERTICAL_GAP` (§9) | 80px | 同 depth 内の縦間隔 |
| `ENTRY_STROKE_WEIGHT` (§9) | 4px | エントリ画面の枠線太さ |
| `ENTRY_FILL_COLOR` (§9) | `#F5FAFF` | エントリ画面の背景色（drawio hex 表記） |
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
  // orphan status の画面は BFS 対象から完全除外
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

```javascript
function getParents(screen, primaryEdges, depthMap, screens) {
  return primaryEdges
    .filter(e => e.to === screen.id && depthMap.get(e.from) === depthMap.get(screen.id) - 1)
    .map(e => screens.find(s => s.id === e.from));
}

function clusterY(screen, primaryEdges, depthMap, placedY, screens) {
  const parents = getParents(screen, primaryEdges, depthMap, screens).filter(Boolean);
  if (parents.length === 0) return 0;
  const ys = parents.map(p => placedY.get(p.id) ?? 0).sort((a, b) => a - b);
  const mid = Math.floor(ys.length / 2);
  return ys.length % 2 === 1 ? ys[mid] : (ys[mid - 1] + ys[mid]) / 2;
}

function centerAlignAroundMedian(group, parentMedianY, VERTICAL_GAP) {
  const n = group.length;
  if (n === 0) return;
  const totalHeight = (n - 1) * VERTICAL_GAP;
  const startY = parentMedianY - totalHeight / 2;
  group.forEach((s, i) => { s.y = startY + i * VERTICAL_GAP; });
}

function resolveCollisions(depthGroups, VERTICAL_GAP) {
  for (const [, group] of depthGroups) {
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
const screenCells = [];
for (const screen of screens) {
  const depth = depthMap.get(screen.id);
  const cellId = toCellId(`screen__${screen.stable_id}`);
  const x = 80 + depth * 400;
  const y = placedY.get(screen.id);
  const style = screen.is_entry_point
    ? "rounded=1;whiteSpace=wrap;html=1;fillColor=#F5FAFF;strokeColor=#3366CC;strokeWidth=4"
    : "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666";

  screenCells.push(`
<mxCell id="${xmlAttr(cellId)}" value="${xmlAttr(screen.label ?? screen.name)}" vertex="1" parent="1" style="${xmlAttr(style)}">
  <mxGeometry x="${x}" y="${y}" width="240" height="160" as="geometry"/>
</mxCell>`);
}
```

#### 3.3.5 エントリビジュアル強調

エントリ画面は style で枠線・背景色を付与する。drawio ではバッジは別 vertex mxCell として生成する。

```javascript
// エントリバッジ mxCell（エントリ画面の左上に重ねて配置）
const badgeCellId = `${cellId}__entry_badge`;
screenCells.push(`
<mxCell id="${xmlAttr(badgeCellId)}" value="Entry" vertex="1" parent="1"
        style="rounded=1;fillColor=#3366CC;fontColor=#FFFFFF;strokeColor=none;fontSize=11;align=center">
  <mxGeometry x="${x + 8}" y="${y + 8}" width="56" height="20" as="geometry"/>
</mxCell>`);
```

drawio style で `fillColor=#F5FAFF;strokeColor=#3366CC;strokeWidth=4` を指定することで枠線強調を表現する（§4 スタイル定義参照）。

#### 3.3.6 ヘルパー再利用

以下は §3.3 専用の変更不要で既存実装を流用する:

| ヘルパー | 定義場所 | 再利用内容 |
|---------|---------|----------|
| `toCellId(stableId)` | §1.5 | stable_id → cell_id 変換 |
| `inferLane(roleDisplay, roleCanonicalMap)` | §3.1 | lane 判定（swim-lane との併用時） |
| `writeNodeKind()` 相当 | 不要 | drawio では mxCell の style 属性で種別を表現 |

旧 Figma API 由来の `pickAnchor` / `applyRoundTripOffset` は drawio 化により削除済み。drawio router が自動処理する。

#### 3.3.7 diagram 命名

drawio は単一 diagram（Page 概念なし）を使用する。

- diagram name: `Screen-Flow-v3-userflow`
- v1/v2 旧 Page 相当は存在しない（drawio は 1 ファイル 1 diagram が基本）

Figma 時代の Page 命名（`Screen-Flow-v1-grid`, `Screen-Flow-v2-swimlane`）は歴史的記録として §7 に記載。

#### 3.3.8 エッジ描画（§4 スタイル定義参照）

エッジ mxCell の生成は layout_strategy に依存しない共通処理。§3.1 / §3.2 / §3.3 で決定した画面 cell_id を source / target に指定する。

```javascript
const edgeCells = [];
for (const edge of edges) {
  const cellId = toCellId(`edge__${edge.stable_id}`);
  const srcId = toCellId(`screen__${edge.from}`);
  const tgtId = toCellId(`screen__${edge.to}`);
  const style = edge.edge_kind === "back"
    ? "endArrow=classic;dashed=1;strokeColor=#999999;strokeWidth=2;edgeStyle=orthogonalEdgeStyle"
    : "endArrow=classic;strokeColor=#4D4D4D;strokeWidth=2;edgeStyle=orthogonalEdgeStyle";
  const label = edge.trigger ?? "";

  edgeCells.push(`
<mxCell id="${xmlAttr(cellId)}" value="${xmlAttr(label)}" edge="1"
        source="${xmlAttr(srcId)}" target="${xmlAttr(tgtId)}" parent="1" style="${xmlAttr(style)}">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>`);
}
// XML 生成時: edgeCells は screenCells の後に追加（z-order 上位）
```

#### 3.3.9 Phase 2 送り項目（v3 user-flow 関連）

以下は Phase 2 で追加予定の改善項目（Phase 1 では未実装）:

- **Tarjan SCC の明示的可視化**: SCC グループ描画 / バッジ表示 / 循環フロー通知 UI
- **force-directed post-processing**: edge-length 最適化（§3.3.3 shortcut edge による y 座標離散の緩和）
- **reachable 不能ノード確認 UI**: §3.3.2 の `unreachable` グループ帯に対する削除/承認確認 UI

---

## 4. drawio スタイル定義

### 4.1 画面ノード（vertex）

| 種別 | style 文字列 |
|------|-------------|
| screen（normal） | `rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666` |
| screen（entry、login 等） | `rounded=1;whiteSpace=wrap;html=1;fillColor=#F5FAFF;strokeColor=#3366CC;strokeWidth=4` |
| entry バッジ | `rounded=1;fillColor=#3366CC;fontColor=#FFFFFF;strokeColor=none;fontSize=11;align=center` |

### 4.2 lane 背景（vertex）

lane_id ごとの fillColor マッピング:

| lane_id | fillColor | label |
|---------|-----------|-------|
| `Common` | `#F2F2F2` | 共通 |
| `Employee` | `#EBF5FF` | 従業員 |
| `Manager` | `#FFF8F0` | 上長/管理者 |
| `HR` | `#F0FAF0` | 人事部 |
| `Admin` | `#F8F0FA` | システム管理者 |
| `Ext` | `#FAFAF0` | 外部利用者 |

lane 背景の style:
```
rounded=0;fillColor=<lane_color>;opacity=40;strokeColor=none;fontSize=14;verticalAlign=top;align=left;spacingLeft=16
```

### 4.3 エッジ（edge）

| 種別 | style 文字列 |
|------|-------------|
| edge primary | `endArrow=classic;strokeColor=#4D4D4D;strokeWidth=2;edgeStyle=orthogonalEdgeStyle` |
| edge back | `endArrow=classic;dashed=1;strokeColor=#999999;strokeWidth=2;edgeStyle=orthogonalEdgeStyle` |
| edge l-shape（明示指定時） | 上記 + `curved=0`（`edgeStyle=orthogonalEdgeStyle;curved=0`） |

### 4.4 使用しないスタイル

以下は drawio では不要（削除済み）:
- `ARROW_LINES` / `ARROW_EQUILATERAL` / `TRIANGLE_FILLED` 等の Figma StrokeCap 値
- `dashPattern` プロパティ（drawio では `dashed=1` で表現）
- `strokeWeight` プロパティ（drawio では `strokeWidth` で表現）

---

## 5. ラベル配置

drawio ではすべてのラベルを mxCell の `value` 属性で設定する。

### 5.1 vertex（画面ノード）のラベル

`value` 属性に設定した文字列が矩形中央に自動配置される。

```xml
<mxCell id="screen__login" value="ログイン" vertex="1" parent="1"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666">
  <mxGeometry x="80" y="160" width="240" height="160" as="geometry"/>
</mxCell>
```

### 5.2 edge のラベル

`value` 属性に設定した文字列が線の中央に自動配置される。手動オフセット不要。

```xml
<mxCell id="edge__login__to__dashboard" value="ログイン成功" edge="1"
        source="screen__login" target="screen__dashboard" parent="1"
        style="endArrow=classic;strokeColor=#4D4D4D;strokeWidth=2;edgeStyle=orthogonalEdgeStyle">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### 5.3 削除された概念

以下は Figma 時代の実装で、drawio では不要:

- `LABEL_OFFSET`（8px オフセット計算）
- 6段階の衝突回避探索
- `TextNode` の手動配置（`label.x = baseX + offset * normalX` 等）
- `loadFontAsync`（フォント管理）

---

## 6. 冪等性照合（cell_id ベース）

再生成時に既存の手動編集（position 調整等）を保持するための照合ロジック。

### 6.1 既存 `.drawio` の読み込みと cell_id 抽出

`cellId` が正規表現メタ文字を含む可能性・属性順序の入れ替わり・属性値内 `/` の存在・`parent="..."` などの派生属性への誤マッチを防御するため、`escapeRegExp` と `\bid=` ワードバウンダリを使用する。

```javascript
// 既存 .drawio ファイルを Read ツールで読み込み
const existingXml = await readFile(manifest.drawio_file_path);

// 正規表現メタ文字をエスケープするヘルパー
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 全 id を \bid= パターンで抽出（属性順序不問、誤マッチ防御）
const idPattern = /\bid="([^"]+)"/g;
const existingIds = new Set();
let match;
while ((match = idPattern.exec(existingXml)) !== null) {
  const id = match[1];
  if (id !== "0" && id !== "1") existingIds.add(id);
}
```

Phase 1 では正規表現で十分（drawio XML は単純な構造）。Phase 2 で DOMParser 化検討（§7 参照）。

### 6.2 manifest の cell_id との突合

```javascript
// manifest から期待される cell_id セットを生成
const expectedIds = new Set([
  ...manifest.screens.map(s => toCellId(`screen__${s.stable_id}`)),
  ...manifest.edges.map(e => toCellId(`edge__${e.stable_id}`)),
]);

// 突合結果
const toAdd    = [...expectedIds].filter(id => !existingIds.has(id));   // 新規追加
const toKeep   = [...expectedIds].filter(id =>  existingIds.has(id));   // 既存保持
const orphans  = [...existingIds].filter(id => !expectedIds.has(id));   // orphan
```

### 6.3 差分マージ戦略

| 状態 | 対応 |
|------|------|
| 一致セル（`toKeep`） | 既存 mxCell を新 XML にそのまま転記（手動編集 position を保持） |
| 新規セル（`toAdd`） | 新規 mxCell を自動生成して追加 |
| orphan セル | `status: orphan` として XML に残置（削除しない）。manifest には記録 |

```javascript
// 既存 XML から一致セルを抽出して転記
// escapeRegExp で cellId のメタ文字を防御し、\bid= でワードバウンダリを保証する
function extractCell(xml, cellId) {
  const escapedId = escapeRegExp(cellId);
  const pattern = new RegExp(
    `<mxCell[^>]*\\bid="${escapedId}"[^>]*\\/>` +
    `|<mxCell[^>]*\\bid="${escapedId}"[^>]*>[\\s\\S]*?<\\/mxCell>`,
    'm'
  );
  return xml.match(pattern)?.[0] ?? null;
}
```

### 6.4 新 XML の生成と Write

照合完了後、新 XML を生成して `.drawio` ファイルに Write する。

```javascript
// 生成順: §1.6 z-order 戦略に従う
const newXml = `<mxfile>
  <diagram name="Screen-Flow-v3-userflow">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${laneCells.join("")}
        ${screenCells.join("")}
        ${edgeCells.join("")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

// Write ツールで保存（manifest.drawio_file_path に書き込む）
// Write 完了後に mcp__drawio__open_drawio_xml でプレビュー表示（Step 9）
```

---

## 7. Phase 2 送り項目（歴史的注釈）

以下は Phase 1 では実装せず、Phase 2 以降の検討事項として記録する。

### 7.1 Figma 時代の手動 elbow ロジック（旧 §2.3）の waypoints XML 化

旧 Figma 実装では `setVectorNetworkAsync` の 3 頂点（始点 + 折れ点 + 終点）で L 字矢印を描画していた。drawio で同等を実現するには `<Array as="points">` で waypoints を明示する:

```xml
<!-- Phase 2 実装予定 - 現在は edgeStyle=orthogonalEdgeStyle で router 任せ -->
<mxCell id="edge__a__to__b" edge="1" source="screen__a" target="screen__b" parent="1"
        style="endArrow=classic;edgeStyle=orthogonalEdgeStyle;curved=0">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="480" y="240"/>  <!-- 折れ点 -->
    </Array>
  </mxGeometry>
</mxCell>
```

### 7.2 mermaid 経由出力モード

`mcp__drawio__open_drawio_mermaid` を使う簡易プロジェクト向けパス。小規模プロジェクト（画面 10 枚以下）では mermaid flowchart を経由して drawio に渡す方が実装コストが低い。

### 7.3 冪等性照合の DOMParser 化

§6.1 の正規表現抽出は大規模 XML（50+ 画面）では脆弱になる可能性がある。Phase 2 では XML の DOMParser 化（または xml2js / fast-xml-parser 相当のライブラリ）で堅牢性向上を検討する。

### 7.4 大規模 XML のストリーミング送信

drawio MCP の通信ペイロードに上限がある場合、50+ 画面プロジェクトではストリーミング分割が必要になる可能性がある。Phase 1 では sample-attendance-saas（11 画面）相当で実測確認。

### 7.5 Figma VectorNode / setVectorNetworkAsync（削除済み参照）

Figma Plugin API の `figma.createVector()` / `setVectorNetworkAsync()` / `setSharedPluginData()` / `loadFontAsync()` は drawio 化により削除された。これらは Figma 時代（2026-05-27 以前）の実装であり、歴史的記録として本セクションに注記する。drawio 実装での復活は不要。
