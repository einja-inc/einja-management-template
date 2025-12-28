import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Playground - Sample App",
	description: "開発基盤学習用サンプルアプリケーション",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ja">
			<body>{children}</body>
		</html>
	);
}
