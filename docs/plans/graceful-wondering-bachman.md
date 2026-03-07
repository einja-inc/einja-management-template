# Codexレビュー指摘修正 Round 2

## Context

Round 1修正（H8+M9+L4件）完了後の再レビューで、High 4件・Medium 12件・Low 8件を検出。
確実なバグ（`$`展開）、セキュリティ（Secret露出・インジェクション）、堅牢性（fd leak・try-catch粒度）を修正する。
設計意見レベル（L-2 console制御、L-4 parser互換性、L-6 vimマーカー等）は対象外。

## スキップする項目と理由

| ID | 理由 |
|----|------|
| M-3 (loadDefaults返却型) | `Partial<Record<AllowedKey, string>>` への変更は全呼び出し元に波及。フィルタ済みなので実害なし |
| M-4 (key/valueバリデーション) | 開発者専用CLIでユーザー入力は限定的。過剰防御 |
| M-6 (env.ts キー名バリデーション) | 同上 |
| M-9 (env.ts バックアップ削除) | 現行ロジックで実害なし |
| L-2, L-4, L-5, L-6, L-7, L-8 | 設計意見・極低リスク |

## バッチ構成

```
Batch 1（並行）— lib層の修正
├── FIX-A: defaults.ts 堅牢化+非公開化   (H-1, M-1+L-1, M-2, L-3)
└── FIX-B: env-common.ts $展開バグ修正   (M-5)

Batch 2（Batch 1完了後に並行）— スクリプト層
├── FIX-C: env.ts 安全性修正             (H-2, M-7, M-8)
├── FIX-D: setup-dev.ts 堅牢性修正       (M-10, M-11)
└── FIX-E: init-github.ts セキュリティ修正 (H-3, H-4, M-12)
```

---

## FIX-A: `scripts/lib/defaults.ts` 堅牢化+非公開化

### H-1: `saveDefaults` 非公開化
- `export function saveDefaults` → `function saveDefaults`（exportを削除）
- 外部からは `setDefault` 経由のみ。直接呼び出しによる既存トークン全消去を防止

### M-1+L-1: tmpファイルクリーンアップ + fdリーク修正（L144-151）
- `fd` を `try/finally` で確実にクローズ
- `renameSync` 失敗時に `.tmp` を確実に削除
```typescript
const fd = fs.openSync(tmpPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC, 0o600);
try {
    fs.writeSync(fd, JSON.stringify(data, null, "\t"));
} finally {
    fs.closeSync(fd);
}
try {
    fs.renameSync(tmpPath, filePath);
} catch (renameErr) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw renameErr;
}
```

### M-2: APPDATA絶対パス検証（L42-44）
- `if (appData)` → `if (appData && path.isAbsolute(appData))`

### L-3: `setDefault` のデッドコード削除（L179-181）
- `if (!isAllowedKey(key)) { return; }` を削除（`key: AllowedKey` 型で既に保証済み）

---

## FIX-B: `scripts/lib/env-common.ts` `$`展開バグ修正

### M-5: `String#replace` の `$` 展開バグ（L127）
- `content.replace(regex, \`${key}=${value}\`)` → 関数形式に変更
```typescript
// 変更前
content = content.replace(regex, `${key}=${value}`);
// 変更後（$&, $1, $$ 等の特殊展開を防止）
content = content.replace(regex, () => `${key}=${value}`);
```

---

## FIX-C: `scripts/env.ts` 安全性修正

### H-2: EDITOR経由のコマンドインジェクション（L631）
- `execSync(\`${editor} ${env.file}.tmp\`)` → `spawnSync` + 引数配列化
```typescript
import { spawnSync } from "node:child_process";
// ...
spawnSync(editor, [`${env.file}.tmp`], { cwd, stdio: "inherit" });
```
- import文に `spawnSync` を追加（`execSync` は dotenvx 用に残す）

### M-7: `current` と `currentEnv` 二重読み込みの統一（L98, L120）
- L98の `const current = parseEnvFile(...)` を削除
- L120の `const currentEnv = ...` を関数冒頭に移動
- L151の `current.GITHUB_TOKEN` → `currentEnv.GITHUB_TOKEN` に統一

### M-8: fetchレスポンスボディ未消費（L186, L464, L484, L504）
- 各 `fetch` 呼び出し後に `await res.text()` を追加してボディを消費
```typescript
const res = await fetch(url, { headers });
const _body = await res.text(); // TCP接続リーク防止
```

---

## FIX-D: `scripts/setup-dev.ts` 堅牢性修正

### M-10: `hasGithubToken` 判定の統一（L463-467）
- 正規表現による生テキスト判定を `parseEnvFile` に統一
```typescript
// 変更前
const envPersonalContent = fs.readFileSync(envPersonalPath, "utf-8");
const hasGithubToken =
    envPersonalContent.includes("GITHUB_TOKEN=") &&
    !envPersonalContent.match(/GITHUB_TOKEN=\s*$/m) &&
    !envPersonalContent.match(/GITHUB_TOKEN=\s*\n/);
// 変更後
const currentEnv = parseEnvFile(envPersonalPath);
const hasGithubToken = !!currentEnv.GITHUB_TOKEN;
```

### M-11: voltaバージョン文字列の検証（L175, L181）
- `voltaConfig.node` / `voltaConfig.pnpm` をバリデーション
```typescript
const versionPattern = /^\d+\.\d+\.\d+$/;
if (voltaConfig.node) {
    if (!versionPattern.test(voltaConfig.node)) {
        fail(`不正なNode.jsバージョン形式: ${voltaConfig.node}`);
        process.exit(1);
    }
    // ...既存のexecSync
}
```

---

## FIX-E: `scripts/init-github.ts` セキュリティ修正

### H-3: org/repoバリデーション追加
- `parseRemoteUrl` の結果と `p.text()` のユーザー入力にバリデーション
```typescript
function isValidGitHubIdentifier(value: string): boolean {
    return /^[a-zA-Z0-9._-]+$/.test(value) && value.length <= 100;
}
```
- `org` / `repo` 使用前にバリデーション。失敗時は `warn` + 該当ステップをスキップ

### H-4: Secret値のプロセス引数露出修正（L281）
- `--body <value>` → stdin経由に変更
```typescript
// 変更前
const result = spawnSync("gh", ["secret", "set", name, "--body", value], { ... });
// 変更後
const result = spawnSync("gh", ["secret", "set", name], {
    input: value,
    stdio: ["pipe", "pipe", "pipe"],
    cwd,
});
```

### M-12: Step 9の大域try-catch分離（L350-486）
- 現在の単一try-catch → Vercel確認・Neon確認・Secrets確認を独立try-catchに分離
```
try { /* Vercel確認 */ } catch { warn("Vercel状態の確認中にエラー"); }
try { /* Neon確認 */ } catch { warn("Neon状態の確認中にエラー"); }
if (org && repo) { try { /* Secrets確認 */ } catch { warn("Secrets確認をスキップ"); } }
```

---

## 変更ファイル

| ファイル | FIX | 修正件数 |
|---------|-----|---------|
| `scripts/lib/defaults.ts` | FIX-A | 4件 |
| `scripts/lib/env-common.ts` | FIX-B | 1件 |
| `scripts/env.ts` | FIX-C | 3件 |
| `scripts/setup-dev.ts` | FIX-D | 2件 |
| `scripts/init-github.ts` | FIX-E | 3件 |

## 検証

1. `pnpm prepush`（lint + typecheck + test）が通ること
2. `git diff --stat` で上記5ファイルのみ変更されていること
