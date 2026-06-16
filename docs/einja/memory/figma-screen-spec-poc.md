<!--
**2026-05-28 注釈**: einja-project-screen-flow Skill は drawio 化された（einja-project-screen-flow-drawio にリネーム）。
本 PoC は Figma 時代の screen-flow 記録であり、現行 screen-flow 実装の参照ではない。
screen-spec（ワイヤーフレーム）側は引き続き Figma を使用しているため、本 PoC は screen-spec 用途で参照価値あり。
-->

# einja-project-screen-spec Skill 設計時 PoC 結果（2026-05-25）

`einja-project-screen-spec` Skill 実装計画（Plan v2.1）の T1 タスクとして、Figma Plugin API の未検証要素を実機検証した記録。本Plan の R1 / R6 リスクを物理的に潰すための PoC。

## PoC 環境

- 日時: 2026-05-25
- Figma 認証ユーザー: dev@einja.net
- Figma plan: クリエイティブ制作チーム (`team::1152187400294529955`, tier: pro)
- PoC 用 Figma ファイル: `poc-screen-spec-test`
  - file_key: `WSLSjypdBV2UYJEiHbSbIv`
  - URL: https://www.figma.com/design/WSLSjypdBV2UYJEiHbSbIv

## Plan で定義した成功基準 4 点

| # | 検証内容 | 期待値 |
|---|---------|-------|
| ① | `figma.createPage()` の id 取得確認 | Page node の id が返る |
| ② | `await figma.setCurrentPageAsync(page)` 成功確認 | `figma.currentPage.id === page.id` |
| ③ | `frame.layoutMode = "VERTICAL"` で子矩形2個 appendChild → 縦積み | child2.y > child1.y、yDiff = childHeight + itemSpacing |
| ④ | `setSharedPluginData / getSharedPluginData` round-trip | 書き込み値と読み出し値が完全一致 |

## 検証コード

`mcp__claude_ai_Figma__use_figma` で以下のJSをワンショット実行（コード長: 約 2,500 字、動的バッチ閾値 30000 字を大きく下回る）。

```javascript
const wireframesPage = figma.createPage();
wireframesPage.name = "Wireframes";
await figma.setCurrentPageAsync(wireframesPage);
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

const screenFrame = figma.createFrame();
screenFrame.resize(400, 300);
screenFrame.layoutMode = "VERTICAL";
screenFrame.primaryAxisSizingMode = "FIXED";
screenFrame.counterAxisSizingMode = "FIXED";
screenFrame.itemSpacing = 8;
screenFrame.paddingTop = 16; screenFrame.paddingBottom = 16;
screenFrame.paddingLeft = 16; screenFrame.paddingRight = 16;

const child1 = figma.createRectangle();
child1.resize(360, 40);
screenFrame.appendChild(child1);

const child2 = figma.createRectangle();
child2.resize(360, 40);
screenFrame.appendChild(child2);

screenFrame.setSharedPluginData("einja.screenSpec", "stable_id",
  "sample-attendance-saas__wf__dashboard__desktop__normal");
const readBack = screenFrame.getSharedPluginData("einja.screenSpec", "stable_id");
```

## 実行結果（全項目クリア）

```json
{
  "criterion_1_pageId": "1:2",
  "criterion_1_pageName": "Wireframes",
  "criterion_2_currentPageId": "1:2",
  "criterion_2_match": true,
  "criterion_3_screenFrameId": "1:3",
  "criterion_3_layoutMode": "VERTICAL",
  "criterion_3_child1_y": 16,
  "criterion_3_child2_y": 64,
  "criterion_3_isStacked": true,
  "criterion_3_yDiff": 48,
  "criterion_4_stable_id_match": true,
  "criterion_4_role_match": true,
  "criterion_4_test_match": true,
  "criterion_4_keyLength_stableId": 54,
  "criterion_4_findAll_count": 1,
  "criterion_4_findAll_firstId": "1:3"
}
```

### 検証結果の解釈

| 基準 | 結果 | 解釈 |
|------|------|------|
| ① | ✅ PASS | `figma.createPage()` は引数なしで Page node を返す。`name` プロパティ後段設定 OK。Page id `1:2` 取得 |
| ② | ✅ PASS | `figma.currentPage = page` は MCP server ガイダンス通り不可、`setCurrentPageAsync` 必須。期待通り動作 |
| ③ | ✅ PASS | `layoutMode: VERTICAL` + `primaryAxisSizingMode: FIXED` + `counterAxisSizingMode: FIXED` 組合せで auto-layout 動作。child2.y - child1.y = 48 = 40(child height) + 8(itemSpacing) で **完全に期待通りの縦積み**。`R1` リスク潰し完了 |
| ④ | ✅ PASS | `setSharedPluginData("einja.screenSpec", key, value)` 直後の `getSharedPluginData` で同値返却。`findAll(n => n.getSharedPluginData(...) === target)` でも検出可能。冪等性管理の基盤動作確認 |

### 副次的に確認できた事項

- **stable_id keyLength: 54字** — `sample-attendance-saas__wf__dashboard__desktop__normal` で54字。Figma `setSharedPluginData` の key 100字制限に対して**現実的なプロジェクト名（30字程度）の範囲では truncate 不要**。長い project_name でも余裕。E16-b（SHA-256 truncate）の発火頻度は低いと想定。
- **`figma.loadFontAsync` 必要性**: フォント設定なしで TextNode を作成すると失敗するため、`Inter Regular` を事前ロード。`screen-flow-figma` と同じパターン。
- **fills/strokes 設定**: SOLID color パターンで動作確認、色は `{ r, g, b }` 0-1 範囲。

## Plan / SKILL.md / references への反映方針

PoC 結果を踏まえ、以下のように反映:

1. **`references/wireframe-primitives.md`**:
   - §2 を「**auto-layout を主軸**（PoC で動作実証済み）」として記述
   - 手動座標 fallback は「§2 末尾のフォールバック節」として参考扱い（R1 リスク潰し完了のため）
   - PoC の `padding(16) + itemSpacing(8)` を **mid-fi デフォルト値**として採用

2. **`SKILL.md` Step 4**:
   - `await figma.setCurrentPageAsync(wireframesPage)` を**主軸**として確定（fallback `currentPage = page` は不要、MCP server で禁止されているため削除可）
   - PoC コードを直接 SKILL.md に転載しない（references/ へ）

3. **`references/manifest-schema.md` §3**:
   - 100字 truncate ルールは維持（防御的措置）、ただし「現実的なプロジェクト名では発火しない」を注記

## 残存リスク（PoC 後）

| ID | 内容 | 緩和策（再評価） |
|----|------|---------------|
| R2 | プリミティブ JS が長文フォーム画面で 40000字超 | T1 PoC ではコード長約 2,500字。1画面15要素なら **約 10,000字程度** と推定（PoC × 4倍）。1画面1バッチ基準で OK。50000字超は実質発生しないが念のため動的分割は維持 |
| R3 | namespace 混同 | `setCurrentPageAsync(wireframesPage)` + `findAll` スコープ限定で潰せる（PoC ④ で findAll 1件動作確認済み） |
| R5 | Page 作成上限（Starter plan 3 Pages） | 本 PoC では Pro plan で実施。Starter plan 環境での確認は別途必要だが、E11 エラー処理で対応済み |

## 関連リソース

- Plan: ローカル `.claude/plans/` 配下に保存（git 管理対象外、Claude Code 自動生成パス）
- Skill: `.claude/skills/einja-project-screen-spec/SKILL.md`（実装予定）
- 参考実装: `.claude/skills/einja-project-screen-flow-drawio/references/drawio-style-rules.md` （旧 `.claude/skills/einja-project-screen-flow-figma/references/figma-arrow-rules.md`、2026-05-28 drawio 化で物理削除済み）
- MCP server instructions: `claude.ai Figma` connector（`figma.currentPage = page` 非サポート、`setCurrentPageAsync` 必須を明示）

## 結論

**PoC 全 4 基準クリア。Plan v2.1 の T1 タスク完了基準を満たす。**

- R1（auto-layout 未検証）リスクは完全に潰れ、`wireframe-primitives.md §2` で auto-layout を主軸として記述可能
- R6（dynamic-page read-only）リスクは MCP server ガイダンス + PoC ②で完全解消
- 後続 T2/T5 は本 PoC 結果を**前提条件**として進行可能

---

# 2026-05-27 追記: sample-attendance-saas 画面遷移図 + ワイヤーフレーム 再生成

`einja-project-screen-flow-figma` Skill v3 user-flow layout strategy 実装完了後、sample-attendance-saas の画面遷移図とワイヤーフレームを上記 PoC file（同一 `WSLSjypdBV2UYJEiHbSbIv`）に追記する形で実生成した記録。

Plan: `/Users/t-hiroyoshi/.claude/plans/worktree-synthetic-hinton.md`（sample 再生成 Plan）

## 実行環境

- 日時: 2026-05-27
- worktree: `.claude/worktrees/feat-einja-project-screen-spec`
- branch: `worktree-feat-einja-project-screen-spec`（main マージ保留）
- 親 commit: `d80b6d4`（docs: sample manifest を v3 user-flow 化）

## ユーザー決定（Plan より）

| # | 論点 | 決定 |
|---|---|---|
| Q1 | 生成スコープ | 既存 PoC file に追記、画面遷移図 + ワイヤーフレーム両方 |
| Q2 | URL コミット | 実 URL は書き戻さず PLACEHOLDER のまま（sample manifest 不変） |
| Q3 | wireframe 対象 | 全 11 画面（status: active 全件） |
| Q4 | 実行ブランチ | worktree 上、main マージ保留 |

## 生成結果

### Phase A: 画面遷移図

- Page: `Screen-Flow-v3-userflow`（id: `28:2`）
- Frame: 11 件配置（depth 0〜4 + unreachable depth 5）
- Edges: 12 件（VectorNode + setVectorNetworkAsync、primary 11 / back 1 = `approval→request`）
- エントリ強調: `login` Frame に stroke 4px、薄青 fill (`r:0.96/g:0.98/b:1.0`)、Entry バッジ TextNode (56×20)
- Plugin Data namespace: `einja.screenFlow`
  - Frame: `stable_id` / `node_kind` / `business_role` / `is_entry`
  - Edge: `stable_id` / `node_kind` / `edge_kind` / `from` / `to`
  - Page: `layout_strategy=user-flow` / `schema_version=1` / `project_name=sample-attendance-saas`
- レイアウト: Y_SCALE=2.0（視認性のため manifest の y 値を 2 倍にスケール、X_SCALE=1.0 維持）

### Phase B: ワイヤーフレーム

- Page: `Wireframes`（id: `31:2`）
- 構成: 11 mid-fi wireframe を 4 列 × 3 行のグリッド配置（screen 328×560px）
- 各 wireframe 構造: ヘッダー (タイトル + role バッジ) + body (auto-layout VERTICAL, padding 16, gap 10)
- Primitive: `field` (label + input), `button` (primary/secondary), `placeholder` (label + 矩形), `text`
- Plugin Data namespace: `einja.screenSpec`
  - Screen Frame: `screen_id` / `stable_id` / `screen_name` / `business_role`
  - Page: `schema_version=1` / `project_name=sample-attendance-saas` / `source_screen_flow_page_id=28:2`

## 検証結果

| 検証 | 結果 |
|---|---|
| Phase A スクリーンショット目視 | ✅ 11 Frame、Entry 強調、back edge 点線、role バッジ全件 |
| Phase A Plugin Data round-trip | ✅ login / back edge / dashboard / page メタデータ全件一致 |
| Phase B スクリーンショット目視 | ✅ 11 wireframe、ヘッダー + フォーム/ボタン/プレースホルダー要素 |
| Phase B Plugin Data round-trip | ✅ 11/11 screen で `screen_id` / `stable_id` / `screen_name` / `business_role` 完全一致 |
| sample manifest 不変確認 | ✅ `git diff docs/einja/example/specs/projects/sample-attendance-saas/` 出力空 |

## 次セッション（Skill 改善 Plan）へのフィードバック

実体験から得た改善ポイント（次 Plan で「manifest 確定確認フェーズ」を新設する根拠）:

1. **dashboard / monthly-report のメニュー要素・サマリーカード推定が曖昧** — 機械的に「メニューボタン群」「サマリーカード」と placeholder 化したが、実際のメニュー項目数や項目名は要件に依存し推測不可
2. **各画面のフォーム項目数・ラベル文言は推測の余地が大きい** — request 画面の「申請種別」選択肢、approval 画面のコメント欄等
3. **forbidden-403 のメッセージ文言など微細な文言** — 「アクセス権限がありません」「この機能はあなたのロールでは利用できません」は推定値
4. **function-spec から推定できない UI 詳細** — プレースホルダーテキスト、サンプル値（日付・時刻）、ボタンの primary/secondary 区別

→ 次 Skill 改善 Plan で `screen-flow-url.md` / `wireframe-url.md` を「未確定ドラフト」として出力 → Figma 描画前に AskUserQuestion で確認・修正フェーズを挟む設計を検討予定。

## バッチ実行統計（Skill 改善の参考データ）

| バッチ | コード長 | 用途 |
|---|---|---|
| Phase A Pass 1 | 約 4,800字 | 新規 Page + 11 Frame + Plugin Data |
| Phase A Pass 2 | 約 4,200字 | 12 edges (VectorNode + setVectorNetworkAsync) |
| Phase B 一括 | 約 6,800字 | Wireframes Page + 11 wireframe (primitive 関数 + 各画面定義) |

いずれも use_figma の 50000字制限内、動的バッチ分割不要（v3 Skill 仕様の 40000字閾値も下回る）。

## 関連リソース

- Plan: sample 再生成 Plan（Next Session セクションに Skill 改善方針を記載）。詳細は本リポジトリのローカル `.claude/plans/` 配下、または当該 PR の commit 履歴を参照
- sample manifest: `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` / `wireframe-url.md`（PLACEHOLDER 維持）
- Figma file: 上記 PoC file と同一（追記方式）

## 2026-05-27 追補: draft 確認フェーズの Skill 仕様化完了

本 memo で「次 Skill 改善 Plan で … 検討予定」と予告していた **manifest ドラフト確認フェーズ** が、両 Skill に新ステップとして実装された。

### 実装結果
- `einja-project-screen-flow-figma`: **Step 4.5** (ヒアリング後・Figma 接続前のゲート)
- `einja-project-screen-spec`: **Step 7.5** (ヒアリング後・Pass 1 描画前のゲート)
- 両 Skill 共通: draft note (`docs/project/<manifest-name>.draft.md`) を生成 → サマリ表 + draft note ファイル参照を AskUserQuestion で提示 → 承認 / 項目戻り / フィールド直接修正 / 中止 / その他 の選択肢
- references 拡張:
  - `hearing-checklist.md §7`: ドラフト確認フェーズ仕様（識別子規約 / 差分絵文字 / 修正フロー / マッピング表）
  - `manifest-schema.md §6 (screen-spec) / §8 (screen-flow)`: status フィールド / ライフサイクル / 差分算出アルゴリズム
- `.gitignore`: `docs/project/*.draft.md` / `docs/project/*.draft.aborted*.md` 追加

### 実機 Figma 検証は Phase 2 送り
本 PR のスコープは Skill 仕様の追加のみ。実機 Figma での Step 4.5 / Step 7.5 動作確認は次セッションで sample-attendance-saas 等を再々生成して検証予定。
