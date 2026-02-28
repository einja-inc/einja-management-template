# JSONスキーマ

このドキュメントはskill-creatorで使用されるJSONスキーマを定義する。

---

## evals.json

スキルの評価テストケースを定義する。スキルディレクトリ内の`evals/evals.json`に配置。

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "ユーザーのサンプルプロンプト",
      "expected_output": "期待される結果の説明",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "出力にXが含まれている",
        "スキルがスクリプトYを使用した"
      ]
    }
  ]
}
```

**フィールド:**
- `skill_name`: スキルのフロントマターと一致する名前
- `evals[].id`: 一意の整数識別子
- `evals[].prompt`: 実行するタスク
- `evals[].expected_output`: 成功を表す人間が読める説明
- `evals[].files`: 入力ファイルパスのオプションリスト（スキルルートからの相対パス）
- `evals[].expectations`: 検証可能な記述のリスト

---

## history.json

改善モードでのバージョン進行を追跡する。ワークスペースルートに配置。

```json
{
  "started_at": "2026-01-15T10:30:00Z",
  "skill_name": "pdf",
  "current_best": "v2",
  "iterations": [
    {
      "version": "v0",
      "parent": null,
      "expectation_pass_rate": 0.65,
      "grading_result": "baseline",
      "is_current_best": false
    },
    {
      "version": "v1",
      "parent": "v0",
      "expectation_pass_rate": 0.75,
      "grading_result": "won",
      "is_current_best": false
    },
    {
      "version": "v2",
      "parent": "v1",
      "expectation_pass_rate": 0.85,
      "grading_result": "won",
      "is_current_best": true
    }
  ]
}
```

**フィールド:**
- `started_at`: 改善開始のISOタイムスタンプ
- `skill_name`: 改善対象のスキル名
- `current_best`: 最高パフォーマンスのバージョン識別子
- `iterations[].version`: バージョン識別子（v0、v1、...）
- `iterations[].parent`: 派生元の親バージョン
- `iterations[].expectation_pass_rate`: 採点からのパス率
- `iterations[].grading_result`: "baseline"、"won"、"lost"、または"tie"
- `iterations[].is_current_best`: 現在の最良バージョンかどうか

---

## grading.json

採点エージェントの出力。`<run-dir>/grading.json`に配置。

```json
{
  "expectations": [
    {
      "text": "出力に'John Smith'という名前が含まれている",
      "passed": true,
      "evidence": "トランスクリプトのステップ3で発見: 'Extracted names: John Smith, Sarah Johnson'"
    },
    {
      "text": "スプレッドシートのセルB10にSUM数式がある",
      "passed": false,
      "evidence": "スプレッドシートが作成されなかった。出力はテキストファイルだった。"
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  },
  "execution_metrics": {
    "tool_calls": {
      "Read": 5,
      "Write": 2,
      "Bash": 8
    },
    "total_tool_calls": 15,
    "total_steps": 6,
    "errors_encountered": 0,
    "output_chars": 12450,
    "transcript_chars": 3200
  },
  "timing": {
    "executor_duration_seconds": 165.0,
    "grader_duration_seconds": 26.0,
    "total_duration_seconds": 191.0
  },
  "claims": [
    {
      "claim": "フォームに12個の入力可能フィールドがある",
      "type": "factual",
      "verified": true,
      "evidence": "field_info.jsonで12フィールドを確認"
    }
  ],
  "user_notes_summary": {
    "uncertainties": ["2023年のデータを使用、古い可能性がある"],
    "needs_review": [],
    "workarounds": ["入力不可フィールドにテキストオーバーレイで代替"]
  },
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "出力に'John Smith'という名前が含まれている",
        "reason": "名前に言及する幻覚ドキュメントでもパスしてしまう"
      }
    ],
    "overall": "アサーションは存在のみをチェックし、正確性をチェックしていない。"
  }
}
```

**フィールド:**
- `expectations[]`: 根拠付きの採点済み期待値
- `summary`: パス/フェイルの集計カウント
- `execution_metrics`: ツール使用量と出力サイズ（エグゼキューターのmetrics.jsonから）
- `timing`: 実行時間（timing.jsonから）
- `claims`: 出力から抽出・検証されたクレーム
- `user_notes_summary`: エグゼキューターがフラグした問題
- `eval_feedback`:（オプション）評価の改善提案。採点エージェントが指摘すべき問題を特定した場合のみ存在

---

## metrics.json

エグゼキューターエージェントの出力。`<run-dir>/outputs/metrics.json`に配置。

```json
{
  "tool_calls": {
    "Read": 5,
    "Write": 2,
    "Bash": 8,
    "Edit": 1,
    "Glob": 2,
    "Grep": 0
  },
  "total_tool_calls": 18,
  "total_steps": 6,
  "files_created": ["filled_form.pdf", "field_values.json"],
  "errors_encountered": 0,
  "output_chars": 12450,
  "transcript_chars": 3200
}
```

**フィールド:**
- `tool_calls`: ツールタイプごとのカウント
- `total_tool_calls`: 全ツール呼び出しの合計
- `total_steps`: 主要な実行ステップの数
- `files_created`: 作成された出力ファイルのリスト
- `errors_encountered`: 実行中のエラー数
- `output_chars`: 出力ファイルの合計文字数
- `transcript_chars`: トランスクリプトの文字数

---

## timing.json

実行の経過時間。`<run-dir>/timing.json`に配置。

**キャプチャ方法:** サブエージェントタスクが完了すると、タスク通知に`total_tokens`と`duration_ms`が含まれる。これらは他の場所に永続化されず、事後に復元できないため、即座に保存すること。

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3,
  "executor_start": "2026-01-15T10:30:00Z",
  "executor_end": "2026-01-15T10:32:45Z",
  "executor_duration_seconds": 165.0,
  "grader_start": "2026-01-15T10:32:46Z",
  "grader_end": "2026-01-15T10:33:12Z",
  "grader_duration_seconds": 26.0
}
```

---

## benchmark.json

ベンチマークモードの出力。`benchmarks/<timestamp>/benchmark.json`に配置。

```json
{
  "metadata": {
    "skill_name": "pdf",
    "skill_path": "/path/to/pdf",
    "executor_model": "claude-sonnet-4-20250514",
    "analyzer_model": "most-capable-model",
    "timestamp": "2026-01-15T10:30:00Z",
    "evals_run": [1, 2, 3],
    "runs_per_configuration": 3
  },

  "runs": [
    {
      "eval_id": 1,
      "eval_name": "Ocean",
      "configuration": "with_skill",
      "run_number": 1,
      "result": {
        "pass_rate": 0.85,
        "passed": 6,
        "failed": 1,
        "total": 7,
        "time_seconds": 42.5,
        "tokens": 3800,
        "tool_calls": 18,
        "errors": 0
      },
      "expectations": [
        {"text": "...", "passed": true, "evidence": "..."}
      ],
      "notes": [
        "2023年のデータを使用、古い可能性がある",
        "入力不可フィールドにテキストオーバーレイで代替"
      ]
    }
  ],

  "run_summary": {
    "with_skill": {
      "pass_rate": {"mean": 0.85, "stddev": 0.05, "min": 0.80, "max": 0.90},
      "time_seconds": {"mean": 45.0, "stddev": 12.0, "min": 32.0, "max": 58.0},
      "tokens": {"mean": 3800, "stddev": 400, "min": 3200, "max": 4100}
    },
    "without_skill": {
      "pass_rate": {"mean": 0.35, "stddev": 0.08, "min": 0.28, "max": 0.45},
      "time_seconds": {"mean": 32.0, "stddev": 8.0, "min": 24.0, "max": 42.0},
      "tokens": {"mean": 2100, "stddev": 300, "min": 1800, "max": 2500}
    },
    "delta": {
      "pass_rate": "+0.50",
      "time_seconds": "+13.0",
      "tokens": "+1700"
    }
  },

  "notes": [
    "アサーション '出力はPDFファイルである' は両構成で100%パス - スキルの価値を区別しない可能性",
    "評価3が高いばらつきを示す（50% ± 40%） - 不安定またはモデル依存の可能性",
    "スキルなし実行はテーブル抽出の期待値で一貫して失敗",
    "スキルは平均13秒の実行時間増加だが、パス率を50%改善"
  ]
}
```

**フィールド:**
- `metadata`: ベンチマーク実行に関する情報
  - `skill_name`: スキル名
  - `timestamp`: ベンチマーク実行日時
  - `evals_run`: 評価名またはIDのリスト
  - `runs_per_configuration`: 構成ごとの実行回数（例: 3）
- `runs[]`: 個別の実行結果
  - `eval_id`: 数値の評価識別子
  - `eval_name`: 人間が読める評価名（ビューアーのセクションヘッダーとして使用）
  - `configuration`: `"with_skill"`または`"without_skill"`でなければならない（ビューアーはこの正確な文字列をグルーピングとカラーコーディングに使用）
  - `run_number`: 整数の実行番号（1、2、3...）
  - `result`: `pass_rate`、`passed`、`total`、`time_seconds`、`tokens`、`errors`を含むネストされたオブジェクト
- `run_summary`: 構成ごとの統計集計
  - `with_skill` / `without_skill`: それぞれ`pass_rate`、`time_seconds`、`tokens`オブジェクトを含み、`mean`と`stddev`フィールドを持つ
  - `delta`: `"+0.50"`、`"+13.0"`、`"+1700"`のような差分文字列
- `notes`: 分析エージェントからのフリーフォーム観察

**重要:** ビューアーはこれらのフィールド名を正確に読み取る。`configuration`の代わりに`config`を使用したり、`pass_rate`を`result`内ではなく実行のトップレベルに配置したりすると、ビューアーは空/ゼロの値を表示する。benchmark.jsonを手動で生成する際は常にこのスキーマを参照すること。

---

## comparison.json

ブラインド比較エージェントの出力。`<grading-dir>/comparison-N.json`に配置。

```json
{
  "winner": "A",
  "reasoning": "出力Aは適切なフォーマットとすべての必須フィールドを備えた完全なソリューションを提供している。出力Bは日付フィールドが欠落しており、フォーマットに不一致がある。",
  "rubric": {
    "A": {
      "content": {
        "correctness": 5,
        "completeness": 5,
        "accuracy": 4
      },
      "structure": {
        "organization": 4,
        "formatting": 5,
        "usability": 4
      },
      "content_score": 4.7,
      "structure_score": 4.3,
      "overall_score": 9.0
    },
    "B": {
      "content": {
        "correctness": 3,
        "completeness": 2,
        "accuracy": 3
      },
      "structure": {
        "organization": 3,
        "formatting": 2,
        "usability": 3
      },
      "content_score": 2.7,
      "structure_score": 2.7,
      "overall_score": 5.4
    }
  },
  "output_quality": {
    "A": {
      "score": 9,
      "strengths": ["完全なソリューション", "適切なフォーマット", "すべてのフィールドが存在"],
      "weaknesses": ["ヘッダーに軽微なスタイル不一致"]
    },
    "B": {
      "score": 5,
      "strengths": ["読みやすい出力", "基本構造が正しい"],
      "weaknesses": ["日付フィールドの欠落", "フォーマットの不一致", "部分的なデータ抽出"]
    }
  },
  "expectation_results": {
    "A": {
      "passed": 4,
      "total": 5,
      "pass_rate": 0.80,
      "details": [
        {"text": "出力に名前が含まれている", "passed": true}
      ]
    },
    "B": {
      "passed": 3,
      "total": 5,
      "pass_rate": 0.60,
      "details": [
        {"text": "出力に名前が含まれている", "passed": true}
      ]
    }
  }
}
```

---

## analysis.json

事後分析エージェントの出力。`<grading-dir>/analysis.json`に配置。

```json
{
  "comparison_summary": {
    "winner": "A",
    "winner_skill": "path/to/winner/skill",
    "loser_skill": "path/to/loser/skill",
    "comparator_reasoning": "比較エージェントが勝者を選んだ理由の要約"
  },
  "winner_strengths": [
    "複数ページのドキュメント処理に対する明確なステップバイステップの指示",
    "フォーマットエラーを検出する検証スクリプトを含む"
  ],
  "loser_weaknesses": [
    "曖昧な指示「ドキュメントを適切に処理」が一貫性のない動作につながった",
    "検証スクリプトがなく、エージェントが即興で対応"
  ],
  "instruction_following": {
    "winner": {
      "score": 9,
      "issues": ["軽微: オプションのログ記録ステップをスキップ"]
    },
    "loser": {
      "score": 6,
      "issues": [
        "スキルのフォーマットテンプレートを使用しなかった",
        "ステップ3に従わず独自のアプローチを考案した"
      ]
    }
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "「ドキュメントを適切に処理」を明示的なステップに置き換え",
      "expected_impact": "一貫性のない動作を引き起こした曖昧さを排除"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "スキルを読む -> 5ステッププロセスに従う -> 検証スクリプトを使用",
    "loser_execution_pattern": "スキルを読む -> アプローチが不明確 -> 3つの異なる方法を試す"
  }
}
```
