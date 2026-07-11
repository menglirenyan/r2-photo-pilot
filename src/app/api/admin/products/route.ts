import { NextResponse } from "next/server";
import { cleanText, databaseError, jsonError, readJsonBody, requireAdmin, requireCompanyAccess } from "@/lib/api";
import { parseMoney } from "@/lib/format";
import { invalidatePublicCatalog, readCompanySlugForInvalidation } from "@/lib/public-cache";
import { getR2Config } from "@/lib/r2";

export async function POST(request: Request) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const body = await readJsonBody<{
    company_id?: string;
    category_id?: string;
    name?: string;
    specification?: string;
    unit_price?: number | string | null;
    description?: string;
    image_url?: string;
    object_key?: string;
    image_width?: number;
    image_height?: number;
    sort_order?: number;
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

  const companyId = cleanText(body.company_id, 80);
  const categoryId = cleanText(body.category_id, 80);
  const name = cleanText(body.name, 120);
  const imageUrl = cleanText(body.image_url, 500);
  const objectKey = cleanText(body.object_key, 500);

  if (!companyId || !categoryId || !name || !imageUrl || !objectKey) {
    return jsonError("企业、类别、名称和图片必填。");
  }

  const r2 = getR2Config();
  if (!r2) return jsonError("图片存储未配置，暂时不能创建产品。", 503);

  const expectedObjectPrefix = `companies/${companyId}/products/`;
  if (!objectKey.startsWith(expectedObjectPrefix) || imageUrl !== `${r2.publicBaseUrl}/${objectKey}`) {
    return jsonError("图片地址与当前企业不匹配。", 403);
  }

  const unitPrice = parseMoney(body.unit_price);
  if (body.unit_price !== null && body.unit_price !== undefined && body.unit_price !== "" && unitPrice === null) {
    return jsonError("单价格式不正确。");
  }

  const accessError = await requireCompanyAccess(supabase, session, companyId);
  if (accessError) return accessError;
  const companySlug = await readCompanySlugForInvalidation(supabase, companyId);

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,code")
    .eq("id", categoryId)
    .eq("company_id", companyId)
    .single();

  if (categoryError || !category) return jsonError("类别不存在。", 404);

  const sortOrder = Number(body.sort_order || 0);
  const imageWidth = Number(body.image_width);
  const imageHeight = Number(body.image_height);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: lastProduct, error: numberError } = await supabase
      .from("products")
      .select("product_number")
      .eq("category_id", categoryId)
      .order("product_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (numberError) return databaseError(numberError);

    const nextNumber = Number(lastProduct?.product_number || 0) + 1;
    const productCode = `${category.code}-${String(nextNumber).padStart(3, "0")}`;
    const { data, error } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        category_id: categoryId,
        product_number: nextNumber,
        product_code: productCode,
        name,
        specification: cleanText(body.specification, 160),
        unit_price: unitPrice,
        description: cleanText(body.description, 1200),
        image_url: imageUrl,
        object_key: objectKey,
        image_width: Number.isInteger(imageWidth) && imageWidth > 0 && imageWidth <= 20000 ? imageWidth : null,
        image_height: Number.isInteger(imageHeight) && imageHeight > 0 && imageHeight <= 20000 ? imageHeight : null,
        status: "active",
        sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0
      })
      .select("*,categories(id,name,code)")
      .single();

    if (!error) {
      invalidatePublicCatalog({ companyId, slug: companySlug, productCodes: [data.product_code] });
      return NextResponse.json({ product: data }, { status: 201 });
    }
    if (error.code !== "23505" || attempt === 2) return databaseError(error, "产品编号冲突，请重试。");
  }

  return jsonError("产品编号生成失败，请重试。", 409);
}
