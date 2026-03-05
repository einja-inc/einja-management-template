import type { JsonPathsConfig } from "@/types/sync.js";

/**
 * JSONコンフリクト情報
 */
export interface JsonConflict {
  keyPath: string;
  baseValue: unknown;
  localValue: unknown;
  templateValue: unknown;
}

/**
 * JSONマージ結果
 */
export interface JsonMergeResult {
  result: Record<string, unknown>;
  conflicts: JsonConflict[];
}

/**
 * JSONファイルのマージ処理を行うクラス
 * marker-processor.tsのパターンに従い、パス指定によるマージを実装します。
 */
export class JsonProcessor {
  /**
   * JSONをマージする
   * - managed パス: テンプレート値で上書き
   * - project-private パス: 完全除外（テンプレートから追加しない）
   * - その他（baseあり）: 3方向マージ
   * - その他（base なし = 初回sync）: ローカル優先 + テンプレート新規キーのみ追加
   *
   * @param templateJson - テンプレート版のJSON
   * @param localJson - ローカル版のJSON（nullの場合はproject-private除外済みテンプレートを返す）
   * @param jsonPaths - JSONパス設定
   * @param filePath - 対象ファイルパス
   * @param baseJson - 前回sync時のテンプレートJSON（3方向マージ用。未指定は初回sync）
   * @returns マージ結果（result + conflicts）
   */
  mergeJson(
    templateJson: Record<string, unknown>,
    localJson: Record<string, unknown> | null,
    jsonPaths: JsonPathsConfig,
    filePath: string,
    baseJson?: Record<string, unknown>
  ): JsonMergeResult {
    // ローカルファイルが存在しない場合はproject-private除外済みテンプレートを返す
    if (!localJson) {
      const result = this.removeProjectPrivateKeys(templateJson, jsonPaths, filePath, "");
      return { result, conflicts: [] };
    }

    const conflicts: JsonConflict[] = [];
    const result = this.deepMergeWithPaths(
      templateJson,
      localJson,
      jsonPaths,
      filePath,
      "",
      conflicts,
      baseJson
    );
    return { result, conflicts };
  }

  /**
   * project-privateキーをテンプレートから除外した新しいオブジェクトを返す
   *
   * @param template - テンプレートオブジェクト
   * @param jsonPaths - JSONパス設定
   * @param filePath - ファイルパス
   * @param currentPath - 現在のパス（再帰用）
   * @returns project-privateキーを除外したオブジェクト
   */
  private removeProjectPrivateKeys(
    template: Record<string, unknown>,
    jsonPaths: JsonPathsConfig,
    filePath: string,
    currentPath: string
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      const keyPath = currentPath ? `${currentPath}.${key}` : key;
      if (this.isPathProjectPrivate(filePath, keyPath, jsonPaths)) {
        continue; // project-private は除外
      }
      if (this.isObject(value)) {
        result[key] = this.removeProjectPrivateKeys(
          value as Record<string, unknown>,
          jsonPaths,
          filePath,
          keyPath
        );
      } else {
        result[key] = this.deepClone(value);
      }
    }
    return result;
  }

  /**
   * パス設定を考慮したディープマージ（3方向マージ対応）
   *
   * @param template - テンプレートオブジェクト
   * @param existing - 既存（ローカル）オブジェクト
   * @param jsonPaths - JSONパス設定
   * @param filePath - ファイルパス
   * @param currentPath - 現在のパス（再帰用）
   * @param conflicts - コンフリクト収集配列
   * @param base - 前回sync時のテンプレートオブジェクト（3方向マージ用）
   * @returns マージ後のオブジェクト
   */
  private deepMergeWithPaths(
    template: Record<string, unknown>,
    existing: Record<string, unknown>,
    jsonPaths: JsonPathsConfig,
    filePath: string,
    currentPath: string,
    conflicts: JsonConflict[],
    base?: Record<string, unknown>
  ): Record<string, unknown> {
    // ローカルをベースにスタート（ローカルのキーはすべて保持）
    const result = this.deepClone(existing);

    // テンプレートのキーを処理
    for (const [key, templateValue] of Object.entries(template)) {
      const keyPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isPathManaged(filePath, keyPath, jsonPaths)) {
        // managed: テンプレートで強制上書き
        result[key] = this.deepClone(templateValue);
        continue;
      }

      if (this.isPathProjectPrivate(filePath, keyPath, jsonPaths)) {
        // project-private: 完全除外（テンプレートから追加しない）
        continue;
      }

      // デフォルト処理
      const localValue = existing[key];
      const baseValue = base ? base[key] : undefined;
      const localExists = key in existing;
      const baseExists = base != null && key in base;

      if (base) {
        // 3方向マージモード
        if (!localExists) {
          if (!baseExists) {
            // base にも local にも存在しない → テンプレートで新規追加
            result[key] = this.deepClone(templateValue);
          } else {
            // base には存在したが local で削除された
            const templateChanged = !this.deepEqual(baseValue, templateValue);
            if (templateChanged) {
              // テンプレートも変更 → コンフリクト（ローカルの削除を保持）
              conflicts.push({ keyPath, baseValue, localValue: undefined, templateValue });
              // result にキーなし（削除維持）
            }
            // テンプレート変更なし → 削除を維持（result にキーなし）
          }
          continue;
        }

        if (this.isObject(templateValue) && this.isObject(localValue)) {
          // 両方オブジェクト: 再帰的に3方向マージ
          result[key] = this.deepMergeWithPaths(
            templateValue as Record<string, unknown>,
            localValue as Record<string, unknown>,
            jsonPaths,
            filePath,
            keyPath,
            conflicts,
            baseExists ? (baseValue as Record<string, unknown>) : undefined
          );
          continue;
        }

        const localChanged = !this.deepEqual(baseValue, localValue);
        const templateChanged = !this.deepEqual(baseValue, templateValue);

        if (!localChanged && templateChanged) {
          // ローカル変更なし + テンプレート変更あり → テンプレート適用
          result[key] = this.deepClone(templateValue);
        } else if (localChanged && !templateChanged) {
          // ローカル変更あり + テンプレート変更なし → ローカル保持（何もしない）
        } else if (localChanged && templateChanged) {
          if (this.deepEqual(localValue, templateValue)) {
            // 両方変更 + 同じ値 → コンフリクトなし、どちらでも同じ
          } else {
            // 両方変更 + 異なる値 → コンフリクト（ローカル保持）
            conflicts.push({ keyPath, baseValue, localValue, templateValue });
          }
        }
        // !localChanged && !templateChanged → 変更なし（ローカル保持）
      } else {
        // 初回sync（base なし）: ローカル優先 + テンプレート新規キーのみ追加
        if (!localExists) {
          // ローカルに存在しない → テンプレートのキーを追加
          result[key] = this.deepClone(templateValue);
        } else if (this.isObject(templateValue) && this.isObject(localValue)) {
          // 両方オブジェクト: 再帰的にマージ（baseなしモード）
          result[key] = this.deepMergeWithPaths(
            templateValue as Record<string, unknown>,
            localValue as Record<string, unknown>,
            jsonPaths,
            filePath,
            keyPath,
            conflicts,
            undefined
          );
        }
        // ローカルに存在する場合は保持（何もしない）
      }
    }

    // base にあってテンプレートから削除されたキーの処理（3方向マージモードのみ）
    if (base) {
      for (const key of Object.keys(base)) {
        // テンプレートに存在しないキー（テンプレートから削除された）
        if (!(key in template)) {
          const keyPath = currentPath ? `${currentPath}.${key}` : key;

          // managed / project-private はスキップ（上のループで処理済み）
          if (
            this.isPathManaged(filePath, keyPath, jsonPaths) ||
            this.isPathProjectPrivate(filePath, keyPath, jsonPaths)
          ) {
            continue;
          }

          const localValue = existing[key];
          const baseValue = base[key];
          const localExists = key in existing;

          if (!localExists) {
            // ローカルでも削除済み → 何もしない
            continue;
          }

          const localChanged = !this.deepEqual(baseValue, localValue);
          if (localChanged) {
            // ローカルで変更あり → コンフリクト（ローカル保持）
            conflicts.push({
              keyPath,
              baseValue,
              localValue,
              templateValue: undefined,
            });
            // result にはローカル値が保持されている（deepClone(existing)から）
          } else {
            // ローカル未変更 → 削除
            delete result[key];
          }
        }
      }
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
   * パスがproject-privateかどうか判定
   *
   * @param filePath - ファイルパス
   * @param keyPath - JSONパス
   * @param jsonPaths - JSONパス設定
   * @returns project-privateの場合true
   */
  private isPathProjectPrivate(
    filePath: string,
    keyPath: string,
    jsonPaths: JsonPathsConfig
  ): boolean {
    const projectPrivatePaths = jsonPaths["project-private"][filePath] || [];
    // keyPath が projectPrivatePaths のいずれかで始まるかチェック
    return projectPrivatePaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
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
   * キー順序非依存の深い等値比較
   *
   * @param a - 比較対象A
   * @param b - 比較対象B
   * @returns 等しい場合true
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => this.deepEqual(item, b[i]));
    }
    if (typeof a === "object" && typeof b === "object") {
      const keysA = Object.keys(a as Record<string, unknown>).sort();
      const keysB = Object.keys(b as Record<string, unknown>).sort();
      if (keysA.length !== keysB.length) return false;
      return keysA.every(
        (key, i) =>
          key === keysB[i] &&
          this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    }
    return false;
  }
}
