import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TodoList } from "../../components/TodoList";

describe("TodoList - ローディング状態とエラーハンドリング", () => {
	// biome-ignore lint: 型推論のためanyを使用
	let fetchSpy: any;

	beforeEach(() => {
		fetchSpy = vi.spyOn(global, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("AC6.5: 初期ローディング中に「読み込み中...」が表示される", async () => {
		// Given: APIレスポンスを遅延させる
		fetchSpy.mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(() => {
						resolve({
							ok: true,
							json: async () => [],
						} as Response);
					}, 100);
				}),
		);

		// When: TodoListをレンダリング
		render(<TodoList />);

		// Then: ローディング表示が出る
		expect(screen.getByText("読み込み中...")).toBeInTheDocument();

		// ローディングが終わるまで待つ
		await waitFor(
			() => {
				expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
			},
			{ timeout: 500 },
		);
	});

	it("AC6.6: APIエラー時にエラーメッセージと再試行ボタンが表示される", async () => {
		// Given: APIが失敗する
		fetchSpy.mockRejectedValue(new Error("Network error"));

		// When: TodoListをレンダリング
		render(<TodoList />);

		// Then: エラーメッセージと再試行ボタンが表示される
		await waitFor(() => {
			expect(
				screen.getByText("Todoの取得に失敗しました。再試行してください。"),
			).toBeInTheDocument();
		});
		expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
	});
});
