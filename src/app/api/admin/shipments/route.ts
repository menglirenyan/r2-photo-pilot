import { NextResponse } from "next/server";
import { cleanText, jsonError, requireAdmin, requireCompanyAccess } from "@/lib/api";
import type { ShipmentDraftItem } from "@/types";

export async function POST(request: Request) {
  const { response, supabase, session } = await requireAdmin();
  if (response) return response;

  const body = (await request.json()) as {
    company_id?: string;
    title?: string;
    customer_name?: string;
    note?: string;
    items?: ShipmentDraftItem[];
  };

  const companyId = cleanText(body.company_id, 80);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!companyId || items.length === 0) {
    return jsonError("企业和出货明细不能为空。");
  }

  const accessError = await requireCompanyAccess(supabase, session, companyId);
  if (accessError) return accessError;

  const normalized = items
    .map((item, index) => {
      const unitPrice = Number(item.unit_price || 0);
      const quantity = Number(item.quantity || 1);
      return {
        product_id: item.product_id || null,
        name: cleanText(item.name, 120),
        specification: cleanText(item.specification, 160),
        unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? Number(unitPrice.toFixed(2)) : 0,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
        sort_order: index
      };
    })
    .filter((item) => item.name);

  if (normalized.length === 0) {
    return jsonError("出货明细缺少产品名称。");
  }

  const total = normalized.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const { data: sheet, error: sheetError } = await supabase
    .from("shipment_sheets")
    .insert({
      company_id: companyId,
      title: cleanText(body.title || "出货单", 120),
      customer_name: cleanText(body.customer_name, 120),
      note: cleanText(body.note, 500),
      total_price: Number(total.toFixed(2))
    })
    .select("*")
    .single();

  if (sheetError || !sheet) return jsonError(sheetError?.message || "创建出货单失败。", 500);

  const { data: sheetItems, error: itemError } = await supabase
    .from("shipment_sheet_items")
    .insert(
      normalized.map((item) => ({
        shipment_sheet_id: sheet.id,
        product_id: item.product_id,
        name: item.name,
        specification: item.specification,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_price: Number((item.unit_price * item.quantity).toFixed(2)),
        sort_order: item.sort_order
      }))
    )
    .select("*");

  if (itemError) return jsonError(itemError.message, 500);

  return NextResponse.json({ shipmentSheet: sheet, items: sheetItems ?? [] }, { status: 201 });
}
