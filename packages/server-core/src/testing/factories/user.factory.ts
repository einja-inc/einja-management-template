import { faker } from "@faker-js/faker/locale/ja";
import { db } from "../../../db/client";
import { users } from "../../../db/schema";
import type { UserProps } from "../../domain/entities/User";
import { randomDateInPastDays } from "../helpers/date";
import { getDefaultHashedPassword } from "../helpers/password";

/** Drizzle $inferSelect から UserRow 型を取得 */
type UserRow = typeof users.$inferSelect;
type UserInsert = typeof users.$inferInsert;

/**
 * テスト用インメモリ UserRow を生成するビルダー
 *
 * build() はメモリ上の行オブジェクトを返す（DB への書き込みなし）。
 * 統合テストで実際にDBへ挿入したい場合は create() を使用する。
 *
 * Prisma 時代の `defineUserFactory` (@quramy/prisma-fabbrica) を置き換える。
 * 後方互換のため、旧 `ActiveUserFactory` などのトレイト別 Factory も
 * このファイル末尾でエイリアスとして提供している。
 */
export const UserFactory = {
  /**
   * メモリ上の UserRow を生成（DB書き込みなし）
   */
  async build(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    const hashedPassword = await getDefaultHashedPassword();
    const now = new Date();

    return {
      id: overrides.id ?? faker.string.nanoid(25),
      name: overrides.name !== undefined ? overrides.name : faker.person.fullName(),
      email: overrides.email ?? faker.internet.email(),
      emailVerified: overrides.emailVerified !== undefined ? overrides.emailVerified : null,
      image: overrides.image !== undefined ? overrides.image : null,
      password: overrides.password !== undefined ? overrides.password : hashedPassword,
      status: overrides.status ?? "active",
      role: overrides.role ?? "user",
      createdAt: overrides.createdAt ?? randomDateInPastDays(30),
      updatedAt: overrides.updatedAt ?? now,
      lastLogin: overrides.lastLogin !== undefined ? overrides.lastLogin : randomDateInPastDays(7),
    };
  },

  /**
   * DB に UserRow を挿入して返す（統合テスト用）
   */
  async create(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    const props = await UserFactory.build(overrides);
    const [row] = await db
      .insert(users)
      .values({ ...props, updatedAt: props.updatedAt ?? new Date() })
      .returning();
    return row;
  },

  /**
   * アクティブユーザーの UserRow を生成
   */
  async buildActive(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({
      status: "active",
      lastLogin: randomDateInPastDays(7),
      ...overrides,
    });
  },

  /**
   * 非アクティブユーザーの UserRow を生成
   */
  async buildInactive(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({
      status: "inactive",
      lastLogin: randomDateInPastDays(60),
      ...overrides,
    });
  },

  /**
   * 保留中ユーザーの UserRow を生成
   */
  async buildPending(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({
      status: "pending",
      lastLogin: null,
      emailVerified: null,
      ...overrides,
    });
  },

  /**
   * 管理者ユーザーの UserRow を生成
   */
  async buildAdmin(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({
      role: "admin",
      status: "active",
      emailVerified: new Date(),
      ...overrides,
    });
  },

  /**
   * モデレーターユーザーの UserRow を生成
   */
  async buildModerator(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({
      role: "moderator",
      status: "active",
      emailVerified: new Date(),
      ...overrides,
    });
  },

  /**
   * メール認証済みユーザーの UserRow を生成
   */
  async buildVerified(overrides: Partial<UserInsert> = {}): Promise<UserRow> {
    return UserFactory.build({
      emailVerified: new Date(),
      status: "active",
      ...overrides,
    });
  },
};

/** 後方互換: 旧 ActiveUserFactory 相当 */
export const ActiveUserFactory = {
  build: (overrides: Partial<UserInsert> = {}) => UserFactory.buildActive(overrides),
};

/** 後方互換: 旧 InactiveUserFactory 相当 */
export const InactiveUserFactory = {
  build: (overrides: Partial<UserInsert> = {}) => UserFactory.buildInactive(overrides),
};

/** 後方互換: 旧 PendingUserFactory 相当 */
export const PendingUserFactory = {
  build: (overrides: Partial<UserInsert> = {}) => UserFactory.buildPending(overrides),
};

/** 後方互換: 旧 AdminUserFactory 相当 */
export const AdminUserFactory = {
  build: (overrides: Partial<UserInsert> = {}) => UserFactory.buildAdmin(overrides),
};

/** 後方互換: 旧 ModeratorUserFactory 相当 */
export const ModeratorUserFactory = {
  build: (overrides: Partial<UserInsert> = {}) => UserFactory.buildModerator(overrides),
};

/** 後方互換: 旧 VerifiedUserFactory 相当 */
export const VerifiedUserFactory = {
  build: (overrides: Partial<UserInsert> = {}) => UserFactory.buildVerified(overrides),
};

/**
 * UserFactory.build()の結果をUserPropsに変換するヘルパー
 * テストでUserエンティティを作成する際に使用
 */
export async function buildUserProps(overrides: Partial<UserInsert> = {}): Promise<UserProps> {
  const data = await UserFactory.build(overrides);

  return {
    id: data.id,
    email: data.email,
    name: data.name ?? null,
    status: data.status,
    role: data.role,
    createdAt: data.createdAt ?? new Date(),
    lastLogin: data.lastLogin ?? null,
  };
}
