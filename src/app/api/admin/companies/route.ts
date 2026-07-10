import { NextResponse } from "next/server";
import { cleanText, databaseError, jsonError, readJsonBody, requirePlatformAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import type { CompanyStatus } from "@/types";

const companySafeSelect =
  "id,company_number,name,slug,login_username,status,paid_until,contact_name,contact_note,created_at,updated_at";

export async function POST(request: Request) {
  const { response, supabase } = await requirePlatformAdmin();
  if (response) return response;

  const body = await readJsonBody<{
    name?: string;
    login_username?: string;
    login_password?: string;
    status?: CompanyStatus;
    paid_until?: string | null;
    contact_name?: string;
    contact_note?: string;
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

  const name = cleanText(body.name, 120);
  const loginUsername = cleanText(body.login_username, 80).toLocaleLowerCase();
  const loginPassword = String(body.login_password ?? "");

  if (!name || !loginUsername || loginPassword.length < 6) {
    return jsonError("用户名称、登录账号和至少 6 位登录密码必填。");
  }

  if (body.paid_until && !/^\d{4}-\d{2}-\d{2}$/.test(body.paid_until)) {
    return jsonError("可用到期日格式不正确。");
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      login_username: loginUsername,
      password_hash: hashPassword(loginPassword),
      status: body.status === "active" ? "active" : "inactive",
      paid_until: body.paid_until || null,
      contact_name: cleanText(body.contact_name, 80),
      contact_note: cleanText(body.contact_note, 500)
    })
    .select(companySafeSelect)
    .single();

  if (error) return databaseError(error, "登录账号已存在，请更换后重试。");
  return NextResponse.json({ company: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { response, supabase } = await requirePlatformAdmin();
  if (response) return response;

  const body = await readJsonBody<{
    id?: string;
    name?: string;
    login_username?: string;
    login_password?: string;
    status?: CompanyStatus;
    paid_until?: string | null;
    contact_name?: string;
    contact_note?: string;
  }>(request);
  if (!body) return jsonError("请求格式不正确。");

  if (!body.id) return jsonError("缺少企业 ID。");

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, 120);
    if (!name) return jsonError("用户名称不能为空。");
    patch.name = name;
  }
  if (body.login_username !== undefined) {
    const loginUsername = cleanText(body.login_username, 80).toLocaleLowerCase();
    if (!loginUsername) return jsonError("登录账号不能为空。");
    patch.login_username = loginUsername;
  }
  if (body.login_password) {
    if (body.login_password.length < 6) return jsonError("新密码至少 6 位。");
    patch.password_hash = hashPassword(body.login_password);
  }
  if (body.status !== undefined) patch.status = body.status === "active" ? "active" : "inactive";
  if (body.paid_until !== undefined) {
    if (body.paid_until && !/^\d{4}-\d{2}-\d{2}$/.test(body.paid_until)) {
      return jsonError("可用到期日格式不正确。");
    }
    patch.paid_until = body.paid_until || null;
  }
  if (body.contact_name !== undefined) patch.contact_name = cleanText(body.contact_name, 80);
  if (body.contact_note !== undefined) patch.contact_note = cleanText(body.contact_note, 500);

  const { data, error } = await supabase.from("companies").update(patch).eq("id", body.id).select(companySafeSelect).single();

  if (error) return databaseError(error, "登录账号已存在，请更换后重试。");
  return NextResponse.json({ company: data });
}

export async function DELETE(request: Request) {
  const { response, supabase } = await requirePlatformAdmin();
  if (response) return response;

  const body = await readJsonBody<{ id?: string }>(request);
  if (!body) return jsonError("请求格式不正确。");
  const companyId = cleanText(body.id, 80);

  if (!companyId) return jsonError("缺少用户 ID。");

  const { data, error: companyError } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)
    .select("id")
    .maybeSingle();
  if (companyError) return databaseError(companyError);
  if (!data) return jsonError("用户不存在。", 404);

  return NextResponse.json({ ok: true, id: companyId });
}
