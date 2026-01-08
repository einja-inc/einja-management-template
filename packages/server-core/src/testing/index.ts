/**
 * テストデータファクトリー - メインエクスポート
 *
 * @example
 * ```typescript
 * import { initialize, UserFactory } from "@repo/server-core/testing";
 * import { prisma } from "@repo/server-core";
 *
 * // 初期化（テストセットアップ時）
 * initialize({ prisma });
 *
 * // ユーザー作成
 * const user = await UserFactory.create();
 * const users = await UserFactory.createList(5);
 * ```
 */

// ファクトリー
export * from "./factories";

// フィクスチャ（シードデータ用）
export * from "./fixtures/users";

// ヘルパー関数
export * from "./helpers/date";
export * from "./helpers/password";
