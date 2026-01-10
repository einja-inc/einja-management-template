import type {
  MarkerError,
  MarkerErrorType,
  MarkerSection,
  MarkerValidationResult,
} from "../../types/sync.js";

/**
 * @einja:managedおよび@einja:seedマーカーの処理を行うクラス
 * マーカーをパースしてセクションを分離し、検証・置換処理を提供します。
 */
export class MarkerProcessor {
  /**
   * Markdownファイル用のmanagedマーカーパターン（ID属性オプショナル）
   */
  private static readonly MARKDOWN_MANAGED_START_PATTERN =
    /^<!--\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*-->$/;
  private static readonly MARKDOWN_MANAGED_END_PATTERN = /^<!--\s*@einja:managed:end\s*-->$/;

  /**
   * Markdownファイル用のseedマーカーパターン（ID属性はオプショナルだが、検証で必須チェック）
   */
  private static readonly MARKDOWN_SEED_START_PATTERN =
    /^<!--\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*-->$/;
  private static readonly MARKDOWN_SEED_END_PATTERN = /^<!--\s*@einja:seed:end\s*-->$/;

  /**
   * YAML/JSONファイル用のmanagedマーカーパターン（ID属性オプショナル）
   */
  private static readonly YAML_MANAGED_START_PATTERN =
    /^\s*#\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*$/;
  private static readonly YAML_MANAGED_END_PATTERN = /^\s*#\s*@einja:managed:end\s*$/;

  /**
   * YAML/JSONファイル用のseedマーカーパターン（ID属性はオプショナルだが、検証で必須チェック）
   */
  private static readonly YAML_SEED_START_PATTERN = /^\s*#\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*$/;
  private static readonly YAML_SEED_END_PATTERN = /^\s*#\s*@einja:seed:end\s*$/;

  /**
   * ファイル内容をパースしてマーカーセクションに分離する
   *
   * @param content - ファイル内容
   * @returns セクション配列（managed/seed/unmanagedが配置される）
   */
  parseMarkers(content: string): MarkerSection[] {
    const lines = content.split("\n");
    const sections: MarkerSection[] = [];
    let currentType: "managed" | "seed" | "unmanaged" = "unmanaged";
    let currentStartLine = 1;
    let currentContent: string[] = [];
    let currentId: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // マーカー開始を検出
      const startMarker = this.parseStartMarker(line);
      if (startMarker) {
        if (currentType !== "unmanaged") {
          // 入れ子のマーカーは無視（検証フェーズでエラーになる）
          currentContent.push(line);
          continue;
        }

        // 現在のunmanagedセクションを保存
        if (currentContent.length > 0 || sections.length === 0) {
          sections.push({
            type: "unmanaged",
            startLine: currentStartLine,
            endLine: lineNumber - 1,
            content: currentContent.join("\n"),
          });
        }

        // managed/seedセクション開始
        currentType = startMarker.type;
        currentId = startMarker.id;
        currentStartLine = lineNumber;
        currentContent = [line];
      }
      // マーカー終了を検出
      else if (this.parseEndMarker(line)) {
        if (currentType === "unmanaged") {
          // 対応するstartがない場合は無視（検証フェーズでエラーになる）
          currentContent.push(line);
          continue;
        }

        // マーカー終了行を追加
        currentContent.push(line);

        // managed/seedセクションを保存
        sections.push({
          type: currentType,
          startLine: currentStartLine,
          endLine: lineNumber,
          content: currentContent.join("\n"),
          id: currentId,
        });

        // unmanagedセクション開始
        currentType = "unmanaged";
        currentId = undefined;
        currentStartLine = lineNumber + 1;
        currentContent = [];
      }
      // 通常行
      else {
        currentContent.push(line);
      }
    }

    // 最後のセクションを保存
    if (currentContent.length > 0 || sections.length === 0) {
      sections.push({
        type: currentType,
        startLine: currentStartLine,
        endLine: lines.length,
        content: currentContent.join("\n"),
        id: currentId,
      });
    }

    return sections;
  }

  /**
   * マーカーペアの検証を行う
   *
   * @param content - ファイル内容
   * @returns 検証結果
   */
  validateMarkers(content: string): MarkerValidationResult {
    const lines = content.split("\n");
    const errors: MarkerError[] = [];
    const startMarkers: Array<{ line: number; type: "managed" | "seed"; id?: string }> = [];
    const seenIds = new Set<string>();
    let currentMarkerType: "managed" | "seed" | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      const startMarker = this.parseStartMarker(line);
      if (startMarker) {
        if (currentMarkerType !== null) {
          // 入れ子のマーカー - エラーを記録するがstackには追加しない
          errors.push({
            line: lineNumber,
            message: `@einja:${currentMarkerType}マーカー内に@einja:${startMarker.type}マーカーをネストすることは許可されていません`,
            type: "nested",
          });
          // ネストマーカーを無視して処理を続行
          continue;
        }

        // seedマーカーにID必須チェック
        if (startMarker.type === "seed" && !startMarker.id) {
          errors.push({
            line: lineNumber,
            message: "@einja:seedマーカーにはid属性が必須です",
            type: "seed_without_id",
          });
        }

        // ID重複チェック
        if (startMarker.id) {
          if (seenIds.has(startMarker.id)) {
            errors.push({
              line: lineNumber,
              message: `ID "${startMarker.id}" が重複しています`,
              type: "duplicate_id",
            });
          } else {
            seenIds.add(startMarker.id);
          }
        }

        startMarkers.push({ line: lineNumber, type: startMarker.type, id: startMarker.id });
        currentMarkerType = startMarker.type;
      } else {
        const endMarkerType = this.parseEndMarker(line);
        if (endMarkerType) {
          if (currentMarkerType === null || startMarkers.length === 0) {
            // 対応するstartがない
            errors.push({
              line: lineNumber,
              message: `対応する@einja:${endMarkerType}:startが見つかりません`,
              type: "unpaired_end",
            });
          } else {
            const lastStart = startMarkers[startMarkers.length - 1];
            if (lastStart.type !== endMarkerType) {
              // 型が一致しない
              errors.push({
                line: lineNumber,
                message: `@einja:${lastStart.type}:startに対して@einja:${endMarkerType}:endが使用されています`,
                type: "unpaired_end",
              });
            }
            startMarkers.pop();
            currentMarkerType = null;
          }
        }
      }
    }

    // 未閉じのstartマーカー
    for (const marker of startMarkers) {
      errors.push({
        line: marker.line,
        message: `対応する@einja:${marker.type}:endが見つかりません`,
        type: "unpaired_start",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * マーカー内セクションをテンプレート版で置換する
   *
   * @param localSections - ローカル版のセクション配列
   * @param templateContent - テンプレート版の内容
   * @returns 置換後の内容
   */
  replaceManaged(localSections: MarkerSection[], templateContent: string): string {
    const templateSections = this.parseMarkers(templateContent);
    const result: string[] = [];

    // セクション数が一致しない場合、ローカル版のセクションを優先
    // （テンプレート側でマーカーが削除された可能性があるため）
    const maxSections = Math.max(localSections.length, templateSections.length);

    for (let i = 0; i < maxSections; i++) {
      const localSection = localSections[i];
      const templateSection = templateSections[i];

      if (!localSection) {
        // テンプレート側にのみ存在するセクションを追加
        if (templateSection) {
          result.push(templateSection.content);
        }
        continue;
      }

      if (localSection.type === "managed") {
        // managedセクションはテンプレート版で置換
        if (templateSection && templateSection.type === "managed") {
          result.push(templateSection.content);
        } else {
          // テンプレート側にmanagedセクションがない場合はローカルを保持
          result.push(localSection.content);
        }
      } else {
        // unmanagedセクションはローカル版を保持
        result.push(localSection.content);
      }
    }

    return result.join("\n");
  }

  /**
   * 行がマーカー開始かどうかを判定し、種別とIDを返す
   *
   * @param line - 行内容
   * @returns マーカー情報（種別、ID）またはnull
   */
  private parseStartMarker(
    line: string
  ): { type: "managed" | "seed"; id?: string } | null {
    // Markdown managed
    let match = line.match(MarkerProcessor.MARKDOWN_MANAGED_START_PATTERN);
    if (match) {
      return { type: "managed", id: match[1] };
    }

    // Markdown seed
    match = line.match(MarkerProcessor.MARKDOWN_SEED_START_PATTERN);
    if (match) {
      return { type: "seed", id: match[1] };
    }

    // YAML managed
    match = line.match(MarkerProcessor.YAML_MANAGED_START_PATTERN);
    if (match) {
      return { type: "managed", id: match[1] };
    }

    // YAML seed
    match = line.match(MarkerProcessor.YAML_SEED_START_PATTERN);
    if (match) {
      return { type: "seed", id: match[1] };
    }

    return null;
  }

  /**
   * 行がマーカー終了かどうかを判定し、種別を返す
   *
   * @param line - 行内容
   * @returns マーカー種別またはnull
   */
  private parseEndMarker(line: string): "managed" | "seed" | null {
    // Markdown managed
    if (MarkerProcessor.MARKDOWN_MANAGED_END_PATTERN.test(line)) {
      return "managed";
    }

    // Markdown seed
    if (MarkerProcessor.MARKDOWN_SEED_END_PATTERN.test(line)) {
      return "seed";
    }

    // YAML managed
    if (MarkerProcessor.YAML_MANAGED_END_PATTERN.test(line)) {
      return "managed";
    }

    // YAML seed
    if (MarkerProcessor.YAML_SEED_END_PATTERN.test(line)) {
      return "seed";
    }

    return null;
  }

  /**
   * 行がマーカー開始かどうかを判定する（後方互換性のため残す）
   *
   * @param line - 行内容
   * @returns マーカー開始の場合true
   */
  private isStartMarker(line: string): boolean {
    return this.parseStartMarker(line) !== null;
  }

  /**
   * 行がマーカー終了かどうかを判定する（後方互換性のため残す）
   *
   * @param line - 行内容
   * @returns マーカー終了の場合true
   */
  private isEndMarker(line: string): boolean {
    return this.parseEndMarker(line) !== null;
  }
}
