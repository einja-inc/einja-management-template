# TODO: Codexレビュー指摘修正

## Batch 1（並行）

- [x] FIX-1: `scripts/lib/defaults.ts` 堅牢化 (H6,H7,H8,M1,M2,M4,L1,L3)
- [x] FIX-2: `scripts/lib/env-common.ts` 共通化 (L2)

## Batch 2（Batch 1完了後に並行）

- [x] FIX-3: `scripts/env.ts` 安全性修正 (H1,H2,H3,M8,M9,L2)
- [x] FIX-4: `scripts/setup-dev.ts` 安全性修正 (H2,H3,M8,M9,L4,L2)
- [x] FIX-5: `scripts/init-github.ts` 修正 (H4,H5,M5,M6,M7)

## 検証

- [x] `pnpm prepush` パス（lint + typecheck + test 622テスト全パス）
- [x] `git diff --stat` で対象5ファイル変更確認
