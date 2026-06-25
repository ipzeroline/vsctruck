#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] starting snapshot sync"
  cd "$ROOT_DIR"
  npm run audit:sync
  echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] snapshot sync completed"
} >> "$LOG_DIR/snapshot-sync.log" 2>&1
