import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Preset } from "@/types/preset-update.js";

/**
 * プリセット発見モジュール
 *
 * packages/cli/presets/ディレクトリ内の利用可能なプリセットを検出します。
 */
export class PresetFinder {
  /**
   * 利用可能なプリセット一覧を取得
   *
   * packages/cli/presets/ディレクトリをスキャンし、
   * 有効なプリセットディレクトリを検出します。
   *
   * @param cliPackagePath - packages/cli/ディレクトリの絶対パス
   * @returns プリセット一覧
   */
  async findPresets(cliPackagePath: string): Promise<Preset[]> {
    const presetsDir = join(cliPackagePath, "presets");

    // presets/ディレクトリが存在しない場合は空配列を返す
    if (!existsSync(presetsDir)) {
      return [];
    }

    const presets: Preset[] = [];

    try {
      const entries = readdirSync(presetsDir);

      for (const entry of entries) {
        const presetPath = join(presetsDir, entry);

        // ディレクトリのみを対象とする
        if (!statSync(presetPath).isDirectory()) {
          continue;
        }

        // プリセット名の検証（有効な名前のみ追加）
        if (this.validatePresetName(entry)) {
          presets.push({
            name: entry,
            path: presetPath,
          });
        }
      }

      return presets;
    } catch (error) {
      throw new Error(
        `プリセットディレクトリの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 指定名のプリセットを取得
   *
   * @param name - プリセット名（例: "default", "turborepo-pandacss"）
   * @param cliPackagePath - packages/cli/ディレクトリの絶対パス
   * @returns プリセット情報（見つからない場合はnull）
   */
  async getPreset(name: string, cliPackagePath: string): Promise<Preset | null> {
    if (!this.validatePresetName(name)) {
      return null;
    }

    const presetPath = join(cliPackagePath, "presets", name);

    // プリセットディレクトリが存在するか確認
    if (!existsSync(presetPath) || !statSync(presetPath).isDirectory()) {
      return null;
    }

    return {
      name,
      path: presetPath,
    };
  }

  /**
   * プリセット名の有効性チェック
   *
   * 以下の条件を満たす必要があります:
   * - 空文字列でない
   * - 英数字、ハイフン、アンダースコアのみを含む
   * - ドット（.）で始まらない（隠しディレクトリを除外）
   *
   * @param name - プリセット名
   * @returns 有効な場合true
   */
  validatePresetName(name: string): boolean {
    if (name.length === 0) {
      return false;
    }

    // ドットで始まる名前は除外（隠しディレクトリ）
    if (name.startsWith(".")) {
      return false;
    }

    // 英数字、ハイフン、アンダースコアのみ許可
    const validNamePattern = /^[a-zA-Z0-9-_]+$/;
    return validNamePattern.test(name);
  }
}
