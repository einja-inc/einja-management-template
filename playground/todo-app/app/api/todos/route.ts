// playground/todo-app/app/api/todos/route.ts

import { prisma } from "@/lib/prisma";
import { validateCreateTodo } from "@/lib/validation";
import { NextResponse } from "next/server";

/**
 * GET /api/todos - Todo一覧取得
 */
export async function GET() {
	try {
		const todos = await prisma.todo.findMany({
			orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
		});
		return NextResponse.json(todos);
	} catch (error) {
		console.error("Failed to fetch todos:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/todos - Todo新規作成
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const validation = validateCreateTodo(body);

		if (!validation.success) {
			return NextResponse.json({ error: validation.error }, { status: 400 });
		}

		const { title, completed } = body as { title: string; completed?: boolean };

		const todo = await prisma.todo.create({
			data: {
				title,
				completed: completed ?? false,
			},
		});

		return NextResponse.json(todo, { status: 201 });
	} catch (error) {
		console.error("Failed to create todo:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
