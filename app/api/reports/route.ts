import { NextRequest, NextResponse } from "next/server";
import { getLatestReport, listReports } from "@/lib/repositories";
import { getTimedCache } from "@/lib/server/timed-cache";

export const runtime = "nodejs";
const REPORTS_CACHE_TTL_MS = 30_000;

export async function GET(request: NextRequest) {
  try {
    const labelDate = normalizeLabelDate(
      request.nextUrl.searchParams.get("date"),
      request.nextUrl.searchParams.get("labelDate"),
    );
    const latestOnly = request.nextUrl.searchParams.get("latest") === "1";
    if (latestOnly) {
      const cacheKey = labelDate ? `reports:latest:${labelDate}` : "reports:latest";
      const { value, hit } = await getTimedCache(cacheKey, REPORTS_CACHE_TTL_MS, () => getLatestReport(labelDate));
      const response = NextResponse.json({ ok: true, latest: value });
      response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
      response.headers.set("X-VSC-Cache", hit ? "HIT" : "MISS");
      return response;
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);
    const cacheKey = labelDate ? `reports:list:${normalizedLimit}:${labelDate}` : `reports:list:${normalizedLimit}`;
    const { value, hit } = await getTimedCache(cacheKey, REPORTS_CACHE_TTL_MS, () =>
      listReports(normalizedLimit, labelDate),
    );
    const response = NextResponse.json({ ok: true, reports: value });
    response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    response.headers.set("X-VSC-Cache", hit ? "HIT" : "MISS");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function normalizeLabelDate(dateParam: string | null, labelDateParam: string | null) {
  if (labelDateParam && /^\d{2}\/\d{2}\/\d{4}$/.test(labelDateParam)) {
    return labelDateParam;
  }

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [year, month, day] = dateParam.split("-");
    return `${day}/${month}/${year}`;
  }

  return undefined;
}
