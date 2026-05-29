/**
 * IUserRepository
 *
 * ユーザーリポジトリのインターフェース。
 * Domain層で定義し、Infrastructure層で実装する。
 */

import type { Result } from "../../core/result";
import type { User, UserRole, UserStatus } from "../entities/User";

/**
 * ユーザー作成入力データ
 *
 * password / image は Domain の User エンティティに含めない（機微情報をドメインに露出させない方針）。
 * 作成時の入力としてのみ Repository インターフェースに渡し、戻り値は User エンティティを返す。
 */
export interface CreateUserInput {
	/** ユーザーID（アプリ層で生成して渡す） */
	readonly id: string;
	/** メールアドレス */
	readonly email: string;
	/** 表示名 */
	readonly name: string | null;
	/** ハッシュ化済みパスワード（任意：OAuth ユーザー等は null） */
	readonly password?: string | null;
	/** プロフィール画像 URL（任意） */
	readonly image?: string | null;
	/** ステータス（省略時は DB デフォルト "pending"） */
	readonly status?: UserStatus;
	/** ロール（省略時は DB デフォルト "user"） */
	readonly role?: UserRole;
}

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
	 * 新規ユーザーを作成する
	 *
	 * password / image を含む入力を受け取り、Domain の User エンティティを返す。
	 *
	 * @param input - 作成するユーザーの入力データ
	 * @returns 作成された User エンティティ、または失敗時のエラー
	 */
	create(input: CreateUserInput): Promise<Result<User, Error>>;

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
	 * 認証用にメールアドレスでユーザーを取得する（Credentials Provider 専用）
	 *
	 * Domain User は password / image を保持しないため、認証フローでのみ必要となる
	 * 機微情報を Domain Entity と並列で返す専用メソッド。
	 *
	 * @param email - メールアドレス
	 * @returns ユーザー本体と認証用フィールド、または見つからない場合はnull
	 */
	findByEmailForAuth(
		email: string,
	): Promise<
		Result<{ user: User; password: string | null; image: string | null } | null, Error>
	>;

	/**
	 * ユーザーの最終ログイン日時を更新する
	 *
	 * @param id - ユーザーID
	 * @param loginTime - ログイン日時
	 * @returns 成功時はvoid、失敗時はエラー
	 */
	updateLastLogin(id: string, loginTime: Date): Promise<Result<void, Error>>;
}
