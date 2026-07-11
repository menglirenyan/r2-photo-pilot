import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api";
import { buildQuotationXlsx, createQuotationExportContext } from "@/lib/quotation-export";
import type { QuotationExportRequest } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await readJsonBody<QuotationExportRequest>(request);
  const result = await createQuotationExportContext(body);
  if (!result.context) return NextResponse.json({ error: result.error }, { status: result.status });

  try {
    const workbook = await buildQuotationXlsx(result.context);
    const encoded = encodeURIComponent(`${result.context.company.slug}-报价单.xlsx`);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="quotation.xlsx"; filename*=UTF-8''${encoded}`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    });
  } catch {
    return NextResponse.json({ error: "Excel 报价单生成失败，请稍后重试。" }, { status: 500 });
  }
}
