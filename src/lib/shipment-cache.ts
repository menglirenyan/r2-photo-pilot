import type { Company, ShipmentDraftItem } from "@/types";

export const shipmentCacheTtlMs = 2 * 60 * 60 * 1000;

export type ShipmentCachePayload = {
  company: Pick<Company, "id" | "name" | "slug">;
  createdAt: number;
  expiresAt: number;
  items: ShipmentDraftItem[];
};

export function shipmentCacheKey(companySlug: string) {
  return `shipment-draft:${companySlug}`;
}
