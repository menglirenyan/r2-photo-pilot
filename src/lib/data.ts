import { cache } from "react";
import { unstable_cache } from "next/cache";
import { isCompanyAccessible } from "@/lib/format";
import {
  PUBLIC_DATA_REVALIDATE_SECONDS,
  publicCatalogCacheTag,
  publicCompanyCacheTag
} from "@/lib/public-cache";
import { isDemoReadFallbackEnabled } from "@/lib/runtime-config";
import { getSampleAdminSnapshot, getSampleCatalog, sampleCompany } from "@/lib/sample-data";
import { getSupabaseServerClient } from "@/lib/supabase";
import type {
  AdminSnapshot,
  CatalogCategory,
  CatalogProduct,
  Category,
  Company,
  Product,
  PublicCatalog,
  PublicCompany,
  PublicProductDetail
} from "@/types";

const queryTimeoutMs = 3500;
const companySafeSelect =
  "id,company_number,name,slug,login_username,status,paid_until,contact_name,contact_note,created_at,updated_at";
const publicCompanySelect = "id,name,slug,status,paid_until";
const publicCategorySelect = "id,name,code,sort_order";
const publicCatalogProductSelect =
  "id,category_id,product_code,name,specification,unit_price,description,image_url";
const publicProductDetailSelect =
  "id,category_id,product_code,name,specification,unit_price,description,image_url,categories(id,name,code)";
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

function isMissingRow(error: { code?: string | null } | null) {
  return error?.code === "PGRST116";
}

function publicReadError(scope: string, error: { code?: string | null; message?: string | null }) {
  const code = error.code || "UNKNOWN";
  return new Error(`Public ${scope} query failed (${code}).`);
}

function samplePublicCompany(slug: string): PublicCompany | null {
  if (!isDemoReadFallbackEnabled() || slug !== sampleCompany.slug) return null;
  return {
    id: sampleCompany.id,
    name: sampleCompany.name,
    slug: sampleCompany.slug,
    status: sampleCompany.status,
    paid_until: sampleCompany.paid_until
  };
}

async function loadPublicCompany(slug: string): Promise<PublicCompany | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return samplePublicCompany(slug);

  const { data, error } = await withTimeout(
    supabase.from("companies").select(publicCompanySelect).eq("slug", slug).single(),
    timeoutResponse()
  );

  if (error) {
    if (isMissingRow(error)) return null;
    const sample = samplePublicCompany(slug);
    if (sample) return sample;
    throw publicReadError("company", error);
  }

  return data as PublicCompany;
}

function getCachedPublicCompany(slug: string) {
  return unstable_cache(() => loadPublicCompany(slug), ["public-company", slug], {
    revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
    tags: [publicCompanyCacheTag(slug)]
  })();
}

type PublicCatalogContent = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
};

function sampleCatalogContent(companyId: string): PublicCatalogContent | null {
  if (!isDemoReadFallbackEnabled() || companyId !== sampleCompany.id) return null;
  const catalog = getSampleCatalog(sampleCompany.slug);
  if (!catalog) return null;

  return {
    categories: catalog.categories.map(({ id, name, code, sort_order }) => ({ id, name, code, sort_order })),
    products: catalog.products.map(
      ({ id, category_id, product_code, name, specification, unit_price, description, image_url }) => ({
        id,
        category_id,
        product_code,
        name,
        specification,
        unit_price,
        description,
        image_url
      })
    )
  };
}

async function loadPublicCatalogContent(companyId: string): Promise<PublicCatalogContent> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return sampleCatalogContent(companyId) ?? { categories: [], products: [] };

  const [categoriesResult, productsResult] = await Promise.all([
    withTimeout(
      supabase
        .from("categories")
        .select(publicCategorySelect)
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      timeoutResponse()
    ),
    withTimeout(
      supabase
        .from("products")
        .select(publicCatalogProductSelect)
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(80),
      timeoutResponse()
    )
  ]);

  if (categoriesResult.error || productsResult.error) {
    const sample = sampleCatalogContent(companyId);
    if (sample) return sample;
    throw publicReadError("catalog", categoriesResult.error || productsResult.error || timeoutError);
  }

  return {
    categories: (categoriesResult.data ?? []) as CatalogCategory[],
    products: (productsResult.data ?? []) as CatalogProduct[]
  };
}

function getCachedPublicCatalogContent(companyId: string) {
  return unstable_cache(() => loadPublicCatalogContent(companyId), ["public-catalog", companyId], {
    revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
    tags: [publicCatalogCacheTag(companyId)]
  })();
}

async function loadPublicProductDetail(companyId: string, productCode: string): Promise<PublicProductDetail | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    if (!isDemoReadFallbackEnabled() || companyId !== sampleCompany.id) return null;
    const product = getSampleAdminSnapshot().products.find((item) => item.product_code === productCode);
    if (!product) return null;

    const { id, category_id, product_code, name, specification, unit_price, description, image_url, categories } = product;
    return { id, category_id, product_code, name, specification, unit_price, description, image_url, categories };
  }

  const { data, error } = await withTimeout(
    supabase
      .from("products")
      .select(publicProductDetailSelect)
      .eq("company_id", companyId)
      .eq("product_code", productCode)
      .eq("status", "active")
      .maybeSingle(),
    timeoutResponse()
  );

  if (error) {
    if (isDemoReadFallbackEnabled() && companyId === sampleCompany.id) {
      const product = getSampleAdminSnapshot().products.find((item) => item.product_code === productCode);
      if (product) {
        const { id, category_id, product_code, name, specification, unit_price, description, image_url, categories } = product;
        return { id, category_id, product_code, name, specification, unit_price, description, image_url, categories };
      }
    }
    throw publicReadError("product detail", error);
  }

  return (data as unknown as PublicProductDetail | null) ?? null;
}

function getCachedPublicProductDetail(companyId: string, productCode: string) {
  return unstable_cache(
    () => loadPublicProductDetail(companyId, productCode),
    ["public-product-detail", companyId, productCode],
    {
      revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
      tags: [publicCatalogCacheTag(companyId)]
    }
  )();
}

export const getPublicCatalog = cache(async (slug: string): Promise<PublicCatalog | null> => {
  const company = await getCachedPublicCompany(slug);
  if (!company) return null;

  const isAccessible = isCompanyAccessible(company.status, company.paid_until);
  if (!isAccessible) return { company, categories: [], products: [], isAccessible };

  const content = await getCachedPublicCatalogContent(company.id);
  return { company, ...content, isAccessible };
});

export const getProductDetail = cache(async (companySlug: string, productCode: string) => {
  const company = await getCachedPublicCompany(companySlug);
  if (!company || !isCompanyAccessible(company.status, company.paid_until)) return null;

  const product = await getCachedPublicProductDetail(company.id, productCode);
  return product ? { company, product } : null;
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

  const companiesResult = await withTimeout(
    supabase.from("companies").select(companySafeSelect).order("company_number", { ascending: true }),
    timeoutResponse()
  );

  if (companiesResult.error) {
    return isDemoReadFallbackEnabled() ? getSampleAdminSnapshot() : emptySnapshot;
  }

  return {
    companies: (companiesResult.data ?? []) as Company[],
    categories: [],
    products: [],
    shipmentSheets: [],
    configured: true
  };
});

export const getCompanyAdminSnapshot = cache(async (slug: string): Promise<AdminSnapshot | null> => {
  const supabase = getSupabaseServerClient();
  const allowDemoFallback = isDemoReadFallbackEnabled();

  if (!supabase) {
    return allowDemoFallback && slug === sampleCompany.slug ? getSampleAdminSnapshot() : null;
  }

  const companyResult = await withTimeout(
    supabase.from("companies").select(companySafeSelect).eq("slug", slug).single(),
    timeoutResponse()
  );

  if (companyResult.error || !companyResult.data) {
    return allowDemoFallback && slug === sampleCompany.slug ? getSampleAdminSnapshot() : null;
  }

  const company = companyResult.data as Company;
  const [categoriesResult, productsResult] = await Promise.all([
    withTimeout(
      supabase
        .from("categories")
        .select("*")
        .eq("company_id", company.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      timeoutResponse()
    ),
    withTimeout(
      supabase
        .from("products")
        .select("*,categories(id,name,code)")
        .eq("company_id", company.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(200),
      timeoutResponse()
    )
  ]);

  if (categoriesResult.error || productsResult.error) {
    return allowDemoFallback && slug === sampleCompany.slug ? getSampleAdminSnapshot() : null;
  }

  return {
    companies: [company],
    categories: (categoriesResult.data ?? []) as Category[],
    products: (productsResult.data ?? []) as unknown as Product[],
    shipmentSheets: [],
    configured: true
  };
});
