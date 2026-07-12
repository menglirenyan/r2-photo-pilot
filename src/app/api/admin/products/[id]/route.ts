import { NextResponse } from "next/server";
import { cleanText, databaseError, jsonError, readJsonBody, requireAdmin, requireCompanyAccess } from "@/lib/api";
import { parseMoney } from "@/lib/format";
import { invalidatePublicCatalog, readCompanySlugForInvalidation } from "@/lib/public-cache";
import { getR2Config } from "@/lib/r2";
import type { ProductStatus } from "@/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await readJsonBody<{
    name?: string;
    specification?: string;
    unit_price?: number | string | null;
    description?: string;
    status?: ProductStatus;
    sort_order?: number;
    image_url?: string;
    object_key?: string;
    image_width?: number;
    image_height?: number;
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

  const imageFields = [body.image_url, body.object_key, body.image_width, body.image_height];
  const imageUpdateRequested = imageFields.some((value) => value !== undefined);
  if (imageUpdateRequested && imageFields.some((value) => value === undefined)) {
    return jsonError("替换图片时必须同时提交图片地址、对象键和图片尺寸。");
  }

  const imageUrl = imageUpdateRequested ? cleanText(body.image_url, 500) : "";
  const objectKey = imageUpdateRequested ? cleanText(body.object_key, 500) : "";
  const imageWidth = imageUpdateRequested ? Number(body.image_width) : 0;
  const imageHeight = imageUpdateRequested ? Number(body.image_height) : 0;

  if (
    imageUpdateRequested &&
    (!imageUrl ||
      !objectKey ||
      !Number.isInteger(imageWidth) ||
      imageWidth <= 0 ||
      imageWidth > 20000 ||
      !Number.isInteger(imageHeight) ||
      imageHeight <= 0 ||
      imageHeight > 20000)
  ) {
    return jsonError("替换图片信息不完整或图片尺寸不正确。");
  }

  const unitPrice = body.unit_price === undefined ? undefined : parseMoney(body.unit_price);
  if (body.unit_price !== undefined && body.unit_price !== null && body.unit_price !== "" && unitPrice === null) {
    return jsonError("单价格式不正确。");
  }

  const name = body.name === undefined ? undefined : cleanText(body.name, 120);
  if (body.name !== undefined && !name) return jsonError("产品名称不能为空。");

  const sortOrder = body.sort_order === undefined ? undefined : Number(body.sort_order);
  if (sortOrder !== undefined && !Number.isFinite(sortOrder)) return jsonError("排序值格式不正确。");

  const patch = {
    name,
    specification: body.specification === undefined ? undefined : cleanText(body.specification, 160),
    unit_price: unitPrice,
    description: body.description === undefined ? undefined : cleanText(body.description, 1200),
    status: body.status === "hidden" ? "hidden" : body.status === "active" ? "active" : undefined,
    sort_order: sortOrder === undefined ? undefined : Math.trunc(sortOrder)
  };

  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id,company_id,product_code")
    .eq("id", id)
    .single();

  if (existingError || !existingProduct) return jsonError("产品不存在。", 404);

  const accessError = await requireCompanyAccess(supabase, session, existingProduct.company_id);
  if (accessError) return accessError;

  if (imageUpdateRequested) {
    const r2 = getR2Config();
    if (!r2) return jsonError("图片存储未配置，暂时不能替换图片。", 503);

    const expectedObjectPrefix = `companies/${existingProduct.company_id}/products/`;
    if (!objectKey.startsWith(expectedObjectPrefix) || imageUrl !== `${r2.publicBaseUrl}/${objectKey}`) {
      return jsonError("图片地址与当前企业不匹配。", 403);
    }

    Object.assign(patch, {
      image_url: imageUrl,
      object_key: objectKey,
      image_width: imageWidth,
      image_height: imageHeight
    });
  }

  const companySlug = await readCompanySlugForInvalidation(supabase, existingProduct.company_id);

  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("*,categories(id,name,code)").single();

  if (error) return databaseError(error);
  invalidatePublicCatalog({
    companyId: existingProduct.company_id,
    slug: companySlug,
    productCodes: [existingProduct.product_code]
  });
  return NextResponse.json({ product: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id,company_id,product_code")
    .eq("id", id)
    .single();

  if (existingError || !existingProduct) return jsonError("产品不存在。", 404);

  const accessError = await requireCompanyAccess(supabase, session, existingProduct.company_id);
  if (accessError) return accessError;
  const companySlug = await readCompanySlugForInvalidation(supabase, existingProduct.company_id);

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return databaseError(error);

  invalidatePublicCatalog({
    companyId: existingProduct.company_id,
    slug: companySlug,
    productCodes: [existingProduct.product_code]
  });

  return NextResponse.json({ ok: true });
}
