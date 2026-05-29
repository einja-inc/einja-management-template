import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { userRepository } from "@repo/server-core/infrastructure/database/repositories/UserRepository";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * NextAuth共通設定
 * アプリ側でmergeAuthOptionsを使用して上書き可能
 */
export const baseAuthOptions: NextAuthConfig = {
  session: {
    strategy: "jwt",
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

          const findResult = await userRepository.findByEmailForAuth(email);
          if (!findResult.isSuccess) {
            console.error("Authentication error:", findResult.error);
            return null;
          }

          const record = findResult.value;
          if (!record || !record.password) {
            return null;
          }

          const { user, password: hashedPassword, image } = record;

          const isPasswordValid = await bcrypt.compare(password, hashedPassword);
          if (!isPasswordValid) {
            return null;
          }

          // lastLoginを更新
          const updateResult = await userRepository.updateLastLogin(user.id, new Date());
          if (!updateResult.isSuccess) {
            console.error("Failed to update lastLogin:", updateResult.error);
            // 認証自体は成功しているのでログインは続行する
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
