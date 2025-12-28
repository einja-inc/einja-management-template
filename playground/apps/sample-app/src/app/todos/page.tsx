"use client";

import { useCallback, useEffect, useState } from "react";

interface Todo {
	id: string;
	text: string;
	createdAt: string;
}

export default function TodosPage() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [text, setText] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/**
	 * TODO一覧を取得する
	 */
	const fetchTodos = useCallback(async () => {
		try {
			setError(null);
			const response = await fetch("/api/todos");
			if (!response.ok) {
				throw new Error("Failed to fetch todos");
			}
			const data = (await response.json()) as Todo[];
			setTodos(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		}
	}, []);

	/**
	 * 新しいTODOアイテムを追加する
	 */
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!text.trim()) {
			setError("TODOテキストを入力してください");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/todos", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ text }),
			});

			if (!response.ok) {
				throw new Error("Failed to create todo");
			}

			setText("");
			await fetchTodos();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchTodos();
	}, [fetchTodos]);

	return (
		<main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
			<h1>📝 TODO App</h1>

			{error && (
				<div
					style={{
						color: "red",
						padding: "1rem",
						marginBottom: "1rem",
						border: "1px solid red",
						borderRadius: "4px",
					}}
				>
					{error}
				</div>
			)}

			<form
				onSubmit={handleSubmit}
				style={{ marginBottom: "2rem", display: "flex", gap: "0.5rem" }}
			>
				<input
					type="text"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="新しいTODOを入力"
					disabled={isLoading}
					style={{
						padding: "0.5rem",
						fontSize: "1rem",
						flex: 1,
						border: "1px solid #ccc",
						borderRadius: "4px",
					}}
				/>
				<button
					type="submit"
					disabled={isLoading}
					style={{
						padding: "0.5rem 1rem",
						fontSize: "1rem",
						backgroundColor: "#0070f3",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: isLoading ? "not-allowed" : "pointer",
					}}
				>
					{isLoading ? "追加中..." : "追加"}
				</button>
			</form>

			<h2>TODO一覧</h2>
			{todos.length === 0 ? (
				<p style={{ color: "#666" }}>TODOがありません</p>
			) : (
				<ul style={{ listStyle: "none", padding: 0 }}>
					{todos.map((todo) => (
						<li
							key={todo.id}
							style={{
								padding: "1rem",
								marginBottom: "0.5rem",
								border: "1px solid #ddd",
								borderRadius: "4px",
								backgroundColor: "#f9f9f9",
							}}
						>
							<div style={{ marginBottom: "0.25rem" }}>{todo.text}</div>
							<div style={{ fontSize: "0.8rem", color: "#666" }}>
								作成日時: {new Date(todo.createdAt).toLocaleString("ja-JP")}
							</div>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
