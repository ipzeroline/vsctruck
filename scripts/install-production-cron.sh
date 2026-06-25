#!/bin/sh
set -eu

DOMAIN="${1:-vsctruck.com}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_FILE="$(mktemp)"

if [ ! -f "$ROOT_DIR/.env.local" ]; then
  echo "Missing $ROOT_DIR/.env.local"
  exit 1
fi

if ! grep -q "^REPORT_CRON_SECRET=" "$ROOT_DIR/.env.local"; then
  echo "Missing REPORT_CRON_SECRET in $ROOT_DIR/.env.local"
  exit 1
fi

crontab -l 2>/dev/null | awk '
  /# VSCTruck cron start/ { skip = 1; next }
  /# VSCTruck cron end/ { skip = 0; next }
  skip != 1 { print }
' > "$TMP_FILE"

cat >> "$TMP_FILE" <<CRON

# VSCTruck cron start
SHELL=/bin/sh
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# Snapshot sync: ก่อนเริ่มงานทุก 5 นาที เพื่อเก็บน้ำมันตั้งต้น
*/5 5-6 * * * flock -n /tmp/vsctruck-snapshot-sync.lock /bin/sh -c 'cd "$ROOT_DIR" && set -a && . ./.env.local && set +a && mkdir -p logs && printf "\n[%s] snapshot sync\n" "$(date "+\%Y-\%m-\%d \%H:\%M:\%S \%z")" >> logs/server-snapshot-sync.log && curl -sS -w "\nHTTP_STATUS=%{http_code}\n" -X POST "https://$DOMAIN/api/audit?secret=\${REPORT_CRON_SECRET}" >> logs/server-snapshot-sync.log 2>&1'

# Snapshot sync: ช่วงทำงานหลักทุก 2 นาที สำหรับจับเติมน้ำมันและสถานะรถ
*/2 7-17 * * * flock -n /tmp/vsctruck-snapshot-sync.lock /bin/sh -c 'cd "$ROOT_DIR" && set -a && . ./.env.local && set +a && mkdir -p logs && printf "\n[%s] snapshot sync\n" "$(date "+\%Y-\%m-\%d \%H:\%M:\%S \%z")" >> logs/server-snapshot-sync.log && curl -sS -w "\nHTTP_STATUS=%{http_code}\n" -X POST "https://$DOMAIN/api/audit?secret=\${REPORT_CRON_SECRET}" >> logs/server-snapshot-sync.log 2>&1'

# Snapshot sync: หลังเลิกงานทุก 5 นาที เพื่อปิดรอบและตรวจข้อมูลค้าง
*/5 18-20 * * * flock -n /tmp/vsctruck-snapshot-sync.lock /bin/sh -c 'cd "$ROOT_DIR" && set -a && . ./.env.local && set +a && mkdir -p logs && printf "\n[%s] snapshot sync\n" "$(date "+\%Y-\%m-\%d \%H:\%M:\%S \%z")" >> logs/server-snapshot-sync.log && curl -sS -w "\nHTTP_STATUS=%{http_code}\n" -X POST "https://$DOMAIN/api/audit?secret=\${REPORT_CRON_SECRET}" >> logs/server-snapshot-sync.log 2>&1'

# Daily Telegram report: ส่งรายงาน 18:00
0 18 * * * flock -n /tmp/vsctruck-daily-report.lock /bin/sh -c 'cd "$ROOT_DIR" && set -a && . ./.env.local && set +a && mkdir -p logs && printf "\n[%s] daily report\n" "$(date "+\%Y-\%m-\%d \%H:\%M:\%S \%z")" >> logs/server-daily-report.log && curl -sS -w "\nHTTP_STATUS=%{http_code}\n" -X POST "https://$DOMAIN/api/report/run?send=1&secret=\${REPORT_CRON_SECRET}" >> logs/server-daily-report.log 2>&1'
# VSCTruck cron end
CRON

crontab "$TMP_FILE"
rm -f "$TMP_FILE"

echo "Installed VSCTruck production cron for https://$DOMAIN"
echo "Check with: crontab -l"
echo "Logs:"
echo "  $ROOT_DIR/logs/server-snapshot-sync.log"
echo "  $ROOT_DIR/logs/server-daily-report.log"
