import { diff3Merge } from "node-diff3";
import type { Conflict, MergeResult } from "../../types/sync.js";

/**
 * 3方向マージエンジン
 * node-diff3ライブラリを使用して、ベース版・ローカル版・テンプレート版の3方向マージを実行
 */
export class DiffEngine {
	/**
	 * 3方向マージを実行する
	 * @param base - ベース版の内容（前回同期時のテンプレート版）
	 * @param local - ローカル版の内容（現在のプロジェクトファイル）
	 * @param template - テンプレート版の内容（最新のテンプレートファイル）
	 * @returns マージ結果
	 */
	merge3Way(base: string, local: string, template: string): MergeResult {
		// 各バージョンを行単位に分割
		const baseLines = base.split("\n");
		const localLines = local.split("\n");
		const templateLines = template.split("\n");

		// node-diff3でマージを実行
		const mergeResult = diff3Merge(localLines, baseLines, templateLines);

		// マージ結果を処理
		const conflicts: Conflict[] = [];
		const mergedLines: string[] = [];
		let currentLine = 1;

		for (const chunk of mergeResult) {
			if ("ok" in chunk && chunk.ok) {
				// コンフリクトなしのチャンク
				mergedLines.push(...chunk.ok);
				currentLine += chunk.ok.length;
			} else if ("conflict" in chunk && chunk.conflict) {
				// コンフリクトが発生したチャンク
				const localContent = chunk.conflict.a.join("\n");
				const templateContent = chunk.conflict.b.join("\n");

				// コンフリクト情報を記録
				conflicts.push({
					line: currentLine,
					localContent,
					templateContent,
				});

				// コンフリクトマーカーを挿入
				mergedLines.push("<<<<<<< LOCAL (your changes)");
				mergedLines.push(...chunk.conflict.a);
				mergedLines.push("=======");
				mergedLines.push(...chunk.conflict.b);
				mergedLines.push(">>>>>>> TEMPLATE (from @einja/cli)");

				// 行番号を更新（マーカー3行 + コンフリクト内容）
				currentLine +=
					3 + chunk.conflict.a.length + chunk.conflict.b.length + 1;
			}
		}

		return {
			success: conflicts.length === 0,
			content: mergedLines.join("\n"),
			conflicts,
		};
	}

	/**
	 * コンフリクトマーカーを検出する
	 * @param content - ファイル内容
	 * @returns 未解決のコンフリクトマーカーが存在するか
	 */
	hasConflictMarkers(content: string): boolean {
		const lines = content.split("\n");
		return lines.some(
			(line) =>
				line.startsWith("<<<<<<< LOCAL") ||
				line.startsWith(">>>>>>> TEMPLATE"),
		);
	}

	/**
	 * コンフリクトマーカーをパースしてコンフリクト情報を抽出する
	 * @param content - ファイル内容
	 * @returns コンフリクト一覧
	 */
	parseConflictMarkers(content: string): Conflict[] {
		const lines = content.split("\n");
		const conflicts: Conflict[] = [];
		let inConflict = false;
		let conflictStartLine = 0;
		let localContent: string[] = [];
		let templateContent: string[] = [];
		let inLocalSection = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.startsWith("<<<<<<< LOCAL")) {
				// コンフリクト開始
				inConflict = true;
				inLocalSection = true;
				conflictStartLine = i + 1;
				localContent = [];
				templateContent = [];
			} else if (line === "=======" && inConflict) {
				// LOCAL→TEMPLATE境界
				inLocalSection = false;
			} else if (line.startsWith(">>>>>>> TEMPLATE") && inConflict) {
				// コンフリクト終了
				conflicts.push({
					line: conflictStartLine,
					localContent: localContent.join("\n"),
					templateContent: templateContent.join("\n"),
				});
				inConflict = false;
				inLocalSection = false;
			} else if (inConflict) {
				// コンフリクト内容を収集
				if (inLocalSection) {
					localContent.push(line);
				} else {
					templateContent.push(line);
				}
			}
		}

		return conflicts;
	}
}
