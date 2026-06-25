# VSCTruck Cron Setup

เป้าหมายของ cron คือเก็บ `vehicle_status_snapshots` และ `fuel_snapshots` ให้ต่อเนื่องพอสำหรับตรวจ:

- น้ำมันก่อนสตาร์ทรถ
- น้ำมันก่อน/หลังเติมจริง
- รถวิ่งแต่ไม่มีคนขับ
- GPS/fuel sensor ผิดปกติ
- Driver Audit cases

## Recommended Schedule

สำหรับงานรถที่เริ่มประมาณ 07:00 ให้เก็บ snapshot ตั้งแต่ 05:00 เพื่อให้มีข้อมูลก่อน `firstIgnitionOn`
สำหรับ production แนะนำให้ละเอียดเฉพาะช่วงทำงานหลัก โดยใช้ทุก 2 นาทีเพื่อจับเติมน้ำมันได้ทันและไม่กด Cartrack API ถี่เกินไป

```cron
SHELL=/bin/sh
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# ก่อนเริ่มงาน: เก็บน้ำมันตั้งต้นทุก 5 นาที
*/5 5-6 * * * /bin/sh /Users/zeroline/Documents/vsctruck/scripts/run-snapshot-sync.sh

# ช่วงทำงานหลัก: เก็บทุก 2 นาที
*/2 7-17 * * * /bin/sh /Users/zeroline/Documents/vsctruck/scripts/run-snapshot-sync.sh

# หลังเลิกงาน: ปิดรอบทุก 5 นาที
*/5 18-20 * * * /bin/sh /Users/zeroline/Documents/vsctruck/scripts/run-snapshot-sync.sh

# ส่งรายงาน Telegram ทุกวัน 18:00
0 18 * * * /bin/sh /Users/zeroline/Documents/vsctruck/scripts/run-daily-report.sh
```

ถ้ารถเริ่มออกก่อน 06:00 ให้เพิ่มช่วงก่อนเริ่มงานเป็น `*/5 4-6 * * *`

## Install On macOS

เปิด crontab:

```bash
crontab -e
```

วาง schedule ด้านบนแล้วบันทึก

ตรวจ cron ที่ติดตั้งแล้ว:

```bash
crontab -l
```

## Test Manually

รัน snapshot sync หนึ่งรอบ:

```bash
npm run cron:snapshot
```

รันส่งรายงานหนึ่งรอบ:

```bash
npm run cron:daily-report
```

ดู log:

```bash
tail -f logs/snapshot-sync.log
tail -f logs/daily-report.log
```

## Production Server: vsctruck.com

บน server จริงให้ใช้ cron แบบยิง production endpoint ผ่าน HTTPS:

```bash
npm run cron:install:production
```

คำสั่งนี้จะติดตั้ง block นี้ใน `crontab` โดยอัตโนมัติ:

```cron
*/5 5-6 * * * curl -sS -X POST "https://vsctruck.com/api/audit?secret=..."
*/2 7-17 * * * curl -sS -X POST "https://vsctruck.com/api/audit?secret=..."
*/5 18-20 * * * curl -sS -X POST "https://vsctruck.com/api/audit?secret=..."
0 18 * * * curl -fsS -X POST "https://vsctruck.com/api/report/run?send=1&secret=..."
```

ตัว installer จะไม่เขียน secret ลง repo แต่จะอ่าน `REPORT_CRON_SECRET` จาก `.env.local` ตอน cron ทำงาน

ตรวจ cron บน server:

```bash
crontab -l
systemctl status cron --no-pager
```

ดู log production:

```bash
tail -f logs/server-snapshot-sync.log
tail -f logs/server-daily-report.log
```

ทดสอบ endpoint production หนึ่งรอบ:

```bash
npm run cron:test:production
```

หรือ debug เฉพาะ audit endpoint:

```bash
set -a && . ./.env.local && set +a
curl -i -sS -X POST "https://vsctruck.com/api/audit?secret=${REPORT_CRON_SECRET}"
```

อย่าใช้ `curl -f` ตอน debug เพราะมันจะซ่อน JSON error body ของ API และเห็นแค่ `curl: (22) ... 500`

บน Ubuntu ห้ามใช้ `/bin/sh -lc` ใน crontab เพราะ `/bin/sh` มักเป็น `dash` และไม่รองรับ `-l`
ตัว installer ใช้ `/bin/sh -c` พร้อม `flock` เพื่อกัน job ซ้อน ถ้า API รอบก่อนหน้ายังไม่จบ

## Accuracy Rules

ระบบจะรู้ “น้ำมันก่อนสตาร์ท” ได้เมื่อมี snapshot ก่อนเวลา `firstIgnitionOn`

- High confidence: snapshot ก่อนสตาร์ทไม่เกิน 15 นาที
- Medium confidence: snapshot ใกล้เวลา แต่ไม่ครบช่วงก่อนสตาร์ท
- Low confidence: มี snapshot หลังสตาร์ทเท่านั้น
- No data: ไม่มี snapshot ของทะเบียนนั้นในวันนั้น

สำหรับรถ `0704777` ที่เติมจริงเกือบ 100 ลิตร แต่ sensor เห็นเพิ่ม 6 ลิตร สาเหตุคือ snapshot เริ่มหลังเหตุการณ์สำคัญไปแล้ว cron ทุก 2 นาทีในช่วงทำงานหลักตั้งแต่ก่อนเติมจะทำให้ระบบจับช่วงก่อนเติม/หลังเติมได้แม่นขึ้น

## Fuel Storage Model

ระบบเก็บข้อมูลน้ำมันเป็น 3 ระดับ:

- `fuel_snapshots`: ข้อมูลดิบจาก Cartrack ทุกครั้งที่ cron ยิง เช่น น้ำมันคงเหลือ, เวลา, ทะเบียน, คนขับ, odometer, ตำแหน่ง
- `fuel_detected_refills`: เหตุการณ์เติมน้ำมันที่ระบบตรวจพบจาก sensor เช่น ก่อนเติม 50 ลิตร หลังเติม 150 ลิตร เพิ่มขึ้น 100 ลิตร
- `fuel_actual_refills`: ยอดเติมจริงจากใบเสร็จหรือคนกรอก เพื่อเทียบกับ sensor

กติกาตรวจเติมจาก sensor:

- ต้องมี fuel level เพิ่มขึ้นอย่างน้อย `10 ลิตร`
- ยอมให้ sensor แกว่งได้ `3 ลิตร`
- ใช้ `eventKey = labelDate + registration + beforeTime` เพื่อป้องกัน cron สร้างข้อมูลซ้ำ
- ถ้า cron ยิงซ้ำระหว่างเติม ระบบจะ update event เดิม ไม่ insert ซ้ำ
