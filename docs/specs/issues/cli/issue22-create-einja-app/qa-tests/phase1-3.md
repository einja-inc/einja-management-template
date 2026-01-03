# Phase 1-3 テスト仕様（パッケージ基盤〜対話式プロンプト）

## 概要

Phase 1（パッケージ基盤）、Phase 2（テンプレートシステム）、Phase 3（対話式プロンプト）のテスト仕様を定義します。

---

## Phase 1: パッケージ基盤

### P1-001: パッケージディレクトリ構造

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P1-001-1 | `packages/create-einja-app/` ディレクトリが存在する | true | - |
| P1-001-2 | `packages/create-einja-app/package.json` が存在する | true | - |
| P1-001-3 | `packages/create-einja-app/tsconfig.json` が存在する | true | - |
| P1-001-4 | `packages/create-einja-app/src/cli.ts` が存在する | true | - |

### P1-002: package.json 設定

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P1-002-1 | `name` が `create-einja-app` | true | - |
| P1-002-2 | `bin` フィールドに `create-einja-app` が設定されている | true | - |
| P1-002-3 | `type` が `module` | true | - |
| P1-002-4 | `files` に `dist` と `templates` が含まれている | true | - |
| P1-002-5 | 必要な依存関係（commander, inquirer, ora, chalk, execa）が含まれている | true | - |

※ 詳細なテスト仕様は phase1-3.md 本文を参照してください。
