import { randomUUID } from "node:crypto";
import { daysAgo, getDefaultHashedPassword, randomDate, SEED_USERS } from "../src/testing";
import { db, pool } from "./client";
import { users } from "./schema";

async function main() {
	// 本番環境での誤実行ガード
	if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
		throw new Error("Refusing to seed in production. Set ALLOW_PROD_SEED=1 to override.");
	}

	console.log("シードデータの投入を開始します...");

	// 共通パスワード（開発環境用）
	const hashedPassword = await getDefaultHashedPassword();

	// 日付範囲
	const now = new Date();
	const oneMonthAgo = daysAgo(30);
	const oneWeekAgo = daysAgo(7);

	for (const userData of SEED_USERS) {
		const createdAt = randomDate(oneMonthAgo, oneWeekAgo);
		const lastLogin =
			userData.status === "active"
				? randomDate(oneWeekAgo, now)
				: userData.status === "inactive"
					? randomDate(oneMonthAgo, oneWeekAgo)
					: null;

		await db
			.insert(users)
			.values({
				id: randomUUID(),
				email: userData.email,
				name: userData.name,
				password: hashedPassword,
				status: userData.status,
				role: userData.role,
				createdAt,
				updatedAt: createdAt,
				lastLogin,
			})
			.onConflictDoUpdate({
				target: users.email,
				set: {
					name: userData.name,
					status: userData.status,
					role: userData.role,
					lastLogin,
					updatedAt: new Date(),
					// password は新規作成時のみ設定するため、更新対象から除外
				},
			});

		console.log(`ユーザー処理完了: ${userData.name} (${userData.email})`);
	}

	console.log("シードデータの投入が完了しました");
}

main()
	.catch((e) => {
		console.error("シードエラー:", e);
		process.exit(1);
	})
	.finally(async () => {
		await pool.end();
	});
