import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "./prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt", // Credentialsプロバイダー使用時はJWT戦略が必要
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const { email, password } = credentialsSchema.parse(credentials);

          // データベースからユーザーを検索
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              image: true,
            },
          });

          // ユーザーが存在しない場合
          if (!user || !user.password) {
            return null;
          }

          // パスワードを検証
          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            return null;
          }

          // ユーザー情報を返す（パスワードは除外）
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
    // TODO: Add OAuth providers when needed
    // Google({
    //   clientId: process.env.AUTH_GOOGLE_ID,
    //   clientSecret: process.env.AUTH_GOOGLE_SECRET,
    // }),
    // GitHub({
    //   clientId: process.env.AUTH_GITHUB_ID,
    //   clientSecret: process.env.AUTH_GITHUB_SECRET,
    // }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      // ログイン時にユーザー情報をJWTトークンに保存
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // JWTトークンからセッションにユーザー情報を設定
      if (token) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // サインイン後は常にダッシュボードにリダイレクト
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // デフォルトはダッシュボード
      return `${baseUrl}/dashboard`;
    },
  },
});
