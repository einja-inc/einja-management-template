// playground/todo-app/__tests__/validation.test.ts

import { describe, it, expect } from "vitest";
import {
	validateCreateTodo,
	validateUpdateTodo,
} from "@/lib/validation";

describe("validateCreateTodo", () => {
	it("有効なデータで成功を返す", () => {
		const result = validateCreateTodo({ title: "テストTodo" });
		expect(result.success).toBe(true);
	});

	it("titleが未指定でエラーを返す", () => {
		const result = validateCreateTodo({});
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title is required");
	});

	it("titleがnullでエラーを返す", () => {
		const result = validateCreateTodo({ title: null });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title is required");
	});

	it("titleが空文字でエラーを返す", () => {
		const result = validateCreateTodo({ title: "" });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title cannot be empty");
	});

	it("titleが空白のみでエラーを返す", () => {
		const result = validateCreateTodo({ title: "   " });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title cannot be empty");
	});

	it("titleが255文字を超えるとエラーを返す", () => {
		const result = validateCreateTodo({ title: "a".repeat(256) });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title must be 255 characters or less");
	});

	it("titleが255文字ちょうどで成功を返す", () => {
		const result = validateCreateTodo({ title: "a".repeat(255) });
		expect(result.success).toBe(true);
	});

	it("titleが文字列でない場合エラーを返す", () => {
		const result = validateCreateTodo({ title: 123 });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title must be a string");
	});

	it("dataがnullの場合エラーを返す", () => {
		const result = validateCreateTodo(null);
		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid data");
	});

	it("dataがオブジェクトでない場合エラーを返す", () => {
		const result = validateCreateTodo("invalid");
		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid data");
	});
});

describe("validateUpdateTodo", () => {
	it("有効な更新データで成功を返す", () => {
		const result = validateUpdateTodo({ completed: true });
		expect(result.success).toBe(true);
	});

	it("titleのみの更新で成功を返す", () => {
		const result = validateUpdateTodo({ title: "更新されたタイトル" });
		expect(result.success).toBe(true);
	});

	it("titleとcompletedの両方更新で成功を返す", () => {
		const result = validateUpdateTodo({
			title: "更新されたタイトル",
			completed: true,
		});
		expect(result.success).toBe(true);
	});

	it("completedが非booleanでエラーを返す", () => {
		const result = validateUpdateTodo({ completed: "invalid" });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Completed must be a boolean");
	});

	it("completedが数値でエラーを返す", () => {
		const result = validateUpdateTodo({ completed: 1 });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Completed must be a boolean");
	});

	it("titleが空文字でエラーを返す", () => {
		const result = validateUpdateTodo({ title: "" });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title cannot be empty");
	});

	it("titleが255文字を超えるとエラーを返す", () => {
		const result = validateUpdateTodo({ title: "a".repeat(256) });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title must be 255 characters or less");
	});

	it("titleが文字列でない場合エラーを返す", () => {
		const result = validateUpdateTodo({ title: 123 });
		expect(result.success).toBe(false);
		expect(result.error).toBe("Title must be a string");
	});

	it("dataがnullの場合エラーを返す", () => {
		const result = validateUpdateTodo(null);
		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid data");
	});

	it("空オブジェクトで成功を返す", () => {
		const result = validateUpdateTodo({});
		expect(result.success).toBe(true);
	});
});
