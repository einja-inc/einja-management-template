/**
 * プロジェクト選択モジュール
 *
 * Vibe-Kanban プロジェクトのインタラクティブ選択と設定ファイル管理
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import inquirer from "inquirer";
import type { VibeKanbanOrganization } from "./types.js";
import type { VibeKanbanClient } from "./vibe-kanban-client.js";
import { VibeKanbanRestClient } from "./vibe-kanban-rest-client.js";

/** 設定ファイル名 */
const CONFIG_FILE_NAME = ".vibe-kanban.json";

/** 設定ファイルの型 */
interface VibeKanbanConfig {
  project_id: string;
}

/**
 * 設定ファイルのパスを取得
 */
function getConfigPath(): string {
  return join(process.cwd(), CONFIG_FILE_NAME);
}

/**
 * 設定ファイルを読み込む
 */
function loadConfig(): VibeKanbanConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as VibeKanbanConfig;
  } catch {
    return null;
  }
}

/**
 * 設定ファイルを保存
 */
function saveConfig(projectId: string): void {
  const configPath = getConfigPath();
  const config: VibeKanbanConfig = { project_id: projectId };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * プロジェクト作成ガイダンスを表示
 */
function showCreateProjectGuidance(issueNumber?: number): void {
  const issueArg = issueNumber ? ` ${issueNumber}` : " <issue-number>";
  console.log(`
❌ Vibe-Kanban バックエンドに接続できません

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: Vibe-Kanban を再起動
  既に起動中の場合は一度終了してから再起動してください
  （ポートファイルが古い可能性があります）

$ npx vibe-kanban

Step 2: 再度このコマンドを実行
$ pnpm task:loop${issueArg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

/**
 * プロジェクトを選択またはプロジェクトが有効か確認
 *
 * @param vibeKanban Vibe-Kanban MCP クライアント
 * @param issueNumber Issue 番号（ガイダンス表示用）
 * @returns プロジェクト ID
 */
export async function selectProject(
  vibeKanban: VibeKanbanClient,
  issueNumber?: number
): Promise<string> {
  // 1. 組織一覧を取得（接続確認も兼ねる）
  let organizations: VibeKanbanOrganization[];
  try {
    organizations = await vibeKanban.listOrganizations();
  } catch (error) {
    // MCP経由でバックエンドに接続できない場合
    showCreateProjectGuidance(issueNumber);
    process.exit(1);
  }

  // 組織が存在しない場合
  if (organizations.length === 0) {
    console.error("❌ 組織が存在しません。先に組織を作成してください。");
    process.exit(1);
  }

  // 2. 組織を選択（組織が1つの場合は自動選択）
  let selectedOrganizationId: string;
  if (organizations.length === 1) {
    selectedOrganizationId = organizations[0].id;
    console.log(`📦 組織: ${organizations[0].name} (${selectedOrganizationId.substring(0, 8)}...)`);
  } else {
    // インタラクティブ選択
    selectedOrganizationId = await interactiveSelectOrganization(organizations);
  }

  // 3. プロジェクト一覧を取得
  let projects: Array<{ id: string; name: string }>;
  try {
    projects = await vibeKanban.listProjects(selectedOrganizationId);
  } catch (error) {
    console.error("❌ プロジェクト一覧の取得に失敗しました:", error);
    process.exit(1);
  }

  // 4. 設定ファイルがあれば使用
  const config = loadConfig();
  if (config?.project_id) {
    // プロジェクトが存在するか確認
    const project = projects.find((p) => p.id === config.project_id);

    if (project) {
      console.log(`📦 プロジェクト: ${project.name} (${config.project_id.substring(0, 8)}...)`);
      return config.project_id;
    }

    console.log(`⚠️  設定ファイルのプロジェクト ID が無効です: ${config.project_id}`);
    console.log("   プロジェクトを再選択してください\n");
  }

  // 5. インタラクティブ選択
  return await interactiveSelectProject(projects, issueNumber);
}

/**
 * インタラクティブに組織を選択
 */
async function interactiveSelectOrganization(
  organizations: VibeKanbanOrganization[]
): Promise<string> {
  const { orgId } = await inquirer.prompt([
    {
      type: "list",
      name: "orgId",
      message: "📦 Vibe-Kanban 組織を選択してください:",
      choices: organizations.map((org) => ({
        name: org.name,
        value: org.id,
      })),
    },
  ]);

  const selected = organizations.find((o) => o.id === orgId);
  console.log(`\n✅ 組織「${selected?.name}」を選択しました\n`);
  return orgId;
}

/**
 * インタラクティブにプロジェクトを選択
 */
async function interactiveSelectProject(
  projects: Array<{ id: string; name: string }>,
  issueNumber?: number
): Promise<string> {
  const NEW_PROJECT_VALUE = "__new__";

  const { projectId } = await inquirer.prompt([
    {
      type: "list",
      name: "projectId",
      message: "📦 Vibe-Kanban プロジェクトを選択してください:",
      choices: [
        ...projects.map((p) => ({ name: p.name, value: p.id })),
        new inquirer.Separator("─────────────────"),
        { name: "新しいプロジェクトを作成", value: NEW_PROJECT_VALUE },
      ],
    },
  ]);

  if (projectId === NEW_PROJECT_VALUE) {
    return await createNewProject(issueNumber);
  }

  saveConfig(projectId);
  console.log("\n✅ .vibe-kanban.json を作成しました");
  console.log("   次回から自動的にこのプロジェクトが使用されます\n");
  return projectId;
}

/**
 * 新規プロジェクトを作成
 */
async function createNewProject(issueNumber?: number): Promise<string> {
  console.log("\n📝 新しいプロジェクトを作成します\n");

  // ポート発見
  const port = VibeKanbanRestClient.discoverPort();
  if (!port) {
    showCreateProjectGuidance(issueNumber);
    process.exit(1);
  }

  // REST クライアント作成
  const restClient = new VibeKanbanRestClient(port);

  // 接続確認
  const isAvailable = await restClient.isAvailable();
  if (!isAvailable) {
    showCreateProjectGuidance(issueNumber);
    process.exit(1);
  }

  // プロジェクト名を入力
  const defaultName = basename(process.cwd());
  const { projectName } = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "📝 プロジェクト名を入力:",
      default: defaultName,
    },
  ]);

  // プロジェクト作成
  try {
    const repoPath = process.cwd();
    const projectId = await restClient.createProject(projectName, repoPath);

    console.log(`\n✅ プロジェクト「${projectName}」を作成しました`);

    // 設定ファイル保存
    saveConfig(projectId);
    console.log("✅ .vibe-kanban.json を作成しました");
    console.log("   次回から自動的にこのプロジェクトが使用されます\n");

    return projectId;
  } catch (error) {
    console.error("\n❌ プロジェクト作成に失敗しました:", error);
    process.exit(1);
  }
}
