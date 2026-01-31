"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { TodoItem } from "./TodoItem";
import { TodoForm } from "./TodoForm";
import type { Todo } from "../types/todo";

export function TodoList() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Todo一覧取得
	const fetchTodos = async () => {
		try {
			setIsLoading(true);
			setError(null);
			const response = await fetch("/api/todos");
			if (!response.ok) throw new Error("Failed to fetch todos");
			const data = await response.json();
			setTodos(data);
		} catch (err) {
			setError("Todoの取得に失敗しました。再試行してください。");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchTodos();
	}, []);

	// Todo作成
	const handleCreate = async (title: string) => {
		try {
			const response = await fetch("/api/todos", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title }),
			});
			if (!response.ok) throw new Error("Failed to create todo");
			const newTodo = await response.json();
			setTodos((prev) => [newTodo, ...prev]);
		} catch (err) {
			setError("Todoの作成に失敗しました。");
		}
	};

	// Todo更新（完了状態切り替え）
	const handleToggle = async (id: string) => {
		const todo = todos.find((t) => t.id === id);
		if (!todo) return;

		try {
			const response = await fetch(`/api/todos/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ completed: !todo.completed }),
			});
			if (!response.ok) throw new Error("Failed to update todo");
			const updatedTodo = await response.json();
			setTodos((prev) => prev.map((t) => (t.id === id ? updatedTodo : t)));
		} catch (err) {
			setError("Todoの更新に失敗しました。");
		}
	};

	// Todo削除
	const handleDelete = async (id: string) => {
		if (!window.confirm("このTodoを削除しますか？")) return;

		try {
			const response = await fetch(`/api/todos/${id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error("Failed to delete todo");
			setTodos((prev) => prev.filter((t) => t.id !== id));
		} catch (err) {
			setError("Todoの削除に失敗しました。");
		}
	};

	const containerStyle: React.CSSProperties = {
		maxWidth: "600px",
		margin: "0 auto",
		padding: "2rem",
	};

	const titleStyle: React.CSSProperties = {
		fontSize: "2rem",
		fontWeight: "bold",
		marginBottom: "1.5rem",
	};

	const listStyle: React.CSSProperties = {
		listStyle: "none",
		padding: 0,
	};

	const loadingStyle: React.CSSProperties = {
		textAlign: "center",
		color: "#6b7280",
		padding: "2rem",
	};

	const errorStyle: React.CSSProperties = {
		backgroundColor: "#fee2e2",
		color: "#991b1b",
		padding: "1rem",
		borderRadius: "0.375rem",
		marginBottom: "1rem",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	};

	const retryButtonStyle: React.CSSProperties = {
		padding: "0.25rem 0.75rem",
		fontSize: "0.875rem",
		color: "#991b1b",
		backgroundColor: "white",
		border: "1px solid #991b1b",
		borderRadius: "0.375rem",
		cursor: "pointer",
	};

	const emptyStyle: React.CSSProperties = {
		textAlign: "center",
		color: "#6b7280",
		padding: "2rem",
	};

	return (
		<div style={containerStyle}>
			<h1 style={titleStyle}>Todo App</h1>
			<TodoForm onSubmit={handleCreate} />

			{error && (
				<div style={errorStyle}>
					{error}
					<button onClick={fetchTodos} style={retryButtonStyle}>
						再試行
					</button>
				</div>
			)}

			{isLoading ? (
				<div style={loadingStyle}>読み込み中...</div>
			) : (
				<ul style={listStyle}>
					{todos.map((todo) => (
						<TodoItem
							key={todo.id}
							todo={todo}
							onToggle={handleToggle}
							onDelete={handleDelete}
						/>
					))}
					{todos.length === 0 && <li style={emptyStyle}>Todoがありません</li>}
				</ul>
			)}
		</div>
	);
}
