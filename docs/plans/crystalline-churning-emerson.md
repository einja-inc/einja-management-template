# Plan: direnv干渉によるsync依存関係インストール失敗の修正

## Context

利用者プロジェクトで `npx @einja/dev-cli sync` 実行時、最終ステップの依存関係インストール(`pnpm add -D typescript`)が `direnv: error .envrc is blocked` で失敗する。`execSync` の子プロセスでdirenvフックが発動し、`.envrc` がブロック状態だとエラーになる。

## 修正方針

インストール失敗時にdirenvエラーを検出し、確認プロンプト付きで `direnv allow` を実行してからリトライする。`create-einja-app/src/utils/post-sync-actions.ts` の既存パターン（`isDirenvAvailable` + `inquirer.prompt`）に合わせる。

## 対象ファイル

- `packages/cli/src/lib/dependency-checker.ts`

## 変更内容

### 1. direnvヘルパー関数を追加（ファイル先頭のインポート後）

`create-einja-app` の既存パターンを踏襲:

```ts
function isDirenvAvailable(): boolean {
  try {
    execSync("which direnv", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isDirenvBlocked(cwd: string): boolean {
  try {
    const result = execSync("direnv status", { cwd, stdio: "pipe", timeout: 5000 });
    return result.toString().includes("Found RC allowed false");
  } catch {
    return false;
  }
}
```

### 2. インストール catch ブロック修正（行228-239）

direnvブロック検出 → 確認プロンプト → allow → リトライ:

```ts
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  if (errorMsg.includes("direnv") || errorMsg.includes(".envrc")) {
    if (isDirenvAvailable() && !isNonInteractive(options)) {
      spinner.warn("direnv がブロックされているため失敗しました");
      const { shouldAllow } = await inquirer.prompt([{
        type: "confirm",
        name: "shouldAllow",
        message: "direnv allow を実行してリトライしますか？",
        default: true,
      }]);
      if (shouldAllow) {
        try {
          execSync("direnv allow", { cwd, stdio: "pipe", timeout: 10000 });
          execSync(addCmd, { cwd, stdio: "pipe", timeout: 120000 });
          spinner.succeed(`devDependencies インストール完了: ${checkResult.missingDevDeps.join(", ")}`);
          result.devDepsInstalled = true;
        } catch (retryError) {
          spinner.fail("devDependencies のインストールに失敗しました");
          console.error(chalk.red(`    ${retryError instanceof Error ? retryError.message : String(retryError)}`));
        }
      }
    } else {
      spinner.fail("devDependencies のインストールに失敗しました");
      console.error(chalk.red(`    ${errorMsg}`));
      console.log(chalk.yellow("    💡 `direnv allow` を実行してから再度 sync を実行してください"));
    }
  } else {
    spinner.fail("devDependencies のインストールに失敗しました");
    console.error(chalk.red(`    ${errorMsg}`));
  }
}
```

## ポイント

- 対話モード: 確認プロンプト → allow → リトライ
- 非対話モード（CI等）: エラーメッセージ + `direnv allow` の案内のみ
- direnv未インストール: 案内メッセージのみ
- direnvと無関係のエラー: 従来通りエラー表示

## 検証方法

1. `pnpm --filter @einja/dev-cli build` でビルド成功を確認
2. `pnpm prepush`（lint + typecheck + test）が通ることを確認
