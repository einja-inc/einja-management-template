# TODO: ドメインベースRPC分割の導入

## Step 1-3: コード変更
- [x] 新規: `apps/web/src/app/api/rpc/users/[[...route]]/route.ts`
- [x] 新規: `apps/web/src/lib/api/rpc.ts`
- [x] 修正: `apps/web/src/hooks/api/use-users.ts`
- [x] 削除: `apps/web/src/app/api/rpc/[[...route]]/route.ts`
- [x] 削除: `apps/web/src/lib/api/client.ts`
- [x] 確認: `apps/web/src/hooks/api/prefetch-users.ts` (URL変更なし)

## Step 4: 検証
- [x] `pnpm prepush` 通過確認（lint + typecheck + test: 7 tasks成功）
- [x] 型エラー修正: basePath追加 + rpc.tsのclient構造調整

## Step 5: ドキュメント更新
- [x] 5-1: `docs/einja/steering/development/api-development.md`
- [x] 5-2: `docs/einja/steering/development/frontend-development.md`
- [x] 5-3: `docs/einja/steering/development/backend-architecture.md`
- [x] 5-4: `docs/einja/steering/development/review-guidelines.md`
- [x] 5-5: `docs/einja/steering/development/testing-strategy.md`
- [x] 5-6: `docs/einja/steering/architecture.md`
- [x] 5-7: `.claude/skills/einja-coding-standards/references/testing-strategy.md`
- [x] 5-8: `.claude/agents/einja/backend-architect.md`
