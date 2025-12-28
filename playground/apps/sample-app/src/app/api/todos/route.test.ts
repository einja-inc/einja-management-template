import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises");

import { readFile, writeFile } from "node:fs/promises";
import { GET, POST } from "@/app/api/todos/route";

describe("GET /api/todos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("空のTODO配列を返す（ファイルが存在しない場合）", async () => {
		// Given: todos.jsonファイルが存在しない
		vi.mocked(readFile).mockRejectedValue({ code: "ENOENT" });

		// When: GET /api/todos をリクエスト
		const response = await GET();

		// Then: ステータス200、空配列を返す
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual([]);
	});

	it("既存のTODO一覧を返す（ファイルにデータが存在する場合）", async () => {
		// Given: todos.jsonに2件のTODOが存在
		const existingTodos = [
			{ id: "1", text: "既存TODO1", createdAt: "2025-01-01T00:00:00.000Z" },
			{ id: "2", text: "既存TODO2", createdAt: "2025-01-02T00:00:00.000Z" },
		];
		vi.mocked(readFile).mockResolvedValue(JSON.stringify(existingTodos));

		// When: GET /api/todos をリクエスト
		const response = await GET();

		// Then: ステータス200、既存のTODO配列を返す
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual(existingTodos);
	});

	it("エラーステータス500を返す（ファイル読み込み失敗時）", async () => {
		// Given: ファイル読み込みでエラー発生
		vi.mocked(readFile).mockRejectedValue(new Error("Read error"));

		// When: GET /api/todos をリクエスト
		const response = await GET();

		// Then: ステータス500、エラーメッセージを返す
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data).toEqual({ error: "Failed to read todos" });
	});
});

describe("POST /api/todos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("新しいTODOを追加する（正常系）", async () => {
		// Given: 既存のTODOが1件存在
		const existingTodos = [
			{ id: "1", text: "既存TODO", createdAt: "2025-01-01T00:00:00.000Z" },
		];
		vi.mocked(readFile).mockResolvedValue(JSON.stringify(existingTodos));
		vi.mocked(writeFile).mockResolvedValue();

		const requestBody = { text: "新しいTODO" };
		const request = new NextRequest("http://localhost/api/todos", {
			method: "POST",
			body: JSON.stringify(requestBody),
			headers: {
				"Content-Type": "application/json",
			},
		});

		// When: POST /api/todos をリクエスト
		const response = await POST(request);

		// Then: ステータス200、新規TODOオブジェクトを返す
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toMatchObject({
			text: "新しいTODO",
		});
		expect(data).toHaveProperty("id");
		expect(data).toHaveProperty("createdAt");

		// Then: ファイルに正しく保存される
		expect(writeFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("新しいTODO"),
			"utf-8",
		);
	});

	it("エラーステータス400を返す（textが空の場合）", async () => {
		// Given: textプロパティが空のリクエスト
		const requestBody = { text: "" };
		const request = new NextRequest("http://localhost/api/todos", {
			method: "POST",
			body: JSON.stringify(requestBody),
			headers: {
				"Content-Type": "application/json",
			},
		});

		// When: POST /api/todos をリクエスト
		const response = await POST(request);

		// Then: ステータス400、エラーメッセージを返す
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data).toEqual({
			error: "text is required and must be a string",
		});

		// Then: ファイルへの書き込みは行われない
		expect(writeFile).not.toHaveBeenCalled();
	});

	it("エラーステータス400を返す（textがnullの場合）", async () => {
		// Given: textプロパティがnullのリクエスト
		const requestBody = { text: null };
		const request = new NextRequest("http://localhost/api/todos", {
			method: "POST",
			body: JSON.stringify(requestBody),
			headers: {
				"Content-Type": "application/json",
			},
		});

		// When: POST /api/todos をリクエスト
		const response = await POST(request);

		// Then: ステータス400、エラーメッセージを返す
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data).toEqual({
			error: "text is required and must be a string",
		});
	});

	it("エラーステータス400を返す（不正なJSON形式の場合）", async () => {
		// Given: 不正なJSON形式のリクエスト
		const request = new NextRequest("http://localhost/api/todos", {
			method: "POST",
			body: "invalid json",
			headers: {
				"Content-Type": "application/json",
			},
		});

		// When: POST /api/todos をリクエスト
		const response = await POST(request);

		// Then: ステータス400、エラーメッセージを返す
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data).toEqual({ error: "Invalid JSON format" });
	});

	it("エラーステータス500を返す（ファイル書き込み失敗時）", async () => {
		// Given: ファイル書き込みでエラー発生
		vi.mocked(readFile).mockResolvedValue("[]");
		vi.mocked(writeFile).mockRejectedValue(new Error("Write error"));

		const requestBody = { text: "新しいTODO" };
		const request = new NextRequest("http://localhost/api/todos", {
			method: "POST",
			body: JSON.stringify(requestBody),
			headers: {
				"Content-Type": "application/json",
			},
		});

		// When: POST /api/todos をリクエスト
		const response = await POST(request);

		// Then: ステータス500、エラーメッセージを返す
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data).toEqual({ error: "Failed to create todo" });
	});
});
