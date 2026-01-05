import type { Prisma } from "@prisma/client";
import { UserRole, UserStatus } from "@prisma/client";
import { defineUserFactory } from "../../__generated__/fabbrica";
import { faker } from "@faker-js/faker/locale/ja";
import { getDefaultHashedPassword } from "../helpers/password";
import { randomDateInPastDays } from "../helpers/date";
import type { UserProps } from "../../domain/entities/User";

/**
 * ユーザーファクトリーの基本定義
 * @faker-js/fakerを使用してリアルなダミーデータを生成
 */
export const UserFactory = defineUserFactory({
  defaultData: async () => ({
    id: faker.string.nanoid(25), // cuid()と同様の長さのIDを生成
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: await getDefaultHashedPassword(),
    status: UserStatus.active,
    role: UserRole.user,
    createdAt: randomDateInPastDays(30),
    lastLogin: randomDateInPastDays(7),
    emailVerified: null,
    image: null,
  }),
  traits: {
    active: {
      data: {
        status: UserStatus.active,
        lastLogin: randomDateInPastDays(7),
      },
    },
    inactive: {
      data: {
        status: UserStatus.inactive,
        lastLogin: randomDateInPastDays(60),
      },
    },
    pending: {
      data: {
        status: UserStatus.pending,
        lastLogin: null,
        emailVerified: null,
      },
    },
    admin: {
      data: {
        role: UserRole.admin,
        status: UserStatus.active,
        emailVerified: new Date(),
      },
    },
    moderator: {
      data: {
        role: UserRole.moderator,
        status: UserStatus.active,
        emailVerified: new Date(),
      },
    },
    verified: {
      data: {
        emailVerified: new Date(),
        status: UserStatus.active,
      },
    },
  },
});

/**
 * アクティブユーザーのファクトリー
 */
export const ActiveUserFactory = UserFactory.use("active");

/**
 * 非アクティブユーザーのファクトリー
 */
export const InactiveUserFactory = UserFactory.use("inactive");

/**
 * 保留中ユーザーのファクトリー
 */
export const PendingUserFactory = UserFactory.use("pending");

/**
 * 管理者ユーザーのファクトリー
 */
export const AdminUserFactory = UserFactory.use("admin");

/**
 * モデレーターユーザーのファクトリー
 */
export const ModeratorUserFactory = UserFactory.use("moderator");

/**
 * メール認証済みユーザーのファクトリー
 */
export const VerifiedUserFactory = UserFactory.use("verified");

/**
 * UserFactory.build()の結果をUserPropsに変換するヘルパー
 * テストでUserエンティティを作成する際に使用
 */
export async function buildUserProps(
  overrides?: Partial<Prisma.UserCreateInput>,
): Promise<UserProps> {
  const data = await UserFactory.build(overrides);

  // createdAtとlastLoginは文字列の可能性があるのでDate型に変換
  const parseDate = (value: string | Date | null | undefined): Date | null => {
    if (value == null) return null;
    return typeof value === "string" ? new Date(value) : value;
  };

  return {
    id: data.id ?? faker.string.nanoid(25),
    email: data.email,
    name: data.name ?? null,
    status: data.status ?? "active",
    role: data.role ?? "user",
    createdAt: parseDate(data.createdAt) ?? new Date(),
    lastLogin: parseDate(data.lastLogin),
  };
}
