#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(currentDir, "..");
const defaultSourceDir = path.join(defaultProjectRoot, "shared", "sync-core");
const defaultTargetDirs = {
  "create-app": path.join(defaultProjectRoot, "packages", "create-app", "src", "internal", "sync-core"),
  cli: path.join(defaultProjectRoot, "packages", "cli", "src", "internal", "sync-core"),
} as const;

export class SyncSharedSyncCoreCheckError extends Error {
  details: string[];

  constructor(details: string[]) {
    super("shared/sync-core と生成コードが未同期です。`pnpm sync:shared:sync-core` を実行してください。");
    this.details = details;
  }
}

export interface RunSyncSharedSyncCoreOptions {
  args?: string[];
  projectRoot?: string;
  sourceDir?: string;
  targetDirs?: Record<string, string>;
  log?: (message: string) => void;
}

function buildGeneratedContent(sourceFileName: string, content: string): string {
  const banner =
    "// AUTO-GENERATED FILE. DO NOT EDIT.\n" +
    `// Source: shared/sync-core/${sourceFileName}\n\n`;

  return `${banner}${content}`;
}

async function checkTarget(
  sourceFiles: string[],
  targetDir: string,
  sourceDir: string,
  projectRoot: string
): Promise<string[]> {
  const errors: string[] = [];
  const expectedFiles = new Set(sourceFiles);
  let targetEntries: string[] = [];

  try {
    const entries = await readdir(targetDir, { withFileTypes: true });
    targetEntries = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      errors.push(`${path.relative(projectRoot, targetDir)} is missing`);
      return errors;
    }
    throw error;
  }

  for (const targetEntry of targetEntries) {
    if (!expectedFiles.has(targetEntry)) {
      errors.push(
        `unexpected generated file: ${path.relative(projectRoot, path.join(targetDir, targetEntry))}`
      );
    }
  }

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.join(sourceDir, sourceFile);
    const targetPath = path.join(targetDir, sourceFile);

    if (!targetEntries.includes(sourceFile)) {
      errors.push(`missing generated file: ${path.relative(projectRoot, targetPath)}`);
      continue;
    }

    const [sourceContent, targetContent] = await Promise.all([
      readFile(sourcePath, "utf-8"),
      readFile(targetPath, "utf-8"),
    ]);
    const expectedContent = buildGeneratedContent(sourceFile, sourceContent);

    if (targetContent !== expectedContent) {
      errors.push(`outdated generated file: ${path.relative(projectRoot, targetPath)}`);
    }
  }

  return errors;
}

export async function runSyncSharedSyncCore(options: RunSyncSharedSyncCoreOptions = {}) {
  const projectRoot = options.projectRoot ?? defaultProjectRoot;
  const sourceDir = options.sourceDir ?? defaultSourceDir;
  const targetDirs = options.targetDirs ?? defaultTargetDirs;
  const rawArgs = options.args ?? process.argv.slice(2);
  const checkMode = rawArgs.includes("--check");
  const requestedTargets = rawArgs.filter((arg) => arg !== "--check");
  const selectedTargets =
    requestedTargets.length > 0 ? requestedTargets : Object.keys(targetDirs);
  const log = options.log ?? console.log;

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const sourceFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name);
  const allErrors: string[] = [];

  for (const target of selectedTargets) {
    const targetDir = targetDirs[target];
    if (!targetDir) {
      throw new Error(`Unknown target: ${target}`);
    }

    if (checkMode) {
      const errors = await checkTarget(sourceFiles, targetDir, sourceDir, projectRoot);
      allErrors.push(...errors);
      continue;
    }

    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });

    for (const sourceFile of sourceFiles) {
      const sourcePath = path.join(sourceDir, sourceFile);
      const targetPath = path.join(targetDir, sourceFile);
      const content = await readFile(sourcePath, "utf-8");
      await writeFile(targetPath, buildGeneratedContent(sourceFile, content), "utf-8");
    }

    log(`synced sync-core -> ${path.relative(projectRoot, targetDir)}`);
  }

  if (checkMode) {
    if (allErrors.length > 0) {
      throw new SyncSharedSyncCoreCheckError(allErrors);
    }

    log("shared/sync-core generated copies are up to date");
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryUrl && import.meta.url === entryUrl) {
  runSyncSharedSyncCore().catch((error) => {
    if (error instanceof SyncSharedSyncCoreCheckError) {
      console.error(error.message);
      for (const detail of error.details) {
        console.error(`- ${detail}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}
