/**
 * UserMapper
 *
 * Drizzle schema から独立したドメインエンティティへの変換を担当。
 */

import { users } from "../../../../db/schema";
import { User, type UserRole, type UserStatus } from "../../../domain/entities/User";

/** Drizzle の $inferSelect で取得した DB 行の型 */
type UserRow = typeof users.$inferSelect;

/** Drizzle の $inferInsert による DB 挿入用データの型 */
type UserRowInsert = typeof users.$inferInsert;

/**
 * UserMapper
 *
 * Drizzle DB行 ⇔ Domain の変換を行うマッパー
 */
export const UserMapper = {
	/**
	 * Drizzle DB行をドメインのUserに変換
	 *
	 * enum カラムは Drizzle が pgEnum 定義と一致する値のみ返すため、
	 * `$inferSelect` の戻り値はそのまま Domain 型と互換となる。
	 * 型不一致が発生した場合はコンパイル時にエラーとして検知される。
	 */
	toDomain(row: UserRow): User {
		const status: UserStatus = row.status;
		const role: UserRole = row.role;

		return new User({
			id: row.id,
			email: row.email,
			name: row.name,
			status,
			role,
			createdAt: row.createdAt,
			lastLogin: row.lastLogin,
		});
	},

	/**
	 * ドメインのUserをDB挿入用データに変換
	 */
	toRowInsert(user: User): UserRowInsert {
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			status: user.status,
			role: user.role,
			createdAt: user.createdAt,
			lastLogin: user.lastLogin,
		};
	},

	/**
	 * ドメインのUserをDB更新用データに変換
	 */
	toRowUpdate(user: User): Partial<UserRowInsert> {
		return {
			name: user.name,
			status: user.status,
			role: user.role,
			lastLogin: user.lastLogin,
		};
	},
};
