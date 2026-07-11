import type { QuotationExportRequest } from "@/types";

export type NormalizedQuotationItem = {
  product_id: string;
  name: string;
  specification: string;
  quantity: number;
  unit_price: number | null;
  line_price: number | null;
};

export type NormalizedQuotation = {
  company_slug: string;
  title: string;
  customer_name: string;
  note: string;
  items: NormalizedQuotationItem[];
  total_price: number;
};

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function decimal(value: unknown, allowBlank = false) {
  const raw = String(value ?? "").replaceAll(",", "").trim();
  if (!raw && allowBlank) return null;
  if (!raw) return Number.NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function normalizeQuotationRequest(body: QuotationExportRequest | null):
  | { value: NormalizedQuotation; error: null }
  | { value: null; error: string } {
  if (!body || !Array.isArray(body.items)) return { value: null, error: "请求格式不正确。" };

  const companySlug = text(body.company_slug, 80).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(companySlug)) return { value: null, error: "企业编号不正确。" };
  if (body.items.length === 0) return { value: null, error: "请至少选择一个产品。" };
  if (body.items.length > 80) return { value: null, error: "每份报价单最多包含 80 个产品。" };

  const items: NormalizedQuotationItem[] = [];
  for (const [index, row] of body.items.entries()) {
    const name = text(row?.name, 80);
    const productId = text(row?.product_id, 80);
    const quantity = decimal(row?.quantity);
    const unitPrice = decimal(row?.unit_price, true);

    if (!name || !productId) return { value: null, error: `第 ${index + 1} 行缺少产品信息。` };
    if (quantity === null || !Number.isFinite(quantity)) {
      return { value: null, error: `第 ${index + 1} 行数量应为不小于 0 的数字。` };
    }
    if (unitPrice !== null && !Number.isFinite(unitPrice)) {
      return { value: null, error: `第 ${index + 1} 行单价应为不小于 0 的数字。` };
    }

    const roundedQuantity = Number(quantity.toFixed(4));
    const roundedPrice = unitPrice === null ? null : Number(unitPrice.toFixed(2));
    items.push({
      product_id: productId,
      name,
      specification: text(row.specification, 80),
      quantity: roundedQuantity,
      unit_price: roundedPrice,
      line_price: roundedPrice === null ? null : Number((roundedQuantity * roundedPrice).toFixed(2))
    });
  }

  return {
    value: {
      company_slug: companySlug,
      title: text(body.title, 120) || "产品报价单",
      customer_name: text(body.customer_name, 120),
      note: text(body.note, 500),
      items,
      total_price: Number(items.reduce((sum, item) => sum + (item.line_price ?? 0), 0).toFixed(2))
    },
    error: null
  };
}

export function quotationMoney(value: number | null) {
  return value === null ? "待议" : `¥${value.toFixed(2)}`;
}
