import type { Conflict, MergeResult } from "@/types/sync.js";
import {
  hasConflictMarkers as hasConflictMarkersCore,
  mergeText3Way as mergeText3WayCore,
  parseConflictMarkers as parseConflictMarkersCore,
} from "@/internal/sync-core/text-merge.js";

/**
 * 3方向マージエンジン
 * 共通 sync-core を薄くラップして dev-cli 向けの API を維持する。
 */
export class DiffEngine {
  merge3Way(base: string, local: string, template: string): MergeResult {
    const result = mergeText3WayCore(base, local, template, "@einja-inc/dev-cli");
    return {
      success: result.success,
      content: result.content,
      conflicts: result.conflicts as Conflict[],
    };
  }

  hasConflictMarkers(content: string): boolean {
    return hasConflictMarkersCore(content);
  }

  parseConflictMarkers(content: string): Conflict[] {
    return parseConflictMarkersCore(content) as Conflict[];
  }
}
