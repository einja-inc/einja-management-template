# シンボリックリンク保持アーキテクチャ

## 概要

CLIでターゲットリポジトリにファイルをインストールする際、プロジェクト原本のシンボリックリンク構造を自動的に再現する仕組み。

## 背景と目的

### 問題

- `.claude/skills/` 内のドキュメントと `docs/` 内のドキュメントで内容が重複する
- 手動で同期を取るのは面倒でミスが起きやすい
- skillsを自己完結させつつ、人間向けドキュメントも提供したい

### 解決策

- `docs/` に実体ファイルを配置（人間が管理する正のドキュメント）
- `.claude/skills/reference/` からシンボリックリンクで参照
- CLIインストール時にこのリンク構造を自動再現

## アーキテクチャ

### 全体フロー

```
┌─────────────────────────────────────────────────────────────────┐
│ プロジェクト原本                                                   │
├─────────────────────────────────────────────────────────────────┤
│ docs/einja/steering/commit-rules.md         ← 実体              │
│ .claude/skills/.../reference/commit-rules.md → ../docs/...     │
│                                              ↑ シンボリックリンク │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ pnpm build (copy-presets.mjs)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLIパッケージ（配布物）                                           │
├─────────────────────────────────────────────────────────────────┤
│ scaffolds/steering/commit-rules.md          ← 実体コピー         │
│ presets/minimal/.claude/skills/...          ← 実体コピー         │
│ presets/minimal/symlinks.json               ← リンク情報         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ npx @einja/cli init
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ターゲットリポジトリ                                              │
├─────────────────────────────────────────────────────────────────┤
│ docs/einja/steering/commit-rules.md         ← 実体コピー         │
│ .claude/skills/.../reference/commit-rules.md → ../docs/...     │
│                                              ↑ リンク再作成      │
└─────────────────────────────────────────────────────────────────┘
```

### symlinks.json フォーマット

```json
{
  "version": 1,
  "symlinks": [
    {
      "link": ".claude/skills/einja-coding-standards/reference/commit-rules.md",
      "target": "../../../../docs/einja/steering/commit-rules.md"
    },
    {
      "link": ".claude/skills/einja-coding-standards/reference/testing-strategy.md",
      "target": "../../../../docs/einja/steering/development/testing-strategy.md"
    }
  ]
}
```

| フィールド | 説明 |
|-----------|------|
| `version` | フォーマットバージョン（将来の互換性のため） |
| `link` | 作成するシンボリックリンクの相対パス（リポジトリルートから） |
| `target` | リンク先の相対パス（リンク元からの相対パス） |

## 実装詳細

### 1. ビルド時処理（copy-presets.mjs）

```javascript
const symlinkMap = [];

function copyDir(src, dest, filter, basePath = '') {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (!filter(srcPath)) continue;

    if (entry.isSymbolicLink()) {
      // シンボリックリンクを検出 → メタデータに記録
      const linkTarget = fs.readlinkSync(srcPath);
      symlinkMap.push({
        link: relativePath,
        target: linkTarget,
      });
      // 実体はコピーしない（リンク先が別途コピーされる前提）
    } else if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filter, relativePath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 最後にメタデータ出力
fs.writeFileSync(
  'presets/minimal/symlinks.json',
  JSON.stringify({ version: 1, symlinks: symlinkMap }, null, 2)
);
```

### 2. インストール時処理（CLI init コマンド）

```javascript
async function createSymlinks(targetDir, presetDir) {
  const symlinkPath = path.join(presetDir, 'symlinks.json');

  if (!fs.existsSync(symlinkPath)) {
    return; // symlinks.jsonがなければスキップ
  }

  const { symlinks } = JSON.parse(fs.readFileSync(symlinkPath, 'utf-8'));

  for (const { link, target } of symlinks) {
    const linkPath = path.join(targetDir, link);
    const linkDir = path.dirname(linkPath);

    // リンク先の実体が存在するか確認
    const absoluteTarget = path.resolve(linkDir, target);
    if (!fs.existsSync(absoluteTarget)) {
      console.warn(`警告: リンク先が存在しません: ${target}`);
      continue;
    }

    // リンク元ディレクトリを作成
    fs.mkdirSync(linkDir, { recursive: true });

    // 既存ファイルがあれば削除
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }

    // シンボリックリンクを作成
    fs.symlinkSync(target, linkPath);
    console.log(`リンク作成: ${link} → ${target}`);
  }
}
```

### 3. 処理順序

インストール時は以下の順序で処理：

1. **scaffolds をコピー**（docs/einja/steering/ など）
2. **presets をコピー**（.claude/ など）
3. **シンボリックリンクを作成**（symlinks.json を元に）

この順序により、リンク先の実体が先に存在することが保証される。

## エッジケース

### Windows対応

Windowsではシンボリックリンクの作成に管理者権限が必要な場合がある。

```javascript
try {
  fs.symlinkSync(target, linkPath);
} catch (error) {
  if (error.code === 'EPERM' && process.platform === 'win32') {
    console.warn(`警告: シンボリックリンクの作成に失敗しました（管理者権限が必要）: ${link}`);
    console.warn('  代替として実体ファイルをコピーします');
    fs.copyFileSync(absoluteTarget, linkPath);
  } else {
    throw error;
  }
}
```

### 既存ファイルとの競合

ターゲットリポジトリに既存ファイルがある場合：

1. 通常ファイル → 削除してリンクを作成
2. 既存のシンボリックリンク → 削除して新しいリンクを作成
3. ディレクトリ → エラー（手動対応を促す）

### 循環参照の防止

シンボリックリンクのリンク先がまたシンボリックリンクの場合は警告を出す。

## テスト観点

1. **正常系**
   - シンボリックリンクが正しく検出される
   - symlinks.json が正しいフォーマットで出力される
   - インストール時にリンクが正しく作成される

2. **異常系**
   - リンク先が存在しない場合の警告
   - Windows での権限エラー時のフォールバック
   - 既存ファイルとの競合処理

3. **E2E**
   - ビルド → パブリッシュ → インストールの全フローでリンクが保持される

## 関連ファイル

- `packages/cli/scripts/copy-presets.mjs` - ビルド時のコピー処理
- `packages/cli/src/commands/init.ts` - インストールコマンド
- `packages/cli/presets/minimal/symlinks.json` - 生成されるメタデータ
