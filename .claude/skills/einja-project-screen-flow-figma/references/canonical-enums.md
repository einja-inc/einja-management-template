# canonical-enums: einja-project-screen-flow-figma 共通 enum 定義

このファイルは `SKILL.md` / `references/hearing-checklist.md` / `references/figma-arrow-rules.md` / `references/manifest-schema.md` / サンプル `screen-flow-url.md` から参照される **canonical（正準）enum 定義**です。これら5ファイル間で enum 値の表記ゆれを防ぐため、本ファイルが Single Source of Truth です。

各 enum 値は **lowercase + ハイフン形式** で記述し、後続ファイルはそのまま引用してください。

## §1. layout_strategy enum

manifest frontmatter `layout_strategy` フィールドに記録するレイアウト戦略。

| value | 用途 |
|-------|------|
| `swim-lane` | role 別 swim lane レイアウト（推奨、新規生成のデフォルト） |
| `grid` | 単純格子レイアウト（v1 後方互換、`layout_strategy` 未指定時の暗黙値） |

## §2. edge_kind enum

manifest `edges[].edge_kind` フィールドに記録するエッジ種別。

| value | 用途 | 視覚表現 |
|-------|------|--------|
| `primary` | 主フロー（業務の正方向遷移、完了系自動遷移を含む） | 実線、濃グレー `{r:0.3,g:0.3,b:0.3}` |
| `back` | 後方フロー（差し戻し / キャンセル / 戻る / エラー / 失敗） | 点線 `dashPattern: [4, 4]`、薄グレー `{r:0.6,g:0.6,b:0.6}` |

## §3. routing enum

manifest `edges[].routing` フィールドに記録する経路種別。

| value | 用途 | 頂点数 |
|-------|------|------|
| `straight` | 直線（同一 lane 内隣接、または lane 内非隣接でない場合） | 2（始点 + 終点） |
| `l-shape` | L字（lane 跨ぎ、または同一 lane 内非隣接の飛び越え） | 3（始点 + 折れ点 + 終点） |

**L字判定条件**:
- lane を跨ぐ場合: 必ず `l-shape`
- 同一 lane 内: 標準 320px 隣接でも `straight`
- 同一 lane 内非隣接（飛び越え）: `|dx| > 2 * (FRAME_W + FRAME_SPACING_X)` で `l-shape` 許容

## §4. node_kind enum

Figma `setSharedPluginData("einja.screenFlow", "node_kind", ...)` に記録するノード種別。

| value | 用途 |
|-------|------|
| `screen` | 画面 FrameNode |
| `edge` | 遷移エッジ Group（VectorNode + TextNode） |
| `lane` | swim lane 背景 Frame |

**移行互換性**: 旧 key `role`（値: `screen` / `edge`）からの移行のため、読み込み時は `node_kind` 優先 → なければ `role` にフォールバックする `readNodeKind()` ユーティリティを使用（詳細は `figma-arrow-rules.md §4`）。書き込みは新 key `node_kind` のみ。

## §5. canonical role 識別子（6種）

業務ロールの正準識別子。`setSharedPluginData("einja.screenFlow", "business_role", ...)` に記録、manifest `screens[].lane_id` にも使用。

**デフォルト辞書順**: `Common → Employee → Manager → HR → Admin → Ext`（lane 配置順）

| 識別子 | 表示名候補（事前登録） | 典型業務 |
|--------|------------------|--------|
| `Common` | 共通 / 全ロール | login / dashboard / error / not-found-404 / session-expired / forbidden-403 / maintenance |
| `Employee` | 従業員 / 一般従業員 / 利用者 | 打刻 / 申請 |
| `Manager` | 上長 / 管理者 / 部門長 | 承認系 |
| `HR` | 人事部 / 人事担当 | 月次集計 / エクスポート |
| `Admin` | システム管理者 / 情シス / 管理 | ユーザー管理 / 監査ログ |
| `Ext` | 外部利用者 | 受託案件で外部組織 |

> **注意**: 本 Skill の `Ext` は **人系アクター（外部利用者）** を指す。
> `einja-project-function-spec` Skill §2.2 participant 規約の `Ext`（**外部システム**）とは別軸の意味なので混同しないこと。
> 将来 screen-flow と function-spec を連携する際は `business_role` (本 Skill) と participant identifier (function-spec) を別フィールドとして扱う必要がある。

**辞書外の role**: `Role_${hash(display).slice(0,8)}` + `display_name` 保持で可読性確保（日本語の kebab 化は不安定なため hash 採用）。

## §6. source_confidence enum

クロスチェック由来画面の信頼度。manifest `screens[].source_confidence` に記録。

| value | 由来 |
|-------|------|
| `high` | §2 業務フロー由来 / 完全一致 / 既知 synonym（マッピング辞書ヒット） |
| `medium` | 部分一致（権限マトリクスと §6 機能一覧の照合で類推） |
| `low` | 機能語尾変換のみ（「閲覧」→「表示」「画面」等の語尾置換による推定） |

`high` 以外はヒアリング項目 A で必ず確認対象とする。

## §7. status enum

manifest 内のライフサイクル状態。再生成時の冪等性管理に使用。

| value | 意味 |
|-------|------|
| `active` | 現行構成に含まれる |
| `orphan` | 再生成で要件から削除された（自動削除はしない、ユーザーに手動削除を促す） |

## §8. Figma plugin data namespace

`setSharedPluginData` / `getSharedPluginData` の namespace は `einja.screenFlow` 固定。`einja.screenSpec`（einja-project-screen-spec Skill）とは厳密に分離。`findAll` のスコープも `figma.currentPage` 切替後に限定。

## §9. lane 配置パラメータ（参考定数）

`figma-arrow-rules.md §3.1 swim-lane レイアウト` で使用するパラメータ。

| 定数 | 値 | 用途 |
|------|-----|------|
| `LANE_HEIGHT` | 240px | 1 lane の縦方向占有 |
| `LANE_HEADER_W` | 160px | lane 左端のラベル領域 |
| `FRAME_W` | 240px | 画面 FrameNode 幅 |
| `FRAME_H` | 160px | 画面 FrameNode 高さ |
| `FRAME_SPACING_X` | 80px | 同一 lane 内の画面間隔 |
| `FRAME_SPACING_Y` | 40px | lane top と frame top のオフセット |
| `EDGE_OFFSET` | 16px | 往復 edge の平行シフト量 |
| `LABEL_OFFSET` | 8px | edge ラベルの線からの法線方向オフセット（初期値） |
