# Codexレビュー指摘の修正（MAJOR 1-3）

## Context

前回計画（TODO-1〜4: setup-dev.ts/dev.ts責務分離）は実装済み。
Codexレビューで以下のMAJOR指摘を受けた:

| # | 問題 | 影響 |
|---|------|------|
| MAJOR 1 | `commandExists("dotenvx")` で**システムインストール**を確認するが、実行は `npx dotenvx`（npxはローカルパッケージも解決可能）→ dotenvxがnpmローカルのみの環境で復号スキップ | 不要なフォールバック |
| MAJOR 2 | `.env.local` 存在 + 復号失敗時にfail-open（警告のみで `.env.example` で続行） | 秘密情報欠落のままサーバー起動 |
| MAJOR 3 | `AUTH_SECRET` を毎回 `generateAuthSecret()` で再生成。`.env.local` に暗号化保存された値を無視 | 再起動のたびに全セッション無効化 |

## 方針

3つのMAJOR指摘を `writeEnvFile` 内で修正。変更は `scripts/worktree/dev.ts` の1ファイルのみ。

## TODO

### TODO-1: dotenvx存在チェックの撤廃（MAJOR 1）

**ファイル**: `scripts/worktree/dev.ts` L415

現状:
```typescript
if (commandExists("dotenvx") && fs.existsSync(envLocalPath)) {
```

修正:
```typescript
if (fs.existsSync(envLocalPath)) {
```

理由: `npx dotenvx` はローカル `node_modules` やグローバル両方を解決できるため、`commandExists` による事前チェックは不要。`npx dotenvx decrypt` 自体が try-catch で囲まれており、npxが失敗すればフォールバックに落ちる。

副次的に `commandExists` のインポートを dev.ts から削除（setup-dev.ts のみが使用）。

### TODO-2: 復号失敗時のfail-close化（MAJOR 2）

**ファイル**: `scripts/worktree/dev.ts` L452-461

現状: `.env.local` 存在 + 復号失敗 → 警告のみで `.env.example` フォールバック続行

修正:
```typescript
if (!decryptedSuccessfully) {
    if (fs.existsSync(envExamplePath)) {
        baseEnvContent = fs.readFileSync(envExamplePath, "utf-8");
    }
    if (fs.existsSync(envLocalPath)) {
        logError("エラー: .env.local が存在しますが復号できませんでした。");
        logError("  秘密情報が欠落した状態でサーバーが起動します。");
        logError("  dotenvx と .env.keys を確認してください（pnpm dev:setup でツールをインストール）");
        logError("");
        logError("  復号に必要な条件:");
        logError("    1. npx dotenvx が実行可能であること");
        logError("    2. .env.keys が存在すること");
        logError("    3. .env.keys 内に DOTENV_PRIVATE_KEY_LOCAL が含まれること");
        logError("");
        // TTY環境では確認プロンプト、非TTY（CI等）ではそのまま続行
        if (process.stdin.isTTY) {
            const readline = await import("node:readline");
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise<string>((resolve) => {
                rl.question("  .env.example のフォールバックで続行しますか？ [y/N] ", resolve);
            });
            rl.close();
            if (answer.trim().toLowerCase() !== "y") {
                process.exit(1);
            }
        }
    }
}
```

注意: `writeEnvFile` を `async` に変更する必要がある。呼び出し元の `main()` は既に `async` なので `await writeEnvFile(...)` に変更。

### TODO-3: AUTH_SECRET の復号値優先利用（MAJOR 3）

**ファイル**: `scripts/worktree/dev.ts` L483-487

現状: 復号成功・失敗に関わらず `generateAuthSecret()` で新規生成

修正:
```typescript
// 復号した内容からAUTH_SECRETを抽出（存在すれば再利用）
let authSecret: string;
if (decryptedSuccessfully) {
    const match = baseEnvContent.match(/^AUTH_SECRET=(.+)$/m);
    if (match && match[1]) {
        authSecret = match[1];
        log("AUTH_SECRET を .env.local から復元しました（セッション維持）");
    } else {
        authSecret = generateAuthSecret();
        log("AUTH_SECRET が .env.local に未定義のため新規生成しました");
    }
} else {
    authSecret = generateAuthSecret();
}
```

これにより:
- 復号成功時: `.env.local` の `AUTH_SECRET` を再利用 → セッション維持
- 復号成功だが `AUTH_SECRET` 未定義: 新規生成（初回セットアップ等）
- 復号失敗時: 新規生成（フォールバック動作）

## 実行順序

```
TODO-1（dotenvxチェック撤廃）
  ↓ 同時実施可能
TODO-2（fail-close化）+ TODO-3（AUTH_SECRET復元）
```

3つとも `writeEnvFile` 内の変更なので、1回の編集で一括適用が効率的。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `scripts/worktree/dev.ts` | writeEnvFile: dotenvxチェック撤廃、fail-close、AUTH_SECRET復元、async化 |

## 検証

- [ ] `pnpm dev` で .env.local が復号され、AUTH_SECRETが復元されることを確認（ログ出力）
- [ ] dotenvx / npx が利用不可の環境で .env.example フォールバックが動作することを確認
- [ ] `.env.local` 存在 + 復号失敗時にプロンプトが表示され、N で終了することを確認
- [ ] `pnpm prepush`（lint + typecheck + test）が通ること
