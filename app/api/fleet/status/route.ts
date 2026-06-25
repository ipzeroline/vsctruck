import { NextResponse } from "next/server";
import { CartrackClient } from "@/lib/cartrack";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = getConfig();
    const client = new CartrackClient(config);
    const rows = await client.getVehicleStatuses(config.reportMaxVehicles);

    return NextResponse.json({
      ok: true,
      rows,
      summary: {
        total: rows.length,
        visible: rows.length,
        ignitionOn: rows.filter((row) => row.ignition === true).length,
        moving: rows.filter((row) => row.ignition === true && row.idling === false).length,
        withDriver: rows.filter((row) => row.driverName !== "-").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
