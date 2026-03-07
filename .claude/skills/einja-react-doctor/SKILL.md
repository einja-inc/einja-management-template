---
name: einja-react-doctor
description: >
  Reactコードベースのヘルス診断を実行するSkill。react-doctorを使用してコード品質スコア・問題検出を行い、改善提案を提示します
user_invocable: true
---

<!-- @references
- url: https://github.com/nicholasgriffintn/react-doctor
  type: github-repo
  description: react-doctor - React codebase health scanner (oxlint + knip based, 60+ rules)
-->

# React Doctor - Reactコードベースヘルス診断

## 概要

react-doctorは、oxlintとknipをベースにしたReactコードベースのヘルススキャナーです。60以上のルールでコードを分析し、0〜100のヘルススコアを算出します。問題箇所はファイル名・行番号付きで報告されるため、具体的な修正アクションにつなげやすいのが特徴です。

## カバー範囲

| カテゴリ | 内容 |
|---------|------|
| 状態/エフェクト | useState/useEffectの誤用、不要な再レンダリング |
| パフォーマンス | メモ化の欠如、不必要な計算 |
| アニメーション | 非効率なアニメーション実装 |
| バンドルサイズ | 不要なインポート、ツリーシェイキング阻害 |
| セキュリティ | dangerouslySetInnerHTML等の危険なパターン |
| アクセシビリティ | aria属性の欠如、セマンティクス違反 |
| Next.js固有 | Next.js特有のベストプラクティス違反 |
| デッドコード | 未使用のエクスポート、未使用の依存関係（knipによる検出） |

## 実行手順

### 1. 対象ディレクトリを特定する

モノレポの場合、スキャン対象のアプリケーションディレクトリを特定します。

```
# モノレポの例
apps/web/
apps/admin/
packages/ui/
```

プロジェクトルートで実行すると全体をスキャンしますが、モノレポでは個別のアプリディレクトリを指定する方が結果が明確になります。

### 2. react-doctorを実行する

```bash
npx -y react-doctor@latest <対象ディレクトリ> --verbose
```

- `--verbose` を付けることで、カテゴリ別の問題数やファイル名・行番号付きの詳細が出力されます
- `<対象ディレクトリ>` はプロジェクトルートからの相対パスまたは絶対パスを指定します

#### 例: プロジェクト全体をスキャン

```bash
npx -y react-doctor@latest . --verbose
```

#### 例: モノレポの特定アプリをスキャン

```bash
npx -y react-doctor@latest apps/web --verbose
npx -y react-doctor@latest apps/admin --verbose
```

### 3. 出力結果を解析する

出力には以下の情報が含まれます:

- **ヘルススコア（0〜100）**: コードベース全体の健全性を示す総合スコア
- **カテゴリ別の問題数**: 状態管理、パフォーマンス、セキュリティ等のカテゴリごとの問題件数
- **ファイル名・行番号付き詳細**: 各問題の具体的な場所とルール名

### 4. 修正提案をユーザーに提示する

検出された問題を重要度順に整理し、以下の形式で提示します:

- 問題の説明（何がなぜ問題なのか）
- 該当ファイル・行番号
- 具体的な修正方法

## 差分モード

mainブランチからの変更ファイルのみをスキャンしたい場合は、`--diff` オプションを使用します。CI連携やローカルでの手動チェックで有用です。

> **注**: task-reviewerでのレビュー時はフルスキャン（`--diff` なし）を使用し、コードベース全体の健康状態を把握します。差分モードはユーザーが手動で実行する場合の選択肢です。

```bash
npx -y react-doctor@latest . --verbose --diff main
```

- `main` の部分は比較対象のブランチ名を指定します
- 変更が加えられたファイルのみが診断対象となるため、高速に実行できます

## 診断結果の読み方

| スコア範囲 | 評価 | 目安 |
|-----------|------|------|
| 90〜100 | 優秀 | 大きな問題なし。細かな改善のみ |
| 70〜89 | 良好 | いくつかの改善ポイントあり |
| 50〜69 | 要改善 | パフォーマンスやセキュリティに注意が必要 |
| 0〜49 | 要注意 | 重大な問題が複数存在。優先的に対処すべき |

## モノレポでの使い方

モノレポ構成では、各アプリケーションディレクトリに対して個別に実行することを推奨します。

```bash
# 各アプリを個別にスキャン
npx -y react-doctor@latest apps/web --verbose
npx -y react-doctor@latest apps/admin --verbose

# 共有UIパッケージもスキャン可能
npx -y react-doctor@latest packages/ui --verbose
```

プロジェクトルートで実行した場合は全ディレクトリが対象になりますが、結果が混在して読みづらくなる可能性があります。アプリごとに分けて実行し、それぞれのスコアと問題を個別に把握するのが効果的です。

<!-- @einja:project-private:start id="einja-react-doctor-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
