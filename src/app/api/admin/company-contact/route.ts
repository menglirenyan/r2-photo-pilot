import { NextResponse } from "next/server";
import {
  cleanText,
  databaseError,
  jsonError,
  readJsonBody,
  requireAdmin,
  requireCompanyAccess
} from "@/lib/api";
import { invalidatePublicCatalog } from "@/lib/public-cache";

const maxPhoneLength = 50;
const controlCharacterPattern = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;

export async function PATCH(request: Request) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const body = await readJsonBody<{
    company_id?: string;
    public_contact_phone?: unknown;
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

  const companyId = cleanText(body.company_id, 80);
  if (!companyId) return jsonError("缺少企业 ID。");
  if (!Object.prototype.hasOwnProperty.call(body, "public_contact_phone")) {
    return jsonError("缺少公开联系电话。");
  }

  const rawPhone = String(body.public_contact_phone ?? "");
  if (controlCharacterPattern.test(rawPhone)) {
    return jsonError("公开联系电话不能包含控制字符。");
  }

  const publicContactPhone = rawPhone.trim();
  if ([...publicContactPhone].length > maxPhoneLength) {
    return jsonError(`公开联系电话不能超过 ${maxPhoneLength} 个字符。`);
  }

  const digitCount = publicContactPhone.match(/[0-9]/g)?.length ?? 0;
  if (publicContactPhone && digitCount < 5) {
    return jsonError("公开联系电话至少需要包含 5 位数字。");
  }

  const accessError = await requireCompanyAccess(supabase, session, companyId);
  if (accessError) return accessError;

  const { data, error } = await supabase
    .from("companies")
    .update({ public_contact_phone: publicContactPhone })
    .eq("id", companyId)
    .select("id,slug,public_contact_phone")
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return jsonError("企业不存在。", 404);

  invalidatePublicCatalog({
    companyId: data.id,
    slug: data.slug,
    companyChanged: true
  });

  return NextResponse.json({
    company: {
      id: data.id,
      public_contact_phone: data.public_contact_phone
    }
  });
}
