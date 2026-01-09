import { spawn } from "node:child_process";
import chalk from "chalk";
import ora from "ora";

export interface TaskLoopOptions {
	issue?: string;
	maxGroup?: string;
	branch?: string;
}

/**
 * Claude Code がインストールされているか確認
 */
async function checkClaudeInstalled(): Promise<boolean> {
	return new Promise((resolve) => {
		const claude = spawn("claude", ["--version"], {
			stdio: "pipe",
			shell: true,
		});

		claude.on("error", () => resolve(false));
		claude.on("close", (code) => resolve(code === 0));
	});
}

/**
 * プロンプトを構築
 */
function buildPrompt(options: TaskLoopOptions): string {
	const parts: string[] = ["/task-vibe-kanban-loop"];

	if (options.issue) {
		// Issue番号を正規化（# がなければ追加）
		const issueNumber = options.issue.startsWith("#")
			? options.issue
			: `#${options.issue}`;
		parts.push(`Issue ${issueNumber}で実行`);
	}

	if (options.maxGroup) {
		parts.push(`最大タスクグループ${options.maxGroup}まで`);
	}

	if (options.branch) {
		parts.push(`ベースブランチは${options.branch}`);
	}

	return parts.join(" ");
}

/**
 * task:loop コマンド
 * Claude Code を起動して /task-vibe-kanban-loop を実行
 */
export async function taskLoopCommand(
	issue: string | undefined,
	options: TaskLoopOptions,
): Promise<void> {
	const spinner = ora();

	// Issue番号をoptionsにマージ
	const mergedOptions: TaskLoopOptions = {
		...options,
		issue: issue || options.issue,
	};

	// 1. Claude Code の存在確認
	spinner.start("Claude Code の確認中...");
	const claudeExists = await checkClaudeInstalled();

	if (!claudeExists) {
		spinner.fail("Claude Code がインストールされていません");
		console.log(chalk.yellow("\n以下の手順でインストールしてください:"));
		console.log("  npm install -g @anthropic-ai/claude-code");
		console.log("  claude /login");
		process.exit(1);
	}
	spinner.succeed("Claude Code 確認完了");

	// 2. Issue番号の確認
	if (!mergedOptions.issue) {
		spinner.fail("Issue番号が指定されていません");
		console.log(chalk.yellow("\n使用例:"));
		console.log("  pnpm task:loop 123");
		console.log("  pnpm task:loop 123 --max-group 1.3");
		process.exit(1);
	}

	// 3. プロンプト構築
	const prompt = buildPrompt(mergedOptions);
	console.log(chalk.gray(`\n実行: claude -p "${prompt}"\n`));

	// 4. Claude Code 起動
	const claude = spawn("claude", ["-p", prompt], {
		stdio: "inherit",
		cwd: process.cwd(),
		shell: true,
	});

	claude.on("error", (error) => {
		console.error(chalk.red(`\nエラー: ${error.message}`));
		process.exit(1);
	});

	claude.on("close", (code) => {
		process.exit(code || 0);
	});
}
