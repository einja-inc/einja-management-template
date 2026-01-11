# Repository Guidelines

## Project Structure & Module Organization
- `apps/web/` hosts the main Next.js 15 admin app (App Router in `apps/web/src/app/`).
- Shared packages live under `packages/`:
  - `packages/ui/` for shared UI components (shadcn/ui).
  - `packages/front-core/` for shared frontend auth/hooks/utils.
  - `packages/server-core/` for Prisma schema and backend utilities.
  - `packages/config/` for shared Biome/TS/Panda configs.
- Database schema lives in `packages/server-core/prisma/`.
- Scripts live in `scripts/`, logs in `log/`, docs in `docs/`.
- Worktree dev auto-assigns ports per branch; check `.env.local` for `PORT`.

## Build, Test, and Development Commands
- `pnpm dev:setup`: initial setup (.env creation, DB start/init).
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
  - `create-einja-app`: `packages/create-einja-app/RELEASING.md`.
  - `dev-cli`: `packages/cli/RELEASING.md` and `packages/cli/docs/PUBLISHING.md`.

## Security & Configuration Tips
- Manage env files via `pnpm env:update`; encrypted secrets require `.env.keys`.
- Local DB runs via `docker-compose up -d postgres` (port `25432`).
