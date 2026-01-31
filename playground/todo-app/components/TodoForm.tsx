"use client";

import type React from "react";
import { useState } from "react";

interface TodoFormProps {
	onSubmit: (title: string) => void;
}

export function TodoForm({ onSubmit }: TodoFormProps) {
	const [title, setTitle] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (title.trim() === "") return;
		onSubmit(title.trim());
		setTitle("");
	};

	const formStyle: React.CSSProperties = {
		display: "flex",
		gap: "0.5rem",
		marginBottom: "1.5rem",
	};

	const inputStyle: React.CSSProperties = {
		flex: 1,
		padding: "0.75rem",
		fontSize: "1rem",
		border: "1px solid #d1d5db",
		borderRadius: "0.375rem",
	};

	const buttonStyle: React.CSSProperties = {
		padding: "0.75rem 1.5rem",
		fontSize: "1rem",
		fontWeight: 500,
		color: "white",
		backgroundColor: "#3b82f6",
		border: "none",
		borderRadius: "0.375rem",
		cursor: "pointer",
	};

	return (
		<form onSubmit={handleSubmit} style={formStyle}>
			<input
				type="text"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="新しいTodoを入力"
				style={inputStyle}
				maxLength={255}
				aria-label="新しいTodoのタイトル"
			/>
			<button type="submit" style={buttonStyle}>
				追加
			</button>
		</form>
	);
}
