/**
 * ファイルハッシュキャッシュ
 * 同一ファイルの重複ハッシュ計算を避けるためのキャッシュ機構
 */
export class HashCache {
	private cache: Map<string, string> = new Map();

	/**
	 * キャッシュキーを生成する
	 * キャッシュキー形式: ${filePath}:${contentLength}
	 */
	private generateKey(filePath: string, contentLength: number): string {
		return `${filePath}:${contentLength}`;
	}

	/**
	 * キャッシュからハッシュを取得する
	 * @returns ハッシュ値（キャッシュに存在しない場合はundefined）
	 */
	get(filePath: string, contentLength: number): string | undefined {
		const key = this.generateKey(filePath, contentLength);
		return this.cache.get(key);
	}

	/**
	 * ハッシュをキャッシュに保存する
	 */
	set(filePath: string, contentLength: number, hash: string): void {
		const key = this.generateKey(filePath, contentLength);
		this.cache.set(key, hash);
	}

	/**
	 * キャッシュに存在するかチェックする
	 */
	has(filePath: string, contentLength: number): boolean {
		const key = this.generateKey(filePath, contentLength);
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
