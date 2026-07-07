import { cache } from "react";
import { getSampleAdminSnapshot, getSampleCatalog, sampleCompany } from "@/lib/sample-data";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { AdminSnapshot, Category, Company, Product, PublicCatalog, ShipmentSheet } from "@/types";
import { isCompanyAccessible } from "@/lib/format";
import { isDemoReadFallbackEnabled } from "@/lib/runtime-config";

const queryTimeoutMs = 3500;
const timeoutError = {
  message: "Supabase query timed out",
  details: "",
  hint: "",
  code: "TIMEOUT",
  name: "PostgrestError"
};

function timeoutResponse() {
  return {
    data: null,
    error: timeoutError,
    count: null,
    status: 0,
    statusText: "Timeout"
  };
}

function withTimeout<T>(promise: PromiseLike<T>, fallback: unknown): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback as T), queryTimeoutMs);

    Promise.resolve(promise)
      .then((value) => resolve(value))
      .catch(() => resolve(fallback as T))
      .finally(() => clearTimeout(timer));
  });
}

export const getPublicCatalog = cache(async (slug: string): Promise<PublicCatalog | null> => {
  const supabase = getSupabaseServerClient();
  const allowDemoFallback = isDemoReadFallbackEnabled();

  if (!supabase) {
    return allowDemoFallback ? getSampleCatalog(slug) : null;
  }

  const { data: company, error: companyError } = await withTimeout(
    supabase
      .from("companies")
      .select("id,name,slug,status,paid_until,contact_name,contact_note,created_at,updated_at")
      .eq("slug", slug)
      .single(),
    timeoutResponse()
  );

  if (companyError || !company) {
    return allowDemoFallback && slug === sampleCompany.slug ? getSampleCatalog(slug) : null;
  }

  const typedCompany = company as Company;
  const accessible = isCompanyAccessible(typedCompany.status, typedCompany.paid_until);

  const [categoriesResult, productsResult] = await Promise.all([
    withTimeout(
      supabase
        .from("categories")
        .select("*")
        .eq("company_id", typedCompany.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      timeoutResponse()
    ),
    accessible
      ? withTimeout(
          supabase
            .from("products")
            .select(
              "id,company_id,category_id,product_number,product_code,name,specification,unit_price,description,image_url,object_key,image_width,image_height,status,sort_order,created_at,updated_at,categories(id,name,code)"
            )
            .eq("company_id", typedCompany.id)
            .eq("status", "active")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(80),
          timeoutResponse()
        )
      : Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: "OK" })
  ]);

  if (categoriesResult.error || productsResult.error) return null;

  return {
    company: typedCompany,
    categories: (categoriesResult.data ?? []) as Category[],
    products: (productsResult.data ?? []) as unknown as Product[],
    isAccessible: accessible
  };
});

export const getAdminSnapshot = cache(async (): Promise<AdminSnapshot> => {
  const supabase = getSupabaseServerClient();
  const emptySnapshot = {
    companies: [],
    categories: [],
    products: [],
    shipmentSheets: [],
    configured: false
  };

  if (!supabase) {
    return isDemoReadFallbackEnabled() ? getSampleAdminSnapshot() : emptySnapshot;
  }

  const [companiesResult, categoriesResult, productsResult, shipmentResult] = await Promise.all([
    withTimeout(supabase.from("companies").select("*").order("created_at", { ascending: false }), timeoutResponse()),
    withTimeout(supabase.from("categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }), timeoutResponse()),
    withTimeout(
      supabase
        .from("products")
        .select("*,categories(id,name,code)")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(200),
      timeoutResponse()
    ),
    withTimeout(supabase.from("shipment_sheets").select("*").order("created_at", { ascending: false }).limit(30), timeoutResponse())
  ]);

  if (companiesResult.error || categoriesResult.error || productsResult.error || shipmentResult.error) {
    return isDemoReadFallbackEnabled() ? getSampleAdminSnapshot() : emptySnapshot;
  }

  return {
    companies: (companiesResult.data ?? []) as Company[],
    categories: (categoriesResult.data ?? []) as Category[],
    products: (productsResult.data ?? []) as unknown as Product[],
    shipmentSheets: (shipmentResult.data ?? []) as ShipmentSheet[],
    configured: true
  };
});

export async function getProductDetail(companySlug: string, productCode: string) {
  const catalog = await getPublicCatalog(companySlug);
  if (!catalog || !catalog.isAccessible) return null;

  return {
    catalog,
    product: catalog.products.find((product) => product.product_code === productCode) ?? null
  };
}
