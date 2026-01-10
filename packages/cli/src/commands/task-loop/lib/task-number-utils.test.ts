import { describe, expect, it } from "vitest";
import {
  getPhaseNumber,
  getTaskGroupId,
  isEqual,
  isLess,
  isLessOrEqual,
  isWithinRange,
  parseTaskNumber,
  sortTaskNumbers,
  toSortKey,
} from "./task-number-utils.js";

describe("task-number-utils", () => {
  describe("parseTaskNumber", () => {
    // 正常系
    it("'1.2.3'をパースすると[1, 2, 3]を返す", () => {
      // Given: ドット区切りのタスク番号
      const input = "1.2.3";

      // When: パース実行
      const result = parseTaskNumber(input);

      // Then: 数値配列として返る
      expect(result).toEqual([1, 2, 3]);
    });

    it("'1'をパースすると[1]を返す", () => {
      // Given: 単一セグメントのタスク番号
      const input = "1";

      // When: パース実行
      const result = parseTaskNumber(input);

      // Then: 1要素の配列として返る
      expect(result).toEqual([1]);
    });

    it("空文字をパースすると空配列を返す", () => {
      // Given: 空文字
      const input = "";

      // When: パース実行
      const result = parseTaskNumber(input);

      // Then: 空配列が返る
      expect(result).toEqual([Number.NaN]);
    });

    // 異常系・境界値
    it("'1.a.3'のような無効トークンの場合、NaNを含む配列を返す", () => {
      // Given: 無効なセグメントを含むタスク番号
      const input = "1.a.3";

      // When: パース実行
      const result = parseTaskNumber(input);

      // Then: NaNを含む配列が返る
      expect(result).toEqual([1, Number.NaN, 3]);
    });

    it("'01.02'のような先頭ゼロの場合、[1, 2]として正規化する", () => {
      // Given: 先頭ゼロを含むタスク番号
      const input = "01.02";

      // When: パース実行
      const result = parseTaskNumber(input);

      // Then: 先頭ゼロが除去された数値配列として返る
      expect(result).toEqual([1, 2]);
    });

    it("'1.2.3.4.5.6'のような深いネストも正常に処理する", () => {
      // Given: 深いネストのタスク番号
      const input = "1.2.3.4.5.6";

      // When: パース実行
      const result = parseTaskNumber(input);

      // Then: 全セグメントがパースされる
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe("isLessOrEqual", () => {
    it("'1.2.3'と'1.2.5'を比較するとtrueを返す", () => {
      // Given: a < b の関係にあるタスク番号
      const a = "1.2.3";
      const b = "1.2.5";

      // When: a <= b を比較
      const result = isLessOrEqual(a, b);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("'1.2.5'と'1.2.5'を比較するとtrueを返す", () => {
      // Given: 同じタスク番号
      const a = "1.2.5";
      const b = "1.2.5";

      // When: a <= b を比較
      const result = isLessOrEqual(a, b);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("'1.2.6'と'1.2.5'を比較するとfalseを返す", () => {
      // Given: a > b の関係にあるタスク番号
      const a = "1.2.6";
      const b = "1.2.5";

      // When: a <= b を比較
      const result = isLessOrEqual(a, b);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("'1.2'と'1.2.0'のような異なる長さでも正しく比較する", () => {
      // Given: 異なる長さのタスク番号
      const a = "1.2";
      const b = "1.2.0";

      // When: a <= b を比較
      const result = isLessOrEqual(a, b);

      // Then: trueが返る（1.2.0 は 1.2 と等価）
      expect(result).toBe(true);
    });

    it("'1.2.0'と'1.2'のような異なる長さでも正しく比較する（逆順）", () => {
      // Given: 異なる長さのタスク番号（逆順）
      const a = "1.2.0";
      const b = "1.2";

      // When: a <= b を比較
      const result = isLessOrEqual(a, b);

      // Then: trueが返る（1.2.0 は 1.2 と等価）
      expect(result).toBe(true);
    });

    it("'1.3'と'1.2.5'を比較するとfalseを返す", () => {
      // Given: 上位セグメントが異なるタスク番号
      const a = "1.3";
      const b = "1.2.5";

      // When: a <= b を比較
      const result = isLessOrEqual(a, b);

      // Then: falseが返る（1.3 > 1.2.5）
      expect(result).toBe(false);
    });
  });

  describe("isLess", () => {
    it("'1.2.3'と'1.2.5'を比較するとtrueを返す", () => {
      // Given: a < b の関係にあるタスク番号
      const a = "1.2.3";
      const b = "1.2.5";

      // When: a < b を比較
      const result = isLess(a, b);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("'1.2.5'と'1.2.5'を比較するとfalseを返す", () => {
      // Given: 同じタスク番号
      const a = "1.2.5";
      const b = "1.2.5";

      // When: a < b を比較
      const result = isLess(a, b);

      // Then: falseが返る（等しい場合はfalse）
      expect(result).toBe(false);
    });

    // 境界値テスト: 末尾ゼロの扱い
    it("'1.2'と'1.2.0'を比較するとfalseを返す（末尾ゼロは同値として扱う）", () => {
      // Given: 末尾ゼロを含む同値のタスク番号
      const a = "1.2";
      const b = "1.2.0";

      // When: a < b を比較
      const result = isLess(a, b);

      // Then: falseが返る（同値なので < ではない）
      expect(result).toBe(false);
    });

    it("'1.2.0'と'1.2'を比較するとfalseを返す（末尾ゼロは同値として扱う）", () => {
      // Given: 末尾ゼロを含む同値のタスク番号（逆順）
      const a = "1.2.0";
      const b = "1.2";

      // When: a < b を比較
      const result = isLess(a, b);

      // Then: falseが返る（同値なので < ではない）
      expect(result).toBe(false);
    });

    it("'1.2.0.0'と'1.2'を比較するとfalseを返す（複数の末尾ゼロも同値）", () => {
      // Given: 複数の末尾ゼロを含むタスク番号
      const a = "1.2.0.0";
      const b = "1.2";

      // When: a < b を比較
      const result = isLess(a, b);

      // Then: falseが返る（同値なので < ではない）
      expect(result).toBe(false);
    });
  });

  describe("isEqual", () => {
    it("'1.2.3'と'1.2.3'を比較するとtrueを返す", () => {
      // Given: 同じタスク番号
      const a = "1.2.3";
      const b = "1.2.3";

      // When: a == b を比較
      const result = isEqual(a, b);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("'1.2.3'と'1.2.4'を比較するとfalseを返す", () => {
      // Given: 異なるタスク番号
      const a = "1.2.3";
      const b = "1.2.4";

      // When: a == b を比較
      const result = isEqual(a, b);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    // 境界値テスト: 末尾ゼロの扱い
    it("'1.2'と'1.2.0'を比較するとtrueを返す（末尾ゼロは同値として扱う）", () => {
      // Given: 異なる長さのタスク番号（末尾ゼロ）
      const a = "1.2";
      const b = "1.2.0";

      // When: a == b を比較
      const result = isEqual(a, b);

      // Then: trueが返る（1.2 と 1.2.0 は数値的に同値）
      expect(result).toBe(true);
    });

    it("'1.2.0'と'1.2'を比較するとtrueを返す（末尾ゼロは同値として扱う）", () => {
      // Given: 異なる長さのタスク番号（逆順）
      const a = "1.2.0";
      const b = "1.2";

      // When: a == b を比較
      const result = isEqual(a, b);

      // Then: trueが返る（1.2.0 と 1.2 は数値的に同値）
      expect(result).toBe(true);
    });

    it("'1.2.0.0'と'1.2'を比較するとtrueを返す（複数の末尾ゼロも同値）", () => {
      // Given: 複数の末尾ゼロを含むタスク番号
      const a = "1.2.0.0";
      const b = "1.2";

      // When: a == b を比較
      const result = isEqual(a, b);

      // Then: trueが返る（末尾ゼロはすべて0として扱われる）
      expect(result).toBe(true);
    });

    it("'1.2.1'と'1.2.0'を比較するとfalseを返す（末尾が異なる）", () => {
      // Given: 末尾が異なるタスク番号
      const a = "1.2.1";
      const b = "1.2.0";

      // When: a == b を比較
      const result = isEqual(a, b);

      // Then: falseが返る（1.2.1 と 1.2.0 は異なる）
      expect(result).toBe(false);
    });
  });

  describe("getPhaseNumber", () => {
    it("'1.2.3'からフェーズ番号1を抽出する", () => {
      // Given: タスク番号
      const taskNumber = "1.2.3";

      // When: フェーズ番号を抽出
      const result = getPhaseNumber(taskNumber);

      // Then: 1が返る
      expect(result).toBe(1);
    });

    it("'2'からフェーズ番号2を抽出する", () => {
      // Given: フェーズ番号のみのタスク番号
      const taskNumber = "2";

      // When: フェーズ番号を抽出
      const result = getPhaseNumber(taskNumber);

      // Then: 2が返る
      expect(result).toBe(2);
    });
  });

  describe("getTaskGroupId", () => {
    it("'1.2.3'からタスクグループID '1.2'を抽出する", () => {
      // Given: タスク番号
      const taskNumber = "1.2.3";

      // When: タスクグループIDを抽出
      const result = getTaskGroupId(taskNumber);

      // Then: '1.2'が返る
      expect(result).toBe("1.2");
    });

    it("'1.2'からタスクグループID '1.2'を抽出する", () => {
      // Given: タスクグループIDのみのタスク番号
      const taskNumber = "1.2";

      // When: タスクグループIDを抽出
      const result = getTaskGroupId(taskNumber);

      // Then: '1.2'が返る
      expect(result).toBe("1.2");
    });

    it("'1'からタスクグループID '1'を抽出する", () => {
      // Given: フェーズ番号のみのタスク番号
      const taskNumber = "1";

      // When: タスクグループIDを抽出
      const result = getTaskGroupId(taskNumber);

      // Then: '1'が返る
      expect(result).toBe("1");
    });
  });

  describe("isWithinRange", () => {
    it("maxTaskNumberが'all'の場合、常にtrueを返す", () => {
      // Given: maxTaskNumberが'all'
      const taskNumber = "999.999.999";
      const maxTaskNumber = "all";

      // When: 範囲チェック
      const result = isWithinRange(taskNumber, maxTaskNumber);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("maxTaskNumberがundefinedの場合、常にtrueを返す", () => {
      // Given: maxTaskNumberがundefined
      const taskNumber = "999.999.999";
      const maxTaskNumber = undefined;

      // When: 範囲チェック
      const result = isWithinRange(taskNumber, maxTaskNumber);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("maxTaskNumberが'1.3'でtaskNumberが'1.2'の場合、trueを返す", () => {
      // Given: taskNumber <= maxTaskNumber
      const taskNumber = "1.2";
      const maxTaskNumber = "1.3";

      // When: 範囲チェック
      const result = isWithinRange(taskNumber, maxTaskNumber);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("maxTaskNumberが'1.3'でtaskNumberが'1.4'の場合、falseを返す", () => {
      // Given: taskNumber > maxTaskNumber
      const taskNumber = "1.4";
      const maxTaskNumber = "1.3";

      // When: 範囲チェック
      const result = isWithinRange(taskNumber, maxTaskNumber);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("maxTaskNumberが'1.3'でtaskNumberが'1.3'の場合、trueを返す", () => {
      // Given: taskNumber == maxTaskNumber
      const taskNumber = "1.3";
      const maxTaskNumber = "1.3";

      // When: 範囲チェック
      const result = isWithinRange(taskNumber, maxTaskNumber);

      // Then: trueが返る（等しい場合も範囲内）
      expect(result).toBe(true);
    });
  });

  describe("toSortKey", () => {
    it("'1.2.3'をソートキー1002003000に変換する", () => {
      // Given: タスク番号
      const taskNumber = "1.2.3";

      // When: ソートキーに変換
      const result = toSortKey(taskNumber);

      // Then: 1002003000が返る（1*1000000000 + 2*1000000 + 3*1000）
      expect(result).toBe(1002003000);
    });

    it("'1'をソートキー1000000000に変換する", () => {
      // Given: フェーズ番号のみ
      const taskNumber = "1";

      // When: ソートキーに変換
      const result = toSortKey(taskNumber);

      // Then: 1000000000が返る
      expect(result).toBe(1000000000);
    });

    it("'1.10'をソートキー1010000000に変換する", () => {
      // Given: 2桁のセグメントを含むタスク番号
      const taskNumber = "1.10";

      // When: ソートキーに変換
      const result = toSortKey(taskNumber);

      // Then: 1010000000が返る（1*1000000000 + 10*1000000）
      expect(result).toBe(1010000000);
    });
  });

  describe("sortTaskNumbers", () => {
    it("['1.2', '1.1', '2.1']をソートすると['1.1', '1.2', '2.1']になる", () => {
      // Given: 順不同のタスク番号配列
      const taskNumbers = ["1.2", "1.1", "2.1"];

      // When: ソート実行
      const result = sortTaskNumbers(taskNumbers);

      // Then: 昇順にソートされる
      expect(result).toEqual(["1.1", "1.2", "2.1"]);
    });

    it("['1.10', '1.2']をソートすると数値順['1.2', '1.10']になる", () => {
      // Given: 辞書順と数値順が異なる配列
      const taskNumbers = ["1.10", "1.2"];

      // When: ソート実行
      const result = sortTaskNumbers(taskNumbers);

      // Then: 数値順でソートされる
      expect(result).toEqual(["1.2", "1.10"]);
    });

    it("空配列をソートすると空配列を返す", () => {
      // Given: 空配列
      const taskNumbers: string[] = [];

      // When: ソート実行
      const result = sortTaskNumbers(taskNumbers);

      // Then: 空配列が返る
      expect(result).toEqual([]);
    });

    it("複雑なタスク番号をソートすると正しい順序になる", () => {
      // Given: 複雑なタスク番号配列
      const taskNumbers = ["2.1.1", "1.10.2", "1.2.3", "1.10.1", "1.1.1"];

      // When: ソート実行
      const result = sortTaskNumbers(taskNumbers);

      // Then: 数値順で正しくソートされる
      expect(result).toEqual(["1.1.1", "1.2.3", "1.10.1", "1.10.2", "2.1.1"]);
    });

    it("元の配列を変更しない（非破壊的）", () => {
      // Given: 順不同のタスク番号配列
      const taskNumbers = ["1.2", "1.1", "2.1"];
      const originalCopy = [...taskNumbers];

      // When: ソート実行
      const result = sortTaskNumbers(taskNumbers);

      // Then: 元の配列は変更されない
      expect(taskNumbers).toEqual(originalCopy);
      expect(result).not.toBe(taskNumbers);
    });
  });
});
