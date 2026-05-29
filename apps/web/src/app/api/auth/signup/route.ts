import { isFailure } from "@repo/server-core/core/result";
import { userRepository } from "@repo/server-core/infrastructure/database/repositories/UserRepository";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

/**
 * Postgres の unique 制約違反 (SQLSTATE 23505) かどうかを判定する。
 *
 * findByEmail と create の間には TOCTOU（time-of-check to time-of-use）が
 * 存在するため、競合時は DB の unique 制約で防ぎ、ここで判定する。
 * drizzle-orm から throw されるエラーは pg ドライバ由来で `code` プロパティを持つ。
 */
function isUniqueViolationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション
    const { name, email, password } = signupSchema.parse(body);

    // 既存ユーザーのチェック
    const findResult = await userRepository.findByEmail(email);
    if (isFailure(findResult)) {
      console.error("Signup findByEmail error:", findResult.error);
      return NextResponse.json(
        { error: "アカウント作成中にエラーが発生しました" },
        { status: 500 }
      );
    }
    if (findResult.value !== null) {
      return NextResponse.json(
        { error: "このメールアドレスは既に使用されています" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12);

    // ユーザーを作成（id はアプリ層で生成。schema は default 生成を持たない）
    const createResult = await userRepository.create({
      id: randomUUID(),
      email,
      name,
      password: hashedPassword,
    });
    if (isFailure(createResult)) {
      // TOCTOU により findByEmail 通過後に別リクエストが先に作成した場合、
      // DB の unique 制約により 23505 が発生する。その場合は 400 を返す。
      if (isUniqueViolationError(createResult.error)) {
        return NextResponse.json(
          { error: "このメールアドレスは既に使用されています" },
          { status: 400 }
        );
      }
      console.error("Signup create error:", createResult.error);
      return NextResponse.json(
        { error: "アカウント作成中にエラーが発生しました" },
        { status: 500 }
      );
    }

    const created = createResult.value;
    return NextResponse.json(
      {
        message: "アカウントが正常に作成されました",
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          createdAt: created.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);

    if (error instanceof z.ZodError) {
      const message = error.errors[0]?.message ?? "入力エラーが発生しました";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "アカウント作成中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
