import { describe, expect, it } from "vitest";
import {
	type Result,
	combine,
	failure,
	flatMap,
	fromNullable,
	getOrElse,
	isFailure,
	isSuccess,
	map,
	success,
} from "./result";

describe("Result型ユーティリティ", () => {
	describe("success", () => {
		it("payloadをラップした成功Resultを返す", () => {
			// Given
			const value = { id: "1", name: "test" };

			// When
			const result = success(value);

			// Then
			expect(result.isSuccess).toBe(true);
			expect(result.value).toEqual(value);
		});

		it("プリミティブ値でも成功Resultを返す", () => {
			// Given
			const value = 42;

			// When
			const result = success(value);

			// Then
			expect(result.isSuccess).toBe(true);
			expect(result.value).toBe(42);
		});
	});

	describe("failure", () => {
		it("エラーコンテキストを保持した失敗Resultを返す", () => {
			// Given
			const error = new Error("Something went wrong");

			// When
			const result = failure(error);

			// Then
			expect(result.isSuccess).toBe(false);
			expect(result.error).toBe(error);
			expect(result.error.message).toBe("Something went wrong");
		});

		it("カスタムエラー型も保持できる", () => {
			// Given
			type CustomError = { code: string; message: string };
			const error: CustomError = { code: "NOT_FOUND", message: "User not found" };

			// When
			const result = failure(error);

			// Then
			expect(result.isSuccess).toBe(false);
			expect(result.error).toEqual({ code: "NOT_FOUND", message: "User not found" });
		});
	});

	describe("fromNullable", () => {
		it("非null値の場合、成功Resultを返す", () => {
			// Given
			const value = "valid value";
			const error = new Error("Value is null");

			// When
			const result = fromNullable(value, error);

			// Then
			expect(result.isSuccess).toBe(true);
			if (result.isSuccess) {
				expect(result.value).toBe("valid value");
			}
		});

		it("null値の場合、失敗Resultを返す", () => {
			// Given
			const value = null;
			const error = new Error("Value is null");

			// When
			const result = fromNullable(value, error);

			// Then
			expect(result.isSuccess).toBe(false);
			if (!result.isSuccess) {
				expect(result.error.message).toBe("Value is null");
			}
		});

		it("undefined値の場合、失敗Resultを返す", () => {
			// Given
			const value = undefined;
			const error = new Error("Value is undefined");

			// When
			const result = fromNullable(value, error);

			// Then
			expect(result.isSuccess).toBe(false);
		});
	});

	describe("combine", () => {
		it("空配列の場合、空配列を含む成功Resultを返す", () => {
			// Given
			const results: Result<number, Error>[] = [];

			// When
			const combined = combine(results);

			// Then
			expect(combined.isSuccess).toBe(true);
			if (combined.isSuccess) {
				expect(combined.value).toEqual([]);
			}
		});

		it("全て成功の場合、値の配列を含む成功Resultを返す", () => {
			// Given
			const results = [success(1), success(2), success(3)];

			// When
			const combined = combine(results);

			// Then
			expect(combined.isSuccess).toBe(true);
			if (combined.isSuccess) {
				expect(combined.value).toEqual([1, 2, 3]);
			}
		});

		it("1つでも失敗がある場合、最初の失敗Resultを返す", () => {
			// Given
			const error1 = new Error("Error 1");
			const error2 = new Error("Error 2");
			const results = [success(1), failure(error1), failure(error2)];

			// When
			const combined = combine(results);

			// Then
			expect(combined.isSuccess).toBe(false);
			if (!combined.isSuccess) {
				expect(combined.error).toBe(error1);
			}
		});
	});

	describe("map", () => {
		it("成功Resultの値を変換する", () => {
			// Given
			const result = success(5);

			// When
			const mapped = map(result, (x) => x * 2);

			// Then
			expect(mapped.isSuccess).toBe(true);
			if (mapped.isSuccess) {
				expect(mapped.value).toBe(10);
			}
		});

		it("失敗Resultはそのまま返す", () => {
			// Given
			const error = new Error("Failed");
			const result: Result<number, Error> = failure(error);

			// When
			const mapped = map(result, (x) => x * 2);

			// Then
			expect(mapped.isSuccess).toBe(false);
			if (!mapped.isSuccess) {
				expect(mapped.error).toBe(error);
			}
		});
	});

	describe("flatMap", () => {
		it("成功Resultをチェーンして新しい成功Resultを返す", () => {
			// Given
			const result = success(5);

			// When
			const chained = flatMap(result, (x) => success(x * 2));

			// Then
			expect(chained.isSuccess).toBe(true);
			if (chained.isSuccess) {
				expect(chained.value).toBe(10);
			}
		});

		it("チェーン処理中の失敗を伝播する", () => {
			// Given
			const result = success(5);
			const error = new Error("Chain failed");

			// When
			const chained = flatMap(result, () => failure(error));

			// Then
			expect(chained.isSuccess).toBe(false);
			if (!chained.isSuccess) {
				expect(chained.error).toBe(error);
			}
		});

		it("最初から失敗の場合、チェーン関数を実行せず失敗を返す", () => {
			// Given
			const error = new Error("Initial failure");
			const result: Result<number, Error> = failure(error);
			let chainCalled = false;

			// When
			const chained = flatMap(result, (x) => {
				chainCalled = true;
				return success(x * 2);
			});

			// Then
			expect(chainCalled).toBe(false);
			expect(chained.isSuccess).toBe(false);
		});
	});

	describe("getOrElse", () => {
		it("成功Resultから値を取得する", () => {
			// Given
			const result = success(42);

			// When
			const value = getOrElse(result, 0);

			// Then
			expect(value).toBe(42);
		});

		it("失敗Resultの場合、デフォルト値を返す", () => {
			// Given
			const result: Result<number, Error> = failure(new Error("Failed"));

			// When
			const value = getOrElse(result, 0);

			// Then
			expect(value).toBe(0);
		});
	});

	describe("isSuccess / isFailure", () => {
		it("isSuccessは成功Resultに対してtrueを返す", () => {
			// Given
			const result = success(42);

			// When & Then
			expect(isSuccess(result)).toBe(true);
			expect(isFailure(result)).toBe(false);
		});

		it("isFailureは失敗Resultに対してtrueを返す", () => {
			// Given
			const result = failure(new Error("Failed"));

			// When & Then
			expect(isSuccess(result)).toBe(false);
			expect(isFailure(result)).toBe(true);
		});
	});
});
