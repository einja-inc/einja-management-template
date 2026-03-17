import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runSyncSharedSyncCore, SyncSharedSyncCoreCheckError } from "./sync-shared-sync-core.mts";

async function setupFixture() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "sync-shared-sync-core-"));
  const sourceDir = path.join(projectRoot, "shared", "sync-core");
  const targetDir = path.join(projectRoot, "packages", "example", "src", "internal", "sync-core");

  await mkdir(sourceDir, { recursive: true });
  await writeFile(path.join(sourceDir, "index.ts"), "export const value = 1;\n", "utf-8");

  return { projectRoot, sourceDir, targetDir };
}

test("sync mode generates files with banner", async () => {
  const { projectRoot, sourceDir, targetDir } = await setupFixture();

  await runSyncSharedSyncCore({
    args: ["example"],
    projectRoot,
    sourceDir,
    targetDirs: { example: targetDir },
    log: () => {},
  });

  const generated = await readFile(path.join(targetDir, "index.ts"), "utf-8");
  assert.equal(
    generated,
    "// AUTO-GENERATED FILE. DO NOT EDIT.\n// Source: shared/sync-core/index.ts\n\nexport const value = 1;\n"
  );
});

test("check mode fails when generated file is outdated", async () => {
  const { projectRoot, sourceDir, targetDir } = await setupFixture();

  await mkdir(targetDir, { recursive: true });
  await writeFile(
    path.join(targetDir, "index.ts"),
    "// AUTO-GENERATED FILE. DO NOT EDIT.\n// Source: shared/sync-core/index.ts\n\nexport const value = 2;\n",
    "utf-8"
  );

  await assert.rejects(
    () =>
      runSyncSharedSyncCore({
        args: ["--check", "example"],
        projectRoot,
        sourceDir,
        targetDirs: { example: targetDir },
        log: () => {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof SyncSharedSyncCoreCheckError);
      assert.deepEqual(error.details, [
        "outdated generated file: packages/example/src/internal/sync-core/index.ts",
      ]);
      return true;
    }
  );
});
