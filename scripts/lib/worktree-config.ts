import fs from "node:fs";
import path from "node:path";

export interface AppConfig {
  id: string;
  portRangeStart: number;
  rangeSize: number;
}

export interface PostgresConfig {
  port: number;
  containerName: string;
}

export interface WorktreeConfig {
  schemaVersion: number;
  postgres: PostgresConfig;
  apps: AppConfig[];
}

const defaultWorktreeConfig: WorktreeConfig = {
  schemaVersion: 1,
  postgres: { port: 25432, containerName: "einja-management-postgres" },
  apps: [{ id: "web", portRangeStart: 3000, rangeSize: 1000 }],
};

function findProjectRoot(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

export function loadWorktreeConfig(projectRoot?: string): WorktreeConfig {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return defaultWorktreeConfig;

  const configPath = path.join(root, "worktree.config.json");
  if (!fs.existsSync(configPath)) return defaultWorktreeConfig;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return {
      schemaVersion: raw.schemaVersion ?? 1,
      postgres: {
        port: typeof raw.postgres?.port === "number" ? raw.postgres.port : 25432,
        containerName: typeof raw.postgres?.containerName === "string"
          ? raw.postgres.containerName : "einja-management-postgres",
      },
      apps: Array.isArray(raw.apps)
        ? raw.apps.filter((a: unknown) =>
            typeof a === "object" && a !== null && "id" in a && "portRangeStart" in a
          )
        : defaultWorktreeConfig.apps,
    };
  } catch {
    console.warn("worktree.config.json の読み込みに失敗。デフォルト設定を使用します。");
    return defaultWorktreeConfig;
  }
}
