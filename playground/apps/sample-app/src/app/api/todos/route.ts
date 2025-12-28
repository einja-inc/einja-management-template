import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import path from "node:path";

interface Todo {
	id: string;
	text: string;
	createdAt: string;
}

/**
 * playgroundルートディレクトリを探索する
 * @returns playgroundディレクトリの絶対パス
 */
function findPlaygroundRoot(): string {
	let currentDir = process.cwd();

	// 最大10階層まで遡る（無限ループ防止）
	for (let i = 0; i < 10; i++) {
		// playgroundディレクトリ名を含むか、package.jsonにplayground workspaceが定義されているかチェック
		if (currentDir.endsWith("playground") || currentDir.includes("/playground/")) {
			// playgroundディレクトリまで遡る
			const playgroundIndex = currentDir.indexOf("/playground");
			if (playgroundIndex !== -1) {
				return currentDir.substring(0, playgroundIndex + "/playground".length);
			}
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			// ルートディレクトリに到達
			break;
		}
		currentDir = parentDir;
	}

	// フォールバック: process.cwd()から相対パスで解決
	return path.join(process.cwd(), "../..");
}

const TODOS_FILE_PATH = path.join(findPlaygroundRoot(), "data/todos.json");

/**
 * TODOデータをファイルから読み込む
 * @returns TODO配列
 * @throws {Error} ファイル読み込みまたはJSONパース失敗時
 */
async function readTodos(): Promise<Todo[]> {
	try {
		const fileContent = await readFile(TODOS_FILE_PATH, "utf-8");
		return JSON.parse(fileContent) as Todo[];
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * TODOデータをファイルに書き込む
 * @param todos - TODO配列
 * @throws {Error} ファイル書き込み失敗時
 */
async function writeTodos(todos: Todo[]): Promise<void> {
	await writeFile(TODOS_FILE_PATH, JSON.stringify(todos, null, 2), "utf-8");
}

/**
 * GET /api/todos
 * TODO一覧を取得する
 */
export async function GET() {
	try {
		const todos = await readTodos();
		return NextResponse.json(todos);
	} catch (error) {
		console.error("Failed to read todos:", error);
		return NextResponse.json(
			{ error: "Failed to read todos" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/todos
 * 新しいTODOアイテムを追加する
 */
export async function POST(request: Request) {
	try {
		const body = (await request.json()) as { text?: string };

		if (!body.text || typeof body.text !== "string") {
			return NextResponse.json(
				{ error: "text is required and must be a string" },
				{ status: 400 },
			);
		}

		const todos = await readTodos();

		const newTodo: Todo = {
			id: crypto.randomUUID(),
			text: body.text,
			createdAt: new Date().toISOString(),
		};

		todos.push(newTodo);
		await writeTodos(todos);

		return NextResponse.json(newTodo, { status: 200 });
	} catch (error) {
		console.error("Failed to create todo:", error);

		if (error instanceof SyntaxError) {
			return NextResponse.json(
				{ error: "Invalid JSON format" },
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{ error: "Failed to create todo" },
			{ status: 500 },
		);
	}
}
