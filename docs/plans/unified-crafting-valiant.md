# Plan: BackupManager 削除（einja sync）

## Context

`einja sync` 実行時に `.einja-sync-backups/` にローカルファイルのバックアップを作成する機能がある。
しかし利用者はgitでバージョン管理しているため、同期前の状態は `git checkout` / `git stash` で復元可能。
バックアップ機能は不要であり、`.gitignore` にも未登録のため追跡されてしまう問題もある。

## 変更内容

### TODO-1: BackupManager 関連ファイル削除

| ファイル | 操作 |
|---------|------|
| `packages/cli/src/lib/sync/backup-manager.ts` | 削除 |
| `packages/cli/src/lib/sync/backup-manager.test.ts` | 削除 |

### TODO-2: sync.ts からバックアップロジック除去

**ファイル**: `packages/cli/src/commands/sync.ts`

- L10: `import { BackupManager }` 削除
- L112: `const backupManager = new BackupManager(cwd)` 削除
- L201-203: 孤児バックアップブロック削除
- L393-398: 同期前バックアップブロック + spinner削除
- L656-659: 孤児バックアップブロック削除

### TODO-3: CLI オプション・型定義から `--no-backup` 除去（sync用のみ）

| ファイル | 変更 |
|---------|------|
| `packages/cli/src/cli.ts` L47 | sync コマンドの `.option("--no-backup", ...)` 削除 |
| `packages/cli/src/types/index.ts` L46 | `SyncOptions.backup?: boolean` 削除 |

**注意**: `init` コマンドの `--no-backup`（L31）は BackupManager 非依存のため残す。

### TODO-4: ドキュメント更新

| ファイル | 変更 |
|---------|------|
| `packages/cli/README.md` L176 | sync の `--no-backup` 行を削除 |

## 対象外（変更不要）

- `init` コマンドの `--no-backup`（`backupDirectory` 関数で独立実装）
- `docs/einja/instructions/setup-flow.md` の `init --force --no-backup` 記述
- `cli-package-specs/SKILL.md` の `init --force --no-backup` 記述

## 検証

1. `pnpm --filter @einja/dev-cli build` 成功
2. `pnpm --filter @einja/dev-cli test` 成功（backup-manager テスト除去後）
3. `pnpm prepush` 通過
