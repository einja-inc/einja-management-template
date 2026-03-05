# Plan: create-einja-app 利用者体験の改善（3問題の修正）

## Context

create-einja-appの利用者がプロジェクト作成〜起動までの過程で3つの問題に遭遇している:
1. `scripts/init.sh` が Permission Denied（実行権限なし）
2. `pnpm install` が `init.sh` と `post-setup.ts` で二重実行される
3. READMEにトラブルシューティング情報が不足

## 修正内容

### TODO-1: template.ts に `.sh` ファイルの実行権限付与処理を追加

**対象**: `packages/create-einja-app/src/generators/template.ts`

`generateTemplate()` 関数の末尾（変数置換ループ後、L279付近）に `.sh` ファイルへの `chmod +x` 処理を追加:

```typescript
import { chmodSync } from "node:fs";
// ...
// シェルスクリプトに実行権限を付与
const shFiles = glob.sync("**/*.sh", {
  cwd: targetPath,
  absolute: true,
  dot: true,
});
for (const file of shFiles) {
  chmodSync(file, 0o755);
}
```

- `node:fs` から `chmodSync` をインポート
- テンプレートは `.gitignore` で git 管理外のため、ソース権限でなくコピー後に明示付与する方式
- `fs-extra` の `copySync` はパーミッションを保持するが、ソース自体が 644 のため chmod が必要

### TODO-2: init.sh から `pnpm install` を削除（2ファイル）

**対象**:
- `scripts/init.sh` (L77-81) — 原本
- `packages/create-einja-app/templates/default/scripts/init.sh` (同箇所) — テンプレート配布物

両ファイルからStep 4（依存関係インストール）を削除する。理由:
- `post-setup.ts` の Step 1 で `pnpm install` を spinner付きで実行済み
- init.sh は「ツール導入」（Volta/Node/pnpm バイナリのインストール）に専念させる
- 二重実行の排除 + Volta PATH未反映でのインストール失敗を回避

Step 4 を削除し、旧Step 5（direnv設定）を Step 4 に繰り上げ。完了メッセージの「次のステップ」に `pnpm install` を追記。

※ `presets/default/scripts/init.sh` はビルド時に自動コピーされるため直接編集不要

### TODO-3: README にトラブルシューティング項目を追加

**対象**: `packages/create-einja-app/README.md` (L333付近、既存トラブルシューティングセクション末尾)

追加する項目:
1. **`scripts/init.sh` が Permission Denied** — `bash scripts/init.sh` で実行するか、`chmod +x scripts/*.sh` で権限付与
2. **Volta環境でpnpmが見つからない** — `npm install -g pnpm@latest-10` で手動インストール、またはターミナル再起動

### TODO-4: テストのモック順修正

**対象**: `packages/create-einja-app/tests/unit/generators/post-setup.test.ts`

`post-setup.ts` の実際の実行順序:
```
Step 0: init.sh
Step 1: pnpm install → pnpm db:generate
Step 2: pnpm env:rotate-secrets
Step 3: git init → git add → git commit
Step 4: npx @einja/dev-cli init（条件付き）
```

現在のテストでモック順が実行順序と不一致のケース（L193-240）を修正:
- 「pnpm installに失敗した場合」(L193): `init.sh成功 → pnpm install失敗` に修正
- 「Prismaクライアント生成に失敗した場合」(L206): `init.sh成功 → pnpm install成功 → pnpm db:generate失敗` に修正
- 「@einja/dev-cli initに失敗した場合」(L222): 正しい順序に修正

## 対象ファイル一覧

| ファイル | 変更 |
|---------|------|
| `packages/create-einja-app/src/generators/template.ts` | `chmodSync` 追加 |
| `scripts/init.sh` | Step 4 (pnpm install) 削除 |
| `packages/create-einja-app/templates/default/scripts/init.sh` | 同上 |
| `packages/create-einja-app/README.md` | トラブルシューティング追記 |
| `packages/create-einja-app/tests/unit/generators/post-setup.test.ts` | モック順修正 |

## 検証方法

1. `pnpm -F create-einja-app test` でユニットテスト通過を確認
2. `pnpm prepush` (lint + typecheck + test) で全体通過を確認
3. テンプレートからプロジェクト生成し、`./scripts/init.sh` が直接実行できることを確認
