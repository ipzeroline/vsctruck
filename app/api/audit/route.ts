import { NextRequest, NextResponse } from "next/server";
import { CartrackClient } from "@/lib/cartrack";
import { getConfig } from "@/lib/config";
import { requireRole } from "@/lib/server/authorization";
import {
  buildDriverDailyAudit,
  getLatestDriverDailyAudit,
  saveFuelSnapshot,
  saveVehicleStatusSnapshot,
  updateDriverAuditCase,
  type DriverAuditStatus,
} from "@/lib/repositories";
import { buildDailyReport } from "@/lib/report";
import { getBangkokReportWindow } from "@/lib/time";
import { saveReport } from "@/lib/repositories";
import { deleteTimedCache, getTimedCache } from "@/lib/server/timed-cache";

export const runtime = "nodejs";
const AUDIT_CACHE_TTL_MS = 15_000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const labelDate = searchParams.get("labelDate") ?? undefined;
    const { value, hit } = await getTimedCache(`driver-audit:${labelDate ?? "latest"}`, AUDIT_CACHE_TTL_MS, () =>
      getLatestDriverDailyAudit(labelDate),
    );
    const response = NextResponse.json({ ok: true, audit: value });
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=15");
    response.headers.set("X-VSC-Cache", hit ? "HIT" : "MISS");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let stage = "init";
  try {
    stage = "config";
    const config = getConfig();
    const { searchParams } = request.nextUrl;
    const secret = searchParams.get("secret");
    if (secret && secret !== config.reportCronSecret) {
      return NextResponse.json({ ok: false, message: "Invalid cron secret" }, { status: 401 });
    }

    const includeReport = searchParams.get("report") === "1";
    stage = "window";
    const window = getBangkokReportWindow(new Date(), config.reportTimezone);
    stage = "cartrack_vehicle_status";
    const rows = await new CartrackClient(config).getVehicleStatuses(config.reportMaxVehicles);
    stage = "save_vehicle_status_snapshot";
    await saveVehicleStatusSnapshot(window.labelDate, rows);
    stage = "save_fuel_snapshot";
    await saveFuelSnapshot(window.labelDate, rows);

    let reportId: string | undefined;
    if (includeReport) {
      stage = "build_daily_report";
      const report = await buildDailyReport();
      stage = "save_daily_report";
      reportId = await saveReport(report, false);
    }

    stage = "build_driver_daily_audit";
    const audit = await buildDriverDailyAudit(window.labelDate);
    deleteTimedCache("driver-audit");
    return NextResponse.json({
      ok: true,
      reportId,
      snapshotVehicleCount: rows.length,
      window,
      audit,
    });
  } catch (error) {
    console.error("Audit sync failed", { stage, error });
    return NextResponse.json(
      {
        ok: false,
        stage,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireRole(request, ["admin", "manager"]);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as {
      id?: string;
      status?: DriverAuditStatus;
      note?: string;
      reviewer?: string;
    };
    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Missing case id" }, { status: 400 });
    }
    const item = await updateDriverAuditCase(body.id, {
      status: body.status,
      note: body.note,
      reviewer: body.reviewer,
    });
    if (!item) {
      return NextResponse.json({ ok: false, message: "Case not found" }, { status: 404 });
    }
    deleteTimedCache("driver-audit");
    return NextResponse.json({ ok: true, case: item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
