/**
 * ランダムな日付を生成（指定範囲内）
 * @param start 開始日時
 * @param end 終了日時
 * @returns 範囲内のランダムな日時
 */
export function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

/**
 * 現在から指定日数前の日付を取得
 * @param days 日数
 * @returns 指定日数前の日付
 */
export function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * 現在から指定日数後の日付を取得
 * @param days 日数
 * @returns 指定日数後の日付
 */
export function daysFromNow(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * 過去N日間内のランダムな日付を生成
 * @param days 日数
 * @returns 過去N日間内のランダムな日付
 */
export function randomDateInPastDays(days: number): Date {
  return randomDate(daysAgo(days), new Date());
}

/**
 * 未来N日間内のランダムな日付を生成
 * @param days 日数
 * @returns 未来N日間内のランダムな日付
 */
export function randomDateInFutureDays(days: number): Date {
  return randomDate(new Date(), daysFromNow(days));
}
