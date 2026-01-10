import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  AddOptions,
  PackageComponent,
  SyncMetadata,
} from "../../types/index.js";
import { mergeAndWriteFile } from "../../utils/merger.js";
import * as logger from "../../utils/logger.js";

/**
 * packages/ ディレクトリにコンポーネントを追加
 */
export async function addPackages(
  options: AddOptions,
  components: PackageComponent[],
  syncMetadata: SyncMetadata
): Promise<{ added: string[]; skipped: string[]; merged: string[] }> {
  const added: string[] = [];
  const skipped: string[] = [];
  const merged: string[] = [];

  const { targetDir, templateDir, config } = options;

  for (const component of components) {
    const componentName =
      component === "front-core"
        ? "front-core"
        : component === "server-core"
          ? "server-core"
          : component === "config"
            ? "config"
            : "ui";

    const srcDir = join(templateDir, "packages", componentName);
    const destDir = join(targetDir, "packages", componentName);

    logger.info(`Adding package component: ${componentName}`);

    await copyDirectory(
      srcDir,
      destDir,
      { added, skipped, merged },
      config.dryRun,
      syncMetadata
    );
  }

  return { added, skipped, merged };
}

/**
 * ディレクトリを再帰的にコピー
 */
async function copyDirectory(
  srcDir: string,
  destDir: string,
  result: { added: string[]; skipped: string[]; merged: string[] },
  dryRun: boolean,
  syncMetadata: SyncMetadata
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, result, dryRun, syncMetadata);
    } else {
      if (!dryRun) {
        const mergeResult = await mergeAndWriteFile(
          srcPath,
          destPath,
          syncMetadata
        );

        if (mergeResult.action === "created") {
          result.added.push(destPath);
        } else if (mergeResult.action === "skipped") {
          result.skipped.push(destPath);
        } else if (mergeResult.action === "merged") {
          result.merged.push(destPath);
        }
      } else {
        // dry-runモードではスキップ
        result.skipped.push(destPath);
      }
    }
  }
}
