import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api";
import { buildQuotationPng, createQuotationExportContext } from "@/lib/quotation-export";
import type { QuotationExportRequest } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await readJsonBody<QuotationExportRequest>(request);
  const result = await createQuotationExportContext(body);
  if (!result.context) return NextResponse.json({ error: result.error }, { status: result.status });

  try {
    const png = await buildQuotationPng(result.context);
    const encoded = encodeURIComponent(`${result.context.company.slug}-报价单.png`);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="quotation.png"; filename*=UTF-8''${encoded}`,
        "Content-Type": "image/png"
      }
    });
  } catch {
    return NextResponse.json({ error: "报价单图片生成失败，请稍后重试。" }, { status: 500 });
  }
}
