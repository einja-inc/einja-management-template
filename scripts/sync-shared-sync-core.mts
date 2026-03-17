#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const sourceDir = path.join(projectRoot, "shared", "sync-core");
const targetDirs = {
  "create-app": path.join(projectRoot, "packages", "create-app", "src", "internal", "sync-core"),
  cli: path.join(projectRoot, "packages", "cli", "src", "internal", "sync-core"),
} as const;

type TargetName = keyof typeof targetDirs;

const requestedTargets = process.argv.slice(2) as TargetName[];
const selectedTargets =
  requestedTargets.length > 0 ? requestedTargets : (Object.keys(targetDirs) as TargetName[]);

async function main() {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const sourceFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));

  for (const target of selectedTargets) {
    const targetDir = targetDirs[target];
    if (!targetDir) {
      throw new Error(`Unknown target: ${target}`);
    }

    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });

    for (const sourceFile of sourceFiles) {
      const sourcePath = path.join(sourceDir, sourceFile.name);
      const targetPath = path.join(targetDir, sourceFile.name);
      const content = await readFile(sourcePath, "utf-8");
      const banner =
        "// AUTO-GENERATED FILE. DO NOT EDIT.\n" +
        `// Source: shared/sync-core/${sourceFile.name}\n\n`;

      await writeFile(targetPath, `${banner}${content}`, "utf-8");
    }

    console.log(`synced sync-core -> ${path.relative(projectRoot, targetDir)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
