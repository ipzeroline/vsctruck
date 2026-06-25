#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] starting daily report"
  cd "$ROOT_DIR"
  npm run report:send
  echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] daily report completed"
} >> "$LOG_DIR/daily-report.log" 2>&1
