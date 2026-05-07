<!-- @einja:managed:start -->
# Pencilデザイン管理規約

> **[Deprecated]** このドキュメントはPencil MCP（.penファイル）利用プロジェクト向けです。
> 新規Issueでは Figma MCP を使用します。→ `figma-design-management.md` を参照してください。

## 概要

Pencil.dev（.penファイル）を使用したUIデザインの管理規約を定義します。design-master.penをSingle Source of Truthとして、Issue仕様書フェーズのui-design.penと実装確定後のdesign-master.penの2層構造でデザインを管理します。

## ファイル構造

### design-master.pen（アプリ/パッケージごと）

最新デザインのSingle Source of Truth。実装確定済み画面 + 共通コンポーネントを格納します。

- **デフォルトパス**: `docs/design/{app}/design-master.pen`
- **例**: `docs/design/web/design-master.pen`（apps/web用）、`docs/design/admin/design-master.pen`（apps/admin用）
- 必要なアプリ/パッケージのみ作成（全部必須ではない）
- プロジェクト固有のパス設定は `@einja:project-private` セクションで管理

### ui-design.pen（Issue仕様書フェーズ）

- **パス**: `docs/specs/issues/{issue名}/ui-design.pen`
- Issue仕様書フェーズのUIモックアップ
- 既存のコロケーション配置を維持
- 実装確定後にdesign-master.penへマージ

## フレーム命名規則

URLパスベース + BEM風拡張の命名規則を採用します。

### 基本ルール

| カテゴリ | パターン | 例 |
|---------|---------|-----|
| ページ（基本） | `{path}` | `dashboard`, `settings-profile` |
| サブコンポーネント | `{path}__[element]` | `dashboard__submit-modal`, `settings__sidebar` |
| 状態バリアント | `{path}--[state]` | `dashboard--empty-state`, `login--error` |
| デバイスバリアント | `{path}__[device]` | `dashboard__tablet`, `settings--mobile` |

### 命名規則の詳細

- URLパスをkebab-caseに変換: `/settings/profile` → `settings-profile`
- ネストされたパスはハイフンで結合: `/users/[id]/edit` → `users-edit`
- 共通コンポーネント: `_components/[name]`（アンダースコアプレフィックス）

## キャンバスレイアウト規約

design-master.pen内のキャンバス配置ルール:

| ゾーン | 位置 | 内容 |
|-------|------|------|
| Componentsゾーン | 左側 | 共通UIコンポーネント（ボタン、フォーム要素、カード等） |
| Pagesゾーン | 右側 | 画面単位のデザイン |

- ゾーン間のpadding: 200px以上
- フレーム間のpadding: 100px
- 同一機能の画面はグループ化して配置

## Git運用ルール

### デザイン変更前
- `.pen`ファイルの変更前に必ず現在の変更をcommitする
- 大きなデザイン変更はfeatureブランチで作業

### PRでのdiff確認
- `.pen`ファイルはバイナリではなくテキストベースのため、git diffで変更を確認可能
- PRレビュー時はPencil.devで実際のデザインを確認

## 規模ガイドライン

| 画面数 | 推奨構成 |
|--------|---------|
| 〜20画面 | 単一の `design-master.pen` |
| 20-30画面 | ファイル分割を検討（`pages.pen` + `components.pen`） |
| 30画面以上 | 機能グループ別に分割（`auth.pen`, `dashboard.pen` 等） |

## マージフロー

実装確定後、ui-design.penのフレームをdesign-master.penに統合するフロー:

### フロー概要

```
ui-design.pen（Issue仕様書）
    ↓ 実装確定
    ↓ einja-pencil-design-manager merge-to-master {app}
design-master.pen（アプリごとのSingle Source of Truth）
```

### マージ手順

1. 対象アプリを指定してマージSkillを実行
   - 例: `merge-to-master web` → `docs/design/web/design-master.pen` に統合
2. フレーム命名規則に従ってフレーム名を正規化
3. 既存フレームとの重複チェック（同名フレームは上書き確認）
4. キャンバスレイアウト規約に従って配置

### 共通コンポーネントの同期

- `sync-components {app}`: design-master.penの共通コンポーネントをui-design.penに反映
- 破壊的操作のため、上書き対象の一覧を表示しユーザー確認を必須とする

## 関連ツール

| Skill/エージェント | 用途 |
|------------------|------|
| `einja-pencil-design-manager` | design-master.penの初期化・マージ・コンポーネント同期・フレームチェック |
| `ui-design-generator` | Issue仕様書フェーズのui-design.pen生成 |
| `design-engineer` | .penファイルからのデザイントークン抽出・実装 |

<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="pencil-design-management-project" -->
## デザインマスター配置（プロジェクト固有）

<!-- 以下はデフォルト値です。プロジェクトのアプリ構成に合わせて書き換えてください。 -->
<!-- 例: apps/web → web, apps/admin → admin のように、アプリ名とパスを対応づけます。 -->

| アプリ/パッケージ | design-master.penパス |
|-----------------|---------------------|
| web | docs/design/web/design-master.pen |
| admin | docs/design/admin/design-master.pen |
<!-- @einja:project-private:end -->
