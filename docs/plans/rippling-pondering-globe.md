# react-doctor 導入 + Skill参照元更新機能

## Context

2つの目的を達成する:

1. **react-doctor導入**: Reactコードベースのヘルス診断ツール [react-doctor](https://github.com/millionco/react-doctor) を導入し、フロントエンドレビューの品質を向上させる。oxlint + knipベースで60+ルールをチェックし、0〜100のヘルススコアを算出。状態/エフェクト、パフォーマンス、アニメーション、バンドルサイズ、セキュリティ、アクセシビリティ、Next.js固有、デッドコードをカバー。

2. **Skill参照元更新Skill**: 外部ツール・ライブラリに依存するSkillが、参照元の更新に追従できるよう、参照元メタデータと更新Skillを整備する。

**導入方針**: 独立Skill + task-reviewer統合 + 参照元更新Skill

## 変更内容

### 1. 独立Skill `einja-react-doctor` の作成

**新規ファイル**: `.claude/skills/einja-react-doctor/SKILL.md`

- 任意のタイミングで呼び出し可能なreact-doctorレビューSkill
- `npx -y react-doctor@latest` でインストール不要実行
- `--verbose` で詳細出力（ファイル名・行番号付き）
- `--diff main` オプションで変更ファイルのみスキャン可能
- 診断結果の解析・レポート出力
- 問題箇所の修正提案
- **参照元メタデータを記載**:
  ```yaml
  references:
    - url: https://github.com/millionco/react-doctor
      type: github-repo
      description: react-doctor - React codebase health scanner
  ```

### 2. task-reviewer への統合

**変更ファイル**: `.claude/agents/einja/task/task-reviewer.md`

- Step 0（品質判定ゲート）に react-doctor 実行を追加
- `npx -y react-doctor@latest . --verbose` を実行してスコア・診断結果を取得
- 結果を後続の並列レビューサブエージェントの `prompt` にテキストとして埋め込んで渡す
- **スキップ判定**: 変更ファイル一覧（`git diff --name-only`）に `.tsx`, `.jsx`, `.css` が含まれない場合はスキップ
- **失敗時フォールバック**: react-doctor実行がエラーの場合（ネットワーク障害、タイムアウト等）はスキップしてレビューを続行。エラーは警告として記録
- **モノレポ対応**: 変更ファイルが属するアプリディレクトリ（`apps/web/`, `apps/admin/` 等）を特定し、そのディレクトリを対象に実行
- **判定基準**: react-doctor単体でのMAJOR/MINOR判定は行わない。診断結果は他のレビュー観点の参考情報として活用

### 3. review-guidelines への追記

**変更ファイル**: `docs/einja/steering/development/review-guidelines.md`

- フロントエンド実装レビュー時のチェック項目に react-doctor の診断カテゴリを追加
- react-doctorが検出する主要パターン（useEffect内fetch、派生状態のeffect管理、ネストコンポーネント定義、バレルインポート等）をチェックリストに反映

### 4. Skill参照元更新Skill `einja-skill-ref-updater` の作成

**新規ファイル**: `.claude/skills/einja-skill-ref-updater/SKILL.md`

手動トリガーで、参照元が更新されたSkillの内容を最新化するSkill。

**動作フロー**:
1. 対象Skillを特定（指定がなければ `.claude/skills/einja-*/SKILL.md` を全スキャンし、`references:` を持つものを一覧化）
2. 各参照元URL（GitHub README等）をWebFetchで取得
3. 現在のSkill内容と参照元の最新情報を比較
4. 差分がある場合（新ルール追加、オプション変更、破壊的変更等）を検出
5. 更新提案をユーザーに提示（AskUserQuestion）
6. 承認後、Skill内容を更新

**トリガー例**: 「Skillを更新して」「参照元を最新化して」「react-doctorのSkillを最新化して」

**参照元メタデータ規約**:
- Skill本文中にMarkdownコメントで記載（frontmatterは未知フィールドの互換性が不明なため避ける）
  ```markdown
  <!-- @references
  - url: https://github.com/millionco/react-doctor
    type: github-repo
    description: react-doctor - React codebase health scanner
  -->
  ```
- `url`: 参照元のURL（GitHub repo, npm, ドキュメントページ等）
- `type`: `github-repo` | `npm-package` | `docs`
- `description`: 参照元の説明
- 初期は `einja-react-doctor` のみに付与。他Skillへの遡及適用は任意（必要に応じて追加）

## 実行方法の決定

- **`npx -y react-doctor@latest`** を使用（devDependency追加不要）
- 理由: 常に最新版を使用でき、package.jsonの変更が不要

## 変更対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `.claude/skills/einja-react-doctor/SKILL.md` | 新規作成 |
| `.claude/skills/einja-skill-ref-updater/SKILL.md` | 新規作成 |
| `.claude/agents/einja/task/task-reviewer.md` | 編集（Step 0にreact-doctor追加） |
| `docs/einja/steering/development/review-guidelines.md` | 編集（チェック項目追加） |

## 検証方法

1. `npx -y react-doctor@latest . --verbose` が正常に実行されることを確認
2. 両Skillが正しく認識されることを確認（skill一覧に表示される）
3. task-reviewer内でreact-doctorステップが正しく実行されることを確認
4. `einja-skill-ref-updater` が参照元メタデータを正しくスキャンできることを確認
5. `pnpm prepush` が通ることを確認
