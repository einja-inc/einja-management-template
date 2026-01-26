// playground/todo-app/vitest.setup.ts

import { beforeEach } from "vitest";
import { prisma } from "./lib/prisma";

// データベース接続が可能かをチェック
let dbAvailable = false;

// 初期化時にデータベース接続をテスト
(async () => {
	if (process.env.DATABASE_URL) {
		try {
			await prisma.$connect();
			dbAvailable = true;
		} catch {
			// データベース接続不可の場合はスキップ
			dbAvailable = false;
		}
	}
})();

// 各テスト前にデータベースをクリーンアップ
// データベースが利用可能な場合のみ実行
beforeEach(async () => {
	if (dbAvailable) {
		await prisma.todo.deleteMany();
	}
});
