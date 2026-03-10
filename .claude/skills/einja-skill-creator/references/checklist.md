# Skill開発チェックリスト

Anthropic公式ガイド準拠の4フェーズチェックリスト。

## フェーズ1: 開始前

- [ ] Skillの目的と対象ユーザーを明確化した
- [ ] 既存Skillと重複しないことを確認した
- [ ] 必要なMCPサーバー・ツールを特定した
- [ ] 成功基準（定量/定性）を定義した

## フェーズ2: 開発中

- [ ] YAML Frontmatterが有効（name, description必須）
- [ ] nameがケバブケース、64文字以内
- [ ] nameに"claude"/"anthropic"を含まない
- [ ] descriptionが3要素公式に従っている: [What] + [When] + [Key capabilities]
- [ ] ネガティブトリガー（Do NOT use for）を記述した
- [ ] ファイルタイプ対象のSkillなら拡張子をdescriptionに含めた
- [ ] SKILL.md本文が500行以内（超える場合はreferencesに分割）
- [ ] 段階的開示（3レベル）を活用している
- [ ] 指示は命令形で記述している
- [ ] 出力フォーマットを明示的に定義した
- [ ] 具体例を含めた
- [ ] Troubleshootingセクションを含めた
- [ ] 参考ドキュメントをHTMLコメントで記録した

## フェーズ3: テスト前

- [ ] テストケースが3エリアをカバーしている:
  - [ ] Triggering: 正しいトリガー / 誤トリガー防止
  - [ ] Functional: Given-When-Then形式の機能テスト
  - [ ] Performance comparison: Skillなしとの比較
- [ ] 2-3個以上のリアルなテストプロンプトを作成した
- [ ] evals/evals.jsonにテストケースを保存した
- [ ] アサーションが客観的に検証可能

## フェーズ4: テスト後

- [ ] トリガー率が90%以上
- [ ] ベースライン（Skillなし）と比較して改善されている
- [ ] 偽陽性（意図しないトリガー）がない
- [ ] 出力品質がセッション間で一貫している
- [ ] ユーザーフィードバックを反映した
- [ ] Description最適化ループを実行した（必要に応じて）
- [ ] `quick_validate.py`でエラーがないことを確認した
