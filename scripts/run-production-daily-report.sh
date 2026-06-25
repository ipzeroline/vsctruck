#!/bin/sh
set -eu

DOMAIN="${1:-vsctruck.com}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
LOG_FILE="$LOG_DIR/server-daily-report.log"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

if [ ! -f "$ROOT_DIR/.env.local" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] missing .env.local" >> "$LOG_FILE"
  exit 1
fi

set -a
. "$ROOT_DIR/.env.local"
set +a

{
  echo
  echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] daily report"
  curl -sS -w "\nHTTP_STATUS=%{http_code}\n" -X POST "https://$DOMAIN/api/report/run?send=1&secret=${REPORT_CRON_SECRET}"
} >> "$LOG_FILE" 2>&1
