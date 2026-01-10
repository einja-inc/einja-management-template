/**
 * プロジェクト選択モジュール
 *
 * Vibe-Kanban プロジェクトのインタラクティブ選択と設定ファイル管理
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type Interface, createInterface } from "node:readline";
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
 * readline でユーザー入力を取得
 */
function askQuestion(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
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
  // 1. プロジェクト一覧を取得（接続確認も兼ねる）
  let projects: Array<{ id: string; name: string }>;
  try {
    projects = await vibeKanban.listProjects();
  } catch (error) {
    // MCP経由でバックエンドに接続できない場合
    showCreateProjectGuidance(issueNumber);
    process.exit(1);
  }

  // 2. 設定ファイルがあれば使用
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

  // 3. インタラクティブ選択
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const projectId = await interactiveSelectProject(rl, projects, issueNumber);
    return projectId;
  } finally {
    rl.close();
  }
}

/**
 * インタラクティブにプロジェクトを選択
 */
async function interactiveSelectProject(
  rl: Interface,
  projects: Array<{ id: string; name: string }>,
  issueNumber?: number
): Promise<string> {
  console.log("\n📦 Vibe-Kanban プロジェクトを選択してください:\n");

  // 選択肢を表示
  for (let i = 0; i < projects.length; i++) {
    console.log(`  ${i + 1}. ${projects[i].name}`);
  }

  // 区切り線と新規作成オプション
  console.log("  ─────────────────");
  console.log(`  ${projects.length + 1}. 新しいプロジェクトを作成`);
  console.log("");

  // 入力を受け付ける
  while (true) {
    const answer = await askQuestion(rl, `番号を入力 (1-${projects.length + 1}): `);
    const num = Number.parseInt(answer, 10);

    if (Number.isNaN(num) || num < 1 || num > projects.length + 1) {
      console.log(`❌ 1〜${projects.length + 1} の数字を入力してください`);
      continue;
    }

    // 既存プロジェクトを選択
    if (num <= projects.length) {
      const selected = projects[num - 1];
      saveConfig(selected.id);
      console.log("\n✅ .vibe-kanban.json を作成しました");
      console.log("   次回から自動的にこのプロジェクトが使用されます\n");
      return selected.id;
    }

    // 新規プロジェクト作成
    return await createNewProject(rl, issueNumber);
  }
}

/**
 * 新規プロジェクトを作成
 */
async function createNewProject(rl: Interface, issueNumber?: number): Promise<string> {
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
  const answer = await askQuestion(rl, `プロジェクト名を入力 (default: ${defaultName}): `);
  const projectName = answer || defaultName;

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
