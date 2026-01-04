import { UserRole, UserStatus } from "@prisma/client";

/**
 * シードデータ用の固定ユーザー定義
 * 決定論的なデータで再現性を確保
 */
export const SEED_USERS = [
  {
    name: "田中太郎",
    email: "tanaka@example.com",
    status: UserStatus.active,
    role: UserRole.admin,
  },
  {
    name: "佐藤花子",
    email: "sato@example.com",
    status: UserStatus.active,
    role: UserRole.user,
  },
  {
    name: "鈴木一郎",
    email: "suzuki@example.com",
    status: UserStatus.inactive,
    role: UserRole.user,
  },
  {
    name: "高橋美咲",
    email: "takahashi@example.com",
    status: UserStatus.pending,
    role: UserRole.moderator,
  },
  {
    name: "伊藤健太",
    email: "ito@example.com",
    status: UserStatus.active,
    role: UserRole.user,
  },
  {
    name: "山田恵子",
    email: "yamada@example.com",
    status: UserStatus.active,
    role: UserRole.admin,
  },
  {
    name: "中村誠",
    email: "nakamura@example.com",
    status: UserStatus.inactive,
    role: UserRole.user,
  },
  {
    name: "小林優子",
    email: "kobayashi@example.com",
    status: UserStatus.pending,
    role: UserRole.user,
  },
] as const;

/**
 * 管理者ユーザーのフィクスチャ
 */
export const ADMIN_USERS = SEED_USERS.filter(
  (user) => user.role === UserRole.admin,
);

/**
 * アクティブユーザーのフィクスチャ
 */
export const ACTIVE_USERS = SEED_USERS.filter(
  (user) => user.status === UserStatus.active,
);

/**
 * 非アクティブユーザーのフィクスチャ
 */
export const INACTIVE_USERS = SEED_USERS.filter(
  (user) => user.status === UserStatus.inactive,
);

/**
 * 保留中ユーザーのフィクスチャ
 */
export const PENDING_USERS = SEED_USERS.filter(
  (user) => user.status === UserStatus.pending,
);
