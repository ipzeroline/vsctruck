#!/bin/sh
set -eu

DOMAIN="${1:-vsctruck.com}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -f ".env.local" ]; then
  echo "Missing .env.local"
  exit 1
fi

set -a
. ./.env.local
set +a

if [ -z "${REPORT_CRON_SECRET:-}" ]; then
  echo "Missing REPORT_CRON_SECRET"
  exit 1
fi

echo "Testing audit snapshot endpoint..."
curl -i -sS -X POST "https://$DOMAIN/api/audit?secret=${REPORT_CRON_SECRET}"

echo
echo "Testing daily report endpoint without sending Telegram..."
curl -i -sS -X POST "https://$DOMAIN/api/report/run?send=0&secret=${REPORT_CRON_SECRET}"
