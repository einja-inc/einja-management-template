import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sampleSeedUsers } from "../src/testing/factories/UserFactory";

const prisma = new PrismaClient();

/**
 * シードデータ用のパスワードをハッシュ化
 */
async function hashPassword(password: string): Promise<string> {
	const salt = await bcrypt.genSalt(10);
	return bcrypt.hash(password, salt);
}

/**
 * ランダムな日付を生成（指定範囲内）
 */
function randomDate(start: Date, end: Date): Date {
	return new Date(
		start.getTime() + Math.random() * (end.getTime() - start.getTime()),
	);
}

async function main() {
	console.log("シードデータの投入を開始します...");

	// 共通パスワード（開発環境用）
	const hashedPassword = await hashPassword("password123");

	// 日付範囲
	const now = new Date();
	const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	for (const userData of sampleSeedUsers) {
		const createdAt = randomDate(oneMonthAgo, oneWeekAgo);
		const lastLogin =
			userData.status === UserStatus.active
				? randomDate(oneWeekAgo, now)
				: userData.status === UserStatus.inactive
					? randomDate(oneMonthAgo, oneWeekAgo)
					: null;

		await prisma.user.upsert({
			where: { email: userData.email },
			update: {
				name: userData.name,
				status: userData.status,
				role: userData.role,
				lastLogin,
			},
			create: {
				email: userData.email,
				name: userData.name,
				password: hashedPassword,
				status: userData.status,
				role: userData.role,
				createdAt,
				lastLogin,
			},
		});

		console.log(`ユーザー作成: ${userData.name} (${userData.email})`);
	}

	console.log("シードデータの投入が完了しました");
}

main()
	.catch((e) => {
		console.error("シードエラー:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
