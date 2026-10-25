#!/usr/bin/env bash
# Supervisor botsw: hidup terus, restart otomatis kalau proses mati/crash.
# Single instance via flock. Stop: kill $(cat bot-sup.pid)
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCK="$BASE_DIR/bot.lock"
LOG="$BASE_DIR/bot.log"

# TLS lewat egress proxy MITM sandbox (jika ada)
if [ -f /usr/local/share/ca-certificates/hatch-egress-ca.crt ]; then
  export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/hatch-egress-ca.crt
fi
# Sanitasi no_proxy (entri IPv6 tanpa kurung siku merusak parsing di bbrp lib)
export NO_PROXY=localhost,127.0.0.1
export no_proxy=localhost,127.0.0.1

exec 9>"$LOCK"
if ! flock -n 9; then echo "botsw supervisor sudah jalan"; exit 0; fi

# Tulis pidfile HANYA setelah lock didapat.
echo $$ > "$BASE_DIR/bot-sup.pid"

CHILD=""
# WAJIB: kode bot pakai process.cwd() untuk settings.js, sessions/, react.json, dll.
cd "$BASE_DIR"

while true; do
  echo "[$(date -u +%FT%TZ)] supervisor: menjalankan bot..." >>"$LOG"
  stdbuf -o0 -e0 node "$BASE_DIR/index.js" 9>&- >>"$LOG" 2>&1 &
  CHILD=$!
  wait "$CHILD"
  code=$?
  CHILD=""
  echo "[$(date -u +%FT%TZ)] supervisor: bot keluar (code $code), restart 2 dtk..." >>"$LOG"
  sleep 2
done
