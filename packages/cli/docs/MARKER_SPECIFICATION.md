# マーカー仕様書

このドキュメントでは、`einja sync`コマンドで使用されるマーカーの仕様を説明します。

## 概要

`docs/einja/`配下のドキュメントには、同期時の動作を制御する2種類のマーカーがあります。

| マーカー | 用途 | sync時の動作 |
|---------|------|-------------|
| `@einja:managed` | 共通ルール（常に最新を維持） | 常に上書き |
| `@einja:project-private` | プロジェクト固有テンプレート | 初回のみ追加、以降は保持 |

## マーカー形式

### @einja:managed（常に上書き）

共通ルールとして管理するセクションを囲みます。`einja sync`実行時に常にテンプレート版で上書きされます。

**Markdown形式:**
```markdown
<!-- @einja:managed:start -->
## 共通ルール

この内容はsync時に常に最新版で上書きされる
<!-- @einja:managed:end -->
```

**YAML形式:**
```yaml
# @einja:managed:start
shared_config:
  key: value
# @einja:managed:end
```

**ID属性（オプション）:**
複数のmanagedセクションがある場合、IDでマッチングして正確に置換できます。
```markdown
<!-- @einja:managed:start id="section-a" -->
セクションA
<!-- @einja:managed:end -->
```

### @einja:project-private（初回のみ追加）

プロジェクト固有の設定を追記する場所として使用します。初回sync時のみ追加され、以降の編集内容は保持されます。

**ID属性は必須です。** 見出しは変更されやすいため、IDで安定した識別を行います。

```markdown
<!-- @einja:project-private:start id="commit-rules-project" -->
## プロジェクト固有のコミットルール

<!-- このセクションはプロジェクト固有のルールを追記する場所です -->
<!-- 例: 特定のプレフィックス追加、承認フロー、例外事項など -->
<!-- @einja:project-private:end -->
```

## 配置ルール

### 基本ルール

- **ネスト禁止**: managed内にseed、seed内にmanagedは配置不可
- **同レベルのみ**: マーカーはファイル内の同じ階層に配置

### 推奨パターン

```markdown
<!-- @einja:managed:start -->
# ファイルタイトル

## セクション1
...

## セクション2
...
<!-- @einja:managed:end -->

---

<!-- @einja:project-private:start id="xxx-project" -->
## プロジェクト固有の設定

<!-- ここにプロジェクト固有の内容を追記 -->
<!-- @einja:project-private:end -->
```

### 禁止パターン（ネスト）

以下はバリデーションエラーになります：

```markdown
<!-- @einja:managed:start -->
## セクション1

<!-- @einja:project-private:start id="xxx" -->  <!-- ❌ エラー: ネスト禁止 -->
...
<!-- @einja:project-private:end -->

<!-- @einja:managed:end -->
```

## sync時の動作フロー

### 1. バリデーション

sync実行前にマーカーのバリデーションを行います：

| チェック項目 | 説明 |
|------------|------|
| 構文チェック | マーカーの形式が正しいか |
| ペア一致 | start/endが揃っているか |
| ネスト禁止 | managed内にseed等がないか |
| seedにID必須 | seedマーカーにID属性があるか |
| ID重複禁止 | 同一ファイル内でIDが重複していないか |

### 2. managedセクションの同期

1. テンプレートのmanagedセクションを抽出
2. ローカルのmanagedセクションをテンプレート版で上書き
3. ローカルの非managedセクションは保持

### 3. seedセクションの同期

1. テンプレートからseedセクションを列挙
2. 各IDについて：
   - ローカルにseed（ID）がない → 追加
   - ローカルにseed（ID）がある → 保持（上書きしない）

### 4. マーカーなしファイルの扱い

マーカーがないファイルは**全体seed扱い**（初回のみ追加）：

| 状態 | 動作 |
|------|------|
| ファイルが存在しない | 追加 |
| ファイルが存在する | 何もしない（利用者管理） |

## バリデーションエラー

### エラー種別

| エラータイプ | 説明 |
|-------------|------|
| `unpaired_start` | 対応するendが見つからない |
| `unpaired_end` | 対応するstartが見つからない |
| `nested` | マーカーがネストされている |
| `seed_without_id` | seedマーカーにIDがない |
| `duplicate_id` | 同一ファイル内でIDが重複 |

### エラー例

```
❌ マーカーバリデーションエラーが見つかりました:

📄 docs/einja/steering/commit-rules.md
   L15: @einja:project-privateマーカーにはid属性が必須です (seed_without_id)

📄 docs/einja/steering/architecture.md
   L8: @einja:managedマーカー内に@einja:project-privateマーカーをネストすることは許可されていません (nested)

合計 2 件のエラーが見つかりました
マーカーを修正してから再度ビルドしてください
```

## ビルド時バリデーション

`pnpm build`実行時に`docs/einja/`配下のマーカーが自動検証されます。エラーがある場合はビルドが中断されます。

対象ディレクトリ：
- `docs/einja/steering/`
- `docs/einja/example/`
- `docs/einja/instructions/`
- `docs/einja/templates/`

## 新しいseedセクションの追加

テンプレート側で新しいseedセクションを追加する場合：

1. 新しいユニークなIDを付けたseedマーカーを追加
2. 利用者が`einja sync`を実行
3. 利用者のファイルに新しいseedセクションが追加される
4. 既存のseedセクションは保持される

```markdown
<!-- 既存 -->
<!-- @einja:project-private:start id="commit-rules-project" -->
## プロジェクト固有のコミットルール
（ユーザーの編集内容）
<!-- @einja:project-private:end -->

<!-- 新規追加 -->
<!-- @einja:project-private:start id="commit-rules-approval-flow" -->
## 承認フローのカスタマイズ
（新しいテンプレート内容）
<!-- @einja:project-private:end -->
```

## 関連ファイル

- `packages/cli/src/lib/sync/marker-processor.ts` - マーカーパース・バリデーション
- `packages/cli/src/lib/sync/seed-synchronizer.ts` - seed同期ロジック
- `packages/cli/scripts/validate-markers.mjs` - ビルド時バリデーションスクリプト
