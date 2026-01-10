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
   * - その他: ディープマージ（テンプレートの新規キーも追加）
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
      return this.deepClone(templateJson);
    }

    // ディープマージ（パス設定を考慮）
    return this.deepMergeWithPaths(templateJson, localJson, jsonPaths, filePath, "");
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
   * パス設定を考慮したディープマージ
   *
   * @param template - テンプレートオブジェクト
   * @param existing - 既存オブジェクト
   * @param jsonPaths - JSONパス設定
   * @param filePath - ファイルパス
   * @param currentPath - 現在のパス（再帰用）
   * @returns マージ後のオブジェクト
   */
  private deepMergeWithPaths(
    template: Record<string, unknown>,
    existing: Record<string, unknown>,
    jsonPaths: JsonPathsConfig,
    filePath: string,
    currentPath: string
  ): Record<string, unknown> {
    const result = this.deepClone(existing);

    for (const [key, templateValue] of Object.entries(template)) {
      const keyPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isPathManaged(filePath, keyPath, jsonPaths)) {
        // managed: テンプレートで上書き
        result[key] = this.deepClone(templateValue);
      } else if (this.isPathSeed(filePath, keyPath, jsonPaths)) {
        // seed: オブジェクトの場合はディープマージ（既存にないキーのみ追加）
        if (this.isObject(templateValue) && this.isObject(existing[key])) {
          // seedパス内でもディープマージ（既存にないキーのみ追加）
          result[key] = this.deepMergeWithPaths(
            templateValue as Record<string, unknown>,
            existing[key] as Record<string, unknown>,
            jsonPaths,
            filePath,
            keyPath
          );
        } else if (!(key in existing)) {
          // seedパスはローカル優先（キーが存在しない場合のみ追加）
          result[key] = this.deepClone(templateValue);
        }
        // 既存値がある場合は何もしない（既存値を保持）
      } else if (this.isObject(templateValue) && this.isObject(existing[key])) {
        // 両方オブジェクト: 再帰的にマージ
        result[key] = this.deepMergeWithPaths(
          templateValue as Record<string, unknown>,
          existing[key] as Record<string, unknown>,
          jsonPaths,
          filePath,
          keyPath
        );
      } else if (!(key in existing)) {
        // 既存にないキー: 追加（これが重要！）
        result[key] = this.deepClone(templateValue);
      }
      // 既存にあるキー: 保持（何もしない）
    }

    return result;
  }

  /**
   * パスがmanagedかどうか判定
   *
   * @param filePath - ファイルパス
   * @param keyPath - JSONパス
   * @param jsonPaths - JSONパス設定
   * @returns managedの場合true
   */
  private isPathManaged(filePath: string, keyPath: string, jsonPaths: JsonPathsConfig): boolean {
    const managedPaths = jsonPaths.managed[filePath] || [];
    // keyPath が managedPaths のいずれかで始まるかチェック
    // 例: keyPath="scripts.dev" が managedPaths=["scripts"] にマッチ
    return managedPaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
  }

  /**
   * パスがseedかどうか判定
   *
   * @param filePath - ファイルパス
   * @param keyPath - JSONパス
   * @param jsonPaths - JSONパス設定
   * @returns seedの場合true
   */
  private isPathSeed(filePath: string, keyPath: string, jsonPaths: JsonPathsConfig): boolean {
    const seedPaths = jsonPaths.seed[filePath] || [];
    // keyPath が seedPaths のいずれかで始まるかチェック
    return seedPaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
  }

  /**
   * オブジェクトかどうか判定
   *
   * @param value - 判定対象
   * @returns オブジェクトの場合true
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
