# Judgment Rules: Unit (Vitest) vs E2E (Playwright)

入力から得たシナリオを「ユニット (Vitest)」「E2E (Playwright)」に自動分類し、混在時には両方を生成するためのルール集。SKILL.md の Step 3（テスト種別判定）から参照される。

## 目次

- [基本方針](#基本方針)
- [分類シグナル一覧](#分類シグナル一覧)
  - [Playwright（E2E）シグナル](#playwrighte2eシグナル)
  - [Vitest（ユニット）シグナル](#vitestユニットシグナル)
  - [両方生成シグナル](#両方生成シグナル)
- [判定アルゴリズム](#判定アルゴリズム)
- [シナリオの粒度分解](#シナリオの粒度分解)
- [例外と落とし穴](#例外と落とし穴)
- [判定結果の出力フォーマット](#判定結果の出力フォーマット)
- [関連ドキュメント](#関連ドキュメント)

## 基本方針

1. **二者択一ではなく、シナリオごと・観点ごとに分類する**
   - 同一入力でも、一部のシナリオは Vitest、別のシナリオは Playwright になりうる
   - 1 つのシナリオに複数の観点が含まれる場合は `both`（両方生成）を選ぶ
2. **判定不能時の弱い既定値**
   - 自然言語入力（自由入力）：Playwright 寄り（UI 想定が多いため）
   - git diff 入力：変更ファイルパスに基づいて判定（後述の表参照）
3. **最終的にユーザー確認の余地を残す**
   - 自動判定が誤ったときの救済として、SKILL.md 側で AskUserQuestion による確認を促す
   - 特に `confidence: low` のシナリオは必ずユーザー確認に回す

## 分類シグナル一覧

### Playwright（E2E）シグナル

| シグナル種別 | 具体例 |
|------------|--------|
| **キーワード** | クリック / 画面 / ボタン / フォーム / 遷移 / リダイレクト / ログイン / ログアウト / モーダル / ダイアログ / URL / navigate / page.goto / セレクタ / タブ / スクロール / 入力 / 送信ボタン |
| **構造** | シナリオ文中の動作記述に UI 動作詞（クリックする・入力する・遷移する等）が含まれる |
| **対象ファイル（git diff 入力時）** | `apps/**/page.tsx`, `apps/**/layout.tsx`, `apps/**/route.ts`（API ルートは除外）, `components/**/*.tsx`（ルートレベル画面コンポーネント）, `pages/**/*.tsx`（Pages Router） |

### Vitest（ユニット）シグナル

| シグナル種別 | 具体例 |
|------------|--------|
| **キーワード** | 計算 / 変換 / バリデーション / マッピング / ソート / フィルタ / 集計 / フォーマット / parse / serialize / 関数 / 戻り値 / 返却 / 純粋関数 / 型変換 |
| **構造** | 入力 → 出力 の純粋関数性。シナリオ文が「関数を呼ぶ」「値を渡す」のみを要求する |
| **対象ファイル（git diff 入力時）** | `packages/**/*.ts`, `lib/**/*.ts`, `utils/**/*.ts`, `domain/**/*.ts`, `services/**/*.ts`, `hooks/**/*.ts`（React フックで DOM 操作を含まないもの）, `helpers/**/*.ts` |

### 両方生成シグナル

| シグナル種別 | 具体例 |
|------------|--------|
| **複合シナリオ** | 1 つのシナリオに UI 操作と内部ロジック検証の両方を要求するケース |
| **典型例** | 「フォームを送信し」「サーバー側のバリデーションエラーメッセージが正しく表示される」 |
| **典型例** | 「金額入力欄に不正値を入れて」「計算ロジックでエラーがスローされ」「画面にエラートーストが出る」 |
| **対象ファイル（git diff 入力時）** | UI ファイル（`apps/**`, `components/**`）とロジックファイル（`packages/**`, `lib/**`, `utils/**`）が**同一差分**に含まれる場合 |

## 判定アルゴリズム

```text
function classifyScenario(scenario):
    playwright_score = 0
    vitest_score = 0
    matched_signals = []

    # 1. キーワードカウント
    for keyword in PLAYWRIGHT_KEYWORDS:
        if keyword in scenario.text:
            playwright_score += 1
            matched_signals.append(keyword)
    for keyword in VITEST_KEYWORDS:
        if keyword in scenario.text:
            vitest_score += 1
            matched_signals.append(keyword)

    # 2. 構造シグナル（動作記述）
    if contains_ui_verb(scenario.action_text):
        playwright_score += 2  # 構造シグナルは重み 2
        matched_signals.append("action:ui-verb")
    if contains_pure_function_pattern(scenario.action_text):
        vitest_score += 2
        matched_signals.append("action:pure-fn")

    # 3. ファイルパスシグナル（git diff 入力時のみ）
    if scenario.target_files:
        for file_path in scenario.target_files:
            if matches_ui_path(file_path):
                playwright_score += 2
                matched_signals.append(f"path:{file_path}")
            elif matches_logic_path(file_path):
                vitest_score += 2
                matched_signals.append(f"path:{file_path}")

    # 4. 判定
    THRESHOLD = 2  # スコア差がこれ未満なら both
    if playwright_score == 0 and vitest_score == 0:
        # 判定不能 → 既定値
        type = DEFAULT_BY_INPUT_KIND[scenario.input_kind]
        confidence = "low"
    elif abs(playwright_score - vitest_score) < THRESHOLD:
        type = "both"
        confidence = "medium"
    elif playwright_score > vitest_score:
        type = "playwright"
        confidence = "high" if playwright_score >= 3 else "medium"
    else:
        type = "vitest"
        confidence = "high" if vitest_score >= 3 else "medium"

    return { scenario_id, type, confidence, signals: matched_signals }
```

判定不能時の既定値:

| 入力種別 | 既定値 |
|---------|--------|
| 自然言語（自由入力） | `playwright`（confidence: low） |
| git diff（ファイルパス無判定） | `both`（confidence: low、過剰生成側に倒す） |

## シナリオの粒度分解

| 入力種別 | シナリオ単位 | 判定対象 |
|---------|------------|---------|
| **自然言語** | 文単位・要求単位で粗く分解 | 文全体 |
| **git diff** | 変更ファイル単位、または差分中の関数/コンポーネント単位 | 差分内容 + ファイルパス |

## 例外と落とし穴

| パターン | 扱い |
|---------|------|
| 「テストする」「確認する」など曖昧な動詞 | シグナル無効として扱う（スコア加算しない） |
| Next.js App Router のサーバーコンポーネント単体テスト | Playwright 寄りに分類（データフェッチ + レンダリングを含むため、純粋関数として扱えない） |
| API ルート（`apps/**/route.ts`） | Vitest 寄り（リクエスト/レスポンスの単体テストが書きやすいため）。例外で UI 経路扱いしない |
| カスタムフック（`hooks/**/*.ts`）で DOM 操作を含むもの | Playwright 寄り or `both`（`useRef` / `document` 直接操作などが見えたら） |
| storybook story（`*.stories.tsx`） | 本 Skill のスコープ外。判定対象から除外し、warning ログのみ出す |
| E2E 用テストデータのセットアップ手順 | テスト本体ではないため判定対象外。`references/test-patterns.md` のフィクスチャ節を参照 |
| モック/スタブの言及（「〜をモックして」） | Vitest 寄りの弱シグナル（+1） |
| ネットワーク経由の通信検証（「API が呼ばれることを確認」） | 純粋関数なら Vitest（`vi.fn()` で確認）、UI 起点なら Playwright（`page.waitForRequest()`） |

## 判定結果の出力フォーマット

Step 3 の判定処理は以下の JSON ライクな構造を出力し、Step 5（テストコード生成）が消費する。

```json
{
  "version": "1",
  "generated_at": "2026-06-11T13:30:45Z",
  "scenarios": [
    { "scenario_id": "nl-1", "type": "playwright", "confidence": "high", "signals": ["クリック", "画面遷移", "action:ui-verb"], "feature_kebab": "login-flow" },
    { "scenario_id": "nl-2", "type": "vitest", "confidence": "high", "signals": ["バリデーション", "action:pure-fn"], "feature_kebab": "login-validation" },
    { "scenario_id": "diff-1", "type": "both", "confidence": "medium", "signals": ["送信", "メッセージ表示", "path:apps/web/login/page.tsx", "path:packages/core/validators.ts"], "feature_kebab": "admin-summary" },
    { "scenario_id": "diff-2", "type": "playwright", "confidence": "low", "signals": [], "feature_kebab": "unknown" }
  ]
}
```

フィールド定義:

| フィールド | 値 | 用途 |
|-----------|-----|------|
| `version` | `"1"` 固定 | スキーマバージョン管理 |
| `generated_at` | ISO 8601 タイムスタンプ | Step 3 で判定を実施した時刻 |
| `scenarios[].scenario_id` | `nl-{n}`（自然言語由来）または `diff-{n}`（git diff 由来） | テストファイル名・コメント参照に使用 |
| `scenarios[].type` | `playwright` / `vitest` / `both` | 生成すべきテストランナーを指示 |
| `scenarios[].confidence` | `high` / `medium` / `low` | `low` は SKILL.md 側でユーザー確認に回す |
| `scenarios[].signals` | マッチしたシグナルの配列 | 判定根拠の表示・デバッグに使用 |
| `scenarios[].feature_kebab` | 小文字ケバブケース（`[a-z0-9-]` のみ）の機能名 | `output-format.md` の命名規約 `{scenario-id}-{feature-kebab}.test.ts` に使用 |

`type: both` の場合、Step 5 は Vitest ファイルと Playwright ファイルの両方を生成する（命名規約は `references/output-format.md` 参照）。

`confidence: low` のシナリオは、Step 5 に進む前に AskUserQuestion で以下を提示する:

- 「Playwright で生成」
- 「Vitest で生成」
- 「両方生成」
- 「その他（自由入力）」

## 関連ドキュメント

- **`input-routing.md`**: 入力種別（git diff/自然言語）の判定木。判定アルゴリズムへの入力前段
- **`test-patterns.md`**: Vitest/Playwright 標準テンプレート集。判定結果の `type` ごとに使用するテンプレートが分かれる
- **`output-format.md`**: 生成テストファイルの命名・配置規約。`scenario_id` と `type` からファイル名を決定する規則を定義
