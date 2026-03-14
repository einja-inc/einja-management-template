# Plan批判的レビュー結果

## 判定: MAJOR

---

## 問題一覧

### MAJOR-1: `generateTemplate()` の引数型が `ProjectConfig` だが、`worktreeConfig` は使われていない — 型不整合ではないが実装漏れの根本原因の誤認

**Planの記述:**
> `generateTemplate()` の末尾に `config.worktreeConfig` が存在する場合に `worktree.config.json` を上書き生成するロジック追加（約10行）。`writeFileSync`, `join` はL2, L6で既にインポート済み。

**問題:** `generateTemplate()` の引数 `config` は `ProjectConfig` 型（`packages/create-app/src/types/index.ts` L20）であり、`worktreeConfig?: WorktreeConfig` を含む。ここまでは正しい。

しかし、Planは「`writeFileSync` は L2 で既にインポート済み」と述べているが、実際には `template.ts` L2 は `const { copySync, readFileSync, writeFileSync, existsSync, removeSync } = fsExtra;` であり、これは `fs-extra` の `writeFileSync` である。Node.js 標準の `writeFileSync` とは動作が同じだが、**Planのコード例で使っている `JSON.stringify` + `writeFileSync` は正しく動作する。ここは問題ない。**

**本当の問題は:** テンプレート展開先の `worktree.config.json` には既にデフォルト値（web + admin）が含まれている。`worktreeConfig` が `undefined`（`--yes` モード）のときはデフォルトが使われるが、**ユーザーがカスタマイズした場合（例: app id を `market-tool` に設定）、`worktree.config.json` は上書きされるが、`apps/web/` ディレクトリはそのまま残り、`apps/web/package.json` の `--port ${PORT_WEB:-3000}` もそのまま**。つまり:
- `worktree.config.json` には `id: "market-tool"` が書かれる
- `dev.ts` は `PORT_MARKET_TOOL` を生成する
- しかし `apps/web/package.json` は `PORT_WEB` を参照し続ける

Planは「スコープ外」としてこの問題を認識しているが、**タスク2単体では実質的に何も改善しない**。`worktreeConfig` を書き出しても、`apps/*/package.json` が `PORT_WEB` をハードコードしている限り、カスタムアプリ名のポートは使われない。これは「スコープ外」ではなく、**タスク2の前提条件が欠けている**。

**推奨:** タスク2の「スコープ外」注記を強化し、タスク2だけでは下流の独自アプリ名問題は解決しないことを明記する。あるいは、`create-app` プロンプトで収集するのはアプリ1つだけ（L145-151参照）なので、init時に `apps/web/package.json` の `PORT_WEB` を `PORT_${appId.toUpperCase()}` に置換する処理も含めるべき。

### MAJOR-2: `calculatePorts()` のソルト追加は既存の全worktreeのポート番号を変更する — 破壊的変更

**Planの記述:**
> `projectName` はオプショナルなので既存テスト（2引数呼び出し）はそのまま動作。ポート番号は変わるが `.env` は自動再生成。

**問題:** テストは壊れないが、**実運用環境で破壊的影響がある**:

1. **既存の下流リポジトリ**: `pnpm dev` を再実行すると、同じブランチ名なのにポート番号が変わる。`scripts/` はビルド時に `copy-presets.mjs` でテンプレートにコピーされ、`einja sync` で下流に反映される。つまり sync 後に `pnpm dev` するとポート番号が変わる。

2. **`.env` は自動再生成**と書いてあるが、`.env` を参照する外部ツール（ブラウザのブックマーク、VS Codeのlaunch.json、docker-composeの設定等）は追従しない。

3. **`main()` L837 で `package.json` の `name` フィールドを読む**とあるが、L837 は現在 `const calculatedPorts = calculatePorts(branch, cfg.apps);` であり、ここを変更する必要がある。しかし **`showDevStatus()` L949 も `calculatePorts(branch, cfg.apps)` を呼んでいる** — こちらも `projectName` を渡さないとポート表示が不一致になる。Planはこの呼び出し箇所を見落としている。

**推奨:** `showDevStatus()` の `calculatePorts` 呼び出しもソルト対応すること。また、破壊的変更の影響範囲をリスクテーブルにより具体的に記載すべき。

### MINOR-1: `main()` 関数のシグネチャに `killExisting` パラメータの不整合

**現状コード（L980）:**
```typescript
main({ setupOnly, skipSetup, background, killExisting: !noKill })
```

**しかし `main()` のシグネチャ（L789-793）:**
```typescript
export async function main(options: {
    setupOnly?: boolean;
    skipSetup?: boolean;
    background?: boolean;
} = {}): Promise<void> {
```

`killExisting` はシグネチャに存在しない。これは既存バグだが、**Planがタスク3で `main()` を修正する際にこの不整合に気づかずに作業すると混乱する**。Plan内で言及すべき。

### MINOR-2: Turbo `EnvWildcard` のバージョンサポート確認が不十分

Planは「Turbo v2.5.8 `EnvWildcard` 型サポート」と述べているが、検証方法が「dry run で確認」のみ。Turboの公式ドキュメント/CHANGELOGで `passThroughEnv` のワイルドカードサポートがいつ導入されたかの根拠が不明。`^2.5.8` は「2.5.8以上」を意味するので、実際にインストールされているバージョンが 2.5.x かそれ以上かによって動作が異なる可能性がある。

**推奨:** 実際の `pnpm ls turbo` でインストール済みバージョンを確認し、そのバージョンのCHANGELOGでワイルドカードサポートを裏付けること。

### MINOR-3: `worktree.config.json` の `schemaVersion` フィールドの扱い

Planのタスク2コード例:
```typescript
const worktreeConfigContent = {
    $schema: "...",
    postgres: config.worktreeConfig.postgres,
    apps: config.worktreeConfig.apps,
};
```

現在の `worktree.config.json` には `"schemaVersion": 1` がある。Planのコード例では `$schema` を追加し `schemaVersion` を含めていない。書き出し時に `schemaVersion` が消失する。`worktree-config-loader.ts` の `worktreeConfigSchema`（zod スキーマ）がこのフィールドを要求しているか確認が必要。

### MINOR-4: `create-app` のプロンプトはアプリを1つしか収集しない

`packages/create-app/src/prompts/project.ts` L140-152 を見ると、`worktreeConfig.apps` は常に1要素の配列。テンプレートのデフォルトは web + admin の2つ。`worktreeConfig` を書き出すと、**adminアプリの設定が消失する**。

ユーザーがカスタマイズ時に「webだけでいい」と思って1つ設定したなら問題ないが、元のテンプレートに admin アプリが含まれている場合、`worktree.config.json` が1アプリになることで admin の開発サーバーにポートが割り当てられなくなる。

**推奨:** これはPlanの「スコープ外（プロンプトの複数アプリ収集対応）」に該当するが、タスク2実装時に **既存の `worktree.config.json` の apps をマージするか完全上書きするかの方針** を明記すべき。

---

## 指摘サマリ

| ID | 重要度 | 概要 |
|----|--------|------|
| MAJOR-1 | MAJOR | タスク2単体では下流アプリ名問題を解決しない（`apps/*/package.json` の `PORT_WEB` ハードコード未対応） |
| MAJOR-2 | MAJOR | ソルト追加で既存環境のポート番号が変わる破壊的変更 + `showDevStatus()` の呼び出し箇所見落とし |
| MINOR-1 | MINOR | `main()` の `killExisting` パラメータが型定義にない既存バグ |
| MINOR-2 | MINOR | Turbo `EnvWildcard` サポートのバージョン根拠が不十分 |
| MINOR-3 | MINOR | `worktree.config.json` 書き出し時に `schemaVersion` フィールド消失の可能性 |
| MINOR-4 | MINOR | プロンプトが1アプリしか収集しないため、書き出すと admin 設定が消失 |
