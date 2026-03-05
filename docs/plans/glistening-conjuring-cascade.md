# Plan: npx コマンドの `@latest` 指定漏れを一括修正

## Context

`npx @einja/dev-cli` を `@latest` なしで実行すると、npxキャッシュの古いバージョンが使われる。`einja:einja-sync` コマンドでv0.1.0が使われてしまった。実行されるコマンド/スクリプト定義を修正する。

## 修正対象

### 1. `.claude/commands/einja/einja-sync.md` (6箇所)

`npx --yes` で実行するコマンドに `@latest` を追加。`replace_all` で一括置換。

| Before | After |
|--------|-------|
| `npx --yes @einja/dev-cli sync` (4箇所: 107,159,162,231行) | `npx --yes @einja/dev-cli@latest sync` |
| `npx --yes create-einja-app sync` (2箇所: 110,165行) | `npx --yes create-einja-app@latest sync` |

**修正しない箇所**: Step 1のCLI検出 (19,20行目) は `npx --no` のまま。目的が「CLIが利用可能か」の検出であり、バージョン不問で検出できる方が適切。実際のsync実行 (Step 3,4) では `--yes @latest` で最新版が使われる。

### 2. `docs/einja/cli/preset.yaml` (2箇所)

下流プロジェクトの `package.json` scripts に反映されるため修正必須。

| 行 | Before | After |
|----|--------|-------|
| 127 | `"task:loop": "npx @einja/dev-cli task:loop"` | `"task:loop": "npx @einja/dev-cli@latest task:loop"` |
| 128 | `"einja:sync": "npx @einja/dev-cli sync"` | `"einja:sync": "npx @einja/dev-cli@latest sync"` |

## 修正不要

| ファイル | 理由 |
|---------|------|
| `einja-sync.md` 19,20行 | Step 1のCLI検出。`--no` で検出目的のためバージョン不問 |
| `package.json` (ルート) | 既に `@latest` 付き |
| `create-einja-app/src/generators/post-setup.ts` | 既に `@latest` 付き |
| README.md / docs/plans/ / docs/specs/ 等 | ドキュメント内の説明・例示。直接実行されるコマンドではない |

## 検証

1. grep で `einja-sync.md` 内の `npx --yes` 呼び出しに全て `@latest` が付いていることを確認
2. `preset.yaml` のscripts定義に `@latest` が付いていることを確認
3. `pnpm build` して `presets/default/` に変更が反映されることを確認
