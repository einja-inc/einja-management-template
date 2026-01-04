import { describe, expect, it } from "vitest";
import { failure, isFailure, isSuccess, success } from "./result";

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
