# 修正計画: create-einja-app sync コマンドの設計ギャップ修正

## 問題一覧

### 致命的 (Critical)

| # | 問題 | 影響 |
|---|------|------|
| C-1 | sync にテンプレート変数置換がない | `@repo/`, `{{packageName}}` が未置換のままコピーされる |
| C-2 | 環境ファイルの暗号化キー上書き | `.env.keys` 以外の `.env.*` が上書きされ秘密鍵が破壊 |
| C-3 | Prismaスキーマの無条件上書き | apps/packages sync時にユーザーのDBモデルが消失 |

### 重大 (High)

| # | 問題 | 影響 |
|---|------|------|
| H-1 | package.json の scripts 完全上書き | ユーザーカスタムスクリプトが消失 |
| H-2 | tsconfig.json の extends/paths 上書き | TypeScriptビルド設定が破壊 |
| H-3 | dry-run がファイルリスト表示のみ | マージ結果や変数置換結果が確認不可 |
| H-4 | バックアップが既存ファイルのみ | 新規追加ファイルがロールバックで残る |
| H-5 | GitHub Actions YAML の無条件同期 | カスタマイズしたCIパイプラインが破壊 |

### 中程度 (Medium)

| # | 問題 | 影響 |
|---|------|------|
| M-1 | dev-cli / create-einja-app の管轄重複 | ユーザーが混乱 |
| M-2 | マーカーの入れ子エラー処理不足 | マーカー破損時に警告なし |
| M-3 | 冪等性の未保証 | sync 2回実行で結果が変わる可能性 |
| M-4 | 個別ファイル保護の仕組みがない | conflictStrategy でしか保護できない |
| M-5 | `.env.personal` の定義に `.env.keys` があるが実装で片方のみチェック | 保護漏れ |

## 修正方針

### Phase 1: 致命的問題の修正 (C-1, C-2, C-3)

#### 1-1. ユーザーリポジトリから packageScope/projectName を検出

sync は既存リポジトリに対して実行されるため、ユーザーの設定を自動検出する必要がある。

**取得元の優先順位**:
1. `.einja.json` (または `.einja-sync.json`) にメタデータとして保存されている場合
2. ルート `package.json` の `name` フィールド（projectName）
3. `apps/` or `packages/` 配下の `package.json` から `name` のスコープ部分を抽出
4. 上記で取得できない場合は対話式プロンプトで入力

**新規ファイル**: `src/utils/project-detector.ts`

#### 1-2. sync プロセスにテンプレート変数置換を統合

**方式**: テンプレートファイル読み込み後、マージ処理の**前**に `replacePlaceholders()` を適用

- `template.ts` の `replacePlaceholders()` を export して共用化
- `merger.ts` の `mergeAndWriteFile()` に templateVariables オプションを追加
- `sync.ts` で検出した変数情報を `mergeAndWriteFile` に渡す

**重要**: 置換はマージ前に行う。マージ後に行うと既存ファイルのユーザーカスタマイズまで誤って置換してしまう。

#### 1-3. 置換漏れ検証

sync 完了後に `@repo/` や `{{packageName}}` がターゲットファイルに残っていないか検証。

**新規ファイル**: `src/utils/placeholder-validator.ts`

#### 1-4. 環境ファイルの保護強化

`ENV_FILE_PROTECTION` を拡張。dotenvx 暗号化済み値を含むファイルを保護対象に追加。

```typescript
const ENV_FILE_PROTECTION = {
  protected: [
    ".env.keys",       // 既存
    ".env.personal",   // 既存
    ".env.develop",    // 追加
    ".env.local",      // 追加
    ".env.production", // 追加
    ".env.staging",    // 追加
    ".env.preview",    // 追加
  ],
  allowed: [           // 同期許可
    ".env.example",
    ".env.personal.example",
    ".envrc",
  ],
};
```

#### 1-5. Prismaスキーマ等の保護

sync 対象から除外すべきファイルパターンを追加:
- `**/prisma/schema.prisma` — DBモデルはユーザー固有
- `**/prisma/migrations/**` — マイグレーション履歴
- `pnpm-lock.yaml` — lockfile は sync すべきでない

### Phase 2: 重大問題の修正 (H-1 ~ H-5)

#### 2-1. package.json scripts の安全なマージ (H-1)

現状: `{...existing, ...template}` でテンプレートが後勝ち。

**方式**: scripts マージ時に、ユーザーが追加したキー（テンプレートに存在しないキー）を保持。テンプレート既存キーの上書き時は既にカスタマイズされている場合は警告。

#### 2-2. `--all` 時のデフォルトスコープ制限 (H-1)

`--all` 使用時も `packageJsonSections` のデフォルトを `["scripts", "engines"]` に限定。dependency 系は明示フラグ必要。

#### 2-3. dry-run の改善 (H-3)

dry-run 時にもマージ処理をシミュレーション実行し、実際のdiff（変更前後）を表示する。

#### 2-4. バックアップの完全性 (H-4)

sync 完了時に「追加されたファイル」のリストも記録し、ロールバック時に削除する。

#### 2-5. GitHub Actions のマーカーベース保護 (H-5)

`.github/workflows/*.yml` にマーカーベースマージを適用。managed セクション外のユーザーカスタマイズを保持。

### Phase 3: テスト

| テストファイル | 内容 |
|---|---|
| `tests/unit/utils/project-detector.test.ts` | **新規**: packageScope 自動検出 |
| `tests/unit/utils/placeholder-validator.test.ts` | **新規**: 置換漏れ検出 |
| `tests/unit/utils/merger.test.ts` | **追加**: templateVariables 付きマージ |
| `tests/integration/sync-variables.test.ts` | **新規**: sync E2E（変数置換検証） |

## 実装順序

```
Phase 1-1: project-detector 作成
    ↓
Phase 1-2: replacePlaceholders 共用化 + merger 統合
    ↓
Phase 1-3: placeholder-validator 作成
    ↓ (並行可)
Phase 1-4: env 保護強化  |  Phase 1-5: Prisma/lockfile 除外
    ↓
Phase 2 (並行可): scripts安全マージ | dry-run改善 | バックアップ完全性
    ↓
Phase 3: テスト作成
```

## 変更ファイルサマリ

| ファイル | 操作 | 内容 |
|---|---|---|
| `src/utils/project-detector.ts` | **新規** | packageScope/projectName 検出 |
| `src/utils/placeholder-validator.ts` | **新規** | 置換漏れ検出 |
| `src/generators/template.ts` | 変更 | `replacePlaceholders()` を export |
| `src/utils/merger.ts` | 変更 | templateVariables オプション追加 |
| `src/commands/sync.ts` | 変更 | 変数検出・置換・検証ステップ追加 |
| `src/generators/sync.ts` | 変更 | env保護リスト拡張、Prisma除外パターン追加 |
| `src/types/index.ts` | 変更 | SyncMetadata に packageScope/projectName 追加 |

## リスク

| リスク | 軽減策 |
|---|---|
| `pnpm-lock.yaml` 内の `@repo/` 置換で lockfile 破壊 | sync 対象から除外 |
| マージ前置換でマージ精度低下 | マーカーベースマージはテキスト比較なので影響なし |
| 既存ユーザーの設定ファイルに packageScope がない | 自動検出 + 対話確認でフォールバック |
