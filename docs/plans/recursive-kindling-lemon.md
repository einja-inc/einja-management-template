# CLIテンプレートの旧Phase形式参照をStory形式に修正

## Context

QAテスト構造をタスクグループ単位（`phase{N}/{N}-{M}.md`）からユーザーストーリー単位（`story{N}.md`）に移行済み。エージェント定義・Skill・コマンドはStory形式に更新済みだが、CLIテンプレート1ファイルに旧Phase形式への参照が残っている。

完了済み実タスク（issue21, 22, 101）の旧形式QAテストは配布対象外（`.templateignore`で除外）のため放置。

---

## 修正対象

### `packages/cli/templates/qa-test.md.template` L83-84

```diff
- - ログファイル: `qa-tests/phaseX/evidence/X-Y-1-*.log`
- - スクリーンショット: `qa-tests/phaseX/evidence/X-Y-1-*.png`
+ - ログファイル: `qa-tests/evidence/story{N}/AC{N}-{M}-*.log`
+ - スクリーンショット: `qa-tests/evidence/story{N}/AC{N}-{M}-*.png`
```

---

## 検証

```bash
# 旧形式参照が残っていないことを確認
grep -r "phaseX\|phase{N}\|phase1/" packages/cli/templates/ --include="*.md*"
# → 出力なしなら完了
```

## コミット

```
docs: CLIテンプレートのQAテストパスをStory形式に修正
```
