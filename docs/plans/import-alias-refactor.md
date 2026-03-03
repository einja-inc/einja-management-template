# インポートエイリアス書き換え: packages/server-core

## 実施日
2026-02-26

## 目的
packages/server-core の相対パスインポートを `@/` エイリアスに統一し、コードの可読性と保守性を向上させる。

## 変更ファイル一覧

### 1. tsconfig.json 修正

#### `packages/server-core/tsconfig.json`
- `paths` エイリアスを追加: `@/*` → `./src/*`

### 2. インポートパス書き換え (8ファイル)

| ファイル | 変更内容 |
|---------|---------|
| `src/domain/entities/User.test.ts` | `../../testing` → `@/testing` |
| `src/domain/repository-interfaces/IUserRepository.ts` | `../../core/result`, `../entities/User` → `@/` 形式 |
| `src/infrastructure/database/mappers/UserMapper.ts` | `../../../domain/entities/User` → `@/domain/entities/User` |
| `src/infrastructure/database/repositories/UserRepository.ts` | 5箇所の相対パス → `@/` 形式 |
| `src/infrastructure/database/mappers/UserMapper.test.ts` | `../../../` 形式 → `@/` 形式 |
| `src/infrastructure/database/repositories/UserRepository.test.ts` | `../../../` 形式、`../client` → `@/` 形式 |
| `src/testing/factories/index.ts` | `../../__generated__/fabbrica` → `@/__generated__/fabbrica` |
| `src/testing/factories/user.factory.ts` | 4箇所の相対パス → `@/` 形式 |

### 3. モノレポ対応 (2ファイル)

#### `apps/web/tsconfig.json`
- `paths` に `@/*` のマッピングを拡張: `["./src/*", "../../packages/server-core/src/*"]`
- server-core の `@/` エイリアスを解決できるよう設定

#### `apps/admin/tsconfig.json`
- 同上

## 検証結果

### TypeScript 型チェック
```bash
pnpm prepush:typecheck
```
✅ 成功 - モジュール解決エラーなし

### Vitest テスト
```bash
pnpm --filter @repo/server-core test
```
✅ 全59テスト成功

### 影響範囲
- **破壊的変更**: なし（内部的なインポートパスの変更のみ）
- **外部API**: 変更なし
- **ビルド**: 正常

## 技術メモ

### モノレポでのエイリアス解決
- `@/` エイリアスは **パッケージ内部の相対パス解決** のためのもの
- 他パッケージから参照する場合、参照元の tsconfig にもエイリアスマッピングが必要
- 解決方法:
  1. TypeScript Project References を使用
  2. 参照元の `paths` に参照先のエイリアスを追加（今回採用）

### vitest.config.ts
- 既に `alias: { "@": path.resolve(__dirname, "./src") }` が設定済み
- 変更不要

## 残存課題
なし

## 次のステップ
- 他パッケージでも同様に `@/` エイリアス導入を検討
- `@repo/front-core` などでも統一
