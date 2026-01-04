import fs from "fs-extra";
import { glob } from "glob";
import ignore from "ignore";
import path from "node:path";
import type { ScanOptions, SyncTarget } from "../../types/sync.js";

/**
 * カテゴリマッピング
 */
const CATEGORY_MAPPING: Record<string, string> = {
	commands: ".claude/commands/einja",
	agents: ".claude/agents/einja",
	skills: ".claude/skills/einja",
	docs: "docs/einja",
};

/**
 * ファイルフィルタリングクラス
 * 同期対象ファイルのスキャンと除外判定を担当
 */
export class FileFilter {
	private projectRoot: string;
	private templateRoot: string;
	private ignoreFilter: ReturnType<typeof ignore> | null = null;

	constructor(projectRoot: string, templateRoot: string) {
		this.projectRoot = projectRoot;
		this.templateRoot = templateRoot;
	}

	/**
	 * 同期対象ファイルをスキャンする
	 */
	async scanSyncTargets(options: ScanOptions = {}): Promise<SyncTarget[]> {
		const targets: SyncTarget[] = [];

		// .gitignoreを読み込む
		await this.loadGitignore();

		// カテゴリごとにスキャン
		const categories = options.categories || Object.keys(CATEGORY_MAPPING);

		for (const category of categories) {
			const categoryPath = CATEGORY_MAPPING[category];
			if (!categoryPath) {
				continue;
			}

			const templateDirPath = path.join(this.templateRoot, categoryPath);
			if (!(await fs.pathExists(templateDirPath))) {
				continue;
			}

			// テンプレートディレクトリ内のファイルをスキャン
			const pattern = `${categoryPath}/**/*`;
			const files = await glob(pattern, {
				cwd: this.templateRoot,
				nodir: true,
				dot: true,
			});

			for (const file of files) {
				// 除外対象チェック
				if (this.shouldExclude(file, options.excludePatterns)) {
					continue;
				}

				const templatePath = path.join(this.templateRoot, file);
				const projectPath = path.join(this.projectRoot, file);
				const exists = await fs.pathExists(projectPath);

				targets.push({
					path: file,
					category,
					templatePath,
					exists,
				});
			}
		}

		return targets;
	}

	/**
	 * 除外対象かを判定する
	 */
	shouldExclude(filePath: string, additionalPatterns?: string[]): boolean {
		const fileName = path.basename(filePath);

		// _プレフィックスで始まるファイルを除外
		if (fileName.startsWith("_")) {
			return true;
		}

		// .gitignoreパターンで除外
		if (this.ignoreFilter?.ignores(filePath)) {
			return true;
		}

		// 追加の除外パターンで除外
		if (additionalPatterns) {
			for (const pattern of additionalPatterns) {
				if (this.matchesPattern(filePath, pattern)) {
					return true;
				}
			}
		}

		// バイナリファイルを除外
		if (this.isBinaryFile(filePath)) {
			return true;
		}

		return false;
	}

	/**
	 * カテゴリでフィルタリングする
	 */
	filterByCategory(files: SyncTarget[], categories: string[]): SyncTarget[] {
		return files.filter((file) => categories.includes(file.category));
	}

	/**
	 * パスからカテゴリを推測する
	 */
	getCategoryFromPath(filePath: string): string | null {
		for (const [category, categoryPath] of Object.entries(CATEGORY_MAPPING)) {
			if (filePath.startsWith(categoryPath)) {
				return category;
			}
		}
		return null;
	}

	/**
	 * .gitignoreを読み込む
	 */
	private async loadGitignore(): Promise<void> {
		const gitignorePath = path.join(this.projectRoot, ".gitignore");
		if (!(await fs.pathExists(gitignorePath))) {
			this.ignoreFilter = null;
			return;
		}

		try {
			const content = await fs.readFile(gitignorePath, "utf-8");
			this.ignoreFilter = ignore().add(content);
		} catch {
			this.ignoreFilter = null;
		}
	}

	/**
	 * パターンマッチング
	 */
	private matchesPattern(filePath: string, pattern: string): boolean {
		// シンプルなglobパターンマッチング
		// エスケープが必要な特殊文字を処理
		const regexPattern = pattern
			.replace(/[.+^${}()|[\]\\]/g, "\\$&") // 正規表現の特殊文字をエスケープ
			.replace(/\*\*/g, "###DOUBLESTAR###") // **を一時的にプレースホルダーに置換
			.replace(/\*/g, "[^/]*") // *を[^/]*に置換
			.replace(/###DOUBLESTAR###/g, ".*") // **を.*に置換
			.replace(/\?/g, "[^/]"); // ?を[^/]に置換
		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(filePath);
	}

	/**
	 * バイナリファイルかを判定する
	 */
	private isBinaryFile(filePath: string): boolean {
		const binaryExtensions = [
			".jpg",
			".jpeg",
			".png",
			".gif",
			".bmp",
			".svg",
			".ico",
			".mp4",
			".webm",
			".mp3",
			".wav",
			".pdf",
			".zip",
			".tar",
			".gz",
			".rar",
		];

		const ext = path.extname(filePath).toLowerCase();
		return binaryExtensions.includes(ext);
	}
}
