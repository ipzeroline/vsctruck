import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { saveReport } from "@/lib/repositories";
import { buildDailyReport } from "@/lib/report";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    const send = request.nextUrl.searchParams.get("send") === "1";
    const secret = request.nextUrl.searchParams.get("secret");

    if (secret && secret !== config.reportCronSecret) {
      return NextResponse.json({ ok: false, message: "Invalid cron secret" }, { status: 401 });
    }

    const report = await buildDailyReport();

    if (send) {
      await sendTelegramMessage(report.text, config);
    }

    const reportId = await saveReport(report, send);

    return NextResponse.json({
      ok: true,
      reportId,
      sent: send,
      report: report.text,
      vehicleCount: report.vehicleCount,
      fuelAvailableCount: report.fuelAvailableCount,
      summary: report.summary,
      window: report.window,
      rows: report.rows,
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
