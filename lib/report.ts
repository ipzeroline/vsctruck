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

  const validRows = rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  const totalDistance = validRows.reduce((sum, row) => sum + (row.distanceKm ?? 0), 0);
  const totalFuel = validRows.reduce((sum, row) => sum + (row.fuelUsedLiters ?? 0), 0);
  const fuelAvailableCount = validRows.filter((row) => typeof row.fuelUsedLiters === "number").length;

  const lines = [
    `สรุปการใช้งานรถประจำวันที่ ${window.labelDate}`,
    `ช่วงเวลา: ${window.startTimestamp} - ${window.endTimestamp}`,
    "",
    `จำนวนรถ: ${validRows.length} คัน`,
    `ระยะทางรวม: ${formatNumber(totalDistance)} กม.`,
    `น้ำมันรวม: ${fuelAvailableCount > 0 ? `${formatNumber(totalFuel)} ลิตร` : "ไม่พบข้อมูล fuel sensor"}`,
    "",
    ...validRows.map((row, index) =>
      [
        `${index + 1}. ทะเบียน: ${row.registration}`,
        `   คนขับ: ${row.driverName}`,
        `   วันที่: ${row.reportDate}`,
        `   สตาร์ท: ${row.firstIgnitionOn ?? "-"} | ดับเครื่องล่าสุดของวัน: ${row.lastIgnitionOff ?? "-"}`,
        `   ระยะทาง: ${formatNumber(row.distanceKm)} กม.`,
        `   น้ำมันที่ใช้: ${row.fuelUsedLiters === null ? "ไม่พบข้อมูล" : `${formatNumber(row.fuelUsedLiters)} ลิตร`}`,
      ].join("\n"),
    ),
  ];

  return {
    text: lines.join("\n"),
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

function firstKnownName(...names: string[]): string {
  return names.find((name) => name && name !== "-") ?? "-";
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
