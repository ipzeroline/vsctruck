# MongoDB Retention Policy

ระบบใช้ TTL indexes ให้ MongoDB ลบข้อมูลเก่าอัตโนมัติ โดยแบ่งข้อมูลตามมูลค่าทางธุรกิจและขนาดข้อมูล

| Collection | Default | เหตุผล |
| --- | ---: | --- |
| `fuel_snapshots` | 90 วัน | raw snapshot ถี่ ใช้ตรวจน้ำมันช่วงล่าสุดและ fallback dashboard |
| `vehicle_status_snapshots` | 90 วัน | raw snapshot ถี่ ใช้ดูตำแหน่ง/สถานะล่าสุดและ audit ระยะสั้น |
| `fuel_detected_refills` | 730 วัน | event เติมน้ำมันจาก sensor เป็นหลักฐานตรวจสอบย้อนหลัง |
| `reports` | 730 วัน | daily report ใช้อ้างอิงการปฏิบัติงานและรายงานย้อนหลัง |
| `driver_daily_audits` | 1095 วัน | audit summary ใช้ตรวจสอบพฤติกรรมพนักงานระยะยาว |
| `driver_audit_cases` | 1095 วัน | exception cases เป็นหลักฐานการสอบทาน |
| `fuel_actual_refills` | 1095 วัน | ยอดเติมจริง/ใบเสร็จ ใช้ reconcile กับ sensor |
| `staff` | ไม่ลบอัตโนมัติ | ข้อมูลผู้ใช้ระบบ ต้องจัดการโดย admin |

## Environment Variables

```bash
MONGODB_RETENTION_RAW_SNAPSHOT_DAYS=90
MONGODB_RETENTION_DETECTED_FUEL_DAYS=730
MONGODB_RETENTION_REPORT_DAYS=730
MONGODB_RETENTION_AUDIT_DAYS=1095
MONGODB_RETENTION_ACTUAL_FUEL_DAYS=1095
```

หลังเปลี่ยนค่า retention ให้ restart app เพื่อให้ `ensureMongoIndexes()` สร้าง/อัปเดต TTL index ตามค่าใหม่

```bash
npm run build
pm2 restart vsctruck --update-env
```

ตรวจ TTL indexes:

```bash
mongosh "$MONGODB_URI" --eval '
db = db.getSiblingDB(process.env.MONGODB_DB || "vscbot");
for (const name of ["fuel_snapshots","vehicle_status_snapshots","fuel_detected_refills","reports","driver_daily_audits","driver_audit_cases","fuel_actual_refills"]) {
  print("\\n" + name);
  printjson(db.getCollection(name).getIndexes().filter((item) => item.expireAfterSeconds));
}
'
```

หมายเหตุ: MongoDB TTL monitor ไม่ลบทันทีแบบ real-time โดยปกติจะตรวจเป็นรอบ จึงอาจเห็นข้อมูลเก่าเกิน policy ได้ช่วงสั้น ๆ
