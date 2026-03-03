# TODO: fix-sync-template-variables

## Phase 1: 致命的問題の修正

- [x] 1-A: project-detector作成 + replacePlaceholders共用化 + sync/merger統合
- [x] 1-B: placeholder-validator作成
- [x] 1-C: env保護強化 + Prisma/lockfile除外パターン追加
- [x] 1-D: sync.tsにplaceholder-validator統合（1-A, 1-B完了後）

## Phase 2: 重大問題の修正

- [ ] 2-1: package.json scripts の安全なマージ
- [ ] 2-2: dry-run の改善
- [ ] 2-3: バックアップの完全性

## Phase 3: テスト

- [ ] 3-1: project-detector テスト
- [ ] 3-2: placeholder-validator テスト
- [ ] 3-3: merger templateVariables テスト
- [ ] 3-4: sync E2E テスト
