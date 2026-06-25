export type ReportWindow = {
  labelDate: string;
  startTimestamp: string;
  endTimestamp: string;
};

export function getBangkokReportWindow(now = new Date(), timezone = "Asia/Bangkok"): ReportWindow {
  const parts = getParts(now, timezone);
  const date = `${parts.year}-${parts.month}-${parts.day}`;

  return {
    labelDate: `${parts.day}/${parts.month}/${parts.year}`,
    startTimestamp: `${date} 00:00:00`,
    endTimestamp: `${date} ${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const match = value.match(/\b(\d{2}):(\d{2})(?::\d{2})?/);
  if (!match) {
    return value;
  }

  return `${match[1]}:${match[2]}`;
}

function getParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour === "24" ? "00" : values.hour,
    minute: values.minute,
    second: values.second,
  };
}
