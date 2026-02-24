import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ValidationResult {
  isValid: boolean;
  violations: PlaceholderViolation[];
}

export interface PlaceholderViolation {
  filePath: string;
  line: number;
  placeholder: string;
  context: string;
}

const PLACEHOLDER_PATTERNS = [
  "@repo/",
  "{{packageName}}",
  "{{projectName}}",
  "{{description}}",
];

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".mp4",
  ".mp3",
]);

const EXCLUDED_DIRS = ["node_modules/", ".git/", "dist/", ".next/"];

function isBinaryFile(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = filePath.substring(lastDot).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function isExcludedDir(filePath: string): boolean {
  return EXCLUDED_DIRS.some((dir) => filePath.includes(dir));
}

/**
 * 指定されたファイル群にテンプレートプレースホルダーが残っていないか検証する
 */
export async function validatePlaceholders(
  targetDir: string,
  filePaths: string[],
): Promise<ValidationResult> {
  const violations: PlaceholderViolation[] = [];

  for (const filePath of filePaths) {
    if (isBinaryFile(filePath) || isExcludedDir(filePath)) {
      continue;
    }

    try {
      const fullPath = join(targetDir, filePath);
      const content = await readFile(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        for (const pattern of PLACEHOLDER_PATTERNS) {
          if (line.includes(pattern)) {
            violations.push({
              filePath,
              line: i + 1,
              placeholder: pattern,
              context: line.trim(),
            });
          }
        }
      }
    } catch {
      // ファイル読み込み失敗時はスキップして続行
      continue;
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}
