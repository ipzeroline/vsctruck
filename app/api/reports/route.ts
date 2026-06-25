import { NextRequest, NextResponse } from "next/server";
import { getLatestReport, listReports } from "@/lib/repositories";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const latestOnly = request.nextUrl.searchParams.get("latest") === "1";
    if (latestOnly) {
      return NextResponse.json({ ok: true, latest: await getLatestReport() });
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    return NextResponse.json({ ok: true, reports: await listReports(limit) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
