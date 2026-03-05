# Plan: ensure-serena.sh の既存インスタンス判定を厳密化

## Context

`ensure-serena.sh` の既存インスタンスチェック（L11-16）は `.serena-port` に記録されたPIDの生存のみを `kill -0` で確認している。
しかし以下のケースで **別プロジェクトのSerenaに誤接続** する問題がある：

1. 自プロジェクトのSerenaがクラッシュ（PID死亡）
2. 別プロジェクトのSerenaが同じポートを取得
3. 次回 `direnv reload` 時、PIDリサイクルで `kill -0` が成功 → 別プロジェクトのSerenaに接続

**根本原因**: PID生存だけでは「そのPIDが記録されたポートを実際にLISTENしているか」が判定できない。

## 変更内容

### TODO-1: 既存インスタンスチェックに PID×ポート検証を追加

**ファイル**: `scripts/ensure-serena.sh` L11-16

**現在のコード**:
```bash
if [ -f "$_SERENA_PORT_FILE" ]; then
  read -r _saved_port _saved_pid < "$_SERENA_PORT_FILE"
  if [ -n "$_saved_pid" ] && kill -0 "$_saved_pid" 2>/dev/null; then
    # PIDが生存 → 自プロジェクトのSerena
    export SERENA_PORT="$_saved_port"
    return 0 2>/dev/null || true
  fi
  # PID死亡 → クリーンアップ
  rm -f "$_SERENA_PORT_FILE"
fi
```

**修正後**:
```bash
if [ -f "$_SERENA_PORT_FILE" ]; then
  read -r _saved_port _saved_pid < "$_SERENA_PORT_FILE"
  if [ -n "$_saved_pid" ] && kill -0 "$_saved_pid" 2>/dev/null \
     && ps -ww -o command= -p "$_saved_pid" 2>/dev/null | grep -q "serena start-mcp-server.*--project ${_SERENA_BASE}"; then
    # PIDが生存 かつ 自プロジェクトのSerenaプロセス → 再利用
    export SERENA_PORT="$_saved_port"
    return 0 2>/dev/null || true
  fi
  # PID死亡 or 別プロセス/別プロジェクトのSerena → クリーンアップ
  rm -f "$_SERENA_PORT_FILE"
fi
```

**判定ロジック**: `kill -0`（PID生存） AND `ps`（そのPIDのコマンドラインに `serena start-mcp-server` + `--project <自プロジェクトパス>` が含まれる）の両方を満たす場合のみ、自プロジェクトのSerenaと判定する。

**`lsof` ではなく `ps` を採用した理由**（Codexレビュー指摘）:
- `lsof` はLinuxで未導入のディストロがある。フォールバックが必要になり複雑化する
- `ps` はPOSIX標準でmacOS/Linux両方で利用可能
- `ps` ならプロセス名だけでなく `--project` 引数まで確認でき、「自プロジェクトのSerenaか」を厳密に判定できる

## 検証

1. `source scripts/ensure-serena.sh` で正常起動を確認
2. 再度 `source` して既存インスタンスが再利用されることを確認
3. `.serena-port` のPIDを偽の値に書き換え → 再起動が走ることを確認
