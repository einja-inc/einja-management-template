/**
 * テストデータファクトリー - メインエクスポート
 *
 * Drizzle ベースの軽量ファクトリー。`build()` でメモリ上の行を生成し、
 * `create()` で DB に挿入する。旧 `@quramy/prisma-fabbrica` の置き換え。
 *
 * @example
 * ```typescript
 * import { UserFactory } from "@repo/server-core/testing";
 *
 * // メモリ上の行を生成（DB 書き込みなし）
 * const userRow = await UserFactory.build();
 *
 * // DB に挿入（統合テスト用）
 * const inserted = await UserFactory.create();
 * ```
 */

// ファクトリー
export * from "./factories";

// フィクスチャ（シードデータ用）
export * from "./fixtures/users";

// ヘルパー関数
export * from "./helpers/date";
export * from "./helpers/password";
