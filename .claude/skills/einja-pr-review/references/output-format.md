# einja-pr-review 出力フォーマット

## 概要

- Sticky comment として投稿される Markdown テンプレートの完全定義
- 冒頭マーカー `<!-- einja-pr-review:v1 -->` は必須（`sticky-comment.md` 参照）
- 該当なしセクションは**動的に省略**する（警告や「該当なし」文言は出さない。ただし §1 の S1-S4 は常時表示のため「なし」を明示）

## マーカー

コメント本文の**冒頭**に不可視HTMLコメントマーカーを固定配置する。

```markdown
<!-- einja-pr-review:v1 -->
```

- Sticky comment 検索で使用される（詳細は `sticky-comment.md`）
- マーカー行の直後は `## Claude PR Review` の見出しから開始する

## 全体構造

```markdown
<!-- einja-pr-review:v1 -->
## Claude PR Review

### 1. PR概要
（§1: S1-S4 常時 + C1/C3/C4/C5 条件付き）

### 2. AIレビュー
（§2: AR-PR1 → AR-PR2 → AR-PR3 → AR-PR4 の固定順序）

### 3. 人間観点で確認が必要な項目
（§3: 該当 HR のみ動的リストアップ。該当ゼロならセクション自体を省略）
```

---

## セクション別テンプレート

### §1 PR概要 テンプレート

**表示形式**: `**ラベル**: 内容` の統一形式（1項目1行）。

#### 常時表示（S1-S4）

```markdown
**ユーザから見た挙動の変化**: <1-3文で説明。機能変更なしなら「なし」>
**ユーザストーリー**: <「誰が何をするとどうなる」形式。該当なしなら「該当なし」>
**技術的な変更カテゴリ**: [UI][API][DB][Infra][Docs] のうち該当タグを列挙
**破壊的変更**: <あり/なし>（あり の場合は影響範囲を1行追記）
```

#### 条件付き表示（C1/C3/C4/C5）

該当がある観点のみ、以下の行を追加する（該当なしは**行ごと省略**、ラベルも出さない）。

```markdown
**関連Issue**: #<番号>
**関連仕様書**:
- docs/specs/<path>/requirements.md
- docs/specs/<path>/design.md
**依存関係変更**: <追加/削除/更新パッケージを列挙>
**設定・環境変数変更**: <変更された設定項目を列挙>
**マイグレーション**: `<migration名>` — <スキーマ変更概要>
```

### §2 AIレビュー テンプレート

**実行順序**: AR-PR1 → AR-PR2 → AR-PR3 → AR-PR4（固定）。スキップ条件に該当する観点は**サブセクションごと省略**する。

#### AR-PR1: Asana整合性

```markdown
#### AR-PR1: Asana整合性
- Asanaタスク: "<タスク名>" (<状態>)
- **[整合|不整合]** <A1: スコープ整合の判定内容>
- **[Info|Major]** <A2: スコープ超過の判定内容>
- **[Info|Warn]** <A3: タスク状態の判定内容>
```

#### AR-PR2: 影響範囲調査

```markdown
#### AR-PR2: 影響範囲調査
- 変更ファイル: <代表的な変更ファイルパスをカンマ区切り or ワイルドカード表記>
- 影響を受けるモジュール:
  - <モジュールパス>（<影響種別: 型変更 / import経由の波及 等>）
  - <モジュールパス>（<影響種別>）
- **[Major]** <export シグネチャ変更・削除等の破壊的リスク箇所>（該当時のみ）
```

#### AR-PR3: 仕様書・Mermaid更新確認

```markdown
#### AR-PR3: 仕様書・Mermaid更新確認
- **[Major|Info]** <対象仕様書パス> の <該当図・章> が <コード変更> と未同期
  - 修正案: <sequenceDiagram / flowchart に追加すべきノード・エッジ等>
```

該当なし（コード変更が仕様書に反映済み、または仕様書変更対象なし）の場合は**サブセクションごと省略**。

#### AR-PR4: 個別レビュー結果サマリー

```markdown
#### AR-PR4: 個別レビュー結果サマリー
| 優先度 | ジャンル | ファイル:行 | 指摘内容 | 対応状態 |
|---|---|---|---|---|
| Critical | セキュリティ | <path>:<line> | <指摘内容> | <未対応|修正済み> |
| Major | 仕様 | <path> | <指摘内容> | <未対応|修正済み> |
| Minor | 実装 | <path>:<line> | <指摘内容> | <未対応|修正済み> |

指摘総数: N件（Critical: n, Major: n, Minor: n, Info: n）
```

- **優先度**: Critical / Major / Minor / Info（`review-lenses.md` §4 準拠）
- **ジャンル**: UI / 仕様 / 実装 / セキュリティ / テスト / インフラ / ドキュメント / 運用（同上）
- **対応状態**: 「未対応」または「修正済み」

### §3 人間観点 テンプレート

**動的リストアップ形式**（HR1-HR6 のうち該当分のみ）。

```markdown
### 3. 人間観点で確認が必要な項目
- **HR<n>（<観点名>）**: <このPRで見るべき具体的箇所を1行で>
- **HR<n>（<観点名>）**: <同上>
```

- 該当ゼロの場合は §3 セクション自体を省略する（見出しも出さない）
- 判定は人間に委ねる旨は Skill 説明側で担保し、コメント本文には冗長な注記を入れない

---

## サンプル出力（フル版）

以下は「パスワードリセット機能追加PR」を想定した完全なサンプル出力（Plan L688-733 準拠）。

```markdown
<!-- einja-pr-review:v1 -->
## Claude PR Review

### 1. PR概要
**ユーザから見た挙動の変化**: パスワードリセット機能が追加される
**ユーザストーリー**: 未認証ユーザーが「パスワードを忘れた方」→ メール入力 → リセットリンク受信
**技術的な変更カテゴリ**: [UI][API]
**破壊的変更**: なし
**関連Issue**: #42
**関連仕様書**:
- docs/specs/issues/auth/issue42-password-reset/requirements.md
- docs/specs/issues/auth/issue42-password-reset/design.md
**依存関係変更**: react-hook-form@7.x を追加
**マイグレーション**: `20260730_password_reset_token` — PasswordResetToken テーブル追加

### 2. AIレビュー

#### AR-PR1: Asana整合性
- Asanaタスク: "パスワードリセット機能実装" (作業中)
- **[整合]** タスクの完了条件が全て実装済み
- **[Info]** タスク範囲外の変更なし

#### AR-PR2: 影響範囲調査
- 変更ファイル: apps/web/src/api/auth/*, apps/web/src/components/LoginForm.tsx
- 影響を受けるモジュール:
  - packages/server-core/src/domain/user.ts（型変更）
  - apps/admin/src/features/user-management（型経由で波及）

#### AR-PR3: 仕様書・Mermaid更新確認
- **[Major]** docs/specs/.../design.md の認証フロー Mermaid 図がリセットフロー未反映
  - 修正案: sequenceDiagram に resetToken 発行フローを追加

#### AR-PR4: 個別レビュー結果サマリー
| 優先度 | ジャンル | ファイル:行 | 指摘内容 | 対応状態 |
|---|---|---|---|---|
| Critical | セキュリティ | apps/web/src/api/auth/reset.ts:15 | resetToken がログ出力される | 未対応 |
| Major | 仕様 | docs/specs/.../design.md | Mermaid未更新 | 未対応 |
| Minor | 実装 | apps/web/src/hooks/useAuth.ts:42 | 命名の一貫性 | 未対応 |

指摘総数: 3件（Critical: 1, Major: 1, Minor: 1, Info: 0）

### 3. 人間観点で確認が必要な項目
- **HR1（デザイン美的判断）**: 「パスワードを忘れた方」リンクの配置・視認性
- **HR4（UXの直感性）**: リンクからリセットまでの体験
```
