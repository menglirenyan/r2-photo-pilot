import { NextResponse } from "next/server";
import { cleanText, jsonError, requirePlatformAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import type { CompanyStatus } from "@/types";

const companySafeSelect =
  "id,company_number,name,slug,login_username,status,paid_until,contact_name,contact_note,created_at,updated_at";

export async function POST(request: Request) {
  const { response, supabase } = await requirePlatformAdmin();
  if (response) return response;

  const body = (await request.json()) as {
    name?: string;
    login_username?: string;
    login_password?: string;
    status?: CompanyStatus;
    paid_until?: string | null;
    contact_name?: string;
    contact_note?: string;
  };

  const name = cleanText(body.name, 120);
  const loginUsername = cleanText(body.login_username, 80);
  const loginPassword = String(body.login_password ?? "");

  if (!name || !loginUsername || loginPassword.length < 6) {
    return jsonError("用户名称、登录账号和至少 6 位登录密码必填。");
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

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ company: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { response, supabase } = await requirePlatformAdmin();
  if (response) return response;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    login_username?: string;
    login_password?: string;
    status?: CompanyStatus;
    paid_until?: string | null;
    contact_name?: string;
    contact_note?: string;
  };

  if (!body.id) return jsonError("缺少企业 ID。");

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = cleanText(body.name, 120);
  if (body.login_username !== undefined) patch.login_username = cleanText(body.login_username, 80);
  if (body.login_password) {
    if (body.login_password.length < 6) return jsonError("新密码至少 6 位。");
    patch.password_hash = hashPassword(body.login_password);
  }
  if (body.status !== undefined) patch.status = body.status === "active" ? "active" : "inactive";
  if (body.paid_until !== undefined) patch.paid_until = body.paid_until || null;
  if (body.contact_name !== undefined) patch.contact_name = cleanText(body.contact_name, 80);
  if (body.contact_note !== undefined) patch.contact_note = cleanText(body.contact_note, 500);

  const { data, error } = await supabase.from("companies").update(patch).eq("id", body.id).select(companySafeSelect).single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ company: data });
}

export async function DELETE(request: Request) {
  const { response, supabase } = await requirePlatformAdmin();
  if (response) return response;

  const body = (await request.json()) as { id?: string };
  const companyId = cleanText(body.id, 80);

  if (!companyId) return jsonError("缺少用户 ID。");

  const { error: shipmentError } = await supabase.from("shipment_sheets").delete().eq("company_id", companyId);
  if (shipmentError) return jsonError(shipmentError.message, 500);

  const { error: productError } = await supabase.from("products").delete().eq("company_id", companyId);
  if (productError) return jsonError(productError.message, 500);

  const { error: categoryError } = await supabase.from("categories").delete().eq("company_id", companyId);
  if (categoryError) return jsonError(categoryError.message, 500);

  const { error: companyError } = await supabase.from("companies").delete().eq("id", companyId);
  if (companyError) return jsonError(companyError.message, 500);

  return NextResponse.json({ ok: true, id: companyId });
}
