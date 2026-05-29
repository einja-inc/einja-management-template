/**
 * UserRepository
 *
 * IUserRepositoryの実装。Drizzle ORM を使用してユーザーデータを操作する。
 */

import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../../../db/client";
import { users } from "../../../../db/schema";
import { failure, type Result, success } from "../../../core/result";
import type { User } from "../../../domain/entities/User";
import type {
	CreateUserInput,
	IUserRepository,
	PaginatedResult,
	PaginationOptions,
	UserSearchCriteria,
} from "../../../domain/repository-interfaces/IUserRepository";
import { UserMapper } from "../mappers/UserMapper";

/** デフォルトのページネーション設定 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * 検索条件をDrizzleのwhere句に変換
 */
function buildWhereClause(criteria: UserSearchCriteria) {
	const conditions = [];

	if (criteria.id !== undefined) {
		conditions.push(eq(users.id, criteria.id));
	}

	if (criteria.email !== undefined) {
		conditions.push(eq(users.email, criteria.email));
	}

	if (criteria.status !== undefined) {
		conditions.push(eq(users.status, criteria.status));
	}

	if (criteria.role !== undefined) {
		conditions.push(eq(users.role, criteria.role));
	}

	if (criteria.search !== undefined && criteria.search.trim() !== "") {
		// ilike のメタ文字 (%, _, \) をエスケープして injection を防ぐ。
		// PostgreSQL の標準 LIKE/ILIKE は `\` をデフォルト escape character として扱う
		// （`standard_conforming_strings = on` の前提。PostgreSQL 9.1+ のデフォルト）。
		// そのため SQL の `ESCAPE` 句を明示する必要はない。
		const escaped = criteria.search.replace(/[\\%_]/g, (c) => `\\${c}`);
		conditions.push(
			or(ilike(users.name, `%${escaped}%`), ilike(users.email, `%${escaped}%`)),
		);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * UserRepository実装
 */
export const userRepository: IUserRepository = {
	async create(input: CreateUserInput): Promise<Result<User, Error>> {
		try {
			const rows = await db
				.insert(users)
				.values({
					id: input.id,
					email: input.email,
					name: input.name,
					password: input.password ?? null,
					image: input.image ?? null,
					// status / role は省略時 DB デフォルト（pending / user）を使用
					...(input.status !== undefined ? { status: input.status } : {}),
					...(input.role !== undefined ? { role: input.role } : {}),
				})
				.returning();

			if (rows.length === 0) {
				return failure(new Error("Failed to create user: no row returned"));
			}

			return success(UserMapper.toDomain(rows[0]));
		} catch (error) {
			return failure(
				error instanceof Error ? error : new Error("Unknown error occurred during user create"),
			);
		}
	},

	async search(
		criteria: UserSearchCriteria,
		pagination?: PaginationOptions,
	): Promise<Result<PaginatedResult<User>, Error>> {
		try {
			const page = pagination?.page ?? DEFAULT_PAGE;
			const limit = pagination?.limit ?? DEFAULT_LIMIT;
			const offset = (page - 1) * limit;

			const where = buildWhereClause(criteria);

			const [rows, countResult] = await Promise.all([
				db
					.select()
					.from(users)
					.where(where)
					.orderBy(desc(users.createdAt), users.id)
					.limit(limit)
					.offset(offset),
				db.select({ value: count() }).from(users).where(where),
			]);

			const total = Number(countResult[0]?.value ?? 0);
			const items = rows.map(UserMapper.toDomain);
			const totalPages = Math.ceil(total / limit);

			return success({
				items,
				total,
				page,
				limit,
				totalPages,
			});
		} catch (error) {
			return failure(
				error instanceof Error ? error : new Error("Unknown error occurred during user search"),
			);
		}
	},

	async find(criteria: UserSearchCriteria): Promise<Result<User | null, Error>> {
		try {
			const where = buildWhereClause(criteria);

			const rows = await db.select().from(users).where(where).limit(1);

			if (rows.length === 0) {
				return success(null);
			}

			return success(UserMapper.toDomain(rows[0]));
		} catch (error) {
			return failure(
				error instanceof Error ? error : new Error("Unknown error occurred during user find"),
			);
		}
	},

	async findById(id: string): Promise<Result<User | null, Error>> {
		try {
			const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);

			if (rows.length === 0) {
				return success(null);
			}

			return success(UserMapper.toDomain(rows[0]));
		} catch (error) {
			return failure(
				error instanceof Error ? error : new Error("Unknown error occurred during user findById"),
			);
		}
	},

	async findByEmail(email: string): Promise<Result<User | null, Error>> {
		try {
			const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);

			if (rows.length === 0) {
				return success(null);
			}

			return success(UserMapper.toDomain(rows[0]));
		} catch (error) {
			return failure(
				error instanceof Error
					? error
					: new Error("Unknown error occurred during user findByEmail"),
			);
		}
	},

	async findByEmailForAuth(
		email: string,
	): Promise<
		Result<{ user: User; password: string | null; image: string | null } | null, Error>
	> {
		try {
			const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);

			if (rows.length === 0) {
				return success(null);
			}

			const row = rows[0];
			return success({
				user: UserMapper.toDomain(row),
				password: row.password,
				image: row.image,
			});
		} catch (error) {
			return failure(
				error instanceof Error
					? error
					: new Error("Unknown error occurred during user findByEmailForAuth"),
			);
		}
	},

	async updateLastLogin(id: string, loginTime: Date): Promise<Result<void, Error>> {
		try {
			const result = await db
				.update(users)
				.set({ lastLogin: loginTime })
				.where(eq(users.id, id))
				.returning({ id: users.id });

			if (result.length === 0) {
				return failure(new Error(`User not found: ${id}`));
			}

			return success(undefined);
		} catch (error) {
			return failure(
				error instanceof Error
					? error
					: new Error("Unknown error occurred during updateLastLogin"),
			);
		}
	},
};
