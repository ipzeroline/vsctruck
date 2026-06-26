import { NextResponse } from "next/server";
import { CartrackClient, type FleetStatusRow } from "@/lib/cartrack";
import { getConfig } from "@/lib/config";
import { getLatestVehicleStatusSnapshotRows } from "@/lib/repositories";
import { getTimedCache } from "@/lib/server/timed-cache";

export const runtime = "nodejs";
const FLEET_STATUS_CACHE_TTL_MS = 15_000;

export async function GET() {
  try {
    const config = getConfig();
    const { value, hit } = await getTimedCache(
      `fleet-status:${config.reportMaxVehicles}`,
      FLEET_STATUS_CACHE_TTL_MS,
      async () => {
        const client = new CartrackClient(config);
        const rows = dedupeFleetStatusRows(await client.getVehicleStatuses(config.reportMaxVehicles));
        return {
          source: "live" as const,
          rows,
          summary: buildFleetStatusSummary(rows),
        };
      },
    );

    const response = NextResponse.json({
      ok: true,
      source: value.source,
      rows: value.rows,
      summary: value.summary,
    });
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=20");
    response.headers.set("X-VSC-Cache", hit ? "HIT" : "MISS");
    return response;
  } catch (error) {
    const fallback = await getLatestVehicleStatusSnapshotRows();
    if (fallback) {
      const rows = dedupeFleetStatusRows(fallback.rows);
      const response = NextResponse.json({
        ok: true,
        source: "snapshot",
        fallback: true,
        fallbackReason: error instanceof Error ? error.message : "Unknown error",
        snapshotCreatedAt: fallback.createdAt,
        snapshotLabelDate: fallback.labelDate,
        rows,
        summary: buildFleetStatusSummary(rows),
      });
      response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=20");
      response.headers.set("X-VSC-Cache", "FALLBACK");
      return response;
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function buildFleetStatusSummary(rows: Array<{
  ignition: boolean | null;
  idling: boolean | null;
  driverName: string;
}>) {
  return {
    total: rows.length,
    visible: rows.length,
    ignitionOn: rows.filter((row) => row.ignition === true).length,
    moving: rows.filter((row) => row.ignition === true && row.idling === false).length,
    withDriver: rows.filter((row) => row.driverName !== "-").length,
  };
}

function dedupeFleetStatusRows(rows: FleetStatusRow[]) {
  const byVehicle = new Map<string, FleetStatusRow>();

  for (const row of rows) {
    const dedupeKey = getFleetStatusDedupeKey(row);
    const current = byVehicle.get(dedupeKey);
    if (!current || getFleetStatusUpdatedTime(row) >= getFleetStatusUpdatedTime(current)) {
      byVehicle.set(dedupeKey, {
        ...row,
        key: `${row.vehicleId || row.registration}:${row.registration}`,
      });
    }
  }

  return Array.from(byVehicle.values());
}

function getFleetStatusDedupeKey(row: FleetStatusRow) {
  return (row.vehicleId || row.registration).trim().toUpperCase();
}

function getFleetStatusUpdatedTime(row: FleetStatusRow) {
  return Math.max(
    parseFleetStatusTime(row.locationUpdated),
    parseFleetStatusTime(row.eventTs),
    parseFleetStatusTime(row.fuelUpdated),
  );
}

function parseFleetStatusTime(value: string | null) {
  if (!value) {
    return 0;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}
