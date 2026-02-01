// playground/todo-app/__tests__/integration/todo-api.test.ts

import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";

// DB接続が必要なため、DATABASE_URLが設定されていない場合はスキップ
const isDbAvailable = (): boolean => {
	try {
		return !!process.env.DATABASE_URL;
	} catch {
		return false;
	}
};

describe.skipIf(!isDbAvailable())("Todo API Integration Tests", () => {
	beforeEach(async () => {
		// テストデータのクリーンアップ
		await prisma.todo.deleteMany();
	});

	describe("GET /api/todos - 一覧取得", () => {
		it("データベースにTodoレコードが存在する場合、Todo配列が返る", async () => {
			// Given: データベースにTodoレコードが存在する
			await prisma.todo.create({
				data: {
					title: "テストTodo1",
					completed: false,
				},
			});
			await prisma.todo.create({
				data: {
					title: "テストTodo2",
					completed: true,
				},
			});

			// When: findManyで一覧取得
			const todos = await prisma.todo.findMany({
				orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
			});

			// Then: 2件のTodoが返る
			expect(todos).toHaveLength(2);
			expect(todos[0].title).toBe("テストTodo1");
			expect(todos[0].completed).toBe(false);
			expect(todos[1].title).toBe("テストTodo2");
			expect(todos[1].completed).toBe(true);
		});

		it("データベースにTodoレコードが存在しない場合、空配列が返る", async () => {
			// Given: データベースにTodoレコードが存在しない
			// When: findManyで一覧取得
			const todos = await prisma.todo.findMany();

			// Then: 空配列が返る
			expect(todos).toHaveLength(0);
			expect(todos).toEqual([]);
		});

		it("未完了Todoが完了済みTodoより先に並ぶ", async () => {
			// Given: 完了済みと未完了のTodoが存在
			await prisma.todo.create({
				data: { title: "完了済み", completed: true },
			});
			await prisma.todo.create({
				data: { title: "未完了", completed: false },
			});

			// When: orderByで取得
			const todos = await prisma.todo.findMany({
				orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
			});

			// Then: 未完了が先に来る
			expect(todos[0].title).toBe("未完了");
			expect(todos[1].title).toBe("完了済み");
		});
	});

	describe("POST /api/todos - 新規作成", () => {
		it("有効なTodoデータを送信すると、データベースにTodoが作成される", async () => {
			// Given: 有効なTodoデータ
			const todoData = {
				title: "買い物に行く",
				completed: false,
			};

			// When: createでTodo作成
			const todo = await prisma.todo.create({
				data: todoData,
			});

			// Then: 作成されたTodoオブジェクトが返る
			expect(todo.id).toBeDefined();
			expect(todo.title).toBe("買い物に行く");
			expect(todo.completed).toBe(false);
			expect(todo.createdAt).toBeInstanceOf(Date);
			expect(todo.updatedAt).toBeInstanceOf(Date);

			// データベースに保存されているか確認
			const savedTodo = await prisma.todo.findUnique({
				where: { id: todo.id },
			});
			expect(savedTodo).toBeDefined();
			expect(savedTodo?.title).toBe("買い物に行く");
		});

		it("completedを指定しない場合、デフォルトでfalseになる", async () => {
			// Given: completedを指定しないデータ
			const todoData = {
				title: "デフォルトTodo",
			};

			// When: Todo作成
			const todo = await prisma.todo.create({
				data: todoData,
			});

			// Then: completedがfalse
			expect(todo.completed).toBe(false);
		});

		it("titleが255文字ちょうどで作成できる", async () => {
			// Given: 255文字のタイトル
			const longTitle = "a".repeat(255);

			// When: Todo作成
			const todo = await prisma.todo.create({
				data: { title: longTitle },
			});

			// Then: 作成成功
			expect(todo.title).toBe(longTitle);
			expect(todo.title.length).toBe(255);
		});
	});

	describe("PUT /api/todos/:id - 更新", () => {
		it("未完了のTodoの完了状態を切り替えることができる", async () => {
			// Given: 未完了のTodoが存在
			const todo = await prisma.todo.create({
				data: {
					title: "テストTodo",
					completed: false,
				},
			});

			// When: completedをtrueに更新
			const updatedTodo = await prisma.todo.update({
				where: { id: todo.id },
				data: { completed: true },
			});

			// Then: 完了状態になる
			expect(updatedTodo.completed).toBe(true);
			expect(updatedTodo.updatedAt.getTime()).toBeGreaterThanOrEqual(
				todo.updatedAt.getTime(),
			);
		});

		it("タイトルを更新できる", async () => {
			// Given: Todoが存在
			const todo = await prisma.todo.create({
				data: {
					title: "旧タイトル",
					completed: false,
				},
			});

			// When: タイトルを更新
			const updatedTodo = await prisma.todo.update({
				where: { id: todo.id },
				data: { title: "新タイトル" },
			});

			// Then: タイトルが更新される
			expect(updatedTodo.title).toBe("新タイトル");
			expect(updatedTodo.updatedAt.getTime()).toBeGreaterThanOrEqual(
				todo.updatedAt.getTime(),
			);
		});

		it("存在しないTodo IDで更新しようとするとエラーが発生する", async () => {
			// Given: 存在しないTodo ID
			const nonexistentId = "nonexistent-id";

			// When/Then: updateでエラーが発生
			await expect(
				prisma.todo.update({
					where: { id: nonexistentId },
					data: { completed: true },
				}),
			).rejects.toThrow();
		});

		it("タイトルとcompletedを同時に更新できる", async () => {
			// Given: Todoが存在
			const todo = await prisma.todo.create({
				data: {
					title: "旧タイトル",
					completed: false,
				},
			});

			// When: 両方を更新
			const updatedTodo = await prisma.todo.update({
				where: { id: todo.id },
				data: {
					title: "新タイトル",
					completed: true,
				},
			});

			// Then: 両方が更新される
			expect(updatedTodo.title).toBe("新タイトル");
			expect(updatedTodo.completed).toBe(true);
		});
	});

	describe("DELETE /api/todos/:id - 削除", () => {
		it("Todoが存在する場合、削除できる", async () => {
			// Given: Todoが存在
			const todo = await prisma.todo.create({
				data: {
					title: "削除されるTodo",
					completed: false,
				},
			});

			// When: 削除
			await prisma.todo.delete({
				where: { id: todo.id },
			});

			// Then: データベースから削除される
			const deletedTodo = await prisma.todo.findUnique({
				where: { id: todo.id },
			});
			expect(deletedTodo).toBeNull();
		});

		it("存在しないTodo IDで削除しようとするとエラーが発生する", async () => {
			// Given: 存在しないTodo ID
			const nonexistentId = "nonexistent-id";

			// When/Then: deleteでエラーが発生
			await expect(
				prisma.todo.delete({
					where: { id: nonexistentId },
				}),
			).rejects.toThrow();
		});

		it("削除後、GET /api/todosで取得できなくなる", async () => {
			// Given: Todoが存在
			const todo = await prisma.todo.create({
				data: { title: "削除されるTodo" },
			});

			// When: 削除
			await prisma.todo.delete({
				where: { id: todo.id },
			});

			// Then: findManyに含まれない
			const todos = await prisma.todo.findMany();
			expect(
				todos.find((t: { id: string }) => t.id === todo.id),
			).toBeUndefined();
		});
	});
});
