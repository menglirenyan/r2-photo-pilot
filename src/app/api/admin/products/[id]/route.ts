import { NextResponse } from "next/server";
import { cleanText, databaseError, jsonError, readJsonBody, requireAdmin, requireCompanyAccess } from "@/lib/api";
import { parseMoney } from "@/lib/format";
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
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

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
    .select("id,company_id")
    .eq("id", id)
    .single();

  if (existingError || !existingProduct) return jsonError("产品不存在。", 404);

  const accessError = await requireCompanyAccess(supabase, session, existingProduct.company_id);
  if (accessError) return accessError;

  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("*,categories(id,name,code)").single();

  if (error) return databaseError(error);
  return NextResponse.json({ product: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id,company_id")
    .eq("id", id)
    .single();

  if (existingError || !existingProduct) return jsonError("产品不存在。", 404);

  const accessError = await requireCompanyAccess(supabase, session, existingProduct.company_id);
  if (accessError) return accessError;

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return databaseError(error);

  return NextResponse.json({ ok: true });
}
