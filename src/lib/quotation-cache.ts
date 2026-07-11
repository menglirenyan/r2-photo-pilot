import type { QuotationCachePayload } from "@/types";

export const quotationCacheTtlMs = 2 * 60 * 60 * 1000;

export function quotationCacheKey(companySlug: string) {
  return `quotation-draft:${companySlug}`;
}

export function readQuotationCache(raw: string | null): QuotationCachePayload | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as QuotationCachePayload;
    if (!payload || !Array.isArray(payload.items) || !payload.meta || payload.expires_at <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
