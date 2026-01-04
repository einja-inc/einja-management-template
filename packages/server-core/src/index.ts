// Server Core - 公開API
// 内部構造を隠蔽し、公開APIのみエクスポート

export { prisma } from "./infrastructure/prisma/client";
export type { PrismaClient, User } from "@prisma/client";
