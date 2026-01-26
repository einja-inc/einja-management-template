// playground/todo-app/app/api/todos/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUpdateTodo } from "@/lib/validation";

/**
 * PUT /api/todos/:id - Todo更新
 */
export async function PUT(
	request: Request,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		const body = await request.json();
		const validation = validateUpdateTodo(body);

		if (!validation.success) {
			return NextResponse.json({ error: validation.error }, { status: 400 });
		}

		const existingTodo = await prisma.todo.findUnique({ where: { id } });
		if (!existingTodo) {
			return NextResponse.json({ error: "Todo not found" }, { status: 404 });
		}

		const { title, completed } = body as {
			title?: string;
			completed?: boolean;
		};

		const todo = await prisma.todo.update({
			where: { id },
			data: {
				...(title !== undefined && { title }),
				...(completed !== undefined && { completed }),
			},
		});

		return NextResponse.json(todo);
	} catch (error) {
		console.error("Failed to update todo:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/todos/:id - Todo削除
 */
export async function DELETE(
	request: Request,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;

		const existingTodo = await prisma.todo.findUnique({ where: { id } });
		if (!existingTodo) {
			return NextResponse.json({ error: "Todo not found" }, { status: 404 });
		}

		await prisma.todo.delete({ where: { id } });

		return new NextResponse(null, { status: 204 });
	} catch (error) {
		console.error("Failed to delete todo:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
