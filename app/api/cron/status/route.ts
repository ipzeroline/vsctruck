import { NextResponse } from "next/server";
import { getCronStatus } from "@/lib/repositories";
import { getTimedCache } from "@/lib/server/timed-cache";

export const runtime = "nodejs";

const CRON_STATUS_CACHE_TTL_MS = 10_000;

export async function GET() {
  try {
    const { value, hit } = await getTimedCache("cron-status", CRON_STATUS_CACHE_TTL_MS, getCronStatus);
    const response = NextResponse.json({ ok: true, status: value });
    response.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=10");
    response.headers.set("X-VSC-Cache", hit ? "HIT" : "MISS");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
