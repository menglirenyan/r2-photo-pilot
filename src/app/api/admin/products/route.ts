import { NextResponse } from "next/server";
import { cleanText, jsonError, requireAdmin, requireCompanyAccess } from "@/lib/api";
import { parseMoney } from "@/lib/format";

export async function POST(request: Request) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const body = (await request.json()) as {
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
  };

  const companyId = cleanText(body.company_id, 80);
  const categoryId = cleanText(body.category_id, 80);
  const name = cleanText(body.name, 120);
  const imageUrl = cleanText(body.image_url, 500);
  const objectKey = cleanText(body.object_key, 500);

  if (!companyId || !categoryId || !name || !imageUrl || !objectKey) {
    return jsonError("企业、类别、名称和图片必填。");
  }

  const accessError = await requireCompanyAccess(supabase, session, companyId);
  if (accessError) return accessError;

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,code")
    .eq("id", categoryId)
    .eq("company_id", companyId)
    .single();

  if (categoryError || !category) return jsonError("类别不存在。", 404);

  const { data: lastProduct } = await supabase
    .from("products")
    .select("product_number")
    .eq("category_id", categoryId)
    .order("product_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = Number(lastProduct?.product_number || 0) + 1;
  const productCode = `${category.code}-${String(nextNumber).padStart(3, "0")}`;
  const sortOrder = Number(body.sort_order || 0);

  const { data, error } = await supabase
    .from("products")
    .insert({
      company_id: companyId,
      category_id: categoryId,
      product_number: nextNumber,
      product_code: productCode,
      name,
      specification: cleanText(body.specification, 160),
      unit_price: parseMoney(body.unit_price),
      description: cleanText(body.description, 1200),
      image_url: imageUrl,
      object_key: objectKey,
      image_width: Number.isFinite(Number(body.image_width)) ? Number(body.image_width) : null,
      image_height: Number.isFinite(Number(body.image_height)) ? Number(body.image_height) : null,
      status: "active",
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
    })
    .select("*,categories(id,name,code)")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ product: data }, { status: 201 });
}
