"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileImage, FileSpreadsheet, ImageIcon, Trash2, X } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { formatPrice } from "@/lib/format";
import { quotationCacheKey, quotationCacheTtlMs, readQuotationCache } from "@/lib/quotation-cache";
import type { Company, Product, QuotationCachePayload, QuotationDraftItem, QuotationMeta } from "@/types";

type QuotationSeed = {
  nonce: number;
  products: Product[];
};

type QuotationComposerProps = {
  company: Pick<Company, "id" | "name" | "slug">;
  open: boolean;
  seed: QuotationSeed | null;
  onClose: () => void;
  onDraftChange: (hasDraft: boolean) => void;
  onMessage: (message: string) => void;
};

const initialMeta: QuotationMeta = {
  title: "产品报价单",
  customer_name: "",
  note: "本报价单由当前页面临时生成，系统内不保存。"
};

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function lineAmount(item: QuotationDraftItem) {
  const quantity = parseNumber(item.quantity);
  const price = parseNumber(item.unit_price);
  return quantity === null || price === null ? null : quantity * price;
}

function makeFilename(companySlug: string, extension: "png" | "xlsx") {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return `${companySlug}-报价单-${stamp}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function QuotationComposer({
  company,
  open,
  seed,
  onClose,
  onDraftChange,
  onMessage
}: QuotationComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hydratedRef = useRef(false);
  const lastSeedRef = useRef(0);
  const [items, setItems] = useState<QuotationDraftItem[]>([]);
  const [meta, setMeta] = useState<QuotationMeta>(initialMeta);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState<"png" | "xlsx" | null>(null);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (lineAmount(item) ?? 0), 0),
    [items]
  );

  useEffect(() => {
    const key = quotationCacheKey(company.slug);
    const cached = readQuotationCache(window.sessionStorage.getItem(key));
    if (cached) {
      setItems(cached.items);
      setMeta(cached.meta);
      setExpiresAt(cached.expires_at);
      onDraftChange(cached.items.length > 0);
    } else {
      window.sessionStorage.removeItem(key);
    }
    hydratedRef.current = true;
  }, [company.slug, onDraftChange]);

  useEffect(() => {
    if (!seed || seed.nonce === lastSeedRef.current) return;
    lastSeedRef.current = seed.nonce;
    const now = Date.now();
    const nextItems = seed.products.slice(0, 80).map<QuotationDraftItem>((product) => ({
      product_id: product.id,
      product_code: product.product_code,
      image_url: product.image_url,
      name: product.name,
      specification: product.specification,
      quantity: "1",
      unit_price: product.unit_price === null ? "" : String(product.unit_price)
    }));
    setItems(nextItems);
    setMeta(initialMeta);
    setExpiresAt(now + quotationCacheTtlMs);
    setStatus(`已加入 ${nextItems.length} 个产品，可继续修改报价内容。`);
  }, [seed]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const key = quotationCacheKey(company.slug);
    if (items.length === 0 || !expiresAt) {
      window.sessionStorage.removeItem(key);
      onDraftChange(false);
      return;
    }

    const payload: QuotationCachePayload = {
      company,
      created_at: Date.now(),
      expires_at: expiresAt,
      meta,
      items
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
    onDraftChange(true);
  }, [company, expiresAt, items, meta, onDraftChange]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(quotationCacheKey(company.slug));
      setItems([]);
      setExpiresAt(null);
      setStatus("");
      onDraftChange(false);
      onMessage("临时报价单已过期并自动清理。");
      onClose();
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [company.slug, expiresAt, onClose, onDraftChange, onMessage]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function updateItem(index: number, patch: Partial<QuotationDraftItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearDraft() {
    window.sessionStorage.removeItem(quotationCacheKey(company.slug));
    setItems([]);
    setMeta(initialMeta);
    setExpiresAt(null);
    setStatus("报价单草稿已清空。");
    onDraftChange(false);
  }

  function validationError() {
    if (items.length === 0) return "请先选择至少一个产品。";
    if (items.length > 80) return "每份报价单最多包含 80 个产品。";
    for (const [index, item] of items.entries()) {
      if (!item.name.trim()) return `第 ${index + 1} 行缺少产品名称。`;
      if (parseNumber(item.quantity) === null) return `第 ${index + 1} 行数量应为不小于 0 的数字。`;
      if (item.unit_price.trim() && parseNumber(item.unit_price) === null) {
        return `第 ${index + 1} 行单价应为不小于 0 的数字。`;
      }
    }
    return "";
  }

  async function exportQuotation(format: "png" | "xlsx") {
    const error = validationError();
    if (error) {
      setStatus(error);
      return;
    }

    setDownloading(format);
    setStatus(format === "png" ? "正在生成报价单图片…" : "正在生成 Excel…");
    try {
      const response = await fetch(`/api/admin/quotations/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_slug: company.slug,
          title: meta.title,
          customer_name: meta.customer_name,
          note: meta.note,
          items: items.map(({ product_id, name, specification, quantity, unit_price }) => ({
            product_id,
            name,
            specification,
            quantity,
            unit_price
          }))
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "报价单生成失败，请稍后重试。");
      }
      downloadBlob(await response.blob(), makeFilename(company.slug, format));
      setStatus(format === "png" ? "报价单图片已下载。" : "Excel 报价单已下载。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "报价单生成失败，请稍后重试。");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <dialog
      aria-labelledby="quotation-title"
      className="quotation-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="quotation-dialog-head">
        <div>
          <span className="eyebrow">临时文件 · 两小时有效</span>
          <h2 id="quotation-title">编辑报价单</h2>
          <p>{items.length > 0 ? `共 ${items.length} 项，修改后实时计算合计。` : "先从产品列表选择产品，再生成报价单。"}</p>
        </div>
        <button aria-label="关闭报价单" className="icon-button" onClick={onClose} type="button">
          <X size={20} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="quotation-empty">
          <FileSpreadsheet size={34} />
          <strong>报价单还是空的</strong>
          <p>关闭此窗口，在产品列表中勾选需要报价的产品。</p>
          <button className="primary-action" onClick={onClose} type="button">返回选择产品</button>
        </div>
      ) : (
        <>
          <div className="quotation-dialog-body">
            <section className="quotation-editor" aria-label="报价内容编辑">
              <div className="quotation-meta-grid">
                <label>
                  报价单标题
                  <input maxLength={120} value={meta.title} onChange={(event) => setMeta({ ...meta, title: event.target.value })} />
                </label>
                <label>
                  客户名称
                  <input maxLength={120} placeholder="可留空" value={meta.customer_name} onChange={(event) => setMeta({ ...meta, customer_name: event.target.value })} />
                </label>
              </div>

              <div className="quotation-line-list">
                {items.map((item, index) => {
                  const amount = lineAmount(item);
                  return (
                    <article className="quotation-line-card" key={`${item.product_id}-${index}`}>
                      <div className="quotation-line-image">
                        <SafeImage alt={item.name} sizes="84px" src={item.image_url} />
                      </div>
                      <div className="quotation-line-fields">
                        <div className="quotation-line-label">
                          <span>第 {index + 1} 项</span>
                          <code>{item.product_code}</code>
                        </div>
                        <label className="quotation-name-field">
                          产品名称
                          <input maxLength={80} value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
                        </label>
                        <label>
                          尺寸 / 规格
                          <input maxLength={80} value={item.specification} onChange={(event) => updateItem(index, { specification: event.target.value })} />
                        </label>
                        <label>
                          数量
                          <input inputMode="decimal" min="0" step="0.01" type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
                        </label>
                        <label>
                          单价
                          <input inputMode="decimal" min="0" placeholder="待议" step="0.01" type="number" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: event.target.value })} />
                        </label>
                        <div className="quotation-line-amount">
                          <span>小计</span>
                          <strong>{amount === null ? "待议" : formatPrice(amount)}</strong>
                        </div>
                        <button aria-label={`移除 ${item.name}`} className="quotation-remove" onClick={() => removeItem(index)} type="button">
                          <Trash2 size={16} />
                          移除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <label className="quotation-note">
                备注
                <textarea maxLength={500} value={meta.note} onChange={(event) => setMeta({ ...meta, note: event.target.value })} />
              </label>
            </section>

            <aside className="quotation-preview" aria-label="报价单预览">
              <div className="preview-paper">
                <span className="preview-kicker">QUOTATION</span>
                <h3>{meta.title || "产品报价单"}</h3>
                <p>{company.name}</p>
                <dl>
                  <div><dt>客户</dt><dd>{meta.customer_name || "未填写"}</dd></div>
                  <div><dt>日期</dt><dd>{new Date().toLocaleDateString("zh-CN")}</dd></div>
                </dl>
                <div className="preview-rows">
                  {items.slice(0, 5).map((item) => (
                    <div key={item.product_id}>
                      <ImageIcon size={14} />
                      <span>{item.name}</span>
                      <strong>{lineAmount(item) === null ? "待议" : formatPrice(lineAmount(item) ?? 0)}</strong>
                    </div>
                  ))}
                  {items.length > 5 ? <small>另有 {items.length - 5} 项…</small> : null}
                </div>
                <footer>
                  <span>报价合计</span>
                  <strong>{formatPrice(total)}</strong>
                </footer>
              </div>
            </aside>
          </div>

          <div className="quotation-actions">
            <div>
              <span>{status || "导出文件包含产品图片，可直接发送或继续编辑。"}</span>
              <strong>合计 {formatPrice(total)}</strong>
            </div>
            <button className="danger-action" disabled={Boolean(downloading)} onClick={clearDraft} type="button">
              <Trash2 size={16} />
              清空
            </button>
            <button className="ghost-action" disabled={Boolean(downloading)} onClick={() => exportQuotation("xlsx")} type="button">
              <Download size={16} />
              {downloading === "xlsx" ? "生成中…" : "下载 Excel"}
            </button>
            <button className="primary-action" disabled={Boolean(downloading)} onClick={() => exportQuotation("png")} type="button">
              <FileImage size={16} />
              {downloading === "png" ? "生成中…" : "下载图片"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
