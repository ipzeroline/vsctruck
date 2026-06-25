export type AppConfig = {
  cartrackBaseUrl: string;
  cartrackUsername: string;
  cartrackPassword: string;
  telegramBotToken: string;
  telegramChatId: string;
  reportTimezone: string;
  reportCron: string;
  reportCronSecret: string;
  reportMaxVehicles: number;
  mongodbUri: string;
  mongodbDb: string;
};

export function getConfig(): AppConfig {
  return {
    cartrackBaseUrl: trimSlash(process.env.CARTRACK_BASE_URL ?? "https://fleetapi-th.cartrack.com/rest"),
    cartrackUsername: requireEnv("CARTRACK_USERNAME"),
    cartrackPassword: requireEnv("CARTRACK_PASSWORD"),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
    reportTimezone: process.env.REPORT_TIMEZONE ?? "Asia/Bangkok",
    reportCron: process.env.REPORT_CRON ?? "0 18 * * *",
    reportCronSecret: process.env.REPORT_CRON_SECRET ?? "change-this-secret",
    reportMaxVehicles: Number(process.env.REPORT_MAX_VEHICLES ?? 100),
    mongodbUri: requireEnv("MONGODB_URI"),
    mongodbDb: process.env.MONGODB_DB ?? "vscbot",
  };
}

export function requireTelegram(config = getConfig()) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env.local");
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in environment`);
  }
  return value;
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}
