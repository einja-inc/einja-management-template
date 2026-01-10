import type { JsonPathsConfig } from "../../types/sync.js";

/**
 * JSONファイルのマージ処理を行うクラス
 * marker-processor.tsのパターンに従い、パス指定によるマージを実装します。
 */
export class JsonProcessor {
  /**
   * JSONをマージする
   * - managed パス: テンプレート値で上書き
   * - seed パス: ローカル優先（キーが存在しない場合のみコピー）
   * - その他: ローカル優先
   *
   * @param templateJson - テンプレート版のJSON
   * @param localJson - ローカル版のJSON（nullの場合はテンプレート版をそのまま返す）
   * @param jsonPaths - JSONパス設定
   * @param filePath - 対象ファイルパス
   * @returns マージ後のJSON
   */
  mergeJson(
    templateJson: Record<string, unknown>,
    localJson: Record<string, unknown> | null,
    jsonPaths: JsonPathsConfig,
    filePath: string
  ): Record<string, unknown> {
    // ローカルファイルが存在しない場合はテンプレート版をそのまま返す
    if (!localJson) {
      return templateJson;
    }

    // マージ結果の初期化（ローカル版をベースに開始）
    const result = this.deepClone(localJson);

    // managedパスの処理: テンプレート値で上書き
    const managedPaths = jsonPaths.managed[filePath] || [];
    for (const path of managedPaths) {
      const templateValue = this.getValueAtPath(templateJson, path);
      if (templateValue !== undefined) {
        this.setValueAtPath(result, path, templateValue);
      }
    }

    // seedパスの処理: ローカルに存在しない場合のみテンプレート値をコピー
    const seedPaths = jsonPaths.seed[filePath] || [];
    for (const path of seedPaths) {
      const localValue = this.getValueAtPath(result, path);
      if (localValue === undefined) {
        const templateValue = this.getValueAtPath(templateJson, path);
        if (templateValue !== undefined) {
          this.setValueAtPath(result, path, templateValue);
        }
      }
    }

    return result;
  }

  /**
   * 指定されたパスの値を取得
   *
   * @param obj - 対象オブジェクト
   * @param path - ドット区切りのパス (例: "scripts.build")
   * @returns パスに対応する値（存在しない場合はundefined）
   */
  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * 指定されたパスに値を設定
   *
   * @param obj - 対象オブジェクト
   * @param path - ドット区切りのパス (例: "scripts.build")
   * @param value - 設定する値
   */
  private setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  /**
   * オブジェクトのディープクローンを作成
   *
   * @param obj - クローン対象のオブジェクト
   * @returns クローンされたオブジェクト
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as T;
    }

    const cloned: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone((obj as Record<string, unknown>)[key]);
      }
    }
    return cloned as T;
  }

  /**
   * パスがmanagedかどうか判定
   *
   * @param filePath - ファイルパス
   * @param path - JSONパス
   * @param jsonPaths - JSONパス設定
   * @returns managedの場合true
   */
  private isManagedPath(filePath: string, path: string, jsonPaths: JsonPathsConfig): boolean {
    const managedPaths = jsonPaths.managed[filePath];
    return managedPaths ? managedPaths.includes(path) : false;
  }

  /**
   * パスがseedかどうか判定
   *
   * @param filePath - ファイルパス
   * @param path - JSONパス
   * @param jsonPaths - JSONパス設定
   * @returns seedの場合true
   */
  private isSeedPath(filePath: string, path: string, jsonPaths: JsonPathsConfig): boolean {
    const seedPaths = jsonPaths.seed[filePath];
    return seedPaths ? seedPaths.includes(path) : false;
  }
}
