import type {
	MarkerError,
	MarkerErrorType,
	MarkerSection,
	MarkerValidationResult,
} from "../../types/sync.js";

/**
 * @einja:managedマーカーの処理を行うクラス
 * マーカーをパースしてセクションを分離し、検証・置換処理を提供します。
 */
export class MarkerProcessor {
	/**
	 * Markdownファイル用のマーカーパターン
	 */
	private static readonly MARKDOWN_START_PATTERN =
		/^<!--\s*@einja:managed:start\s*-->$/;
	private static readonly MARKDOWN_END_PATTERN =
		/^<!--\s*@einja:managed:end\s*-->$/;

	/**
	 * YAML/JSONファイル用のマーカーパターン
	 */
	private static readonly YAML_START_PATTERN = /^\s*#\s*@einja:managed:start\s*$/;
	private static readonly YAML_END_PATTERN = /^\s*#\s*@einja:managed:end\s*$/;

	/**
	 * ファイル内容をパースしてマーカーセクションに分離する
	 *
	 * @param content - ファイル内容
	 * @returns セクション配列（managedとunmanagedが交互に配置される）
	 */
	parseMarkers(content: string): MarkerSection[] {
		const lines = content.split("\n");
		const sections: MarkerSection[] = [];
		let currentType: "managed" | "unmanaged" = "unmanaged";
		let currentStartLine = 1;
		let currentContent: string[] = [];
		let startMarkerLine = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// マーカー開始を検出
			if (this.isStartMarker(line)) {
				if (currentType === "managed") {
					// 入れ子のマーカーは無視（検証フェーズでエラーになる）
					currentContent.push(line);
					continue;
				}

				// 現在のunmanagedセクションを保存
				if (currentContent.length > 0 || sections.length === 0) {
					sections.push({
						type: "unmanaged",
						startLine: currentStartLine,
						endLine: lineNumber - 1,
						content: currentContent.join("\n"),
					});
				}

				// managedセクション開始
				currentType = "managed";
				startMarkerLine = lineNumber;
				currentStartLine = lineNumber;
				currentContent = [line];
			}
			// マーカー終了を検出
			else if (this.isEndMarker(line)) {
				if (currentType === "unmanaged") {
					// 対応するstartがない場合は無視（検証フェーズでエラーになる）
					currentContent.push(line);
					continue;
				}

				// マーカー終了行を追加
				currentContent.push(line);

				// managedセクションを保存
				sections.push({
					type: "managed",
					startLine: currentStartLine,
					endLine: lineNumber,
					content: currentContent.join("\n"),
				});

				// unmanagedセクション開始
				currentType = "unmanaged";
				currentStartLine = lineNumber + 1;
				currentContent = [];
			}
			// 通常行
			else {
				currentContent.push(line);
			}
		}

		// 最後のセクションを保存
		if (currentContent.length > 0 || sections.length === 0) {
			sections.push({
				type: currentType,
				startLine: currentStartLine,
				endLine: lines.length,
				content: currentContent.join("\n"),
			});
		}

		return sections;
	}

	/**
	 * マーカーペアの検証を行う
	 *
	 * @param content - ファイル内容
	 * @returns 検証結果
	 */
	validateMarkers(content: string): MarkerValidationResult {
		const lines = content.split("\n");
		const errors: MarkerError[] = [];
		const startMarkers: number[] = [];
		let inManaged = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			if (this.isStartMarker(line)) {
				if (inManaged) {
					// 入れ子のマーカー - エラーを記録するがstackには追加しない
					errors.push({
						line: lineNumber,
						message: "@einja:managedマーカーのネストは許可されていません",
						type: "nested",
					});
					// ネストマーカーを無視して処理を続行
					continue;
				}
				startMarkers.push(lineNumber);
				inManaged = true;
			} else if (this.isEndMarker(line)) {
				if (!inManaged || startMarkers.length === 0) {
					// 対応するstartがない
					errors.push({
						line: lineNumber,
						message: "対応する@einja:managed:startが見つかりません",
						type: "unpaired_end",
					});
				} else {
					startMarkers.pop();
					inManaged = false;
				}
			}
		}

		// 未閉じのstartマーカー
		for (const lineNumber of startMarkers) {
			errors.push({
				line: lineNumber,
				message: "対応する@einja:managed:endが見つかりません",
				type: "unpaired_start",
			});
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * マーカー内セクションをテンプレート版で置換する
	 *
	 * @param localSections - ローカル版のセクション配列
	 * @param templateContent - テンプレート版の内容
	 * @returns 置換後の内容
	 */
	replaceManaged(
		localSections: MarkerSection[],
		templateContent: string,
	): string {
		const templateSections = this.parseMarkers(templateContent);
		const result: string[] = [];

		// セクション数が一致しない場合、ローカル版のセクションを優先
		// （テンプレート側でマーカーが削除された可能性があるため）
		const maxSections = Math.max(localSections.length, templateSections.length);

		for (let i = 0; i < maxSections; i++) {
			const localSection = localSections[i];
			const templateSection = templateSections[i];

			if (!localSection) {
				// テンプレート側にのみ存在するセクションを追加
				if (templateSection) {
					result.push(templateSection.content);
				}
				continue;
			}

			if (localSection.type === "managed") {
				// managedセクションはテンプレート版で置換
				if (templateSection && templateSection.type === "managed") {
					result.push(templateSection.content);
				} else {
					// テンプレート側にmanagedセクションがない場合はローカルを保持
					result.push(localSection.content);
				}
			} else {
				// unmanagedセクションはローカル版を保持
				result.push(localSection.content);
			}
		}

		return result.join("\n");
	}

	/**
	 * 行がマーカー開始かどうかを判定する
	 *
	 * @param line - 行内容
	 * @returns マーカー開始の場合true
	 */
	private isStartMarker(line: string): boolean {
		return (
			MarkerProcessor.MARKDOWN_START_PATTERN.test(line) ||
			MarkerProcessor.YAML_START_PATTERN.test(line)
		);
	}

	/**
	 * 行がマーカー終了かどうかを判定する
	 *
	 * @param line - 行内容
	 * @returns マーカー終了の場合true
	 */
	private isEndMarker(line: string): boolean {
		return (
			MarkerProcessor.MARKDOWN_END_PATTERN.test(line) ||
			MarkerProcessor.YAML_END_PATTERN.test(line)
		);
	}
}
