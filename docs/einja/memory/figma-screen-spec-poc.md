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
- 参考実装: `.claude/skills/einja-project-screen-flow-figma/references/figma-arrow-rules.md`
- MCP server instructions: `claude.ai Figma` connector（`figma.currentPage = page` 非サポート、`setCurrentPageAsync` 必須を明示）

## 結論

**PoC 全 4 基準クリア。Plan v2.1 の T1 タスク完了基準を満たす。**

- R1（auto-layout 未検証）リスクは完全に潰れ、`wireframe-primitives.md §2` で auto-layout を主軸として記述可能
- R6（dynamic-page read-only）リスクは MCP server ガイダンス + PoC ②で完全解消
- 後続 T2/T5 は本 PoC 結果を**前提条件**として進行可能
