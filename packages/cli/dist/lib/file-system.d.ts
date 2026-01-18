/**
 * パッケージルートからの相対パスを解決
 */
export declare function getPackageRoot(): string;
/**
 * コアテンプレートのパスを取得
 */
export declare function getCorePath(): string;
/**
 * プリセットディレクトリのパスを取得
 */
export declare function getPresetsPath(): string;
/**
 * テンプレートディレクトリのパスを取得
 */
export declare function getTemplatesPath(): string;
/**
 * スキャフォールドディレクトリのパスを取得
 */
export declare function getScaffoldsPath(): string;
/**
 * 特定のプリセットのパスを取得
 */
export declare function getPresetPath(presetName: string): string;
/**
 * ディレクトリをバックアップ
 */
export declare function backupDirectory(dirPath: string): Promise<string>;
/**
 * ディレクトリをコピー（除外パターン対応）
 */
export declare function copyDirectory(src: string, dest: string, options?: {
    exclude?: string[];
}): Promise<void>;
/**
 * テンプレート変数を展開
 */
export declare function processTemplateFile(filePath: string, variables: Record<string, string>): Promise<string>;
/**
 * 利用可能なプリセット一覧を取得
 */
export declare function getAvailablePresets(): Promise<string[]>;
//# sourceMappingURL=file-system.d.ts.map