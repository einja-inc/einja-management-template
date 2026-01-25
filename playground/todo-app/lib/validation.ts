// playground/todo-app/lib/validation.ts

interface ValidationResult {
	success: boolean;
	error?: string;
}

/**
 * Todo新規作成時のバリデーション
 * @param data - 検証対象のデータ
 * @returns ValidationResult
 */
export function validateCreateTodo(data: unknown): ValidationResult {
	if (!data || typeof data !== "object") {
		return { success: false, error: "Invalid data" };
	}

	const { title } = data as { title?: unknown };

	if (title === undefined || title === null) {
		return { success: false, error: "Title is required" };
	}

	if (typeof title !== "string") {
		return { success: false, error: "Title must be a string" };
	}

	if (title.trim() === "") {
		return { success: false, error: "Title cannot be empty" };
	}

	if (title.length > 255) {
		return { success: false, error: "Title must be 255 characters or less" };
	}

	return { success: true };
}

/**
 * Todo更新時のバリデーション
 * @param data - 検証対象のデータ
 * @returns ValidationResult
 */
export function validateUpdateTodo(data: unknown): ValidationResult {
	if (!data || typeof data !== "object") {
		return { success: false, error: "Invalid data" };
	}

	const { title, completed } = data as {
		title?: unknown;
		completed?: unknown;
	};

	if (title !== undefined) {
		if (typeof title !== "string") {
			return { success: false, error: "Title must be a string" };
		}
		if (title.trim() === "") {
			return { success: false, error: "Title cannot be empty" };
		}
		if (title.length > 255) {
			return { success: false, error: "Title must be 255 characters or less" };
		}
	}

	if (completed !== undefined && typeof completed !== "boolean") {
		return { success: false, error: "Completed must be a boolean" };
	}

	return { success: true };
}
