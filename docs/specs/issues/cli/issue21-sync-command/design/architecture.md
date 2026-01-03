# アーキテクチャ

## 概要

@einja/cliパッケージに`sync`コマンドを追加し、既存プロジェクトに対してテンプレート更新を安全にマージする機能を実装します。3方向マージアルゴリズムにより、ローカルのカスタマイズを保持しつつテンプレートの最新変更を取り込むことで、手動マージ作業を80%削減し、テンプレート改善の継続的反映を実現します。

本設計書では、requirements.mdで定義された9つのユーザーストーリー（基本同期、ディレクトリ分離、@einja:managedマーカー、選択的同期、ドライラン、強制上書き、コンフリクト検出、JSON出力、パッケージ名変更）を実現するための技術的実装を詳細に定義します。

### 主要な技術的課題と解決方針

1. **3方向マージの複雑性**
   - 課題: ベース版・ローカル版・テンプレート版の3つを比較してマージする処理が複雑
   - 解決策: `node-diff3`ライブラリの活用、マージアルゴリズムの段階的実装
   - 対策: 十分な単体テストケース、エッジケースの事前洗い出し

2. **メタデータ管理の信頼性**
   - 課題: `.einja-sync.json`の破損や不整合が同期処理全体に影響
   - 解決策: スキーマバリデーション（Zod）、マイグレーション機能の実装
   - 対策: バックアップ機能、復元コマンドの提供

3. **@einja:managedマーカーのパース精度**
   - 課題: 不正なマーカーペアや入れ子構造への対処
   - 解決策: 厳格なパースルール、エラー検出とユーザーへの明確なフィードバック
   - 対策: マーカー構文の自動検証、修正支援メッセージ

4. **パフォーマンス要件の達成**
   - 課題: 100ファイルの同期を3秒以内に完了する必要
   - 解決策: 並列処理（Promise.all）、ファイルハッシュキャッシュ
   - 対策: パフォーマンステスト、ボトルネック分析

## システム構成図

```mermaid
graph TB
    subgraph "CLI Interface"
        CLI[CLI Entry Point<br/>src/cli.ts]
        SyncCmd[Sync Command<br/>src/commands/sync.ts]
    end

    subgraph "Core Services"
        TemplateLoader[Template Loader<br/>テンプレート読み込み]
        MetadataManager[Metadata Manager<br/>.einja-sync.json管理]
        DiffEngine[Diff Engine<br/>3方向マージ処理]
        MarkerProcessor["@einja:managed<br/>マーカー処理"]
        FileFilter[File Filter<br/>同期対象判定]
    end

    subgraph "File System"
        LocalFiles[ローカルファイル<br/>.claude/, docs/]
        TemplateFiles[テンプレートファイル<br/>packages/cli/core/, presets/]
        MetadataFile[メタデータ<br/>.einja-sync.json]
        BackupDir[バックアップ<br/>.claude.backup-*]
    end

    subgraph "External Libraries"
        Diff3[node-diff3<br/>3方向マージ]
        Chalk[chalk<br/>ターミナル表示]
        Ora[ora<br/>スピナー表示]
    end

    CLI --> SyncCmd
    SyncCmd --> TemplateLoader
    SyncCmd --> MetadataManager
    SyncCmd --> DiffEngine
    SyncCmd --> MarkerProcessor
    SyncCmd --> FileFilter

    TemplateLoader --> TemplateFiles
    MetadataManager --> MetadataFile
    DiffEngine --> Diff3
    DiffEngine --> LocalFiles
    DiffEngine --> TemplateFiles
    MarkerProcessor --> LocalFiles
    FileFilter --> LocalFiles
    SyncCmd --> BackupDir
    SyncCmd --> Chalk
    SyncCmd --> Ora
```

## データフロー図（DFD）

```mermaid
flowchart LR
    %% 外部エンティティ
    User[👤 CLI利用者]

    %% プロセス
    P1((1.0<br/>同期開始))
    P2((2.0<br/>ファイル<br/>スキャン))
    P3((3.0<br/>差分計算))
    P4((4.0<br/>マージ処理))
    P5((5.0<br/>ファイル<br/>書き込み))
    P6((6.0<br/>メタデータ<br/>更新))

    %% データストア
    Templates[(テンプレート)]
    LocalFiles[(ローカル<br/>ファイル)]
    Metadata[(メタデータ<br/>.einja-sync.json)]
    Backup[(バックアップ)]

    %% データフロー
    User -->|コマンド実行| P1
    P1 -->|テンプレート読込| Templates
    P1 -->|メタデータ読込| Metadata
    P1 -->|ローカル読込| LocalFiles
    Templates --> P2
    LocalFiles --> P2
    Metadata --> P2
    P2 -->|ファイルリスト| P3
    P3 -->|差分情報| P4
    P4 -->|マージ結果| P5
    P4 -->|バックアップ| Backup
    P5 -->|更新ファイル| LocalFiles
    P5 -->|ハッシュ値| P6
    P6 -->|新メタデータ| Metadata
    P6 -->|結果レポート| User
```

### データフロー説明

1. **同期開始フロー**
   - ユーザーがsyncコマンドを実行
   - オプション解析（--dry-run, --only, --force, --json）
   - テンプレートファイル、ローカルファイル、メタデータの読み込み

2. **ファイルスキャンフロー**
   - 同期対象ディレクトリのスキャン（`.claude/commands/einja/`, etc.）
   - ファイル除外ルールの適用（`_`プレフィックス、.gitignore）
   - カテゴリフィルタリング（--onlyオプション適用）

3. **差分計算フロー**
   - ファイルごとに3つのバージョンを取得
     - ベース版: メタデータのハッシュから復元
     - ローカル版: 現在のプロジェクトファイル
     - テンプレート版: 最新のテンプレートファイル
   - @einja:managedマーカーの検出とセクション分離

4. **マージ処理フロー**
   - マーカー内セクション: テンプレート版で完全上書き
   - マーカー外セクション: 3方向マージアルゴリズム適用
   - コンフリクト検出: マーカー挿入またはエラー報告
   - --forceオプション: マージスキップ、テンプレート版で上書き

5. **ファイル書き込みフロー**
   - ドライランモード: ファイル書き込みスキップ、差分表示のみ
   - 通常モード: マージ結果をファイルに書き込み
   - バックアップ作成（変更前の状態を保存）

6. **メタデータ更新フロー**
   - 各ファイルのハッシュ値計算
   - `.einja-sync.json`の更新（バージョン、最終同期日時、ファイルハッシュ）
   - 結果レポートの生成（成功/失敗ファイル数、コンフリクト情報）

## 技術スタック

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| **ランタイム** | Node.js | >= 20.0.0 | JavaScript実行環境 |
| **言語** | TypeScript | ^5 | 型安全な開発 |
| **CLIフレームワーク** | commander | ^13.1.0 | コマンドライン引数パース |
| **ターミナルUI** | chalk | ^5.4.1 | カラー出力 |
| **ターミナルUI** | ora | ^8.2.0 | スピナー表示 |
| **ファイル操作** | fs-extra | ^11.3.0 | 拡張ファイルシステム操作 |
| **差分・マージ** | node-diff3 | ^3.1.2 | 3方向マージアルゴリズム |
| **パターンマッチング** | minimatch | ^10.0.1 | ファイルパスマッチング |
| **バリデーション** | zod | ^3.x | スキーマ検証 |
| **ハッシュ** | crypto (Node.js標準) | - | ファイルハッシュ計算 |
| **Linter & Formatter** | Biome | 1.9.4 | コード品質 |
| **テスト** | Vitest | ^2.1.9 | ユニット・統合テスト |

## シーケンス図

### 基本的な同期処理フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant CLI as CLI
    participant Sync as SyncCommand
    participant Meta as MetadataManager
    participant Filter as FileFilter
    participant Diff as DiffEngine
    participant Marker as MarkerProcessor
    participant FS as FileSystem

    U->>CLI: npx @einja/cli sync
    CLI->>Sync: execute()

    Note over Sync: オプション解析
    Sync->>Meta: loadMetadata()
    Meta->>FS: read .einja-sync.json
    FS-->>Meta: メタデータ
    Meta-->>Sync: metadata

    Sync->>Filter: scanSyncTargets()
    Filter->>FS: readdir einja/
    FS-->>Filter: ファイルリスト
    Filter->>Filter: applyExclusionRules()
    Filter-->>Sync: syncTargets

    loop 各ファイル
        Sync->>Diff: calculateDiff(file)
        Diff->>FS: readLocal(file)
        Diff->>FS: readTemplate(file)
        Diff->>Meta: getBaseVersion(file)
        Diff->>Diff: 3方向マージ実行

        alt @einja:managedマーカーあり
            Diff->>Marker: parseMarkers(content)
            Marker-->>Diff: sections配列
            Diff->>Diff: マーカー内を上書き
        end

        alt コンフリクト検出
            Diff-->>Sync: conflict detected
            Sync->>Sync: recordConflict()
        else マージ成功
            Diff-->>Sync: merged content
            Sync->>FS: writeFile(merged)
            Sync->>Meta: updateHash(file)
        end
    end

    Sync->>Meta: saveMetadata()
    Meta->>FS: write .einja-sync.json

    Sync->>U: 結果レポート表示
```

### @einja:managedマーカー処理フロー

```mermaid
sequenceDiagram
    participant Diff as DiffEngine
    participant Marker as MarkerProcessor
    participant Validator as MarkerValidator

    Diff->>Marker: parseMarkers(localContent, templateContent)

    Marker->>Validator: validateMarkerPairs(localContent)

    alt マーカー不正
        Validator-->>Marker: ValidationError
        Marker-->>Diff: エラー返却
    else マーカー正常
        Validator-->>Marker: valid

        Marker->>Marker: extractSections()
        Note over Marker: マーカー内/外のセクション分離

        loop 各セクション
            alt マーカー内セクション
                Marker->>Marker: replaceWithTemplate()
                Note over Marker: テンプレート版で上書き
            else マーカー外セクション
                Marker->>Diff: mergeSection()
                Note over Diff: 3方向マージ適用
            end
        end

        Marker->>Marker: reconstructContent()
        Marker-->>Diff: merged content
    end
```

### コンフリクト検出と報告フロー

```mermaid
sequenceDiagram
    participant Diff as DiffEngine
    participant Reporter as ConflictReporter
    participant FS as FileSystem
    participant User as ユーザー

    Diff->>Diff: detectConflicts()

    alt コンフリクトあり
        Diff->>Reporter: reportConflict(file, conflicts)

        Reporter->>FS: insertConflictMarkers()
        Note over FS: <<<<<<< LOCAL<br/>...<br/>=======<br/>...<br/>>>>>>>> TEMPLATE

        Reporter->>Reporter: generateConflictReport()
        Reporter-->>User: ファイルパス、行番号、内容

        Note over User: 手動解決が必要
    else コンフリクトなし
        Diff->>FS: writeFile(merged)
    end
```
