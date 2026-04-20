import * as fs from "node:fs";
import * as path from "node:path";
import { segmentToLabel } from "./path-utils";
import type { AppScanTarget } from "./types";

export interface SpecViewerConfig {
  apps: AppScanTarget[];
  docsDir: string;
  issueSpecsDir: string;
  integrationTestDir?: string;
}

function getMonorepoRoot(): string {
  return path.resolve(process.cwd(), "..", "..");
}

export function getConfig(): SpecViewerConfig {
  const monorepoRoot = getMonorepoRoot();
  const appsDir = path.join(monorepoRoot, "apps");
  const apps: AppScanTarget[] = [];

  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "spec-viewer") continue;
      const appDir = path.join("apps", entry.name, "src", "app");
      if (fs.existsSync(path.join(monorepoRoot, appDir))) {
        // Check for QA test directory
        const qaTestDir = path.join("docs", "qa-tests", "pages", entry.name);
        const hasQATestDir = fs.existsSync(path.join(monorepoRoot, qaTestDir));
        apps.push({
          name: entry.name,
          label: segmentToLabel(entry.name),
          appDir,
          qaTestDir: hasQATestDir ? qaTestDir : undefined,
        });
      }
    }
  }

  // Sort alphabetically, but put "web" first if it exists
  apps.sort((a, b) => {
    if (a.name === "web") return -1;
    if (b.name === "web") return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    apps,
    docsDir: "docs",
    issueSpecsDir: "docs/specs/issues",
    integrationTestDir: "docs/qa-tests/integration",
  };
}

export { getMonorepoRoot };
