import { baseAuthOptions, mergeAuthOptions } from "@repo/front-core/auth";
import NextAuth from "next-auth";

if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  // Preview deployments use branch-specific URLs on Vercel.
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

/**
 * アプリ固有のNextAuth設定
 * baseAuthOptionsを拡張してアプリ固有の設定を追加
 */
const authOptions = mergeAuthOptions(baseAuthOptions, {
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return `${baseUrl}/dashboard`;
    },
  },
});

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);
