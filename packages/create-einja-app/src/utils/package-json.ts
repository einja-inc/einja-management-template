import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileExists } from "./fs.js";

type PackageJson = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  volta?: {
    node?: string;
    pnpm?: string;
  };
  "lint-staged"?: Record<string, string | string[]>;
  [key: string]: unknown;
};

/**
 * package.jsonを読み込む
 */
export function readPackageJson(targetDir: string): PackageJson {
  const packageJsonPath = join(targetDir, "package.json");

  if (!fileExists(packageJsonPath)) {
    return {};
  }

  const content = readFileSync(packageJsonPath, "utf-8");
  return JSON.parse(content) as PackageJson;
}

/**
 * package.jsonに書き込む
 */
export function writePackageJson(targetDir: string, data: PackageJson): void {
  const packageJsonPath = join(targetDir, "package.json");
  const content = JSON.stringify(data, null, 2);
  writeFileSync(packageJsonPath, `${content}\n`, "utf-8");
}

/**
 * package.jsonにスクリプトを追加する
 */
export function addScripts(
  targetDir: string,
  scripts: Record<string, string>
): void {
  const pkg = readPackageJson(targetDir);
  pkg.scripts = { ...pkg.scripts, ...scripts };
  writePackageJson(targetDir, pkg);
}

/**
 * package.jsonに依存関係を追加する
 */
export function addDependencies(
  targetDir: string,
  dependencies: Record<string, string>,
  dev = false
): void {
  const pkg = readPackageJson(targetDir);

  if (dev) {
    pkg.devDependencies = { ...pkg.devDependencies, ...dependencies };
  } else {
    pkg.dependencies = { ...pkg.dependencies, ...dependencies };
  }

  writePackageJson(targetDir, pkg);
}

/**
 * package.jsonにVoltaフィールドを追加する
 */
export function addVoltaField(
  targetDir: string,
  nodeVersion: string,
  pnpmVersion: string
): void {
  const pkg = readPackageJson(targetDir);
  pkg.volta = {
    node: nodeVersion,
    pnpm: pnpmVersion,
  };
  writePackageJson(targetDir, pkg);
}

/**
 * package.jsonにlint-staged設定を追加する
 */
export function addLintStaged(
  targetDir: string,
  config: Record<string, string | string[]>
): void {
  const pkg = readPackageJson(targetDir);
  pkg["lint-staged"] = { ...pkg["lint-staged"], ...config };
  writePackageJson(targetDir, pkg);
}
