/**
 * GitHub CLI セットアップ確認・実行
 *
 * pnpm task:loop 実行前に GitHub CLI の準備を自動化する
 */

import { execSync, spawnSync } from "node:child_process";

// ANSI カラーコード（setup-dev.ts と同じパターン）
const colors = {
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
};

/**
 * ログ出力
 */
function log(prefix: string, message: string): void {
  console.log(`${prefix} ${message}`);
}

/**
 * 成功メッセージ
 */
function succeed(message: string): void {
  log(colors.green("✓"), message);
}

/**
 * 失敗メッセージ
 */
function fail(message: string): void {
  log(colors.red("✗"), message);
}

/**
 * OS 判定
 */
function getPlatform(): "macos" | "linux" | "windows" | "unknown" {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
}

/**
 * コマンドが存在するか確認
 */
function commandExists(cmd: string): boolean {
  try {
    const checkCmd =
      process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(checkCmd, { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * gh auth status の出力を解析
 */
interface GhAuthStatus {
  isAuthenticated: boolean;
  scopes: string[];
}

function parseGhAuthStatus(): GhAuthStatus {
  try {
    // gh auth status は認証済みの場合 exit code 0 を返す
    // stderr に出力されるため 2>&1 でリダイレクト
    const output = execSync("gh auth status 2>&1", {
      encoding: "utf-8",
      shell: true,
    });

    // Token scopes を解析
    // 形式: "  - Token scopes: 'copilot', 'read:project', 'repo', 'user'"
    const scopeMatch = output.match(/Token scopes:\s*([^\n]+)/);
    if (scopeMatch) {
      const scopesStr = scopeMatch[1];
      // 'scope1', 'scope2' 形式から抽出
      const scopes =
        scopesStr.match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
      return { isAuthenticated: true, scopes };
    }

    return { isAuthenticated: true, scopes: [] };
  } catch {
    return { isAuthenticated: false, scopes: [] };
  }
}

/**
 * gh CLI がインストールされているか確認し、未インストールの場合はインストール
 */
function ensureGhInstalled(): void {
  if (commandExists("gh")) {
    succeed("GitHub CLI (gh) は既にインストールされています");
    return;
  }

  const platform = getPlatform();

  if (platform === "macos") {
    if (commandExists("brew")) {
      console.log("   GitHub CLI をインストール中...");
      const result = spawnSync("brew", ["install", "gh"], { stdio: "inherit" });
      if (result.error || result.status !== 0) {
        fail("GitHub CLI のインストールに失敗しました");
        console.log(
          colors.yellow("   手動でインストールしてください: brew install gh")
        );
        process.exit(1);
      }
      succeed("GitHub CLI をインストールしました");
    } else {
      fail("Homebrew がインストールされていません");
      console.log(
        colors.yellow("   以下のいずれかの方法でインストールしてください:")
      );
      console.log(
        colors.gray("     1. Homebrew をインストール後: brew install gh")
      );
      console.log(
        colors.gray("     2. 公式インストーラー: https://cli.github.com/")
      );
      process.exit(1);
    }
  } else if (platform === "linux") {
    fail("GitHub CLI がインストールされていません");
    console.log(colors.yellow("   以下の方法でインストールしてください:"));
    console.log(
      colors.gray(
        "     https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
      )
    );
    process.exit(1);
  } else {
    fail("GitHub CLI がインストールされていません");
    console.log(
      colors.yellow("   https://cli.github.com/ からインストールしてください")
    );
    process.exit(1);
  }
}

/**
 * gh CLI が認証されているか確認し、未認証の場合は認証を実行
 */
function ensureGhAuthenticated(): void {
  const status = parseGhAuthStatus();

  if (status.isAuthenticated) {
    succeed("GitHub CLI は認証済みです");
    return;
  }

  console.log(colors.yellow("   GitHub CLI の認証が必要です"));
  console.log("   ブラウザで認証を行います...");

  // gh auth login を実行（対話的に認証）
  const result = spawnSync("gh", ["auth", "login", "--web"], {
    stdio: "inherit",
  });

  if (result.error || result.status !== 0) {
    fail("GitHub CLI の認証に失敗しました");
    console.log(
      colors.yellow("   手動で実行してください: gh auth login --web")
    );
    process.exit(1);
  }

  succeed("GitHub CLI の認証が完了しました");
}

/**
 * 必要な権限スコープが設定されているか確認し、不足している場合は追加
 */
function ensureRequiredScopes(): void {
  const status = parseGhAuthStatus();

  if (!status.isAuthenticated) {
    // 認証されていない場合はスキップ（ensureGhAuthenticated で処理済みのはず）
    return;
  }

  // 必要なスコープ: repo（Issue の読み書きに必要）
  const requiredScopes = ["repo"];
  const missingScopes = requiredScopes.filter(
    (s) => !status.scopes.includes(s)
  );

  if (missingScopes.length === 0) {
    succeed("必要な権限スコープが設定されています (repo)");
    return;
  }

  console.log(
    colors.yellow(`   不足している権限スコープ: ${missingScopes.join(", ")}`)
  );
  console.log("   権限を追加します...");

  // gh auth refresh でスコープを追加
  const result = spawnSync(
    "gh",
    ["auth", "refresh", "-s", missingScopes.join(",")],
    {
      stdio: "inherit",
    }
  );

  if (result.error || result.status !== 0) {
    fail("権限スコープの追加に失敗しました");
    console.log(
      colors.yellow(
        `   手動で実行してください: gh auth refresh -s ${missingScopes.join(",")}`
      )
    );
    process.exit(1);
  }

  succeed("権限スコープを追加しました");
}

/**
 * GitHub CLI のセットアップを確認・実行
 *
 * 以下の順序で確認・セットアップを行う:
 * 1. gh コマンドの存在確認（未インストール → 自動インストールまたは手順案内）
 * 2. 認証状態の確認（未認証 → gh auth login を実行）
 * 3. token scopes の確認（repo スコープ不足 → gh auth refresh で追加）
 */
export function ensureGhSetup(): void {
  console.log("\n🔧 GitHub CLI セットアップ確認...\n");

  // 1. インストール確認
  ensureGhInstalled();

  // 2. 認証確認
  ensureGhAuthenticated();

  // 3. スコープ確認
  ensureRequiredScopes();

  console.log("");
}
