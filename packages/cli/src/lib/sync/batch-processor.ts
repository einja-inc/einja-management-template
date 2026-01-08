/**
 * バッチ処理クラス
 * ファイルの並列処理を制御し、メモリ使用量を抑制する
 */
export class BatchProcessor {
	private batchSize: number;

	/**
	 * @param batchSize バッチサイズ（デフォルト: 10ファイル）
	 */
	constructor(batchSize = 10) {
		this.batchSize = batchSize;
	}

	/**
	 * アイテムをバッチごとに並列処理する
	 * @param items 処理対象のアイテム配列
	 * @param processor 各アイテムを処理する関数
	 * @returns 処理結果の配列
	 */
	async processBatch<T, R>(
		items: T[],
		processor: (item: T) => Promise<R>,
	): Promise<R[]> {
		const results: R[] = [];

		// アイテムをバッチに分割
		for (let i = 0; i < items.length; i += this.batchSize) {
			const batch = items.slice(i, i + this.batchSize);

			// バッチ内のアイテムを並列処理
			const batchResults = await Promise.all(batch.map((item) => processor(item)));

			// 結果を収集
			results.push(...batchResults);
		}

		return results;
	}

	/**
	 * バッチサイズを取得する
	 */
	getBatchSize(): number {
		return this.batchSize;
	}

	/**
	 * バッチサイズを設定する
	 */
	setBatchSize(size: number): void {
		if (size <= 0) {
			throw new Error("バッチサイズは1以上である必要があります");
		}
		this.batchSize = size;
	}
}
