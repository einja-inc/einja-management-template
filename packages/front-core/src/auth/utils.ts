import type { NextAuthConfig } from "next-auth";

/**
 * アプリ固有のNextAuth設定オーバーライド用の型
 * providersは通常上書きしないため除外
 */
type AuthConfigOverrides = Omit<Partial<NextAuthConfig>, "providers">;

/**
 * baseAuthOptionsとアプリ固有設定を安全にマージするユーティリティ
 * callbacksやpagesなどのネストしたオブジェクトも適切にマージします
 */
export function mergeAuthOptions(
	base: NextAuthConfig,
	overrides: AuthConfigOverrides,
): NextAuthConfig {
	return {
		...base,
		...overrides,
		callbacks: {
			...base.callbacks,
			...overrides.callbacks,
		},
		pages: {
			...base.pages,
			...overrides.pages,
		},
	};
}
