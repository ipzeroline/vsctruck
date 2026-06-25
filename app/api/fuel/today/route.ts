import { NextResponse } from "next/server";
import { CartrackClient } from "@/lib/cartrack";
import { getConfig } from "@/lib/config";
import { buildFuelSummary, saveFuelSnapshot } from "@/lib/repositories";
import { getTimedCache } from "@/lib/server/timed-cache";
import { getBangkokReportWindow } from "@/lib/time";

export const runtime = "nodejs";
const FUEL_SUMMARY_CACHE_TTL_MS = 20_000;

export async function GET(request: Request) {
  try {
    const config = getConfig();
    const window = getBangkokReportWindow(new Date(), config.reportTimezone);
    const { searchParams } = new URL(request.url);
    const saveSnapshot = searchParams.get("snapshot") !== "0";

    const { value: summary, hit } = saveSnapshot
      ? {
          value: await saveFuelSnapshot(window.labelDate, await new CartrackClient(config).getVehicleStatuses(config.reportMaxVehicles)),
          hit: false,
        }
      : await getTimedCache(`fuel-summary:${window.labelDate}`, FUEL_SUMMARY_CACHE_TTL_MS, () =>
          buildFuelSummary(window.labelDate),
        );

    const response = NextResponse.json({
      ok: true,
      window,
      summary,
      note:
        summary.snapshotCount < 2
          ? "ต้องมีอย่างน้อย 2 snapshots ภายในวันเดียวกัน จึงจะตรวจการเติมน้ำมันจาก fuel level ได้"
          : undefined,
    });
    response.headers.set("Cache-Control", saveSnapshot ? "no-store" : "private, max-age=10, stale-while-revalidate=20");
    response.headers.set("X-VSC-Cache", hit ? "HIT" : "MISS");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
