#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, "../dist/cli.js");

if (fs.existsSync(cliPath)) {
	const content = fs.readFileSync(cliPath, "utf-8");
	const shebang = "#!/usr/bin/env node\n";

	if (!content.startsWith(shebang)) {
		fs.writeFileSync(cliPath, shebang + content);
		console.log("✅ Shebang added to cli.js");
	} else {
		console.log("ℹ️ Shebang already exists");
	}

	// 実行権限を付与
	fs.chmodSync(cliPath, "755");
	console.log("✅ Executable permission granted");
} else {
	console.error("❌ cli.js not found at:", cliPath);
	process.exit(1);
}
