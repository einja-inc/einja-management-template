import { diff3Merge } from "node-diff3";
import type { TextConflict, TextMergeResult } from "./types.js";

export function mergeText3Way(
  baseContent: string,
  localContent: string,
  templateContent: string,
  templateSource: string
): TextMergeResult {
  const mergeResult = diff3Merge(
    localContent.split("\n"),
    baseContent.split("\n"),
    templateContent.split("\n")
  );

  const conflicts: TextConflict[] = [];
  const mergedLines: string[] = [];
  let currentLine = 1;

  for (const chunk of mergeResult) {
    if ("ok" in chunk && chunk.ok) {
      mergedLines.push(...chunk.ok);
      currentLine += chunk.ok.length;
      continue;
    }

    if ("conflict" in chunk && chunk.conflict) {
      const localChunk = chunk.conflict.a.join("\n");
      const templateChunk = chunk.conflict.b.join("\n");

      conflicts.push({
        line: currentLine,
        localContent: localChunk,
        templateContent: templateChunk,
      });

      mergedLines.push("<<<<<<< LOCAL (your changes)");
      mergedLines.push(...chunk.conflict.a);
      mergedLines.push("=======");
      mergedLines.push(...chunk.conflict.b);
      mergedLines.push(`>>>>>>> TEMPLATE (from ${templateSource})`);

      currentLine += 3 + chunk.conflict.a.length + chunk.conflict.b.length;
    }
  }

  return {
    success: conflicts.length === 0,
    content: mergedLines.join("\n"),
    conflicts,
  };
}

export function hasConflictMarkers(content: string): boolean {
  const lines = content.split("\n");
  return lines.some(
    (line) => line.startsWith("<<<<<<< LOCAL") || line.startsWith(">>>>>>> TEMPLATE")
  );
}

export function parseConflictMarkers(content: string): TextConflict[] {
  const lines = content.split("\n");
  const conflicts: TextConflict[] = [];
  let inConflict = false;
  let conflictStartLine = 0;
  let localContent: string[] = [];
  let templateContent: string[] = [];
  let inLocalSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line?.startsWith("<<<<<<< LOCAL")) {
      inConflict = true;
      inLocalSection = true;
      conflictStartLine = i + 1;
      localContent = [];
      templateContent = [];
    } else if (line === "=======" && inConflict) {
      inLocalSection = false;
    } else if (line?.startsWith(">>>>>>> TEMPLATE") && inConflict) {
      conflicts.push({
        line: conflictStartLine,
        localContent: localContent.join("\n"),
        templateContent: templateContent.join("\n"),
      });
      inConflict = false;
      inLocalSection = false;
    } else if (inConflict) {
      if (inLocalSection) {
        localContent.push(line ?? "");
      } else {
        templateContent.push(line ?? "");
      }
    }
  }

  return conflicts;
}
