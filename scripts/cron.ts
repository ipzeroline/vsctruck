import cron from "node-cron";
import { loadLocalEnv } from "../lib/load-env";
import { getConfig } from "../lib/config";
import { buildDailyReport } from "../lib/report";
import { sendTelegramMessage } from "../lib/telegram";

loadLocalEnv();
const config = getConfig();

console.log(`Starting report cron "${config.reportCron}" in ${config.reportTimezone}`);

cron.schedule(
  config.reportCron,
  async () => {
    try {
      const report = await buildDailyReport();
      await sendTelegramMessage(report.text, config);
      console.log(`Sent daily report for ${report.vehicleCount} vehicle(s).`);
    } catch (error) {
      console.error(error);
    }
  },
  {
    timezone: config.reportTimezone,
  },
);
