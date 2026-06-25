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

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const labelDate = searchParams.get("labelDate") ?? undefined;
    const audit = await getLatestDriverDailyAudit(labelDate);
    return NextResponse.json({ ok: true, audit });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    const { searchParams } = request.nextUrl;
    const secret = searchParams.get("secret");
    if (secret && secret !== config.reportCronSecret) {
      return NextResponse.json({ ok: false, message: "Invalid cron secret" }, { status: 401 });
    }

    const includeReport = searchParams.get("report") === "1";
    const window = getBangkokReportWindow(new Date(), config.reportTimezone);
    const rows = await new CartrackClient(config).getVehicleStatuses(config.reportMaxVehicles);
    await saveVehicleStatusSnapshot(window.labelDate, rows);
    await saveFuelSnapshot(window.labelDate, rows);

    let reportId: string | undefined;
    if (includeReport) {
      const report = await buildDailyReport();
      reportId = await saveReport(report, false);
    }

    const audit = await buildDriverDailyAudit(window.labelDate);
    return NextResponse.json({
      ok: true,
      reportId,
      snapshotVehicleCount: rows.length,
      window,
      audit,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
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
    return NextResponse.json({ ok: true, case: item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
