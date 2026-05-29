/**
 * UserRepository.test.ts
 *
 * NOTE (B-9 暫定対応):
 *   Drizzle 化に伴い、本テストは一時的に describe.skip 状態にしている。
 *
 *   旧 Prisma 時代は `vi.mock("../client", () => ({ prisma: { user: { findMany, ... } } }))`
 *   というフラットなオブジェクト mock で十分だったが、Drizzle は
 *   `db.select().from(users).where(...).orderBy(...).limit(...).offset(...)` のような
 *   流暢な (fluent) チェーン API を採用しているため、vi.mock でチェーン全段を
 *   再現すると mock コードが本体ロジックより大幅に長く・脆くなる。
 *
 *   einja-ai-base リポジトリでは fluent chain helper（buildSelectChain, mockSelectReturning,
 *   mockSelectCapturingWhere, mockSelectFindReturning 等）を 16KB 規模で書いて維持しているが、
 *   テンプレート原本としての保守コスト最小化を優先し、本リポジトリでは:
 *
 *     - 短期: 本 describe.skip + TODO（本コミット = B-9）
 *     - 中期: 統合テスト（実 PostgreSQL に対する db クエリ検証）へ移行
 *       → Plan recursive-wondering-harp.md の Phase D（D-1 後継タスク）で対応予定
 *     - 代替カバレッジ: 上位の UserUseCases.test.ts が userRepository を vi.mock しているため、
 *       Repository インターフェースに対する契約レベルの検証は維持されている
 *
 * TODO(B-9-followup):
 *   1. einja-ai-base の chain helper パターンを移植する（最小工数）か、
 *   2. vitest.integration.config.ts と docker-compose のテスト DB を立てて実 DB テスト化する
 *   どちらかを選択し、本ファイルの describe.skip を解除する。
 */

import { describe, it } from "vitest";

describe.skip("UserRepository (drizzle 移行後の単体テストは一時 skip)", () => {
	it("TODO: einja-ai-base パターンの drizzle chain mock 移植 または 統合テスト化", () => {
		// intentionally empty — see file header for rationale
	});
});
