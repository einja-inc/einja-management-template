# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **sync コマンド**: 既存プロジェクトへのテンプレート同期機能を追加
  - カテゴリ選択式の柔軟な同期（11カテゴリ対応）
  - マーカーベースマージ（`@einja:managed`, `@einja:seed`）による既存コード保護
  - package.json 依存関係のバージョン競合検出・解決機能
  - Git 未コミット変更チェック（`--force` で強制実行可能）
  - 自動バックアップ作成（`.einja-sync-backup-{timestamp}/`）
  - ロールバック機能（`--rollback` オプション）
  - Ctrl+C 中断時のクリーンアップ処理
  - dry-run モード（`--dry-run`）でのプレビュー機能
  - 環境変数ファイル保護（`.env.keys`, `.env.personal`）

### Removed

- `-y, --yes` オプションを削除（`--all` または `--categories` で代替可能）

### Security

- Git 未コミット変更がある場合、デフォルトで同期をブロック
- 重要な環境変数ファイル（`.env.keys`, `.env.personal`）を保護
- バックアップ機能により、誤った変更からの復旧が可能

## [0.2.9] - 2025-01-XX

### Changed

- Initial release with project creation functionality
