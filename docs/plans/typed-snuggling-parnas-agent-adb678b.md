# task-loop コード復元計画のリスク分析

## 調査結果サマリー

### 依存関係
- **MCP SDK**: `@modelcontextprotocol/sdk` は `package.json` に含まれている ✅
- **vibe-kanban MCP**: 以下の2ファイルが MCP SDK を使用している
  - `vibe-kanban-client.ts` (L11-12)
  - `vibe-kanban-client.test.ts`

### ドキュメント変更状況
```
docs/einja/cli/preset.yaml                       |  12 +- (vibe-kanban MCP設定削除)
docs/einja/instructions/task-execute.md          |  40 +- (issue-exec版に更新)
docs/einja/instructions/task-vibe-kanban-loop.md | 560 ------- (削除)
docs/einja/steering/README.md                    |   2 +-
docs/einja/steering/branch-strategy.md           | 122 +++-- (issue-exec版に更新)
docs/einja/steering/development-workflow.md      | 184 +++---- (issue-exec版に更新)
docs/einja/steering/task-management.md           | 101 +--- (issue-exec版に更新)
```

## 🚨 発見された重大なリスク

### 1. ランタイム MCP 接続失敗（Critical）

**問題**: `vibe-kanban-client.ts` が `.mcp.json` の `vibe_kanban` 設定に依存するが、計画では復元しない

**影響範囲**:
- `task-loop` コマンド実行時に vibe-kanban MCP サーバー接続が必須
- `.mcp.json` には設定が存在するが、`preset.yaml` から削除済み
- **CLI パッケージビルド時に `preset.yaml` から `.mcp.json` が生成される可能性**がある
  - ビルドスクリプト: `prebuild` → `generate-template.mjs` + `copy-presets.mjs`
  - この場合、配布版では vibe-kanban 設定が欠落する

**検証が必要**:
1. ビルドスクリプトが `.mcp.json` を生成するかどうか
2. 開発環境の `.mcp.json` とビルド成果物の関係

### 2. ドキュメント vs コードの不整合（High）

**問題**: steering ドキュメントが「issue-exec のみ」記載、コードは「task-loop と issue-exec 両方」存在

**具体的な影響**:
- `docs/einja/steering/development-workflow.md`: issue-exec の手順のみ記載
- `docs/einja/steering/task-management.md`: Vibe-Kanban 統合の説明が削除済み
- ユーザーが steering を読んでも `task:loop` の使い方が分からない

**このリスクは許容可能か？**
→ ユーザーが「コードのみ復元」を明示的に希望しているため、ドキュメント不整合は承知の上と思われる

### 3. npm パッケージ依存関係（Low）

**調査結果**: すべて package.json に含まれている ✅
- `@modelcontextprotocol/sdk`: ^1.0.0（存在）
- `commander`, `chalk`, `ora`, `fs-extra`, `glob` 等: すべて存在

### 4. preset.yaml vs .mcp.json の不整合（Medium）

**現状**:
- **ワーキングツリーの preset.yaml**: vibe-kanban MCP 設定なし
- **プロジェクトルートの .mcp.json**: vibe-kanban MCP 設定あり（L3-10）

**問題**:
- CLI init/sync 時に preset.yaml から設定が生成される場合、不整合が発生する
- ユーザーが手動で .mcp.json を編集している場合は問題ないが、自動生成の場合は要注意

## 推奨される対応

### 最小限の修正（計画の範囲内）

**現状の計画で進める場合の前提条件**:
1. `.mcp.json` が preset.yaml から自動生成されない（手動管理）
2. ユーザーは「task-loop は動かなくてもよい」と理解している
3. ドキュメント不整合は一時的なもの

**追加すべき検証手順**:
- [ ] ビルド後に `dist/` や `presets/` 配下の `.mcp.json` を確認
- [ ] `task:loop` コマンドを実際に実行して vibe-kanban 接続を確認

### 推奨：計画の拡張

以下のいずれかを計画に追加することを推奨：

#### オプションA: vibe-kanban 設定を復元（動作可能にする）
```yaml
# preset.yaml に追加
mcpServers:
  - vibe-kanban  # ← この行を追加
```

**メリット**:
- task-loop が実際に動作する
- 既存の .mcp.json と整合性が取れる

**デメリット**:
- 「コードのみ復元」という当初の方針から逸脱

#### オプションB: task-loop を非推奨にする
```typescript
// cli.ts
.command("task:loop [issue]")
.description("【非推奨】GitHub Issueのタスクを自動実行（代わりに einja:issue-exec を使用）")
```

**メリット**:
- ドキュメント（issue-exec推奨）とコード（両方存在）の整合性が向上
- ユーザーに移行を促せる

**デメリット**:
- 追加のコード変更が必要

#### オプションC: README 等で注記を追加
```markdown
## 注意事項
- `task:loop` コマンドは vibe-kanban MCP の設定が必要です
- 現在の推奨ワークフローは `einja:issue-exec` です
```

## 質問事項

計画を最終化する前に、以下を確認させてください：

1. **task-loop の動作**:
   - 実際に動作させる必要がありますか？
   - それとも「コードが残っていればよい」（動作不要）ですか？

2. **ビルドプロセス**:
   - `preset.yaml` から `.mcp.json` が自動生成されますか？
   - それとも `.mcp.json` は手動管理ですか？

3. **対応方針**:
   - 上記オプション A/B/C のいずれかを採用しますか？
   - それとも現状の計画のまま進めますか？

---

## 現時点の推奨

**最も安全な選択肢**: オプションA（vibe-kanban 設定を復元）

**理由**:
- コードを復元する以上、動作可能な状態にすべき
- .mcp.json との整合性が保たれる
- 将来的に issue-exec に移行する場合でも、段階的に削除できる
