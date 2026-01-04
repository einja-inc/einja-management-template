/**
 * User Factory
 *
 * テストおよびシードデータ作成用のファクトリー関数。
 * ドメインエンティティ、Prismaモデル、シードデータの生成を共通化。
 */

import type {
	User as PrismaUser,
	UserRole as PrismaUserRole,
	UserStatus as PrismaUserStatus,
} from "@prisma/client";
import type { UserProps, UserRole, UserStatus } from "../../domain/entities/User";
import { User } from "../../domain/entities/User";

/**
 * ドメインエンティティ用のUserPropsを作成
 */
export function createUserProps(overrides: Partial<UserProps> = {}): UserProps {
	return {
		id: "user-123",
		email: "test@example.com",
		name: "Test User",
		status: "active" as UserStatus,
		role: "user" as UserRole,
		createdAt: new Date("2025-01-01T00:00:00Z"),
		lastLogin: new Date("2025-01-02T00:00:00Z"),
		...overrides,
	};
}

/**
 * ドメインエンティティのUserインスタンスを作成
 */
export function createUser(overrides: Partial<UserProps> = {}): User {
	return new User(createUserProps(overrides));
}

/**
 * Prisma User型のモックデータを作成
 */
export function createPrismaUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
	return {
		id: "user-123",
		email: "test@example.com",
		name: "Test User",
		emailVerified: null,
		image: null,
		password: "hashed-password",
		status: "active" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
		createdAt: new Date("2025-01-01T00:00:00Z"),
		updatedAt: new Date("2025-01-01T00:00:00Z"),
		lastLogin: new Date("2025-01-02T00:00:00Z"),
		...overrides,
	};
}

/**
 * シードデータ用のユーザー情報
 */
export interface SeedUserData {
	name: string;
	email: string;
	status: PrismaUserStatus;
	role: PrismaUserRole;
}

/**
 * シードデータ用のサンプルユーザー一覧
 */
export const sampleSeedUsers: SeedUserData[] = [
	{
		name: "田中太郎",
		email: "tanaka@example.com",
		status: "active" as PrismaUserStatus,
		role: "admin" as PrismaUserRole,
	},
	{
		name: "佐藤花子",
		email: "sato@example.com",
		status: "active" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
	},
	{
		name: "鈴木一郎",
		email: "suzuki@example.com",
		status: "inactive" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
	},
	{
		name: "高橋美咲",
		email: "takahashi@example.com",
		status: "pending" as PrismaUserStatus,
		role: "moderator" as PrismaUserRole,
	},
	{
		name: "伊藤健太",
		email: "ito@example.com",
		status: "active" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
	},
	{
		name: "山田恵子",
		email: "yamada@example.com",
		status: "active" as PrismaUserStatus,
		role: "admin" as PrismaUserRole,
	},
	{
		name: "中村誠",
		email: "nakamura@example.com",
		status: "inactive" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
	},
	{
		name: "小林優子",
		email: "kobayashi@example.com",
		status: "pending" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
	},
];
