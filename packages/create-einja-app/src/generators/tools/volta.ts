import { join } from "node:path";
import type { ToolSetupOptions } from "../../types/index.js";
import { writeWithStrategy } from "../../utils/fs.js";
import { addVoltaField } from "../../utils/package-json.js";

const NODE_VERSION = "22.16.0";
const PNPM_VERSION = "9.15.0";

const NODE_VERSION_CONTENT = `${NODE_VERSION}
`;

/**
 * Voltaのセットアップを実行する
 *
 * AC-005-1: package.jsonにvoltaフィールドが追加される
 * AC-005-2: .node-version ファイルが生成される
 */
export function setupVolta(options: ToolSetupOptions): void {
  const { targetDir, conflictStrategy } = options;

  addVoltaField(targetDir, NODE_VERSION, PNPM_VERSION);

  const nodeVersionPath = join(targetDir, ".node-version");
  writeWithStrategy(nodeVersionPath, NODE_VERSION_CONTENT, conflictStrategy);
}
