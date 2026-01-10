import inquirer from "inquirer";
import type {
  AddConfig,
  PackageComponent,
  AppComponent,
} from "../types/index.js";

/**
 * デフォルトの追加設定を取得
 * skipPrompts=true 時に使用
 */
export function getDefaultAddConfig(): AddConfig {
  return {
    components: {
      packages: true,
      apps: true,
      config: true,
    },
    packageComponents: ["front-core", "server-core", "config", "ui"],
    appComponents: ["web"],
    dryRun: false,
  };
}

/**
 * 追加用プロンプトを実行
 * @param dryRun - dry-runモードかどうか
 * @returns AddConfig - 追加設定
 */
export async function promptAddConfig(dryRun: boolean): Promise<AddConfig> {
  // ステージ1: コンポーネント種別選択
  const componentAnswers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "components",
      message: "追加するコンポーネントを選択（Spaceで選択、Enterで確定）:",
      choices: [
        {
          name: "packages/ - 共通パッケージ（front-core, server-core, config, ui）",
          value: "packages",
          checked: true,
        },
        {
          name: "apps/ - アプリテンプレート",
          value: "apps",
          checked: true,
        },
        {
          name: "直下設定ファイル - turbo.json, pnpm-workspace.yaml 等",
          value: "config",
          checked: true,
        },
      ],
    },
  ]);

  const selectedComponents = componentAnswers.components as string[];
  const hasPackages = selectedComponents.includes("packages");
  const hasApps = selectedComponents.includes("apps");
  const hasConfig = selectedComponents.includes("config");

  // ステージ2: packages詳細選択
  let packageComponents: PackageComponent[] = [];
  if (hasPackages) {
    const packageAnswers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "packages",
        message: "追加するパッケージを選択:",
        choices: [
          {
            name: "front-core - フロントエンド共通層（認証設定、hooks、utils）",
            value: "front-core",
            checked: true,
          },
          {
            name: "server-core - バックエンド共通層（Prisma、ドメインロジック）",
            value: "server-core",
            checked: true,
          },
          {
            name: "config - 共通設定（Biome, TypeScript, Panda CSS）",
            value: "config",
            checked: true,
          },
          {
            name: "ui - 共通UIコンポーネント（shadcn/ui）",
            value: "ui",
            checked: true,
          },
        ],
        validate: (input: string[]): boolean | string => {
          if (input.length === 0) {
            return "少なくとも1つのパッケージを選択してください";
          }
          return true;
        },
      },
    ]);
    packageComponents = packageAnswers.packages as PackageComponent[];
  }

  // ステージ3: apps詳細選択
  let appComponents: AppComponent[] = [];
  if (hasApps) {
    const appAnswers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "apps",
        message: "追加するアプリを選択:",
        choices: [
          {
            name: "web - メイン管理画面アプリ（Next.js + App Router）",
            value: "web",
            checked: true,
          },
        ],
        validate: (input: string[]): boolean | string => {
          if (input.length === 0) {
            return "少なくとも1つのアプリを選択してください";
          }
          return true;
        },
      },
    ]);
    appComponents = appAnswers.apps as AppComponent[];
  }

  return {
    components: {
      packages: hasPackages,
      apps: hasApps,
      config: hasConfig,
    },
    packageComponents,
    appComponents,
    dryRun,
  };
}
