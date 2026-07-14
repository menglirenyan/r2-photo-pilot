export function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `¥${Number(value).toFixed(2)}`;
}

export function parseMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
}

const beijingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function beijingDateKey(now: Date) {
  const parts = beijingDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export type CompanyExpiryReminder = {
  label: string;
  detail: string;
  tone: "safe" | "notice" | "urgent" | "expired";
};

export function getCompanyExpiryReminder(paidUntil: string | null, now = new Date()): CompanyExpiryReminder {
  if (!paidUntil) {
    return { label: "长期有效", detail: "当前未设置到期日", tone: "safe" };
  }

  const today = beijingDateKey(now);
  const dayInMilliseconds = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round(
    (Date.parse(`${paidUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayInMilliseconds
  );
  const detail = `有效期至 ${paidUntil.replaceAll("-", ".")}`;

  if (daysRemaining < 0) return { label: "已到期", detail, tone: "expired" };
  if (daysRemaining === 0) return { label: "今天到期", detail, tone: "urgent" };
  if (daysRemaining <= 7) return { label: `仅剩 ${daysRemaining} 天`, detail, tone: "urgent" };
  if (daysRemaining <= 30) return { label: `还剩 ${daysRemaining} 天`, detail, tone: "notice" };
  return { label: `还剩 ${daysRemaining} 天`, detail, tone: "safe" };
}

export function isCompanyAccessible(status: string, paidUntil: string | null, now = new Date()) {
  if (status !== "active") return false;
  if (!paidUntil) return true;

  return paidUntil >= beijingDateKey(now);
}

export function compactDate(value: string | null) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 64);
}
