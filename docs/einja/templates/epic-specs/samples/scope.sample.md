---
schemaVersion: "1.0"
epicId: EPIC-1
issueSlug: profile-view-edit
featureIds:
  - F-01
storyIds:
  - S-01
acIds:
  - AC-01
  - AC-02
dependsOn: []
uiFrameIds:
  - profile-view
  - profile-edit
transitionIds:
  - TR-01
  - TR-02
---

# Scope: プロフィール表示・編集画面の実装

## 参照Epic

- Epic requirements: docs/specs/epics/user-profile-settings/requirements.md
- Epic design: docs/specs/epics/user-profile-settings/design.md
- Epic ui-design: docs/specs/epics/user-profile-settings/ui-design.pen
- Epic screen transitions: docs/specs/epics/user-profile-settings/screen-transitions.drawio
- Epic manifest: docs/specs/epics/user-profile-settings/epic-manifest.json

## このIssueが担当するFeature

- F-01 プロフィール情報表示・編集
  - 既存のアカウント情報（`users` テーブル）を参照し、名前・メール・自己紹介フィールドの表示と編集を提供する。

## ユーザーストーリー

- S-01: 認証済みユーザーとして、自分のプロフィール情報を閲覧・編集し、最新の状態に保ちたい。

## 受け入れ基準

- AC-01: 認証済みユーザーがプロフィール情報（名前・メール・自己紹介）を閲覧できる。
  - 未認証時は `/login` へリダイレクト。
  - 自己紹介は Markdown レンダリング対応。
- AC-02: 認証済みユーザーがプロフィール情報を編集・保存できる（バリデーション付き）。
  - 名前は 1〜50 文字、必須。
  - メールは RFC 5322 形式、必須、一意性チェック。
  - 自己紹介は 最大 500 文字、任意。
  - 保存成功時にトースト通知を表示。

## 技術的前提・制約

- Next.js 15 App Router、Server Actions で保存処理を実装。
- Prisma の `User` モデルに `bio` カラムを追加する（マイグレーションは別 Issue ではなくこの Issue 内で実施）。
- Zod でフォームバリデーション。

## 担当する画面・遷移

- 画面: `profile-view`（表示）、`profile-edit`（編集）
- 遷移:
  - TR-01: profile-view → profile-edit（「編集」ボタン押下）
  - TR-02: profile-edit → profile-view（「保存」ボタン押下・成功時）

## スコープ境界

### In Scope

- プロフィール情報の表示・編集 UI と Server Action 実装
- `users.bio` カラム追加マイグレーション
- 編集画面のフォームバリデーションとエラー表示

### Out of Scope

- アバター画像アップロード機能（別 Issue `profile-avatar-upload` で実装）
- パスワード変更機能（本 Epic 外）
- メール変更時の確認メール送信フロー（将来検討）

## Issue固有の補足情報

- 既存の `/settings/profile` 画面は未実装のため新規作成。
- Epic design.md の「認証ガード設計」セクションを参照し、middleware 経由で未認証ユーザーをブロックすること。
