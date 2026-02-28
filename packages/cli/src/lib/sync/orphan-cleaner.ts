import path from "node:path";
import fs from "fs-extra";
import type { SyncMetadata, OrphanFile, OrphanReport } from "@/types/sync.js";
import type { FileFilter } from "./file-filter.js";

/**
 * 孤児ファイル検出・レポート生成クラス
 * テンプレートから削除されたファイルの検出と報告を担当
 */
export class OrphanCleaner {
	private projectRoot: string;
	private fileFilter: FileFilter;

	constructor(projectRoot: string, fileFilter: FileFilter) {
		this.projectRoot = projectRoot;
		this.fileFilter = fileFilter;
	}

	/**
	 * 孤児ファイルを検出する
	 * メタデータに存在するがテンプレートに存在しないファイルを検出
	 */
	async detectOrphans(
		metadata: SyncMetadata,
		currentTemplateFiles: string[],
		categories?: string[],
	): Promise<OrphanFile[]> {
		const templateFileSet = new Set(currentTemplateFiles);
		const orphans: OrphanFile[] = [];

		for (const filePath of Object.keys(metadata.files)) {
			// テンプレートに存在するファイルはスキップ
			if (templateFileSet.has(filePath)) {
				continue;
			}

			// パストラバーサル防御
			const normalized = path.normalize(filePath);
			if (normalized.includes('..') || path.isAbsolute(normalized)) {
				continue;
			}

			// カテゴリを判定
			const category = this.fileFilter.getCategoryFromPath(filePath);

			// カテゴリフィルタが指定されている場合、対象カテゴリのみ
			if (categories && category && !categories.includes(category)) {
				continue;
			}

			// カテゴリがnullの場合（どのカテゴリにも属さない）もスキップ
			if (!category) {
				continue;
			}

			// ディスク上に実在するかチェック
			const fullPath = path.join(this.projectRoot, filePath);
			const exists = await fs.pathExists(fullPath);

			orphans.push({ path: filePath, category, exists });
		}

		return orphans;
	}

	/**
	 * 孤児レポートを生成する
	 */
	createReport(orphans: OrphanFile[]): OrphanReport {
		const existingCount = orphans.filter((o) => o.exists).length;

		return {
			hasOrphans: orphans.length > 0,
			orphans,
			total: orphans.length,
			existingCount,
		};
	}

	/**
	 * 孤児レポートを人間が読みやすい形式でフォーマットする
	 */
	formatReport(report: OrphanReport): string {
		if (!report.hasOrphans) {
			return "";
		}

		const lines: string[] = [];
		lines.push("\n⚠️  孤児ファイルが検出されました:");

		for (const orphan of report.orphans) {
			const status = orphan.exists ? "(存在)" : "(削除済み)";
			lines.push(`  🗑️  ${orphan.path} ${status}`);
		}

		return lines.join("\n");
	}

	/**
	 * 孤児削除のヘルプメッセージを生成する
	 */
	formatHelpMessage(): string {
		return "\n💡 削除するには --clean オプションを使用してください\n";
	}
}
