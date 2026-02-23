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
