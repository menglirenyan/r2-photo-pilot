import { NextResponse } from "next/server";
import { cleanText, jsonError, requireAdmin } from "@/lib/api";
import { toSlug } from "@/lib/format";
import type { CompanyStatus } from "@/types";

export async function POST(request: Request) {
  const { response, supabase } = await requireAdmin();
  if (response) return response;

  const body = (await request.json()) as {
    name?: string;
    slug?: string;
    status?: CompanyStatus;
    paid_until?: string | null;
    contact_name?: string;
    contact_note?: string;
  };

  const name = cleanText(body.name, 120);
  const slug = toSlug(body.slug || body.name || "");

  if (!name || !slug) {
    return jsonError("企业名称和链接标识必填。");
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      slug,
      status: body.status === "active" ? "active" : "inactive",
      paid_until: body.paid_until || null,
      contact_name: cleanText(body.contact_name, 80),
      contact_note: cleanText(body.contact_note, 500)
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ company: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { response, supabase } = await requireAdmin();
  if (response) return response;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    slug?: string;
    status?: CompanyStatus;
    paid_until?: string | null;
    contact_name?: string;
    contact_note?: string;
  };

  if (!body.id) return jsonError("缺少企业 ID。");

  const patch = {
    name: body.name ? cleanText(body.name, 120) : undefined,
    slug: body.slug ? toSlug(body.slug) : undefined,
    status: body.status === "active" ? "active" : "inactive",
    paid_until: body.paid_until || null,
    contact_name: cleanText(body.contact_name, 80),
    contact_note: cleanText(body.contact_note, 500)
  };

  const { data, error } = await supabase.from("companies").update(patch).eq("id", body.id).select("*").single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ company: data });
}

export async function DELETE(request: Request) {
  const { response, supabase } = await requireAdmin();
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
