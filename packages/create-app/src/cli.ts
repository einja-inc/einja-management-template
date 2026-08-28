import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createCommand } from "./commands/create.js";
import { syncCommand } from "./commands/sync.js";

// package.jsonからバージョン情報を読み込み
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const program = new Command();

/**
 * カンマ区切り文字列を配列に変換するヘルパー
 * - 空文字・undefined は undefined を返す
 * - 各要素は trim され、空文字は除外される
 * - 全要素が空文字の場合は undefined を返す
 *
 * 例:
 *   parseList(undefined) → undefined
 *   parseList("") → undefined
 *   parseList("  ,  ,  ") → undefined
 *   parseList("env, tools") → ["env", "tools"]
 */
const parseList = (v?: string): string[] | undefined => {
  if (!v) return undefined;
  const parsed = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
};

program
  .name("create-app")
  .description("CLI tool to create new projects with Einja Management Template")
  .version(packageJson.version);

// createコマンド
program
  .argument("[project-name]", "Project name")
  .option("--skip-git", "Skip git initialization")
  .option("--skip-install", "Skip package installation")
  .option("-y, --yes", "Use default values without prompts")
  .action(
    async (
      projectName: string | undefined,
      options: {
        skipGit?: boolean;
        skipInstall?: boolean;
        yes?: boolean;
      }
    ) => {
      await createCommand(projectName, options);
    }
  );

// syncコマンド
program
  .command("sync")
  .description("Sync template files to existing project")
  .option(
    "--categories <categories>",
    "Comma-separated list of categories to sync (e.g. env,tools,packages)"
  )
  .option("--apps-detail <apps>", "Comma-separated list of apps to limit sync (e.g. web,admin)")
  .option(
    "--packages-detail <packages>",
    "Comma-separated list of packages to limit sync (e.g. admin-ui)"
  )
  .option("--all", "Sync all categories")
  .option("--dry-run", "Preview changes without making them")
  .option("--backup", "Create backup before syncing (default: true)", true)
  .option("--rollback", "Rollback to previous backup")
  .option("--force", "Force sync even with uncommitted changes")
  .option(
    "-y, --yes",
    "Sync safe categories without confirmation prompts (excludes apps, packages). When combined with --categories, suppresses interactive prompts for any category."
  )
  .action(
    async (options: {
      categories?: string;
      appsDetail?: string;
      packagesDetail?: string;
      all?: boolean;
      dryRun?: boolean;
      backup?: boolean;
      rollback?: boolean;
      force?: boolean;
      yes?: boolean;
    }) => {
      try {
        await syncCommand({
          categories: parseList(options.categories),
          appsDetail: parseList(options.appsDetail),
          packagesDetail: parseList(options.packagesDetail),
          all: options.all || false,
          dryRun: options.dryRun || false,
          backup: options.backup !== false, // デフォルトtrue
          rollback: options.rollback || false,
          force: options.force || false,
          yes: options.yes || false,
        });
      } catch (error) {
        // syncCommand 内部で発生した例外（バリデーションエラー等）を
        // 確実に fail-fast させるため、明示的に process.exit(1) する
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }
  );

program.parse();
