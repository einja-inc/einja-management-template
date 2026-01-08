import bcrypt from "bcryptjs";

/**
 * パスワードをハッシュ化
 * @param password プレーンテキストのパスワード
 * @param saltRounds ソルトラウンド数（デフォルト: 10）
 * @returns ハッシュ化されたパスワード
 */
export async function hashPassword(
  password: string,
  saltRounds = 10,
): Promise<string> {
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

/**
 * パスワードを検証
 * @param password プレーンテキストのパスワード
 * @param hashedPassword ハッシュ化されたパスワード
 * @returns パスワードが一致する場合true
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 開発環境用のデフォルトパスワード
 */
export const DEFAULT_PASSWORD = "password123";

/**
 * 開発環境用のデフォルトパスワード（ハッシュ化済み）
 * テストやシードで使用するためのキャッシュ
 */
let cachedHashedPassword: string | null = null;

/**
 * デフォルトパスワードのハッシュを取得（キャッシュあり）
 * @returns ハッシュ化されたデフォルトパスワード
 */
export async function getDefaultHashedPassword(): Promise<string> {
  if (!cachedHashedPassword) {
    cachedHashedPassword = await hashPassword(DEFAULT_PASSWORD);
  }
  return cachedHashedPassword;
}
