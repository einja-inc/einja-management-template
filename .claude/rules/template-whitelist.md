---
paths:
  - "*"
  - "*/."
---

ルート直下にファイルやディレクトリを新規追加する場合、以下のホワイトリストの更新が必要か確認すること:

1. **create-app テンプレート**: `packages/create-app/scripts/template-update.ts` の `dirMappings` または `fileMappings`
2. **dev-cli プリセット**: `packages/cli/scripts/copy-presets.mjs` の `mappings` または `fileMappings`

配布対象に含める場合 → ホワイトリストに追加
配布対象に含めない場合 → `knownIgnoreList` に追加（未登録警告を抑制するため）
