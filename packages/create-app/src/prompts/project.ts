import inquirer from "inquirer";
import type { ProjectConfig, WorktreeConfig, App } from "@/types/index.js";

export type { ProjectConfig, WorktreeConfig, App };

/**
 * プロジェクト作成用プロンプトを実行
 * @param defaultProjectName - デフォルトのプロジェクト名
 * @returns ProjectConfig - プロジェクト設定
 */
export async function promptProjectConfig(
  defaultProjectName?: string
): Promise<ProjectConfig> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "プロジェクト名:",
      default: defaultProjectName || "my-project",
      validate: (input: string): boolean | string => {
        // 英数字・ハイフン・アンダースコアのみ許可、先頭は英字、1〜50文字
        const regex = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
        if (!regex.test(input)) {
          return "プロジェクト名は英字で始まり、英数字・ハイフン・アンダースコアのみ使用できます（1〜50文字）";
        }
        return true;
      },
    },
    {
      type: "confirm",
      name: "useCurrentDir",
      message: "今いるディレクトリに直接作成しますか？（Noならサブディレクトリを作成）",
      default: false,
    },
    {
      type: "input",
      name: "packageScope",
      message: "パッケージスコープ:",
      default: "@repo",
      validate: (input: string): boolean | string => {
        // @で始まり、英数字・ハイフン・アンダースコアのみ許可
        const regex = /^@[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
        if (!regex.test(input)) {
          return "パッケージスコープは@で始まり、英数字・ハイフン・アンダースコアのみ使用できます";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "authMethod",
      message: "認証機能:",
      choices: [
        { name: "NextAuth.js を使用", value: "default" },
        { name: "なし（認証ファイルを除外）", value: "none" },
      ],
      default: "default",
    },
    {
      type: "confirm",
      name: "setupEinjaCli",
      message: "@einja-inc/dev-cli を自動セットアップしますか？",
      default: true,
    },
    {
      type: "confirm",
      name: "customizeWorktree",
      message: "Worktree設定をカスタマイズしますか？",
      default: false,
    },
  ]);

  // ツールは全て有効（固定）
  const tools = {
    direnv: true,
    dotenvx: true,
    mise: true,
    biome: true,
    husky: true,
  };

  let worktreeConfig: WorktreeConfig | undefined;

  // Worktree設定カスタマイズ
  if (answers.customizeWorktree) {
    const worktreeAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "postgresPort",
        message: "PostgreSQLポート番号:",
        default: "25432",
        validate: (input: string): boolean | string => {
          const port = Number.parseInt(input, 10);
          if (Number.isNaN(port) || port < 1024 || port > 65535) {
            return "ポート番号は1024〜65535の範囲で指定してください";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "containerName",
        message: "Dockerコンテナ名:",
        default: `${answers.projectName}-postgres`,
      },
      {
        type: "input",
        name: "appId",
        message: "アプリケーションID:",
        default: "web",
      },
      {
        type: "input",
        name: "portRangeStart",
        message: "アプリポート範囲開始:",
        default: "3000",
        validate: (input: string): boolean | string => {
          const port = Number.parseInt(input, 10);
          if (Number.isNaN(port) || port < 1024 || port > 65535) {
            return "ポート番号は1024〜65535の範囲で指定してください";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "rangeSize",
        message: "ポート範囲サイズ:",
        default: "1000",
        validate: (input: string): boolean | string => {
          const size = Number.parseInt(input, 10);
          if (Number.isNaN(size) || size < 1 || size > 10000) {
            return "範囲サイズは1〜10000の範囲で指定してください";
          }
          return true;
        },
      },
    ]);

    worktreeConfig = {
      postgres: {
        port: Number.parseInt(worktreeAnswers.postgresPort, 10),
        containerName: worktreeAnswers.containerName,
      },
      apps: [
        {
          id: worktreeAnswers.appId,
          portRangeStart: Number.parseInt(worktreeAnswers.portRangeStart, 10),
          rangeSize: Number.parseInt(worktreeAnswers.rangeSize, 10),
        },
      ],
    };
  }

  return {
    projectName: answers.projectName,
    packageScope: answers.packageScope,
    template: "default" as const,
    authMethod: answers.authMethod,
    tools,
    setupEinjaCli: answers.setupEinjaCli,
    worktreeConfig,
    useCurrentDir: answers.useCurrentDir,
  };
}
