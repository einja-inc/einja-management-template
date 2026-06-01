# Plan: einja-project-screen-flow-figma Skill 新規作成（v0.5・セッション再開版）

## Context

`feat/einja-project-requirements` ブランチから派生し、**プロジェクト全体要件定義書 (`docs/project/requirements.md`) をベース入力に、Figma Design 上にプロジェクト全体の画面遷移図を生成するスタンドアロン Skill** を新規作成する。

### このPlanの来歴
- 2026-05-15 に v0.4（3回レビュー反映済み）を作成、worktree作成・plan配置（0-0〜0-2）まで実装着手済み
- **タスク 0-2.5 PoC で Figma MCP 未認識によりブロック → 中断**
- 2026-05-18 現セッションで Figma MCP（`mcp__claude_ai_Figma__*`）がClaude Code CLIに認識されたため再開
- v0.4 planは worktree内 `docs/plans/202605/20260515-einja-project-screen-flow-figma.plan.md`（untracked）に配置済み

### なぜこのブランチから派生するか
- 入力ソースは `einja-project-requirements` Skill の出力（`docs/project/requirements.md`）であり、この Skill 自体が **`feat/einja-project-requirements` ブランチで追加された未マージの新機能**
- 新Skill は project requirements の章構造（§1 概要 / §2 業務フロー / §3 ユーザー / §5 スコープ / §6 機能要件サマリ等）に依存

### ブランチ運用・PR 戦略（v0.4 確定済み）

| 項目 | 方針 |
|------|------|
| **新ブランチ** | `feat/einja-project-screen-flow-figma`（`feat/einja-project-requirements` から派生。worktree作成済み） |
| **PR ターゲット** | `feat/einja-project-requirements`（stacked PR） |
| **CI/CD 影響** | `deploy-pr-preview.yml` の全 job が `github.repository != 'einja-inc/einja-management-template'` 条件で skip され、feat ベース PR では GitHub Actions PR CI が走らない → **ローカル `pnpm prepush` 必須運用**（`einja-task-commit` Skill が内包） |
| **親 PR 通常 merge 後** | `git fetch origin && git rebase origin/main && git push --force-with-lease` |
| **親 PR squash merge 後** | `git rebase --onto origin/main <親tip SHA> HEAD` で child-only commit のみ積み直し（単純 rebase は二重適用でコンフリクト誘発） |

### なぜ画面遷移セクション追加でなくヒアリング補完にするか
- `einja-project-requirements/references/structure-guide.md` に **「画面一覧は §6 に含めない。Figma / ui-design-url.md 側で管理」** という設計方針あり（重複・乖離防止）
- 新 Skill 側で §2 業務フロー（**主要シグナル**）・§3 ユーザー / §5 スコープ / §6 機能要件サマリ（**補助シグナル**）から画面候補を **推定** し、不足情報を **AskUserQuestion でヒアリング補完**

### なぜ Figma Design + VectorNode (+ LineNode 不採用) か
- `figma.createConnector()` は FigJam 専用で Design ファイル不可
- ユーザー指示: 「Figma Design で生成（line/vector で代替）」
- 既存 `ui-design-generator` が `editorType: design` を使用しており整合
- **矢印描画（v0.5.2 PoC 検証 2026-05-18 結果反映）**:
  - **不採用: `LineNode` + `strokeCap`** — `LineNode.strokeCap` は vectorNetwork 全体に一括適用されて**両端矢印固定**になるため、片方向矢印が必須の画面遷移図では使えない
  - **主軸採用: `VectorNode` + `setVectorNetworkAsync`** — 頂点ごとに `strokeCap` を個別指定（始点: `"NONE"` / 終点: `"ARROW_LINES"`）することで**片方向矢印**を実現
  - **ラベル: `TextNode` + `loadFontAsync()`**
  - **グループ化: `figma.group()` で 1 エッジ（VectorNode + TextNode）を単一グループに**

## 現状（2026-05-18時点）

### 完了済み（worktree内）

| ID | 状態 | 内容 |
|----|------|------|
| 0-1 | ✅ | v0.4 plan を `docs/plans/202605/20260515-einja-project-screen-flow-figma.plan.md` に配置（untracked）|
| 0-2 | ✅ | 親ブランチ存在確認（feat/einja-project-requirements commit `e860d26`）+ worktree作成（`.claude/worktrees/einja-project-screen-flow-figma`）+ ローカル設定コピー |

### 環境変化（再開時の検証必須）

| 項目 | v0.4時点 | 現状 |
|------|----------|------|
| Figma MCP 認識 | ❌ ToolSearch ヒットなし | ✅ `mcp__claude_ai_Figma__*` が deferred tools リストに登場（**ただし呼び出し前に ToolSearch でのスキーマ取得が必要**） |
| Figma 認証 | ❓ 不明 | ❓ 未確認（再開時に `whoami` 検証） |
| Figma 公式 Skill | - | サーバー指示で `/figma-use`（`use_figma` 前に必須）、`/figma-generate-diagram` が言及。**SKILL.md ワークフローで先行ロード必須** |
| 親ブランチ remote push | ✅ 確認済み（2026-05-15） | ✅ コミット e860d26 が remote 反映済みだが、**3日経過のため最新化確認が必要** |
| context7 MCP | - | Figma Plugin API の挙動（`ARROW_LINES`等）確認に活用可能 |

### 既存資産（v0.4 から変更なし）

| パス | 役割 | 関係 |
|------|------|------|
| `feat/einja-project-requirements:.claude/skills/einja-project-requirements/SKILL.md` | プロジェクト要件定義書生成Skill | **本Skillの入力ソース提供元** |
| `feat/einja-project-requirements:.claude/skills/einja-project-requirements/references/structure-guide.md` | 章別記入ガイド。画面一覧を §6 に含めない方針を明示 | 本Skill設計の前提制約 |
| `feat/einja-project-requirements:docs/einja/example/specs/projects/sample-attendance-saas/requirements.md` | 勤怠管理SaaSサンプル | **動作確認用フィクスチャ** |
| `.claude/agents/einja/issue-specs/ui-design-generator.md` | Figma Design 画面モックアップ生成 | 出力先・命名規則のリファレンス |
| `docs/einja/steering/development/figma-design-management.md` | Figma フレーム命名規則 + 保存先設定 | 本Skillが参照、規約追加先 |

## 変更内容

### 新規作成

| パス | 内容 |
|------|------|
| `.claude/skills/einja-project-screen-flow-figma/SKILL.md` | Skill 本体（300-400行、Progressive disclosure） |
| `.claude/skills/einja-project-screen-flow-figma/references/hearing-checklist.md` | 画面候補推定ルール + ヒアリング項目 |
| `.claude/skills/einja-project-screen-flow-figma/references/figma-arrow-rules.md` | VectorNode + setVectorNetworkAsync 主軸の矢印描画パターン（LineNode は両端矢印固定で不採用、フォールバック用に記載） |
| `.claude/skills/einja-project-screen-flow-figma/references/manifest-schema.md` | `screen-flow-url.md` スキーマ + 冪等性ポリシー |

### 既存ファイル変更（軽微）

| パス | 変更内容 |
|------|---------|
| `CLAUDE.md` | キーワードトリガー表に「プロジェクト画面遷移図」「project screen flow」等を追加 |
| `docs/einja/steering/development/figma-design-management.md` | 「screen-flow-url.md スキーマ」セクション追加 |

### 配布制御
- `einja-` プレフィックスで `presets/default/.claude/skills/` へ自動配布対象
- ホワイトリスト更新不要（既存マッピング `einja-*/` に該当）

## Skill仕様（v0.4 から変更なし。einja-skill-plan-guide ワークフローA 確定済み）

### 1. 基本情報
- Skill名: `einja-project-screen-flow-figma`（35文字、規則準拠）

### 2. description
```
docs/project/requirements.md（einja-project-requirements 出力）をベース入力に、Figma Design 上でプロジェクト全体の画面遷移図を生成するスタンドアロン Skill。要件定義書の §2 業務フロー（主要シグナル）と §3/§5/§6（補助シグナル）から画面候補を推定し、AskUserQuestion で不足情報をヒアリング補完した上で、矩形ノード配置・VectorNode + setVectorNetworkAsync による片方向矢印描画・TextNode によるトリガーラベル付与を自動化し、Figma URL を docs/project/screen-flow-url.md に記録する。「プロジェクト画面遷移図」「project screen flow」「画面遷移図 Figma」「画面フロー図」等で呼び出す。Do NOT use for: 画面単体のUIモックアップ生成（→ ui-design-generator）、Issue単位の requirements.md §8.2 mermaid 生成（→ requirements-generator）、状態遷移図（→ design.md State Transitions）、FigJam ファイル生成（本Skillは Design ファイル専用）
```

### 3. 分類: **オーケストレーター**（AskUserQuestion 多用、`context: fork` 非設定）

### 4. 配置先: `.claude/skills/einja-project-screen-flow-figma/`（配布対象）

### 5. Frontmatter
```yaml
---
name: einja-project-screen-flow-figma
description: "{上記2のdescription}"
user-invocable: true
---
```

### 6. Progressive disclosure
| レベル | 内容 | 行数目安 |
|--------|------|---------|
| SKILL.md body | コアワークフロー、エラー処理、トリガー | 300-400行 |
| references/hearing-checklist.md | 章別画面候補推定ルール + ヒアリング項目 + パターン例 | 150行 |
| references/figma-arrow-rules.md | **冒頭に「PoC 結果（v0.5.2）で VectorNode 主軸に確定した経緯」を明記**。VectorNode + setVectorNetworkAsync 主軸の矢印描画パターン（LineNode は両端矢印固定で不採用、フォールバック用に記載）、2パス戦略、`setSharedPluginData` 再解決、**動的文字数チェックによる**バッチ分割 | 180行 |
| references/manifest-schema.md | screen-flow-url.md スキーマ + ui-design-url.md フィールド差分表 + 冪等性詳細 | 100行 |

### 7. ワークフロー概略
1. 引数または対話で `docs/project/requirements.md` パス確定
2. **Figma 公式 Skill `/figma-use` を先行ロード**（`use_figma` 呼び出し前に必須。Figma MCP サーバー指示で MANDATORY）
3. Figma MCP `whoami` で認証確認（未認証 → `authenticate` 呼び出し → **AskUserQuestion で「ブラウザで認証完了後に続行してください」と案内して停止**）
4. requirements.md を **見出し名ベース** で章識別:
   - **主要シグナル**: §2 業務フロー TO-BE
   - **補助シグナル**: §3 対象ユーザー、§5 スコープ境界、§6 機能要件サマリ
5. 推定結果を AskUserQuestion でヒアリング補完（追加・削除・名称・遷移・トリガー・ロール）
6. `figma-design-management.md` から保存先プロジェクト設定（planKey）を取得
7. `create_new_file`（editorType: `design`）で `{プロジェクト名}-screen-flow` ファイル作成
8. `use_figma`（Plugin API）で **2パス生成**（**`/figma-use` Skill ロード後に呼び出す**）:
   - **パス1**: 全画面を FrameNode（矩形・kebab-case）として格子レイアウト配置。**`setSharedPluginData("einja.screenFlow", "role"|"stable_id", ...)`** を使用（ファイル横断読取可・冪等性要件のため `setPluginData` ではなく `setSharedPluginData`）
   - **パス2**: 各エッジを 3 要素グループで描画。**主軸: `VectorNode` + `setVectorNetworkAsync({ vertices: [..{strokeCap:"NONE"},..{strokeCap:"ARROW_LINES"}], segments: [..] })`**（v0.5.2 PoC で確定。LineNode は strokeCap が vectorNetwork 全体に適用され両端矢印固定になるため画面遷移図では不採用）+ `TextNode` + `figma.group()`。**50000字制限への対応: バッチサイズは固定値ではなく動的調整（1バッチあたりコード文字数を40000字程度に抑えて分割。10エッジ/バッチは目安）**。nodeId 消失時は `stable_id` から **`getSharedPluginData`** 検索で再解決
9. `get_screenshot` でスクリーンショット取得しユーザーに提示
10. `docs/project/screen-flow-url.md` に Figma URL + manifest を記録（ui-design-url.md とフィールド互換）
11. **冪等性**: 再生成時は既存 Figma ファイルを開く。`stable_id` で照合・流用、未知のみ新規作成。要件削除時は `status: orphan` 付与（自動削除はしない）

## タスク概要

| ID | タスク | 委託先/Skill | 並列可 | 状態 |
|----|--------|------------|--------|------|
| 0-0 | TaskCreate で本タスク一覧を一括登録（再登録） | オーケストレーター | - | 未着手 |
| 0-1 | **`~/.claude/plans/wild-swinging-puzzle.md`（v0.5本体）と worktree内 `docs/plans/202605/20260515-einja-project-screen-flow-figma.plan.md`（v0.4 untracked）を `diff` で比較 → 想定外の手動編集が無いことを確認 → v0.5 内容で上書きコピー** | Bash | - | 未着手 |
| 0-2 | **worktree状態確認 + 親ブランチ最新化判定**: `.claude/worktrees/einja-project-screen-flow-figma` のセットアップ確認、サンプル requirements.md §2 業務フローの目視で抽出可能画面数を概算（8画面届かない場合は99-2 を「最低 N 画面・M エッジ」に下方修正）、`git fetch origin && git log --oneline feat/einja-project-requirements..origin/feat/einja-project-requirements` で追加コミット確認（あれば AskUserQuestion で rebase 判断） | Bash + AskUserQuestion | - | 一部完了（worktree作成済み、再開時に状態確認） |
| **0-2.0** | **Figma MCP スキーマ取得 + 認証確認**: ToolSearch で必要ツール（`whoami`, `authenticate`, `use_figma`, `create_new_file`, `get_screenshot`, `get_metadata`）のスキーマをロード → `whoami` 実行 → 認証状態と planKey 取得。未認証なら `authenticate` 呼び出し → **AskUserQuestion で「ブラウザで認証完了後に続行してください」と案内して停止**。スキーマ取得失敗時は再 ToolSearch | Figma MCP + ToolSearch | - | **再開地点** |
| **0-2.05** | **Figma 公式 Skill ロード確認**: `/figma-use` Skill が利用可能か検証し、PoC・本実装で必ず先行ロードする運用を確立。`figma-generate-diagram` の利用可否も確認（必要時のみ） | Skill | - | 未着手 |
| **0-2.1** | **Figma Plugin API 挙動の事前確認**: context7 MCP で `LineNode.strokeCap`、`ARROW_LINES`、`setSharedPluginData`、`figma.group()` の最新仕様・Design ファイル対応状況を確認 | context7 MCP | - | 未着手 |
| **0-2.5** | **PoC（LineNode + ARROW_LINES）**: Figma Design に `LineNode + ARROW_LINES + TextNode + figma.group()` で矢印1〜2本を実機描画。`get_screenshot` で品質確認 | オーケストレーター + Figma MCP | - | 未着手 |
| **0-2.5b** | **PoC（VectorNode 代替）**: 0-2.6 で LineNode NG 判定時のみ実行。VectorNode + 三角形ベクター + TextNode + figma.group() で同条件描画 → 0-2.6 再判定 | オーケストレーター + Figma MCP | - | 条件付き（LineNode NG時） |
| **0-2.6** | **PoC 判定ゲート** [AskUserQuestion]: スクショ提示 + 客観チェックリスト5項目（①ARROW_LINES（または VectorNode）三角形表示 ②TextNode線中点±10px配置 ③figma.group()単一選択 ④動的バッチ分割で50000字制約OK ⑤Undo単位）。**3分岐**: LineNode PASS → 続行 / VectorNode PASS → figma-arrow-rules.md を VectorNode 主軸に書き換えて続行 / 両方 NG → **本 Plan 停止し再計画（drawio MCP / FigJam 検討）** | オーケストレーター | - | 未着手 |
| 0-3 | Skill 雛形作成 [`einja-skill-creator`]: SKILL.md + references/ 3ファイル配置 | einja-skill-creator | - | 未着手 |
| 1-1 | hearing-checklist.md 執筆（§2主・§3/§5/§6補助、見出し名ベース、パターン例3-5件） | general-purpose | 1-2/1-3並列 | 未着手 |
| 1-2 | figma-arrow-rules.md 執筆（**冒頭に PoC 前提・NG時差し替え方法を明記**、PoC結果反映、LineNode主軸 + VectorNode代替、2パス、**`setSharedPluginData` 再解決**、**動的文字数チェックによる**バッチ分割） | general-purpose | 1-1/1-3並列 | 未着手 |
| 1-3 | manifest-schema.md 執筆（screen-flow-url.md スキーマ + ui-design-url.md フィールド差分表 + 冪等性詳細） | general-purpose | 1-1/1-2並列 | 未着手 |
| 1-4 | SKILL.md 本体執筆（ワークフロー・トリガー・エラー処理。1-1〜1-3完了後） | general-purpose | 1-1〜1-3後 | 未着手 |
| 2-1 | CLAUDE.md キーワードトリガー追加 | Edit | 2-2並列 | 未着手 |
| 2-2 | figma-design-management.md に `screen-flow-url.md スキーマ` セクション追加 | Edit | 2-1並列 | 未着手 |
| 2-3 | Skill 自己動作確認 + **配布チェック**（`pnpm --filter @einja-inc/dev-cli build` で presets配下に references/ 含め出力確認） | オーケストレーター + Bash | 2-1/2-2後 | 未着手 |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] + Skill 固有チェック [`einja-skill-plan-guide` ワークフローB] | einja-review-code + general-purpose | - | 未着手 |
| 99-2 | 動作確認: 勤怠管理SaaS サンプル（**0-2 で確認した実画面数規模、目安 最低 8 画面・12 エッジ**）を入力に Figma 生成 → URL と get_screenshot で目視確認。**再実行で冪等性（ユーザー手動編集保持・orphan化）も確認** | Bash + Figma MCP | - | 未着手 |
| 99-G | コミット承認ゲート [AskUserQuestion]（修正概要 / レビュー全指摘と対応 / 動作確認結果） | オーケストレーター | - | 未着手 |
| 99-3 | コミット・プッシュ [`einja-task-commit`]（内部で `pnpm prepush` 実行） | einja-task-commit | - | 未着手 |

## 並列実行計画

- **Phase 0**: 0-0 → 0-1（差分確認+上書き）→ 0-2（worktree確認+親ブランチ最新化+サンプル画面数概算）→ **0-2.0 Figma スキーマ取得+認証** → 0-2.05 公式Skillロード確認 → 0-2.1 context7 事前確認 → 0-2.5 LineNode PoC → **0-2.6 判定ゲート**（LineNode NG時 → 0-2.5b VectorNode PoC → 再 0-2.6）→ 0-3
- **Phase 1**: 1-1 / 1-2 / 1-3 を `general-purpose` 3並列 → 1-4 SKILL.md 本体（直列）
- **Phase 2**: 2-1 / 2-2 を並列 → 2-3 自己確認 + 配布チェック
- **Phase 99**: 99-1 並列 → 99-2 動作確認（冪等性含む）→ 99-G → 99-3

## リスク・不明点

| 区分 | 内容 | 影響 | 対策 |
|------|------|------|------|
| **認証** | Figma MCP がロード可能だが認証状態未確認 | 高 | 0-2.0 で `whoami` 検証。未認証なら `authenticate` 実行で停止し、ユーザーに claude.ai 認証依頼 |
| **技術** | `LineNode + ARROW_LINES` の見た目品質が「画面遷移図」として実用可か未検証 | 中 | 0-2.5 PoC + 0-2.6 判定ゲート。NG → VectorNode 代替 → それも NG なら drawio MCP / FigJam 再検討（Plan モード差し戻し） |
| **設計** | project requirements の章番号がスキーマ変更で揺れた場合の堅牢性 | 中 | **見出し名ベース抽出**（章番号非依存）。`einja-project-requirements/references/structure-guide.md` を SSOT |
| **設計** | §2 主・§6 補助の画面抽出ヒューリスティクスの精度 | 中 | hearing-checklist.md に明記。AskUserQuestion による確定を必須化 |
| **技術** | `use_figma` 50000 字制限・バッチ間で nodeId 消失 | 中 | 2パス + **`setSharedPluginData("einja.screenFlow", "stable_id", ...)`**（ファイル横断読取・冪等性要件のため `setPluginData` ではない）で再解決。**バッチサイズは固定値ではなく動的文字数チェック（40000字超で次バッチ）** |
| **環境** | Figma MCP は deferred tools のため呼び出し前に `ToolSearch` でスキーマ取得が必要 | 低 | 0-2.0 で必要ツールを ToolSearch ロード。失敗時は再 ToolSearch / サーバー再起動をフォールバック |
| **環境** | Figma 公式 Skill `/figma-use` が `use_figma` 前に MANDATORY ロード必須 | 低 | 0-2.05 で公式 Skill 利用可能性確認、SKILL.md ワークフロー Step 8 の前にロード手順を明記 |
| **環境** | 親ブランチ `feat/einja-project-requirements` が 3日経過で追加コミットされている可能性 | 低 | 0-2 で `git log feat/einja-project-requirements..origin/feat/einja-project-requirements` 確認、必要なら rebase（AskUserQuestion 経由） |
| **設計** | サンプル requirements.md の §2 業務フローから 8 画面・12 エッジ規模が抽出可能か未検証 | 中 | 0-2 で実機目視し、不足時は 99-2 の規模を下方修正、または別サンプル切替 |
| **運用** | PR ターゲットを feat/einja-project-requirements にする運用副作用 | 低 | Context のブランチ運用表で明文化。management-template リポジトリでは PR Preview スキップで副作用なし |
| **仕様** | `screen-flow-url.md` と `ui-design-url.md` の関係 | 低 | フィールド互換（figma_url, file_key, plan_key）・用途相違（project全体 vs Issue単位）を manifest-schema.md に差分表で明示 |
| **仕様** | 冪等性の衝突解決（既存ノードのユーザー手動編集） | 低 | 「既存ファイル追記モード、タグ/名前一致は流用、未知のみ新規、削除しない（orphan化のみ）」を明記 |
| **配布** | references/ 配布制御 | 低 | タスク 2-3 で `pnpm cli build` 実機確認 |

## 検証・動作確認方法

1. **Figma MCP 認証（0-2.0）**: `whoami` 成功 + planKey 取得可能であること
2. **PoC（0-2.5 / 0-2.6）**: 矢印1〜2本を Design 描画 → `get_screenshot` → 客観チェック5項目 PASS
3. **Skill 読込確認**: SKILL.md フロントマター妥当性、`einja-skill-plan-guide` ワークフローB 4カテゴリ全 PASS
4. **画面候補推定**: 勤怠SaaSサンプルの §2 TO-BE フローから画面候補抽出、AskUserQuestion で補正可能
5. **end-to-end（99-2）**: 勤怠SaaSサンプル（最低 8 画面・12 エッジ規模）→ Figma 生成 → 目視 + manifest 記録 + 再実行（冪等性）でユーザー手動編集が保持
6. **配布チェック（2-3）**: `cli-package-specs` Skill 参照 → ビルドコマンド実行 → `presets/default/.claude/skills/einja-project-screen-flow-figma/` 出力 + figma-design-management.md 反映
7. **レビュー（99-1）**: `einja-review-code` MAX 判定 PASS / `einja-skill-plan-guide` ワークフローB 4カテゴリ全 PASS

## 完了判定

- 99-1〜99-3 全通過
- `feat/einja-project-screen-flow-figma` ブランチが remote に push 済み
- PR ターゲット: `feat/einja-project-requirements`（親が main merge 後は rebase + main 切替）

## 変更履歴

- **v0.1**: 初版（feature-level requirements.md §8 入力案）
- **v0.2**: 入力ソースを project-level に変更、FigJam → Design+line/vector、PoC タスク追加
- **v0.3（第2回レビュー反映）**: ブランチ運用表、LineNode 主軸、setPluginData 再解決、見出し名ベース、PoC 判定ゲート、配布制御タスク化等
- **v0.4（第3回レビュー反映、最小追記）**: squash merge rebase 手順、PR CI 不在対応、setPluginData namespace 統一、orphan エッジ、親ブランチ未存在チェック、PoC 客観基準5項目、manifest YAML 最小例、cli-package-specs 参照
- **v0.5（本版・セッション再開、レビュー反映前）**: Figma MCP 認識復活を反映、**タスク 0-2.0 Figma認証確認を新設**、再開時点の完了済みタスクを明示、worktree作成済み前提に簡略化
- **v0.5.1（einja-review-plan MINOR 11件反映）**:
  - レビュアー1-1 / レビュアー2-2: Figma 公式 Skill `/figma-use` ロード必須化（ワークフロー Step 2 + タスク 0-2.05 新設）
  - レビュアー1-2: 0-2.0 を「ToolSearch スキーマ取得 + whoami」に再定義
  - レビュアー1-3: 0-2 に親ブランチ最新化判定を追加
  - レビュアー1-4 / レビュアー2-4: 0-1 を「diff確認 → wild-swinging-puzzle.md の内容で上書き」に明確化
  - レビュアー1-5: 0-2.5b（VectorNode PoC、LineNode NG時のみ）を新設、0-2.6 を3分岐化
  - レビュアー1-6: 0-2.1 context7 MCP 事前確認を新設、リスク表に追記
  - レビュアー1-7: 0-2 にサンプル画面数概算を追加、99-2 規模を「目安」に修正
  - レビュアー2-1: 0-2.0 停止表記を「`authenticate` 呼び出し → AskUserQuestion」に統一
  - レビュアー2-3: バッチサイズを「動的文字数チェック（40000字超で次バッチ、10エッジ/バッチは目安）」に変更
  - レビュアー2-5: `setPluginData` → `setSharedPluginData` に全文統一
- **v0.5.2（PoC 結果反映）**:
  - 2026-05-18 PoC #1 で LineNode + ARROW_LINES が**両端矢印固定**（StrokeCap は vectorNetwork 全体に適用）と判明、画面遷移図用途には不適切
  - PoC #2 で VectorNode + `setVectorNetworkAsync` の頂点別 strokeCap 指定（始点NONE / 終点ARROW_LINES）で**片方向矢印**を実機確認
  - 0-2.6 判定ゲートで「VectorNode 主軸に切り替えて続行」をユーザー承認 → 矢印描画の主軸を VectorNode に変更（LineNode は不採用）
  - figma-arrow-rules.md は VectorNode + setVectorNetworkAsync を主軸で執筆
  - PoC ファイル: https://www.figma.com/design/gvjsXJVZYzFvqKGkmRyoXz
- **v0.5.3（einja-review-plan MINOR 4件反映・v0.5.2 整合化）**:
  - MINOR-1: 「なぜ Figma Design + LineNode（+ VectorNode 代替）か」セクションを「なぜ Figma Design + VectorNode (+ LineNode 不採用) か」に書き換え、v0.5.2 PoC 結果（LineNode の strokeCap が vectorNetwork 全体適用で両端矢印固定 → 不採用、VectorNode + setVectorNetworkAsync の頂点別 strokeCap 指定で片方向矢印を実現）を本文に反映
  - MINOR-2: Skill仕様 §2 description の矢印描画記述を「LineNode+ARROW_LINES」→「VectorNode + setVectorNetworkAsync による片方向矢印」に更新
  - MINOR-3: Skill仕様 §6 Progressive disclosure の references/figma-arrow-rules.md 説明を「VectorNode + setVectorNetworkAsync 主軸（LineNode は両端矢印固定で不採用、フォールバック用に記載）」に更新。新規作成テーブルの説明も同様に更新
  - MINOR-4: ワークフロー Step 8 パス2 の「PoC 検証必須・NG なら VectorNode 代替」表現を削除し「v0.5.2 PoC で確定」に修正

---

## セッション継続メモ（2026-05-18 11:30 時点・第2回中断）

### ステータス
**実装フェーズ Phase 0、Figma MCP 再認証待ちで中断中**

### 本セッション（2026-05-18）で完了したこと
- ✅ **Plan v0.5 → v0.5.1**: einja-review-plan による MINOR 11件レビュー指摘を全反映
- ✅ **0-0**: TaskCreate で全20タスクを登録（Task IDs #1〜#20）
- ✅ **0-1**: `~/.claude/plans/wild-swinging-puzzle.md` (v0.5.1) を worktree内に上書きコピー
- ✅ **0-2**: worktree状態確認（planファイルのみuntracked。クリーン）、親ブランチ追加コミットなし（rebase不要）、`pnpm install` で node_modules 復元完了、サンプル requirements §2 TO-BE フロー目視で約10-12画面相当を確認（99-2「最低 8 画面・12 エッジ」目安をクリア）

### ブロッカー（要対応）
**Figma MCP 認証トークン期限切れ**:
- `mcp__claude_ai_Figma__whoami` → "MCP server claude.ai Figma requires re-authorization (token expired)" エラー
- `mcp__claude_ai_Figma__authenticate` は deferred tools リストに含まれない（claude.ai側プロキシ機構の制約）
- ユーザーに claude.ai 側で再認証を依頼 → AskUserQuestion で「claude.aiで再認証してから続行」を選択 → 中断

### 新セッション再開手順
1. ユーザーが claude.ai でFigmaコネクタを再認証する
2. このworktree（`/Users/t-hiroyoshi/git/einja/einja-management-template/.claude/worktrees/einja-project-screen-flow-figma`）で Claude Code を新セッションで起動
3. 「前回の続きから」と入力
4. `mcp__claude_ai_Figma__whoami` を呼び出して認証成功を確認 → 失敗なら再度ユーザーに依頼
5. 成功なら planKey を記録し、**0-2.05（公式 Skill `/figma-use` ロード確認）から再開**
6. TaskList で既存タスク（#1〜#20）の状態を確認し、未完了タスクから進める

### Phase 0 残タスク一覧
- 0-2.0（Figma認証）← **再開地点**
- 0-2.05（公式 Skill `/figma-use` ロード確認）
- 0-2.1（context7 で Plugin API 挙動事前確認）
- 0-2.5（LineNode + ARROW_LINES PoC 実機描画）
- 0-2.6（PoC 判定ゲート）
- 0-2.5b（VectorNode PoC、判定NG時のみ）
- 0-3（Skill 雛形作成）

### Phase 1〜99 残タスク
1-1〜1-4（references/ + SKILL.md 執筆）、2-1〜2-3（CLAUDE.md / steering / 配布チェック）、99-1〜99-3（レビュー / 動作確認 / 承認 / コミット）

---

## セッション継続メモ #3（2026-05-18 14:10 時点・第3回中断）

### ステータス
**実装フェーズほぼ完了。99-2 動作確認のみ Figma MCP proxy エラーで中断。99-G/99-3 は新セッションへ持ち越し**

### 本セッション（2026-05-18 復活後）で完了したこと
- ✅ 0-2.0 Figma 認証（whoami 成功、planKey: `team::1152187400294529955`）
- ✅ 0-2.05 公式 Skill 確認（`/figma-use` は MCP リソースとして提供されないと判明）
- ✅ 0-2.1 context7 で Figma Plugin API 仕様確認（StrokeCap enum / VectorNetwork API）
- ✅ **0-2.5 PoC #1 (LineNode + ARROW_LINES)**: **両端矢印固定で NG 判定**
- ✅ **0-2.5b PoC #2 (VectorNode + setVectorNetworkAsync)**: 頂点別 strokeCap で **片方向矢印 PASS**
- ✅ 0-2.6 PoC 判定ゲート（ユーザー承認: 「VectorNode 主軸に切り替えて続行」）
- ✅ 0-3 Skill 雛形作成
- ✅ 1-1〜1-4 references/3ファイル + SKILL.md 本体執筆完了
- ✅ 2-1〜2-3 CLAUDE.md / steering / 配布チェック（CLI build成功、presets配下に配布確認）
- ✅ 99-1 観点別並列コードレビュー（A/D/G + Codex、MAJOR 0件・MINOR 29件全件対応）

### ブロッカー（要対応）
**Figma MCP proxy エラー**: 14:00 以降、`whoami` / `create_new_file` / `use_figma` / `get_screenshot` すべて `"Anthropic Proxy: Invalid content from server"` エラー。15分以上継続し復旧せず。
- 99-2 簡易フローテスト（10画面・12エッジ規模での end-to-end 検証）が実施できず
- ユーザー判断: 打ち切り、新セッションで本番テスト

### 新セッション再開手順（最終版）
1. このworktree（`/Users/t-hiroyoshi/git/einja/einja-management-template/.claude/worktrees/einja-project-screen-flow-figma`）で Claude Code を起動
2. 「前回の続きから」と入力
3. `mcp__claude_ai_Figma__whoami` で proxy 復活確認
4. 復活していれば **99-2 動作確認** を実施:
   - `/einja-project-screen-flow-figma` Skill が available なら Skill 起動
   - 利用不可なら手動ワークフロー再現（サンプル `docs/einja/example/specs/projects/sample-attendance-saas/requirements.md` を入力に、10画面・12エッジで Figma 描画 → スクショ → manifest 生成 → 再実行で冪等性検証）
5. 動作確認 OK → **99-G**（コミット承認ゲート、AskUserQuestion）→ **99-3**（einja-task-commit でコミット・プッシュ）

### worktree git status（2026-05-18 14:10時点）
```
 M CLAUDE.md
 M .claude/agents/einja/issue-specs/requirements-generator.md
 M .claude/agents/einja/issue-specs/ui-design-generator.md
 M docs/einja/steering/development/figma-design-management.md
?? .claude/skills/einja-project-screen-flow-figma/
?? docs/plans/202605/20260515-einja-project-screen-flow-figma.plan.md
```

### 本セッションの主要技術発見
- **LineNode + ARROW_LINES は両端矢印固定**（Figma Plugin API 仕様）→ 画面遷移図不適切
- **VectorNode + setVectorNetworkAsync で頂点別 strokeCap 指定が可能** → 片方向矢印実現
- `/figma-use` Skill は GitHub 配布のプラグイン経由のみ（Figma MCP リソースとしては未提供）
- TextNode は `characters` 設定後に `textAutoResize = "WIDTH_AND_HEIGHT"` を呼ばないと width/height が 0 になる（実装時注意）
- use_figma は **入力50000字制限 + 出力20kb制限の二重制約** → 動的バッチ分割で 40000字目安、再試行時は 30000字へ下げる
