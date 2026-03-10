import chalk from "chalk";

/**
 * 情報メッセージを出力
 * @param message - メッセージ
 */
export function info(message: string): void {
  console.log(chalk.blue("ℹ"), message);
}

/**
 * 成功メッセージを出力（緑色）
 * @param message - メッセージ
 */
export function success(message: string): void {
  console.log(chalk.green("✔"), message);
}

/**
 * 警告メッセージを出力（黄色）
 * @param message - メッセージ
 */
export function warn(message: string): void {
  console.log(chalk.yellow("⚠"), message);
}

/**
 * エラーメッセージを出力（赤色）
 * @param message - メッセージ
 */
export function error(message: string): void {
  console.error(chalk.red("✖"), message);
}
