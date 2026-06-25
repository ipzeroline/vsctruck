import { AppConfig, requireTelegram } from "./config";

export async function sendTelegramMessage(text: string, config: AppConfig): Promise<void> {
  requireTelegram(config);

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  }
}
