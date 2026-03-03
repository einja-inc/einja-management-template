# Plan: task-loop ソースコード復元 + 動作可能状態の維持

## Context

`task-loop` から `issue-exec` への移行で task-loop 関連が全削除されている（未コミット）。ユーザーの意向:
- **ソースコードは復元**（動作可能な状態で）
- **ドキュメントは新ワークフロー（issue-exec）のまま**

task-loop は vibe-kanban MCP 接続が必須のため、`preset.yaml` の MCP 設定も復元する。

## 作業ステップ

### 1. ソースコード復元

```bash
git checkout HEAD -- packages/cli/src/commands/task-loop/
```

35ファイル（index.ts、lib/配下全ファイル、テスト、モック）

### 2. cli.ts に task:loop コマンド登録を追加

`packages/cli/src/cli.ts` に import + コマンド登録を Edit で追加:

```typescript
import { taskLoopCommand } from "./commands/task-loop/index.js";

program
  .command("task:loop [issue]")
  .description("GitHub Issueのタスクを自動実行")
  .option("-m, --max-group <number>", "最大タスクグループ番号")
  .option("-b, --branch <name>", "ベースブランチ")
  .action(taskLoopCommand);
```

### 3. package.json に task:loop スクリプト追加

```json
"task:loop": "npx @einja/dev-cli task:loop",
```

### 4. preset.yaml に vibe-kanban MCP 設定を復元

```bash
git checkout HEAD -- docs/einja/cli/preset.yaml
```

復元される内容:
- `mcpServers` に `vibe_kanban` 追加
- `additionalPermissions` に vibe-kanban 関連パーミッション 7 個追加
- `requirements.scripts` に `task:loop` スクリプト追加
- `description` を Vibe-Kanban 統合版に戻す

### 復元しないもの（新ワークフローを維持）

| ファイル | 理由 |
|---------|------|
| `docs/einja/steering/` 4ファイル | issue-exec版ワークフローを維持 |
| `docs/einja/instructions/task-vibe-kanban-loop.md` | 新ワークフローのドキュメントで代替 |

## 対象ファイル一覧

| カテゴリ | ファイル | 操作 |
|---------|---------|------|
| CLI ソース | `packages/cli/src/commands/task-loop/` (35ファイル) | `git checkout HEAD --` |
| CLI 登録 | `packages/cli/src/cli.ts` | Edit（import + コマンド登録追加） |
| npm スクリプト | `package.json` | Edit（task:loop スクリプト追加） |
| MCP設定 | `docs/einja/cli/preset.yaml` | `git checkout HEAD --` |

## 検証

1. `git diff --stat HEAD -- packages/cli/src/commands/task-loop/` → 差分なし
2. `pnpm build` が通ること（CLI パッケージビルド）
3. `grep "task:loop" packages/cli/src/cli.ts` → コマンド登録あり
4. `grep "vibe_kanban" docs/einja/cli/preset.yaml` → MCP設定あり
5. ドキュメント（steering）が issue-exec 版のままであること
