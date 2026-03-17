import type { JsonPathsConfig } from "@/types/sync.js";
import { mergeJsonWithConflicts } from "@/internal/sync-core/json-merge.js";

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
 * 共通 sync-core を薄くラップして dev-cli 向けの API を維持する。
 */
export class JsonProcessor {
  mergeJson(
    templateJson: Record<string, unknown>,
    localJson: Record<string, unknown> | null,
    jsonPaths: JsonPathsConfig,
    filePath: string,
    baseJson?: Record<string, unknown>
  ): JsonMergeResult {
    const result = mergeJsonWithConflicts(templateJson, localJson, jsonPaths, filePath, baseJson, {
      missingLocalStrategy: "exclude-project-private",
      projectPrivateStrategy: "exclude",
    });

    return {
      result: result.result,
      conflicts: result.conflicts as JsonConflict[],
    };
  }
}
