/**
 * ファイルハッシュキャッシュ
 * 同一ファイルの重複ハッシュ計算を避けるためのキャッシュ機構
 */
export class HashCache {
	private cache: Map<string, string> = new Map();
	private static readonly SAMPLE_SIZE = 32;

	/**
	 * コンテンツの簡易シグネチャを生成する
	 * 先頭・中央・末尾をサンプリングして衝突を回避
	 */
	private generateContentSignature(content: string): string {
		const len = content.length;
		const sampleSize = HashCache.SAMPLE_SIZE;

		// 短いコンテンツはそのまま使用
		if (len <= sampleSize * 3) {
			return content;
		}

		// 先頭・中央・末尾をサンプリング
		const start = content.substring(0, sampleSize);
		const middle = content.substring(
			Math.floor(len / 2) - Math.floor(sampleSize / 2),
			Math.floor(len / 2) + Math.ceil(sampleSize / 2),
		);
		const end = content.substring(len - sampleSize);

		return start + middle + end;
	}

	/**
	 * キャッシュキーを生成する
	 * キャッシュキー形式: ${filePath}:${contentLength}:${contentSignature}
	 */
	private generateKey(filePath: string, content: string): string {
		const signature = this.generateContentSignature(content);
		return `${filePath}:${content.length}:${signature}`;
	}

	/**
	 * キャッシュからハッシュを取得する
	 * @returns ハッシュ値（キャッシュに存在しない場合はundefined）
	 */
	get(filePath: string, content: string): string | undefined {
		const key = this.generateKey(filePath, content);
		return this.cache.get(key);
	}

	/**
	 * ハッシュをキャッシュに保存する
	 */
	set(filePath: string, content: string, hash: string): void {
		const key = this.generateKey(filePath, content);
		this.cache.set(key, hash);
	}

	/**
	 * キャッシュに存在するかチェックする
	 */
	has(filePath: string, content: string): boolean {
		const key = this.generateKey(filePath, content);
		return this.cache.has(key);
	}

	/**
	 * キャッシュをクリアする
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * キャッシュサイズ（エントリ数）を取得する
	 */
	size(): number {
		return this.cache.size;
	}
}
