/**
 * Result型
 * 例外を使わないエラーハンドリングパターン
 */

/**
 * 成功を表す型
 */
export type Success<T> = {
	readonly isSuccess: true;
	readonly value: T;
};

/**
 * 失敗を表す型
 */
export type Failure<E> = {
	readonly isSuccess: false;
	readonly error: E;
};

/**
 * 成功または失敗を表すResult型
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * 成功を生成する
 */
export function success<T>(value: T): Success<T> {
	return { isSuccess: true, value };
}

/**
 * 失敗を生成する
 */
export function failure<E>(error: E): Failure<E> {
	return { isSuccess: false, error };
}

/**
 * Resultが成功かどうかを判定する型ガード
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
	return result.isSuccess;
}

/**
 * Resultが失敗かどうかを判定する型ガード
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
	return !result.isSuccess;
}
