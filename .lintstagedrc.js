module.exports = {
	// Biomeによるリントとフォーマット（CLAUDE.md、.claude/、docs/specs/を除外）
	"**/*.{js,jsx,ts,tsx,json}": (filenames) => {
		const filteredFiles = filenames.filter(
			(filename) =>
				!filename.includes("CLAUDE.md") &&
				!filename.includes(".claude/") &&
				!filename.includes("docs/specs/"),
		);
		if (filteredFiles.length === 0) return [];
		// ステージングされたファイルだけをBiomeに直接渡す（高速）
		return [`npx biome check --write ${filteredFiles.join(" ")}`];
	},
	"**/*.md": (filenames) => {
		const filteredFiles = filenames.filter(
			(filename) =>
				!filename.includes("CLAUDE.md") &&
				!filename.includes(".claude/") &&
				!filename.includes("docs/specs/"),
		);
		if (filteredFiles.length === 0) return [];
		return [`npx biome check --write ${filteredFiles.join(" ")}`];
	},
};
