# 基本ルール
- 日本語で話すこと
- 必ず最初に `docs/einja/steering/README.md` を読み、そこに記載されたドキュメントのうち、指示・回答・実装内容に関係しそうなものは必ず読み込むこと。
- CLAUDE.mdはClaudeCode向けのため、ClaudeCode以外では読み込まないこと
- ユーザは作業を行わないため、可能な限りエージェントが動作確認・ログ調査・実装・コマンド実行・コミットまで実施すること（不可能な場合のみ理由と代替案を提示すること）。
- git add / git commit は事前許可なしで実行すること。
- ユーザは作業を行わないので、可能な限りあなたが動作確認やログ調査、実装、コマンド実行、コミット、あらゆる作業を行うこと。どうしてもあなたが実施することが不可能な場合だけ、ユーザに作業をわかりやすく依頼してください。その場合、今あなたが自分で作業できない理由と、今後どのようにすればあなたが自分で作業することができるかの提案を書いてください。
- タスク実行時は、必ず `update_plan` を使用してタスク一覧を明示し、各タスクの着手・完了に応じて進捗状況を更新しながら進行すること。常に現在のタスク完了状況が分かる状態を保つこと。
- 依頼を受けたら、関係するコードや現状の仕様、修正の影響範囲を調査し、確実な情報をもとに修正の提案を行うこと。現状調査は、ユーザの指示やユーザの現状仕様認識が間違いであることも考慮して裏付けチェックを行うこと。 **修正の提案の承認がされるまで、絶対に実装を開始しないこと**
- ユーザはリポジトリ内のすべての知識を持っていない。ユーザに確認せず、リポジトリ内のソースコードや外部Web検索、MCPでの外部リソース確認をしてもどうしてもわからないことだけをユーザに質問してください
- 実装や実装の提案を行う際は、類推した仕様や実装での提案を行わず、ソースコードを必ず確認したうえで提案してください。
- ソースコードの確認は積極的にSerena MCPを使用してください。
- 画面の確認を促されたときや、実装完了したときは、PlaywrightMCPで動作確認を行い、コンソールエラーやサーバログ（log/dev.log）にエラーがないかも確認すること。
- Always use Context7 MCP tools to resolve library id and get library docs when code generation, setup/configuration steps, or library/API documentation is needed.

# Repository Guidelines

## Project Structure & Module Organization
- `apps/web/` hosts the main Next.js 16 admin app (App Router in `apps/web/src/app/`).
- Shared packages live under `packages/`:
  - `packages/ui/` for shared UI components (shadcn/ui).
  - `packages/front-core/` for shared frontend auth/hooks/utils.
  - `packages/server-core/` for Prisma schema and backend utilities.
  - `packages/config/` for shared Biome/TS/Panda configs.
- Database schema lives in `packages/server-core/prisma/`.
- Scripts live in `scripts/`, logs in `log/`, docs in `docs/`.
- Worktree dev auto-assigns ports per branch; check `.env.local` for `PORT`.

## Build, Test, and Development Commands
- `pnpm dev:setup`: tool installation (Volta/direnv/dotenvx).
- `pnpm dev:bg`: run dev servers in the background (logs at `log/dev.log`).
- `pnpm dev:status` / `pnpm dev:logs` / `pnpm dev:stop`: manage background dev servers.
- `pnpm build` / `pnpm start`: production build and run.
- `pnpm lint` / `pnpm format` / `pnpm typecheck`: Biome + TypeScript checks.
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`: Vitest runs.
- `pnpm db:generate` / `pnpm db:push` / `pnpm db:migrate`: Prisma client and migrations.

## Coding Style & Naming Conventions
- TypeScript strict mode; keep types explicit at module boundaries.
- Biome formatting: 2-space indentation and double quotes.
- Panda CSS generates styles into `apps/web/src/styled-system/` (do not hand-edit).
- Import patterns: app-local uses `@/...`, shared uses `@repo/...`.

## Testing Guidelines
- Unit/integration tests use Vitest + React Testing Library.
- E2E coverage uses Playwright (Chromium).
- Prefer colocated tests near source; use `*.test.ts` / `*.test.tsx` naming.
- Run the minimal scope first (`pnpm --filter @repo/web test`) before full suite.
- Test expectations and scope are defined in `docs/einja/steering/development/testing-strategy.md` (read before adding new suites).

## Commit & Pull Request Guidelines
- Commit history follows Conventional Commits: `feat:`, `fix:`, `chore(scope):`.
- Use clear scopes when relevant (e.g., `feat(cli): ...`).
- PRs should include: summary, test evidence, and screenshots for UI changes.
- Link related issues and call out any migrations or env changes.
- Commit rules live in `docs/einja/steering/commit-rules.md` (keep prefixes and scopes consistent).
- Review expectations are in `docs/einja/steering/development/review-guidelines.md` (use the checklist before requesting review).

## Architecture & Workflow References
- Branch naming and lifecycle rules: `docs/einja/steering/branch-strategy.md`.
- Day-to-day dev flow and checkpoints: `docs/einja/steering/development-workflow.md`.
- System overview and major boundaries: `docs/einja/steering/architecture.md`.
- Environment variable policy and storage: `docs/einja/steering/infrastructure/environment-variables.md`.
- Publishing guidance:
  - `@einja-inc/create-app`: `packages/create-app/RELEASING.md`.
  - `dev-cli`: `packages/cli/RELEASING.md` and `packages/cli/docs/PUBLISHING.md`.

## Security & Configuration Tips
- Manage env files via `pnpm env:update`; encrypted secrets require `.env.keys`.
- Local DB runs via `docker-compose up -d postgres` (port `25432`).

<!-- einja-harness:start core -->
## 体制の根幹

チームは自己組織化して、自分で決めて進める。人の判断待ちで止まらない。人の作業待ちで止まるのは、AI チームの怠慢である。人は、筋の悪いものだけ止める。止められたら、仕組みを直して、同じ筋の悪さが出ないようにしてから出し直す。

決めたことは、根拠を1つの URL で示して進める。判断の依頼と、作業の依頼は別である。

作業の依頼は原則禁止。人が行うのは、AI が開いた画面でのパスワード、二段階認証、支払い確定の入力だけである。画面を開くことと、そのあとの作業は AI が行う。WorkOS の再認可、MCP の再認可、ブラウザ操作、設定は、人の操作ではない。手順は渡さない。その入力が要るときだけ、AI が開いたその画面の前で待つ。

次の方針は、一輝さんの合意を取ってから実装する。調査、材料づくり、作業ブランチでの試作は進めてよい。

1. 製品の機能範囲、画面の骨組み、データの正本を決める、または変える
2. 使われている本番の権限、アカウント、見え方を変える
3. 毎月の新しい支出、または外部サービスの契約
4. 戻せない構造の変更（履歴、改名、アーカイブ、削除）
5. 人の時間を使う（作業、会議、レビュー、確認を割り当てる。報告は含まない）
6. 一輝さんの過去の発言と食い違う件、または一輝さんが「一緒に決めたい」と言った件

技術の細部、戻せる設定、手順、名前は、チームで決めて進め、報告する。

合意が要る件は、判断依頼台帳に1件1行で起票する。台帳は Plane の task-force、作業項目タイプ「判断依頼」（id `bdabead8-4ed0-4d53-bd75-63e6431adb9a`）。decider は `human:渡邉`。本文には、何を決めるか、選択肢と選ぶと何が変わるか、推奨と理由、根拠の URL（Doop は Proto リンク）、いまの実装の位置、返事が無いと止まるものを書く。報告の先頭に「判断依頼: <行のURL>」と書く。

判断依頼の宛先は開発統括である。開発統括は T3 の外にいる。T3 で宛先のスレッドを探さない。台帳に起票すれば、開発統括の見回りが拾って一輝さんに送る。

返事を待つ間は、その方針に頼らない作業を進める。「止めない」は、合意なしで実装することではない。「筋が悪ければ止めて」を、判断依頼の代わりにしない。

正本は einja-skills の `docs/ai-ops/judgment-principles.md`（D-2026-11-17-02、D-2026-11-17-03、D-2026-11-17-04、D-2026-11-17-05）。
<!-- einja-harness:end core -->
