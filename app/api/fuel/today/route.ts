import { NextResponse } from "next/server";
import { CartrackClient } from "@/lib/cartrack";
import { getConfig } from "@/lib/config";
import { buildFuelSummary, saveFuelSnapshot } from "@/lib/repositories";
import { getTimedCache } from "@/lib/server/timed-cache";
import { formatDate, getBangkokReportWindow } from "@/lib/time";

export const runtime = "nodejs";
const FUEL_SUMMARY_CACHE_TTL_MS = 20_000;

export async function GET(request: Request) {
  try {
    const config = getConfig();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const labelDateParam = searchParams.get("labelDate");
    const currentWindow = getBangkokReportWindow(new Date(), config.reportTimezone);
    const requestedWindow = resolveFuelWindow(dateParam, labelDateParam, currentWindow);
    const saveSnapshot = searchParams.get("snapshot") === "1" && requestedWindow.labelDate === currentWindow.labelDate;

    const { value: summary, hit } = saveSnapshot
      ? {
          value: await saveFuelSnapshot(requestedWindow.labelDate, await new CartrackClient(config).getVehicleStatuses(config.reportMaxVehicles)),
          hit: false,
        }
      : await getTimedCache(`fuel-summary:${requestedWindow.labelDate}`, FUEL_SUMMARY_CACHE_TTL_MS, () =>
          buildFuelSummary(requestedWindow.labelDate),
        );

    const response = NextResponse.json({
      ok: true,
      window: requestedWindow,
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

function resolveFuelWindow(
  dateParam: string | null,
  labelDateParam: string | null,
  currentWindow: ReturnType<typeof getBangkokReportWindow>,
) {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return {
      labelDate: formatDate(dateParam),
      startTimestamp: `${dateParam} 00:00:00`,
      endTimestamp: `${dateParam} 23:59:59`,
    };
  }

  if (labelDateParam && /^\d{2}\/\d{2}\/\d{4}$/.test(labelDateParam)) {
    const [day, month, year] = labelDateParam.split("/");
    const date = `${year}-${month}-${day}`;
    return {
      labelDate: labelDateParam,
      startTimestamp: `${date} 00:00:00`,
      endTimestamp: `${date} 23:59:59`,
    };
  }

  return currentWindow;
}
