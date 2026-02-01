"use client";

import type React from "react";
import type { Todo } from "../types/todo";

interface TodoItemProps {
	todo: Todo;
	onToggle: (id: string) => void;
	onDelete: (id: string) => void;
}

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
	const itemStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "0.75rem",
		borderBottom: "1px solid #e5e7eb",
	};

	const labelStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "0.75rem",
		flex: 1,
		cursor: "pointer",
	};

	const checkboxStyle: React.CSSProperties = {
		width: "1.25rem",
		height: "1.25rem",
		cursor: "pointer",
	};

	const textStyle: React.CSSProperties = {
		fontSize: "1rem",
	};

	const completedTextStyle: React.CSSProperties = {
		fontSize: "1rem",
		textDecoration: "line-through",
		color: "#9ca3af",
	};

	const deleteButtonStyle: React.CSSProperties = {
		padding: "0.25rem 0.75rem",
		fontSize: "0.875rem",
		color: "#dc2626",
		backgroundColor: "transparent",
		border: "1px solid #fca5a5",
		borderRadius: "0.375rem",
		cursor: "pointer",
	};

	return (
		<li style={itemStyle}>
			<label style={labelStyle}>
				<input
					type="checkbox"
					checked={todo.completed}
					onChange={() => onToggle(todo.id)}
					style={checkboxStyle}
					aria-label={`${todo.title}を${todo.completed ? "未完了" : "完了"}にする`}
				/>
				<span style={todo.completed ? completedTextStyle : textStyle}>
					{todo.title}
				</span>
			</label>
			<button
				type="button"
				onClick={() => onDelete(todo.id)}
				style={deleteButtonStyle}
				aria-label={`${todo.title}を削除`}
			>
				削除
			</button>
		</li>
	);
}
