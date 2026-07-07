import { NextResponse } from "next/server";
import { cleanText, jsonError, requireAdmin, requireCompanyAccess } from "@/lib/api";

export async function POST(request: Request) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const body = (await request.json()) as {
    company_id?: string;
    name?: string;
    code?: string;
    sort_order?: number;
  };

  const companyId = cleanText(body.company_id, 80);
  const name = cleanText(body.name, 80);
  const code = cleanText(body.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!companyId || !name || !code) {
    return jsonError("企业、类别名称和类别代码必填。");
  }

  const accessError = await requireCompanyAccess(supabase, session, companyId);
  if (accessError) return accessError;

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

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ category: data }, { status: 201 });
}
