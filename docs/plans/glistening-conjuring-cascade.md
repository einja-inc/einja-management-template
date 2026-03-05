# Plan: パッケージ利用者側でSkill等が少ない問題の修正

## Context

利用者リポ（eenchow）で `einja sync` 実行後に配布されるSkillが8個しかなく、テンプレートの19個と大きな乖離がある。

## 調査結果サマリー

| 項目 | テンプレート (v0.1.44) | npm v0.1.41（同期実行時） | 利用者リポ (eenchow) |
|------|----------------------|---------------------|---------------------|
| Skills数 | 19個 (einja-*: 15, _einja-*: 4) | **8個** | **8個** |

### 根本原因

1. **タイミングの問題（解決済み）**: ユーザーが同期実行した時点ではnpm上の最新がv0.1.41だった。v0.1.42〜v0.1.43はbiome lintエラーでCI失敗。v0.1.44は**本日GitHub Actionsでnpm公開完了**（12:08 UTC）。再度 `einja sync` を実行すれば15個のeinja-*スキルが配信される
2. **`_einja-*` スキルの同期除外バグ（未修正）**: `file-filter.ts`のglobパターン `einja-*/**/*` が `_einja-*` にマッチしない。v0.1.44で同期しても**インナースキル4個が配信されない**
3. **インナースキル名変更の移行**: v0.1.41では `einja-*`（`_`なし）、v0.1.44では `_einja-*`。orphan cleanerで自動移行可能だが、バグ2の修正が前提

## 修正内容

### Step 1: `file-filter.ts` のバグ修正（2箇所）

**ファイル**: `packages/cli/src/lib/sync/file-filter.ts`

#### 1-A. globパターン修正（105行目）

```typescript
// Before:
pattern = `${categoryPath}/einja-*/**/*`;

// After:
pattern = `${categoryPath}/{einja-,_einja-}*/**/*`;
```

brace expansionで `einja-*` と `_einja-*` の両方をスキャン。

#### 1-B. カテゴリ判定修正（205行目）

```typescript
// Before:
if (firstSegment?.startsWith("einja-")) {

// After:
if (firstSegment?.startsWith("einja-") || firstSegment?.startsWith("_einja-")) {
```

orphan cleanerがこのメソッドを使用するため（orphan-cleaner.ts:44行目）、修正しないと `_einja-*` パスのorphan検出が機能しない。

### Step 2: テスト追加

**ファイル**: `packages/cli/src/lib/sync/file-filter.test.ts`

- `_einja-*` スキルがscanSyncTargetsでスキャンされることのテスト
- `getCategoryFromPath` が `_einja-*` パスに対して `"skills"` を返すことのテスト

### Step 3: ビルド・テスト・公開

1. `pnpm prepush`（lint + typecheck + test）
2. `pnpm build`（packages/cli）
3. ビルド後の `presets/default/.claude/skills/` に `_einja-*` が含まれることを確認
4. `einja-npm-release` Skillに従ってnpm公開

### Step 4: 利用者リポでの同期確認

1. eenchowで `npx @einja/dev-cli@latest sync`
2. 新スキル（19個）が配信されることを確認
3. `--clean` で旧名インナースキル（`einja-general-context-loader`等）がorphanとして検出・削除されることを確認

## 修正不要の確認済みファイル

| ファイル | 理由 |
|---------|------|
| `copy-presets.mjs` (88行目) | 既に `_einja-*` 対応済み |
| `preset-update/file-copier.ts` (195行目) | `prefixFilter: ["einja-", "_einja-"]` で対応済み |
| `shouldExclude` の `_` フィルタ (145行目) | `path.basename()` 判定のためディレクトリ名には影響しない |
| `orphan-cleaner.ts` | `getCategoryFromPath` 修正のみで連動して動作する |

## 検証方法

1. `pnpm prepush` でlint/typecheck/testが全パス
2. `pnpm build` 成功 → `presets/default/.claude/skills/` に19個のスキル（_einja-* 4個含む）
3. npm公開後、eenchowで `npx @einja/dev-cli@latest sync` → 全スキル配信確認
4. `einja sync --clean` で旧名スキルがorphanとして検出されること

## Skill-First評価

スキップ基準に該当: 具体的かつ限定的なバグ修正 + 1回限りの公開作業。Skill化不要。
