import { prisma } from "@repo/server-core";
import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション
    const { name, email, password } = signupSchema.parse(body);

    // 既存ユーザーのチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に使用されています" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12);

    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "アカウントが正常に作成されました",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "アカウント作成中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
