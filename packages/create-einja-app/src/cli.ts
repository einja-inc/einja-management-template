import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createCommand } from "./commands/create.js";
import { setupCommand } from "./commands/setup.js";
import { addCommand } from "./commands/add.js";
import { syncCommand } from "./commands/sync.js";

// package.jsonからバージョン情報を読み込み
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const program = new Command();

program
  .name("create-einja-app")
  .description("CLI tool to create new projects with Einja Management Template")
  .version(packageJson.version);

// createコマンド
program
  .argument("[project-name]", "Project name")
  .option("--skip-git", "Skip git initialization")
  .option("--skip-install", "Skip package installation")
  .action(
    async (
      projectName: string | undefined,
      options: {
        skipGit?: boolean;
        skipInstall?: boolean;
      }
    ) => {
      await createCommand(projectName, options);
    }
  );

// setupコマンド
program
  .command("setup")
  .description("Setup tools for existing project")
  .action(async () => {
    await setupCommand();
  });

// addコマンド
program
  .command("add")
  .description("Add einja components to existing monorepo")
  .option("--all", "Select all components")
  .option("--dry-run", "Preview changes without making them")
  .action(
    async (options: { all?: boolean; dryRun?: boolean }) => {
      await addCommand({
        skipPrompts: options.all || false,
        dryRun: options.dryRun || false,
      });
    }
  );

// syncコマンド
program
  .command("sync")
  .description("Sync template files to existing project")
  .option("--categories <categories>", "Comma-separated list of categories to sync")
  .option("--all", "Sync all categories")
  .option("--dry-run", "Preview changes without making them")
  .option("--backup", "Create backup before syncing (default: true)", true)
  .option("--rollback", "Rollback to previous backup")
  .option("--force", "Force sync even with uncommitted changes")
  .action(
    async (options: {
      categories?: string;
      all?: boolean;
      dryRun?: boolean;
      backup?: boolean;
      rollback?: boolean;
      force?: boolean;
    }) => {
      await syncCommand({
        categories: options.categories?.split(","),
        all: options.all || false,
        dryRun: options.dryRun || false,
        backup: options.backup !== false, // デフォルトtrue
        rollback: options.rollback || false,
        force: options.force || false,
      });
    }
  );

program.parse();
