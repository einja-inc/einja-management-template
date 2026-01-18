import chalk from "chalk";
import { getAllPresets } from "../lib/preset.js";
export async function listCommand() {
    var _a, _b;
    console.log(chalk.blue("\n📦 利用可能なプリセット\n"));
    const presets = await getAllPresets();
    if (presets.length === 0) {
        console.log(chalk.gray("  利用可能なプリセットがありません"));
        return;
    }
    for (const preset of presets) {
        console.log(chalk.bold(`  ${preset.name}`));
        console.log(chalk.gray(`    ${preset.displayName}`));
        console.log(chalk.gray(`    ${preset.description}`));
        if (preset.config.mcpServers.length > 0) {
            console.log(chalk.gray(`    MCP: ${preset.config.mcpServers.join(", ")}`));
        }
        console.log("");
    }
    console.log(chalk.gray("使用例:"));
    console.log(chalk.cyan(`  npx @einja/claude-cli init --preset ${(_b = (_a = presets[0]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "minimal"}`));
}
//# sourceMappingURL=list.js.map