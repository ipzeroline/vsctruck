import { NextResponse } from "next/server";
import { CartrackClient } from "@/lib/cartrack";
import { getConfig } from "@/lib/config";
import { buildFuelSummary, saveFuelSnapshot } from "@/lib/repositories";
import { getBangkokReportWindow } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const config = getConfig();
    const window = getBangkokReportWindow(new Date(), config.reportTimezone);
    const { searchParams } = new URL(request.url);
    const saveSnapshot = searchParams.get("snapshot") !== "0";

    const summary = saveSnapshot
      ? await saveFuelSnapshot(window.labelDate, await new CartrackClient(config).getVehicleStatuses(config.reportMaxVehicles))
      : await buildFuelSummary(window.labelDate);

    return NextResponse.json({
      ok: true,
      window,
      summary,
      note:
        summary.snapshotCount < 2
          ? "ต้องมีอย่างน้อย 2 snapshots ภายในวันเดียวกัน จึงจะตรวจการเติมน้ำมันจาก fuel level ได้"
          : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
