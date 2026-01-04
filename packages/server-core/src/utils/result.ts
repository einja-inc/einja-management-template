/**
 * Result型ユーティリティ
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
 * nullable値からResultを生成する
 * @param value - 検査する値
 * @param errorIfNull - nullの場合のエラー
 */
export function fromNullable<T, E>(
	value: T | null | undefined,
	errorIfNull: E,
): Result<T, E> {
	if (value === null || value === undefined) {
		return failure(errorIfNull);
	}
	return success(value);
}

/**
 * 複数のResultを結合する
 * 全て成功の場合のみ成功、1つでも失敗があれば最初の失敗を返す
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
	const values: T[] = [];
	for (const result of results) {
		if (!result.isSuccess) {
			return failure(result.error);
		}
		values.push(result.value);
	}
	return success(values);
}

/**
 * Resultの値を変換する（mapと同等）
 */
export function map<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => U,
): Result<U, E> {
	if (result.isSuccess) {
		return success(fn(result.value));
	}
	return result;
}

/**
 * Result型のチェーン処理（flatMapと同等）
 */
export function flatMap<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>,
): Result<U, E> {
	if (result.isSuccess) {
		return fn(result.value);
	}
	return result;
}

/**
 * 成功値を取得、失敗の場合はデフォルト値を返す
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
	if (result.isSuccess) {
		return result.value;
	}
	return defaultValue;
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
