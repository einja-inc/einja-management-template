import path from "node:path";
import { execSync } from "node:child_process";
import fs from "fs-extra";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/**
 * パッケージマネージャを検出する
 * 検出順: packageManager フィールド → lockfile → npm fallback
 */
export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  // 1. package.json の packageManager フィールドをチェック
  const packageJsonPath = path.join(cwd, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      if (packageJson.packageManager) {
        const pm = packageJson.packageManager as string;
        if (pm.startsWith("pnpm")) return "pnpm";
        if (pm.startsWith("yarn")) return "yarn";
        if (pm.startsWith("bun")) return "bun";
        if (pm.startsWith("npm")) return "npm";
      }
    } catch {
      // パース失敗時はlockfileチェックに進む
    }
  }

  // 2. lockfile の存在をチェック
  const lockfiles: [string, PackageManager][] = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ];

  for (const [lockfile, pm] of lockfiles) {
    if (await fs.pathExists(path.join(cwd, lockfile))) {
      return pm;
    }
  }

  // 3. fallback
  return "npm";
}

/**
 * devDependencies 追加コマンドを生成
 */
export function getAddDevCommand(pm: PackageManager, packages: string[]): string {
  const pkgStr = packages.join(" ");
  switch (pm) {
    case "pnpm":
      return `pnpm add -D ${pkgStr}`;
    case "yarn":
      return `yarn add -D ${pkgStr}`;
    case "bun":
      return `bun add -D ${pkgStr}`;
    case "npm":
      return `npm install -D ${pkgStr}`;
  }
}

/**
 * scripts 内の {pm} プレースホルダーを検出したパッケージマネージャで置換
 */
export function resolveScriptPlaceholders(
  scripts: Record<string, string>,
  pm: PackageManager
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(scripts)) {
    resolved[key] = value.replace(/\{pm\}/g, pm);
  }
  return resolved;
}
