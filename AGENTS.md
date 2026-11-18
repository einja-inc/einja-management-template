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
