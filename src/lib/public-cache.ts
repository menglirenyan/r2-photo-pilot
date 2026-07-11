import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_DATA_REVALIDATE_SECONDS = 300;

export function publicCompanyCacheTag(slug: string) {
  return `public-company:${slug}`;
}

export function publicCatalogCacheTag(companyId: string) {
  return `public-catalog:${companyId}`;
}

export async function readCompanySlugForInvalidation(supabase: SupabaseClient, companyId: string) {
  const { data, error } = await supabase.from("companies").select("slug").eq("id", companyId).maybeSingle();
  if (error) throw new Error(`Failed to read company slug for cache invalidation (${error.code || "UNKNOWN"}).`);
  if (!data?.slug) return null;
  return String(data.slug);
}

type InvalidatePublicCatalogOptions = {
  companyId: string;
  slug?: string | null;
  productCodes?: string[];
  companyChanged?: boolean;
  allProductDetails?: boolean;
};

export function invalidatePublicCatalog({
  companyId,
  slug,
  productCodes = [],
  companyChanged = false,
  allProductDetails = false
}: InvalidatePublicCatalogOptions) {
  revalidateTag(publicCatalogCacheTag(companyId), { expire: 0 });

  if (!slug) return;

  if (companyChanged) {
    revalidateTag(publicCompanyCacheTag(slug), { expire: 0 });
  }

  revalidatePath(`/c/${slug}`);

  for (const productCode of new Set(productCodes.filter(Boolean))) {
    revalidatePath(`/c/${slug}/p/${productCode}`);
  }

  if (allProductDetails) {
    revalidatePath(`/c/${slug}/p/[productCode]`, "page");
  }
}
