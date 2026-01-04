import { baseAuthOptions, mergeAuthOptions } from "@einja/front-core/auth";
import NextAuth from "next-auth";

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
