import { CartrackClient } from "../lib/cartrack";
import { getConfig } from "../lib/config";
import { loadLocalEnv } from "../lib/load-env";
import {
  buildDriverDailyAudit,
  saveFuelSnapshot,
  saveReport,
  saveVehicleStatusSnapshot,
} from "../lib/repositories";
import { buildDailyReport } from "../lib/report";
import { getBangkokReportWindow } from "../lib/time";

loadLocalEnv();

async function main() {
  const config = getConfig();
  const window = getBangkokReportWindow(new Date(), config.reportTimezone);
  const client = new CartrackClient(config);
  const rows = await client.getVehicleStatuses(config.reportMaxVehicles);
  await saveVehicleStatusSnapshot(window.labelDate, rows);
  await saveFuelSnapshot(window.labelDate, rows);

  if (process.argv.includes("--report")) {
    const report = await buildDailyReport();
    await saveReport(report, false);
  }

  const audit = await buildDriverDailyAudit(window.labelDate);
  console.log(
    `Driver audit ${audit.labelDate}: ${audit.summary.driverCount} driver(s), ${audit.summary.openCaseCount} open case(s), average score ${audit.summary.averageScore}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
