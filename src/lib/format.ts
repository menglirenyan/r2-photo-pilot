export function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `¥${Number(value).toFixed(2)}`;
}

export function parseMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
}

export function isCompanyAccessible(status: string, paidUntil: string | null) {
  if (status !== "active") return false;
  if (!paidUntil) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${paidUntil}T23:59:59`);

  return expiry >= today;
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
