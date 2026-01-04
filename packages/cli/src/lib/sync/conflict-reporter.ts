import type { Conflict } from "../../types/sync.js";

/**
 * コンフリクト報告結果
 */
export interface ConflictReport {
	/** コンフリクトが存在するか */
	hasConflicts: boolean;
	/** コンフリクトが発生したファイルのパスと情報 */
	files: Array<{
		path: string;
		conflicts: Conflict[];
	}>;
	/** 総コンフリクト数 */
	totalConflicts: number;
}

/**
 * コンフリクト報告クラス
 * コンフリクトの検出、報告、ヘルプメッセージの生成を担当
 */
export class ConflictReporter {
	/**
	 * コンフリクト情報をレポートとしてまとめる
	 * @param fileConflicts - ファイルパスとコンフリクト情報のマップ
	 * @returns コンフリクトレポート
	 */
	createReport(
		fileConflicts: Map<string, Conflict[]>,
	): ConflictReport {
		const files = Array.from(fileConflicts.entries())
			.filter(([_, conflicts]) => conflicts.length > 0)
			.map(([path, conflicts]) => ({ path, conflicts }));

		const totalConflicts = files.reduce(
			(sum, file) => sum + file.conflicts.length,
			0,
		);

		return {
			hasConflicts: files.length > 0,
			files,
			totalConflicts,
		};
	}

	/**
	 * コンフリクトレポートを人間が読みやすい形式で出力する
	 * @param report - コンフリクトレポート
	 * @returns フォーマット済みのメッセージ
	 */
	formatReport(report: ConflictReport): string {
		if (!report.hasConflicts) {
			return "コンフリクトは検出されませんでした。";
		}

		const lines: string[] = [];
		lines.push(`⚠️  ${report.totalConflicts}件のコンフリクトが検出されました:\n`);

		for (const file of report.files) {
			lines.push(`  📄 ${file.path} (${file.conflicts.length}箇所)`);
			for (const conflict of file.conflicts) {
				lines.push(`     - 行${conflict.line}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * コンフリクト解消方法のヘルプメッセージを生成する
	 * @returns ヘルプメッセージ
	 */
	formatHelpMessage(): string {
		const lines: string[] = [];
		lines.push("\n💡 コンフリクト解消方法:");
		lines.push("  1. 上記ファイルを開く");
		lines.push("  2. <<<<<<< LOCAL と >>>>>>> TEMPLATE の間を手動編集");
		lines.push("  3. コンフリクトマーカーを削除");
		lines.push("  4. 再度 sync を実行\n");

		return lines.join("\n");
	}

	/**
	 * ファイルに未解決のコンフリクトマーカーが存在するか検出する
	 * @param content - ファイル内容
	 * @returns 未解決のコンフリクトマーカーが存在するか
	 */
	hasUnresolvedConflicts(content: string): boolean {
		const lines = content.split("\n");
		return lines.some(
			(line) =>
				line.startsWith("<<<<<<< LOCAL") ||
				line.startsWith(">>>>>>> TEMPLATE"),
		);
	}

	/**
	 * 未解決のコンフリクトが存在する場合のエラーメッセージを生成する
	 * @param filePath - ファイルパス
	 * @returns エラーメッセージ
	 */
	formatUnresolvedConflictError(filePath: string): string {
		return `❌ 未解決のコンフリクトが存在します: ${filePath}\n\nコンフリクトマーカー（<<<<<<< LOCAL, =======, >>>>>>> TEMPLATE）を解消してから再度実行してください。`;
	}

	/**
	 * コンフリクト発生時の終了メッセージを生成する
	 * @param report - コンフリクトレポート
	 * @returns 終了メッセージ
	 */
	formatExitMessage(report: ConflictReport): string {
		return `${this.formatReport(report)}${this.formatHelpMessage()}\n⚠️  同期処理は部分的に完了しましたが、コンフリクトの解消が必要です。`;
	}
}
