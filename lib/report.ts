import {
  CartrackClient,
  Driver,
  FuelSummary,
  VehicleActivity,
  VehicleDriverLink,
  getActivityDriverNames,
  getDriverIdFromVehicle,
  getDriverName,
  getLinkDriverName,
  getRegistration,
} from "./cartrack";
import { getConfig } from "./config";
import { formatDate, formatNumber, formatTime, getBangkokReportWindow } from "./time";

export type DailyReport = {
  text: string;
  vehicleCount: number;
  fuelAvailableCount: number;
  summary: {
    totalDistanceKm: number;
    totalFuelLiters: number;
    missingFuelCount: number;
  };
  window: {
    labelDate: string;
    startTimestamp: string;
    endTimestamp: string;
  };
  rows: DailyReportRow[];
};

export type DailyReportRow = {
  registration: string;
  driverName: string;
  reportDate: string;
  firstIgnitionOn: string | null;
  lastIgnitionOff: string | null;
  distanceKm: number | null;
  fuelUsedLiters: number | null;
};

export async function buildDailyReport(): Promise<DailyReport> {
  const config = getConfig();
  const client = new CartrackClient(config);
  const window = getBangkokReportWindow(new Date(), config.reportTimezone);

  const reportDate = window.startTimestamp.slice(0, 10);
  const [vehicles, drivers, activities, driverLinks] = await Promise.all([
    client.getVehicles(config.reportMaxVehicles),
    client.getDrivers(config.reportMaxVehicles),
    client.getVehiclesActivity(reportDate, config.reportMaxVehicles),
    client.getVehicleDriverLinks(config.reportMaxVehicles),
  ]);

  const driverMap = new Map<string, Driver>();
  for (const driver of drivers) {
    const id = driver.driver_id ?? driver.id;
    if (id) {
      driverMap.set(String(id), driver);
    }
  }

  const activityMap = new Map<string, VehicleActivity>();
  for (const activity of activities) {
    const registration = getRegistration(activity);
    if (registration) {
      activityMap.set(registration, activity);
    }
  }

  const linkMap = new Map<string, VehicleDriverLink>();
  for (const link of driverLinks) {
    const registration = getRegistration(link);
    if (registration) {
      linkMap.set(registration, link);
    }
  }

  const registrations = vehicles.map(getRegistration).filter((value): value is string => Boolean(value));
  const fuelMap = new Map<string, FuelSummary>();

  for (const batch of chunk(registrations, 100)) {
    const rows = await client.getFuelLevels(batch, window.startTimestamp, window.endTimestamp);
    for (const row of rows) {
      fuelMap.set(row.registration, row);
    }
  }

  const rows = await Promise.all(
    vehicles.map(async (vehicle) => {
      const registration = getRegistration(vehicle);
      if (!registration) {
        return null;
      }

      const odometer = await client.getOdometer(registration, window.startTimestamp, window.endTimestamp);
      const activity = activityMap.get(registration);
      const driverId = getDriverIdFromVehicle(vehicle);
      const activityDriverName = getActivityDriverNames(activity);
      const linkedDriverName = getLinkDriverName(linkMap.get(registration));
      const defaultDriverName = driverId ? getDriverName(driverMap.get(driverId)) : "-";
      const driverName = firstKnownName(activityDriverName, linkedDriverName, defaultDriverName);
      const fuel = fuelMap.get(registration);

      return {
        registration,
        driverName,
        reportDate: formatDate(reportDate),
        firstIgnitionOn: formatTime(activity?.first_ignition_on),
        lastIgnitionOff: formatTime(activity?.last_ignition_off),
        distanceKm: odometer.distanceKm,
        fuelUsedLiters: fuel?.fuelUsedLiters ?? null,
      } satisfies DailyReportRow;
    }),
  );

  const validRows = rows.filter((row): row is NonNullable<typeof row> => {
    if (!row) {
      return false;
    }

    return hasReportableVehicleData(row);
  });
  const totalDistance = validRows.reduce((sum, row) => sum + (row.distanceKm ?? 0), 0);
  const totalFuel = validRows.reduce((sum, row) => sum + (row.fuelUsedLiters ?? 0), 0);
  const fuelAvailableCount = validRows.filter((row) => typeof row.fuelUsedLiters === "number").length;

  return {
    text: buildTelegramReportText(validRows, {
      labelDate: window.labelDate,
      startTimestamp: window.startTimestamp,
      endTimestamp: window.endTimestamp,
      totalDistance,
      totalFuel,
      fuelAvailableCount,
    }),
    vehicleCount: validRows.length,
    fuelAvailableCount,
    summary: {
      totalDistanceKm: totalDistance,
      totalFuelLiters: totalFuel,
      missingFuelCount: validRows.length - fuelAvailableCount,
    },
    window,
    rows: validRows,
  };
}

function buildTelegramReportText(
  rows: DailyReportRow[],
  summary: {
    labelDate: string;
    startTimestamp: string;
    endTimestamp: string;
    totalDistance: number;
    totalFuel: number;
    fuelAvailableCount: number;
  },
): string {
  const sortedRows = [...rows].sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
  const missingFuelCount = rows.length - summary.fuelAvailableCount;
  const averageDistance = rows.length === 0 ? 0 : summary.totalDistance / rows.length;
  const fuelEfficiency =
    summary.totalDistance > 0 && summary.fuelAvailableCount > 0
      ? (summary.totalFuel / summary.totalDistance) * 100
      : null;

  return [
    "VSCTruck Daily Fleet Report",
    `ประจำวันที่ ${summary.labelDate}`,
    `ช่วงเวลา ${formatTime(summary.startTimestamp)} - ${formatTime(summary.endTimestamp)} น.`,
    "━━━━━━━━━━━━━━━━━━━━",
    "สรุปภาพรวม",
    `รถที่มีข้อมูล: ${rows.length} คัน`,
    `ระยะทางรวม: ${formatNumber(summary.totalDistance)} กม.`,
    `ระยะทางเฉลี่ย: ${formatNumber(averageDistance)} กม./คัน`,
    `น้ำมันรวม: ${
      summary.fuelAvailableCount > 0 ? `${formatNumber(summary.totalFuel)} ลิตร` : "ไม่พบข้อมูล fuel sensor"
    }`,
    `อัตราสิ้นเปลืองเฉลี่ย: ${fuelEfficiency === null ? "-" : `${formatNumber(fuelEfficiency)} ลิตร/100 กม.`}`,
    missingFuelCount > 0 ? `รถไม่มีข้อมูลน้ำมัน: ${missingFuelCount} คัน` : "ข้อมูลน้ำมันครบทุกคันที่รายงาน",
    "━━━━━━━━━━━━━━━━━━━━",
    "รายละเอียดรายคัน",
    ...sortedRows.map((row, index) =>
      [
        `${index + 1}. ${row.registration} | ${row.driverName}`,
        `   เวลา: ${formatReportTime(row.firstIgnitionOn)} - ${formatReportTime(row.lastIgnitionOff)}`,
        `   ระยะทาง: ${formatNumber(row.distanceKm)} กม. | น้ำมัน: ${formatFuel(row.fuelUsedLiters)}`,
        `   ประสิทธิภาพ: ${formatEfficiency(row)}`,
      ].join("\n"),
    ),
    "━━━━━━━━━━━━━━━━━━━━",
    "หมายเหตุ: รายงานนี้แสดงเฉพาะรถที่มีข้อมูลการใช้งานจริงในรอบวัน",
  ].join("\n");
}

function firstKnownName(...names: string[]): string {
  return names.find((name) => name && name !== "-") ?? "-";
}

function hasReportableVehicleData(row: DailyReportRow): boolean {
  const hasDistance = typeof row.distanceKm === "number" && row.distanceKm > 0;
  const hasFuel = typeof row.fuelUsedLiters === "number";
  const hasIgnition = Boolean(
    (row.firstIgnitionOn && row.firstIgnitionOn !== "-") || (row.lastIgnitionOff && row.lastIgnitionOff !== "-"),
  );

  return hasDistance || hasFuel || hasIgnition;
}

function formatReportTime(value: string | null) {
  return value && value !== "-" ? value : "-";
}

function formatFuel(value: number | null) {
  return value === null ? "ไม่พบข้อมูล" : `${formatNumber(value)} ลิตร`;
}

function formatEfficiency(row: DailyReportRow) {
  if (!row.distanceKm || row.distanceKm <= 0 || row.fuelUsedLiters === null) {
    return "-";
  }
  return `${formatNumber((row.fuelUsedLiters / row.distanceKm) * 100)} ลิตร/100 กม.`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
