/**
 * UserRepository
 *
 * IUserRepositoryの実装。Prismaを使用してユーザーデータを操作する。
 */

import type { Prisma } from "@prisma/client";
import type { User } from "../../../domain/entities/User";
import type {
	IUserRepository,
	PaginatedResult,
	PaginationOptions,
	UserSearchCriteria,
} from "../../../domain/repository-interfaces/IUserRepository";
import { type Result, failure, success } from "../../../utils/result";
import { prisma } from "../client";
import { UserMapper } from "../mappers/UserMapper";

/** デフォルトのページネーション設定 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * 検索条件をPrismaのwhere句に変換
 */
function buildWhereClause(criteria: UserSearchCriteria): Prisma.UserWhereInput {
	const where: Prisma.UserWhereInput = {};

	if (criteria.id !== undefined) {
		where.id = criteria.id;
	}

	if (criteria.email !== undefined) {
		where.email = criteria.email;
	}

	if (criteria.status !== undefined) {
		where.status = criteria.status;
	}

	if (criteria.role !== undefined) {
		where.role = criteria.role;
	}

	if (criteria.search !== undefined && criteria.search.trim() !== "") {
		where.OR = [
			{ name: { contains: criteria.search, mode: "insensitive" } },
			{ email: { contains: criteria.search, mode: "insensitive" } },
		];
	}

	return where;
}

/**
 * UserRepository実装
 */
export const userRepository: IUserRepository = {
	async search(
		criteria: UserSearchCriteria,
		pagination?: PaginationOptions,
	): Promise<Result<PaginatedResult<User>, Error>> {
		try {
			const page = pagination?.page ?? DEFAULT_PAGE;
			const limit = pagination?.limit ?? DEFAULT_LIMIT;
			const skip = (page - 1) * limit;

			const where = buildWhereClause(criteria);

			const [users, total] = await Promise.all([
				prisma.user.findMany({
					where,
					skip,
					take: limit,
					orderBy: { createdAt: "desc" },
				}),
				prisma.user.count({ where }),
			]);

			const items = users.map(UserMapper.toDomain);
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

			const user = await prisma.user.findFirst({ where });

			if (!user) {
				return success(null);
			}

			return success(UserMapper.toDomain(user));
		} catch (error) {
			return failure(
				error instanceof Error ? error : new Error("Unknown error occurred during user find"),
			);
		}
	},

	async findById(id: string): Promise<Result<User | null, Error>> {
		try {
			const user = await prisma.user.findUnique({
				where: { id },
			});

			if (!user) {
				return success(null);
			}

			return success(UserMapper.toDomain(user));
		} catch (error) {
			return failure(
				error instanceof Error ? error : new Error("Unknown error occurred during user findById"),
			);
		}
	},

	async findByEmail(email: string): Promise<Result<User | null, Error>> {
		try {
			const user = await prisma.user.findUnique({
				where: { email },
			});

			if (!user) {
				return success(null);
			}

			return success(UserMapper.toDomain(user));
		} catch (error) {
			return failure(
				error instanceof Error
					? error
					: new Error("Unknown error occurred during user findByEmail"),
			);
		}
	},

	async updateLastLogin(id: string, loginTime: Date): Promise<Result<void, Error>> {
		try {
			await prisma.user.update({
				where: { id },
				data: { lastLogin: loginTime },
			});

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
