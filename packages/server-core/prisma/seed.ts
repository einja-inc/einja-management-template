import { PrismaClient } from "@prisma/client";
import {
  SEED_USERS,
  getDefaultHashedPassword,
  initialize,
  randomDate,
  daysAgo,
} from "../src/testing";

const prisma = new PrismaClient();

// fabbrica初期化
initialize({ prisma });

async function main() {
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
