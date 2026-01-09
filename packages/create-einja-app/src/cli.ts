import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createCommand } from "./commands/create.js";
import { setupCommand } from "./commands/setup.js";

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
  .option("--template <template>", "Template to use", "turborepo-pandacss")
  .option("--skip-git", "Skip git initialization")
  .option("--skip-install", "Skip package installation")
  .option("-y, --yes", "Skip interactive prompts")
  .action(
    async (
      projectName: string | undefined,
      options: {
        template: string;
        skipGit?: boolean;
        skipInstall?: boolean;
        yes?: boolean;
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

program.parse();
