import { loadLocalEnv } from "../lib/load-env";
import { getConfig } from "../lib/config";
import { buildDailyReport } from "../lib/report";
import { sendTelegramMessage } from "../lib/telegram";

async function main() {
  loadLocalEnv();
  const config = getConfig();
  const report = await buildDailyReport();
  await sendTelegramMessage(report.text, config);
  console.log(`Sent daily report for ${report.vehicleCount} vehicle(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
