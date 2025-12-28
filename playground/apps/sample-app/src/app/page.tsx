export default function Home() {
	return (
		<main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
			<h1>🎮 Playground: Sample App</h1>
			<p>開発基盤学習用のサンプルアプリケーションです。</p>

			<h2>機能</h2>
			<ul>
				<li>Next.js 15 + React 19</li>
				<li>Turbopack統合</li>
				<li>Prisma連携（sample-db）</li>
				<li>Vitest テスト環境</li>
			</ul>

			<h2>次のステップ</h2>
			<p>
				<code>playground/00-quick-start/README.md</code> を参照して、
				Quick Startを実行してください。
			</p>
		</main>
	);
}
