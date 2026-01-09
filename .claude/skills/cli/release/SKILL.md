---
name: cli-release
description: "@einja/cli パッケージをビルド・テストし、NPMに公開するSkill"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
  - TodoWrite
  - TodoRead
---

# cli-release Skill: @einja/cli パッケージ公開エンジン

## 役割

`@einja/cli` パッケージをビルド・テストし、NPMに公開します。

## 参照ドキュメント

- `packages/cli/RELEASING.md` - 詳細なリリース手順、トラブルシューティング、NPM_TOKEN設定方法

## 実行手順

### 1. 前提条件の確認

```bash
git branch --show-current    # mainブランチであること
git status --porcelain       # 未コミット変更がないこと
```

失敗時は修正方法を案内して終了。

### 2. バージョン種別の決定

現在のバージョンと最近の変更を表示後、**AskUserQuestion**で確認:

- patch（推奨）: バグ修正・軽微な改善
- minor: 後方互換性のある機能追加
- major: 破壊的変更

### 3. ビルド・テスト

```bash
cd packages/cli && pnpm build && pnpm test && pnpm typecheck
```

### 4. バージョン更新・プッシュ

```bash
cd packages/cli
npm version {patch|minor|major}
git push origin main
git push origin cli-v{version}
```

### 5. 完了報告

GitHub Actions URL と確認コマンドを出力。

---

**最終更新**: 2025-01-10
