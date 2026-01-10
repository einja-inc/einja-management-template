/**
 * タスク番号比較ユーティリティ
 *
 * タスク番号形式: "1", "1.2", "1.2.3"
 * - Phase番号: 1
 * - タスクグループ番号: 1.2
 * - タスク番号: 1.2.3
 */

/**
 * タスク番号を数値配列にパース
 * @example "1.2.3" -> [1, 2, 3]
 */
export function parseTaskNumber(taskNumber: string): number[] {
  return taskNumber.split(".").map((part) => Number.parseInt(part, 10));
}

/**
 * 比較: a <= b
 * @example isLessOrEqual("1.2.3", "1.2.5") -> true
 * @example isLessOrEqual("1.2.5", "1.2.5") -> true
 * @example isLessOrEqual("1.2.6", "1.2.5") -> false
 */
export function isLessOrEqual(a: string, b: string): boolean {
  const partsA = parseTaskNumber(a);
  const partsB = parseTaskNumber(b);

  // 各セグメントを左から順に比較
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;

    if (numA < numB) return true;
    if (numA > numB) return false;
  }

  // 完全一致
  return true;
}

/**
 * 比較: a < b
 */
export function isLess(a: string, b: string): boolean {
  return isLessOrEqual(a, b) && a !== b;
}

/**
 * 比較: a == b
 */
export function isEqual(a: string, b: string): boolean {
  const partsA = parseTaskNumber(a);
  const partsB = parseTaskNumber(b);

  if (partsA.length !== partsB.length) return false;

  for (let i = 0; i < partsA.length; i++) {
    if (partsA[i] !== partsB[i]) return false;
  }

  return true;
}

/**
 * Phase番号を抽出
 * @example getPhaseNumber("1.2.3") -> 1
 */
export function getPhaseNumber(taskNumber: string): number {
  const parts = parseTaskNumber(taskNumber);
  return parts[0] ?? 0;
}

/**
 * タスクグループ番号を抽出（X.Y形式）
 * @example getTaskGroupId("1.2.3") -> "1.2"
 * @example getTaskGroupId("1.2") -> "1.2"
 * @example getTaskGroupId("1") -> "1"
 */
export function getTaskGroupId(taskNumber: string): string {
  const parts = parseTaskNumber(taskNumber);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return parts[0]?.toString() ?? "";
}

/**
 * タスク番号が最大タスク番号の範囲内かチェック
 * @param taskNumber チェック対象のタスク番号
 * @param maxTaskNumber 最大タスク番号（"all" の場合は常に true）
 */
export function isWithinRange(taskNumber: string, maxTaskNumber: string | undefined): boolean {
  if (maxTaskNumber === undefined || maxTaskNumber === "all") {
    return true;
  }

  return isLessOrEqual(taskNumber, maxTaskNumber);
}

/**
 * タスク番号をソート用の数値に変換
 * @example toSortKey("1.2.3") -> 1002003
 */
export function toSortKey(taskNumber: string): number {
  const parts = parseTaskNumber(taskNumber);
  // 各セグメントを1000倍しながら合算
  // 例: 1.2.3 -> 1*1000000 + 2*1000 + 3 = 1002003
  let key = 0;
  for (let i = 0; i < parts.length; i++) {
    key += (parts[i] ?? 0) * 10 ** ((3 - i) * 3);
  }
  return key;
}

/**
 * タスク番号の配列をソート
 */
export function sortTaskNumbers(taskNumbers: string[]): string[] {
  return [...taskNumbers].sort((a, b) => toSortKey(a) - toSortKey(b));
}
