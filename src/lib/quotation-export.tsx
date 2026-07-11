import { readFile } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import satori from "satori";
import sharp from "sharp";
import { getAuthSession } from "@/lib/auth";
import { getCompanyAdminSnapshot } from "@/lib/data";
import { normalizeQuotationRequest, quotationMoney, type NormalizedQuotation } from "@/lib/quotation";
import type { Company, Product, QuotationExportRequest } from "@/types";

type ExportImage = {
  dataUrl: string | null;
  png: Buffer | null;
};

export type QuotationExportContext = {
  company: Company;
  quotation: NormalizedQuotation;
  products: Product[];
  images: ExportImage[];
};

const fontPath = path.join(process.cwd(), "src", "assets", "fonts", "NotoSansCJKsc-Regular.otf");
let fontPromise: Promise<Buffer> | null = null;

function quoteFont() {
  fontPromise ??= readFile(fontPath);
  return fontPromise;
}

async function readProductImage(imageUrl: string): Promise<Buffer | null> {
  try {
    let source: Buffer;
    if (imageUrl.startsWith("/demo-products/")) {
      const publicRoot = path.join(process.cwd(), "public");
      const candidate = path.resolve(publicRoot, imageUrl.replace(/^\/+/, ""));
      if (!candidate.startsWith(publicRoot)) return null;
      source = await readFile(candidate);
    } else {
      const configuredBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
      if (!configuredBase || !imageUrl.startsWith(`${configuredBase}/`)) return null;
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 8 * 1024 * 1024) return null;
      source = Buffer.from(bytes);
    }

    return await sharp(source)
      .rotate()
      .resize(260, 180, { fit: "contain", background: "#ffffff", withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();
  } catch {
    return null;
  }
}

async function loadImages(products: Product[]) {
  const result: ExportImage[] = [];
  for (let index = 0; index < products.length; index += 4) {
    const group = products.slice(index, index + 4);
    const buffers = await Promise.all(group.map((product) => readProductImage(product.image_url)));
    result.push(
      ...buffers.map((png) => ({
        png,
        dataUrl: png ? `data:image/png;base64,${png.toString("base64")}` : null
      }))
    );
  }
  return result;
}

export async function createQuotationExportContext(body: QuotationExportRequest | null): Promise<
  | { context: QuotationExportContext; error: null; status: 200 }
  | { context: null; error: string; status: number }
> {
  const normalized = normalizeQuotationRequest(body);
  if (!normalized.value) return { context: null, error: normalized.error, status: 400 };

  const session = await getAuthSession();
  if (!session) return { context: null, error: "未登录或登录已过期。", status: 401 };
  if (session.role === "company" && session.companySlug !== normalized.value.company_slug) {
    return { context: null, error: "不能导出其他企业的报价单。", status: 403 };
  }

  const snapshot = await getCompanyAdminSnapshot(normalized.value.company_slug);
  const company = snapshot?.companies[0];
  if (!snapshot || !company) return { context: null, error: "企业不存在或当前不可访问。", status: 404 };

  const productsById = new Map(snapshot.products.map((product) => [product.id, product]));
  const products: Product[] = [];
  for (const item of normalized.value.items) {
    const product = productsById.get(item.product_id);
    if (!product || product.company_id !== company.id) {
      return { context: null, error: "报价单包含不属于当前企业的产品。", status: 403 };
    }
    products.push(product);
  }

  return {
    context: {
      company,
      quotation: normalized.value,
      products,
      images: await loadImages(products)
    },
    error: null,
    status: 200
  };
}

const cell = (width: number, children: React.ReactNode, extra: React.CSSProperties = {}) => (
  <div
    style={{
      width,
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "14px",
      borderRight: "1px solid #d7ded9",
      textAlign: "center",
      lineHeight: 1.45,
      ...extra
    }}
  >
    {children}
  </div>
);

export async function buildQuotationPng({ company, quotation, products, images }: QuotationExportContext) {
  const width = 1200;
  const rowHeight = 210;
  const height = 250 + quotation.items.length * rowHeight + 125;
  const font = await quoteFont();
  const columns = [180, 300, 180, 110, 150, 200];

  const svg = await satori(
    <div style={{ width, height, display: "flex", flexDirection: "column", padding: "38px 40px", color: "#15221d", background: "#f5f6f3", fontFamily: "Noto Sans SC" }}>
      <div style={{ height: 132, display: "flex", justifyContent: "space-between", padding: "24px 28px", background: "#123c32", color: "#ffffff" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 15, letterSpacing: 3, color: "#a8d5c8" }}>PRODUCT QUOTATION</span>
          <span style={{ marginTop: 10, fontSize: 34, fontWeight: 700 }}>{quotation.title}</span>
          <span style={{ marginTop: 8, fontSize: 17 }}>{company.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", fontSize: 16, lineHeight: 1.7 }}>
          <span>客户：{quotation.customer_name || "未填写"}</span>
          <span>日期：{new Date().toLocaleDateString("zh-CN")}</span>
          <span>共 {quotation.items.length} 项</span>
        </div>
      </div>

      <div style={{ height: 52, display: "flex", background: "#e6eee9", border: "1px solid #cbd7d0", fontSize: 16, fontWeight: 700 }}>
        {cell(columns[0], "产品名称")}
        {cell(columns[1], "产品图片")}
        {cell(columns[2], "尺寸 / 规格")}
        {cell(columns[3], "数量")}
        {cell(columns[4], "单价")}
        {cell(columns[5], "参考合计", { borderRight: "0" })}
      </div>

      {quotation.items.map((item, index) => (
        <div key={`${item.product_id}-${index}`} style={{ height: rowHeight, display: "flex", background: index % 2 === 0 ? "#ffffff" : "#fbfcfa", borderLeft: "1px solid #d7ded9", borderRight: "1px solid #d7ded9", borderBottom: "1px solid #d7ded9", fontSize: 17 }}>
          {cell(columns[0], <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><strong>{item.name}</strong><span style={{ marginTop: 8, color: "#637168", fontSize: 14 }}>{products[index].product_code}</span></div>)}
          {cell(columns[1], images[index].dataUrl ? <img alt="" src={images[index].dataUrl!} style={{ width: 260, height: 180, objectFit: "contain" }} /> : <span style={{ color: "#7b8780" }}>暂无图片</span>)}
          {cell(columns[2], item.specification || "-")}
          {cell(columns[3], String(item.quantity))}
          {cell(columns[4], quotationMoney(item.unit_price))}
          {cell(columns[5], <strong style={{ fontSize: 20, color: item.line_price === null ? "#6c7871" : "#0f766e" }}>{quotationMoney(item.line_price)}</strong>, { borderRight: "0" })}
        </div>
      ))}

      <div style={{ minHeight: 98, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px", background: "#ffffff", border: "1px solid #d7ded9", borderTop: "0" }}>
        <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", color: "#59675f", fontSize: 14 }}>
          <span>备注：{quotation.note || "无"}</span>
          <span style={{ marginTop: 7 }}>本报价单由当前页面临时生成，系统内不保存。</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ color: "#637168", fontSize: 17 }}>报价合计</span>
          <strong style={{ color: "#0f766e", fontSize: 32 }}>{quotationMoney(quotation.total_price)}</strong>
        </div>
      </div>
    </div>,
    {
      width,
      height,
      fonts: [
        { name: "Noto Sans SC", data: font, weight: 400, style: "normal" },
        { name: "Noto Sans SC", data: font, weight: 700, style: "normal" }
      ]
    }
  );

  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}

export async function buildQuotationXlsx({ company, quotation, products, images }: QuotationExportContext) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "货物产品册";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("报价单", { views: [{ state: "frozen", ySplit: 4 }] });
  sheet.columns = [
    { key: "name", width: 28 },
    { key: "image", width: 20 },
    { key: "specification", width: 28 },
    { key: "quantity", width: 12 },
    { key: "unit_price", width: 16 },
    { key: "line_price", width: 18 }
  ];

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = quotation.title;
  sheet.getCell("A1").font = { name: "Microsoft YaHei", bold: true, size: 22, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123C32" } };
  sheet.getRow(1).height = 34;

  sheet.mergeCells("A2:C2");
  sheet.getCell("A2").value = `企业：${company.name}`;
  sheet.mergeCells("D2:F2");
  sheet.getCell("D2").value = `客户：${quotation.customer_name || "未填写"}　日期：${new Date().toLocaleDateString("zh-CN")}`;
  sheet.getCell("D2").alignment = { horizontal: "right" };

  const header = sheet.getRow(4);
  header.values = ["产品名称", "产品图片", "尺寸 / 规格", "数量", "单价", "参考合计"];
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { name: "Microsoft YaHei", bold: true, color: { argb: "FF173B31" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EEE9" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  quotation.items.forEach((item, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);
    row.values = [
      `${item.name}\n${products[index].product_code}`,
      images[index].png ? "" : "暂无图片",
      item.specification,
      item.quantity,
      item.unit_price,
      item.line_price
    ];
    row.height = 86;
    if (images[index].png) {
      const imageId = workbook.addImage({ base64: images[index].png!.toString("base64"), extension: "png" });
      sheet.addImage(imageId, { tl: { col: 1.16, row: rowNumber - 0.86 }, ext: { width: 110, height: 76 } });
    }
    row.eachCell((cell, column) => {
      cell.font = { name: "Microsoft YaHei", size: 11 };
      cell.alignment = { horizontal: column >= 4 ? "center" : "left", vertical: "middle", wrapText: true };
      if (column === 5 || column === 6) cell.numFmt = '¥0.00;[Red]-¥0.00';
    });
  });

  const totalRowNumber = quotation.items.length + 5;
  sheet.mergeCells(`A${totalRowNumber}:E${totalRowNumber}`);
  sheet.getCell(`A${totalRowNumber}`).value = "报价合计";
  sheet.getCell(`A${totalRowNumber}`).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell(`F${totalRowNumber}`).value = quotation.total_price;
  sheet.getCell(`F${totalRowNumber}`).numFmt = '¥0.00;[Red]-¥0.00';
  sheet.getRow(totalRowNumber).font = { name: "Microsoft YaHei", bold: true, size: 13, color: { argb: "FF0F766E" } };

  const noteRow = totalRowNumber + 1;
  sheet.mergeCells(`A${noteRow}:F${noteRow}`);
  sheet.getCell(`A${noteRow}`).value = `备注：${quotation.note || "无"}\n本报价单由当前页面临时生成，系统内不保存。`;
  sheet.getCell(`A${noteRow}`).alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(noteRow).height = 38;

  for (let row = 2; row <= noteRow; row += 1) {
    sheet.getRow(row).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD7DED9" } },
        left: { style: "thin", color: { argb: "FFD7DED9" } },
        bottom: { style: "thin", color: { argb: "FFD7DED9" } },
        right: { style: "thin", color: { argb: "FFD7DED9" } }
      };
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
