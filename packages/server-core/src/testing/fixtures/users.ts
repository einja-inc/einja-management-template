import type { users } from "../../../db/schema";
import type { UserRole, UserStatus } from "../../domain/entities/User";

/**
 * シードデータ用の最小ユーザー型（name/email/status/role のみ必須）
 * Prisma 時代の `Pick<Prisma.UserCreateInput, ...>` を置き換える。
 */
export type SeedUser = {
  name: string;
  email: string;
  status: UserStatus;
  role: UserRole;
};

/** Drizzle の $inferInsert 相当（参照用） */
export type UserInsert = typeof users.$inferInsert;

/**
 * シードデータ用の固定ユーザー定義
 * 決定論的なデータで再現性を確保
 */
export const SEED_USERS: readonly SeedUser[] = [
  {
    name: "田中太郎",
    email: "tanaka@example.com",
    status: "active",
    role: "admin",
  },
  {
    name: "佐藤花子",
    email: "sato@example.com",
    status: "active",
    role: "user",
  },
  {
    name: "鈴木一郎",
    email: "suzuki@example.com",
    status: "inactive",
    role: "user",
  },
  {
    name: "高橋美咲",
    email: "takahashi@example.com",
    status: "pending",
    role: "moderator",
  },
  {
    name: "伊藤健太",
    email: "ito@example.com",
    status: "active",
    role: "user",
  },
  {
    name: "山田恵子",
    email: "yamada@example.com",
    status: "active",
    role: "admin",
  },
  {
    name: "中村誠",
    email: "nakamura@example.com",
    status: "inactive",
    role: "user",
  },
  {
    name: "小林優子",
    email: "kobayashi@example.com",
    status: "pending",
    role: "user",
  },
];

/**
 * 管理者ユーザーのフィクスチャ
 */
export const ADMIN_USERS = SEED_USERS.filter((user) => user.role === "admin");

/**
 * アクティブユーザーのフィクスチャ
 */
export const ACTIVE_USERS = SEED_USERS.filter((user) => user.status === "active");

/**
 * 非アクティブユーザーのフィクスチャ
 */
export const INACTIVE_USERS = SEED_USERS.filter((user) => user.status === "inactive");

/**
 * 保留中ユーザーのフィクスチャ
 */
export const PENDING_USERS = SEED_USERS.filter((user) => user.status === "pending");
