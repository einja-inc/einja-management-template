/**
 * UserMapper
 *
 * Prismaモデル ⇔ ドメインエンティティの変換を担当。
 */

import type { User as PrismaUser, UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from "@prisma/client";
import { User, type UserRole, type UserStatus } from "../../../domain/entities/User";

/**
 * Prismaのステータスをドメインのステータスに変換
 */
function mapPrismaStatusToDomain(status: PrismaUserStatus): UserStatus {
	switch (status) {
		case "active":
			return "active";
		case "inactive":
			return "inactive";
		case "pending":
			return "pending";
	}
}

/**
 * Prismaのロールをドメインのロールに変換
 */
function mapPrismaRoleToDomain(role: PrismaUserRole): UserRole {
	switch (role) {
		case "admin":
			return "admin";
		case "user":
			return "user";
		case "moderator":
			return "moderator";
	}
}

/**
 * ドメインのステータスをPrismaのステータスに変換
 */
function mapDomainStatusToPrisma(status: UserStatus): PrismaUserStatus {
	switch (status) {
		case "active":
			return "active";
		case "inactive":
			return "inactive";
		case "pending":
			return "pending";
	}
}

/**
 * ドメインのロールをPrismaのロールに変換
 */
function mapDomainRoleToPrisma(role: UserRole): PrismaUserRole {
	switch (role) {
		case "admin":
			return "admin";
		case "user":
			return "user";
		case "moderator":
			return "moderator";
	}
}

/**
 * UserMapper
 *
 * Prisma ⇔ Domain の変換を行うマッパークラス
 */
export const UserMapper = {
	/**
	 * PrismaのUserをドメインのUserに変換
	 */
	toDomain(prismaUser: PrismaUser): User {
		return new User({
			id: prismaUser.id,
			email: prismaUser.email,
			name: prismaUser.name,
			status: mapPrismaStatusToDomain(prismaUser.status),
			role: mapPrismaRoleToDomain(prismaUser.role),
			createdAt: prismaUser.createdAt,
			lastLogin: prismaUser.lastLogin,
		});
	},

	/**
	 * ドメインのUserをPrismaの更新用データに変換
	 */
	toPrismaUpdate(user: User): {
		name: string | null;
		status: PrismaUserStatus;
		role: PrismaUserRole;
		lastLogin: Date | null;
	} {
		return {
			name: user.name,
			status: mapDomainStatusToPrisma(user.status),
			role: mapDomainRoleToPrisma(user.role),
			lastLogin: user.lastLogin,
		};
	},
};
