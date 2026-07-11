import { NextResponse } from "next/server";
import { cleanText, databaseError, jsonError, readJsonBody, requireAdmin, requireCompanyAccess } from "@/lib/api";
import { invalidatePublicCatalog, readCompanySlugForInvalidation } from "@/lib/public-cache";

export async function POST(request: Request) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const body = await readJsonBody<{
    company_id?: string;
    name?: string;
    code?: string;
    sort_order?: number;
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

  const companyId = cleanText(body.company_id, 80);
  const name = cleanText(body.name, 80);
  let code = cleanText(body.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!companyId || !name) {
    return jsonError("企业和类别名称必填。");
  }

  const accessError = await requireCompanyAccess(supabase, session, companyId);
  if (accessError) return accessError;
  const companySlug = await readCompanySlugForInvalidation(supabase, companyId);

  if (!code) {
    const { data: existingCategories, error: codeError } = await supabase
      .from("categories")
      .select("code")
      .eq("company_id", companyId)
      .like("code", "C%");

    if (codeError) return jsonError(codeError.message, 500);

    const usedCodes = new Set((existingCategories ?? []).map((category) => category.code));
    for (let index = 1; index <= 9999; index += 1) {
      const candidate = `CAT${String(index).padStart(3, "0")}`;
      if (!usedCodes.has(candidate)) {
        code = candidate;
        break;
      }
    }
  }

  if (!code) return jsonError("类别代码生成失败。");

  const sortOrder = Number(body.sort_order || 0);
  const { data, error } = await supabase
    .from("categories")
    .insert({
      company_id: companyId,
      name,
      code,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
    })
    .select("*")
    .single();

  if (error) return databaseError(error, "分类名称或代码已存在。");
  invalidatePublicCatalog({ companyId, slug: companySlug });
  return NextResponse.json({ category: data }, { status: 201 });
}
