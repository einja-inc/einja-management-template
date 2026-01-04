/**
 * IUserRepository
 *
 * ユーザーリポジトリのインターフェース。
 * Domain層で定義し、Infrastructure層で実装する。
 */

import type { Result } from "../../utils/result";
import type { User, UserRole, UserStatus } from "../entities/User";

/**
 * ユーザー検索条件
 */
export interface UserSearchCriteria {
	/** ユーザーID */
	readonly id?: string;
	/** メールアドレス */
	readonly email?: string;
	/** ステータス */
	readonly status?: UserStatus;
	/** ロール */
	readonly role?: UserRole;
	/** 検索テキスト（名前やメールアドレスに対する部分一致） */
	readonly search?: string;
}

/**
 * ページネーションオプション
 */
export interface PaginationOptions {
	/** ページ番号（1始まり） */
	readonly page?: number;
	/** 1ページあたりの件数 */
	readonly limit?: number;
}

/**
 * ページネーション付きの結果
 */
export interface PaginatedResult<T> {
	/** 結果アイテム */
	readonly items: readonly T[];
	/** 総件数 */
	readonly total: number;
	/** 現在のページ番号 */
	readonly page: number;
	/** 1ページあたりの件数 */
	readonly limit: number;
	/** 総ページ数 */
	readonly totalPages: number;
}

/**
 * ユーザーリポジトリインターフェース
 */
export interface IUserRepository {
	/**
	 * 検索条件に基づいてユーザーを検索する
	 *
	 * @param criteria - 検索条件
	 * @param pagination - ページネーションオプション
	 * @returns ページネーション付きのユーザーリスト
	 */
	search(
		criteria: UserSearchCriteria,
		pagination?: PaginationOptions,
	): Promise<Result<PaginatedResult<User>, Error>>;

	/**
	 * 検索条件に一致する単一のユーザーを取得する
	 *
	 * @param criteria - 検索条件
	 * @returns 見つかったユーザー、または見つからない場合はnull
	 */
	find(criteria: UserSearchCriteria): Promise<Result<User | null, Error>>;

	/**
	 * IDでユーザーを取得する
	 *
	 * @param id - ユーザーID
	 * @returns 見つかったユーザー、または見つからない場合はnull
	 */
	findById(id: string): Promise<Result<User | null, Error>>;

	/**
	 * メールアドレスでユーザーを取得する
	 *
	 * @param email - メールアドレス
	 * @returns 見つかったユーザー、または見つからない場合はnull
	 */
	findByEmail(email: string): Promise<Result<User | null, Error>>;

	/**
	 * ユーザーの最終ログイン日時を更新する
	 *
	 * @param id - ユーザーID
	 * @param loginTime - ログイン日時
	 * @returns 成功時はvoid、失敗時はエラー
	 */
	updateLastLogin(id: string, loginTime: Date): Promise<Result<void, Error>>;
}
