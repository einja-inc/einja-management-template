import inquirer from "inquirer";

/**
 * SetupConfig型
 * 既存プロジェクトへのツール追加設定
 */
export interface SetupConfig {
  tools: {
    direnv: boolean;
    dotenvx: boolean;
    volta: boolean;
    biome: boolean;
    husky: boolean;
  };
  conflictStrategy: "merge" | "overwrite" | "skip";
}

/**
 * セットアップ用プロンプトを実行
 * @returns SetupConfig - セットアップ設定
 */
export async function promptSetupConfig(): Promise<SetupConfig> {
  const answers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "tools",
      message: "セットアップするツールを選択（複数選択可）:",
      choices: [
        {
          name: "direnv（ディレクトリごとの環境変数管理）",
          value: "direnv",
          checked: true,
        },
        {
          name: "dotenvx（.env暗号化）",
          value: "dotenvx",
          checked: true,
        },
        {
          name: "Volta（Node.jsバージョン管理）",
          value: "volta",
          checked: true,
        },
        {
          name: "Biome（Linter / Formatter）",
          value: "biome",
          checked: false,
        },
        {
          name: "Husky + lint-staged（Git hooks）",
          value: "husky",
          checked: false,
        },
      ],
    },
    {
      type: "list",
      name: "conflictStrategy",
      message: "既存ファイルがある場合の動作:",
      choices: [
        {
          name: "マージ（既存設定を保持しつつ追加）",
          value: "merge",
        },
        {
          name: "上書き",
          value: "overwrite",
        },
        {
          name: "スキップ",
          value: "skip",
        },
      ],
      default: "merge",
    },
  ]);

  // ツール選択を boolean フラグに変換
  const toolsArray = answers.tools as string[];
  const tools = {
    direnv: toolsArray.includes("direnv"),
    dotenvx: toolsArray.includes("dotenvx"),
    volta: toolsArray.includes("volta"),
    biome: toolsArray.includes("biome"),
    husky: toolsArray.includes("husky"),
  };

  return {
    tools,
    conflictStrategy: answers.conflictStrategy,
  };
}
