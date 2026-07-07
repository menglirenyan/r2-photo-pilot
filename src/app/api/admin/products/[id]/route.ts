import { NextResponse } from "next/server";
import { cleanText, jsonError, requireAdmin } from "@/lib/api";
import { parseMoney } from "@/lib/format";
import type { ProductStatus } from "@/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const { response, supabase } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    specification?: string;
    unit_price?: number | string | null;
    description?: string;
    status?: ProductStatus;
    sort_order?: number;
  };

  const patch = {
    name: body.name === undefined ? undefined : cleanText(body.name, 120),
    specification: body.specification === undefined ? undefined : cleanText(body.specification, 160),
    unit_price: body.unit_price === undefined ? undefined : parseMoney(body.unit_price),
    description: body.description === undefined ? undefined : cleanText(body.description, 1200),
    status: body.status === "hidden" ? "hidden" : body.status === "active" ? "active" : undefined,
    sort_order: body.sort_order === undefined ? undefined : Number(body.sort_order)
  };

  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("*,categories(id,name,code)").single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ product: data });
}
