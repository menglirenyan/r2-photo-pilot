"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, ImageDown, LogOut, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { shipmentCacheKey, type ShipmentCachePayload } from "@/lib/shipment-cache";
import type { Company, ShipmentDraftItem } from "@/types";

type ShipmentWorkspaceProps = {
  company: Pick<Company, "id" | "name" | "slug">;
  configured: boolean;
};

type ShipmentMeta = {
  customer_name: string;
  note: string;
  title: string;
};

const initialMeta: ShipmentMeta = {
  customer_name: "",
  note: "",
  title: "出货单"
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  const raw = text || "-";
  if (ctx.measureText(raw).width <= maxWidth) {
    ctx.fillText(raw, x, y);
    return;
  }

  let next = raw;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  ctx.fillText(`${next}...`, x, y);
}

function normalizeQuantity(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1;
}

export function ShipmentWorkspace({ company, configured }: ShipmentWorkspaceProps) {
  const router = useRouter();
  const [items, setItems] = useState<ShipmentDraftItem[]>([]);
  const [meta, setMeta] = useState<ShipmentMeta>(initialMeta);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.unit_price || 0) * normalizeQuantity(Number(item.quantity || 1)), 0),
    [items]
  );

  useEffect(() => {
    const key = shipmentCacheKey(company.slug);
    const cached = window.sessionStorage.getItem(key);
    if (!cached) return;

    try {
      const payload = JSON.parse(cached) as ShipmentCachePayload;
      if (payload.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(key);
        setMessage("临时出货单已过期，请从产品列表重新生成。");
        return;
      }

      setItems(payload.items);
      setExpiresAt(payload.expiresAt);
    } catch {
      window.sessionStorage.removeItem(key);
      setMessage("临时出货单缓存不可读取，请从产品列表重新生成。");
    }
  }, [company.slug]);

  useEffect(() => {
    if (!expiresAt) return;
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(shipmentCacheKey(company.slug));
      setItems([]);
      setExpiresAt(null);
      setMessage("临时出货单已过期并自动清理。");
    }, delay);

    return () => window.clearTimeout(timer);
  }, [company.slug, expiresAt]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(`/${company.slug}`);
  }

  function updateItem(index: number, patch: Partial<ShipmentDraftItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function clearDraft() {
    window.sessionStorage.removeItem(shipmentCacheKey(company.slug));
    setItems([]);
    setExpiresAt(null);
    setMessage("临时出货单已清空。");
  }

  function downloadExcel() {
    const rows = items
      .map((item) => {
        const quantity = normalizeQuantity(Number(item.quantity || 1));
        const lineTotal = Number(item.unit_price || 0) * quantity;
        return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.specification)}</td><td>${item.unit_price}</td><td>${quantity}</td><td>${lineTotal.toFixed(2)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><caption>${escapeHtml(
      meta.title || "出货单"
    )}</caption><tr><td>企业</td><td>${escapeHtml(company.name)}</td><td>客户</td><td>${escapeHtml(
      meta.customer_name || "-"
    )}</td><td>日期</td><td>${new Date().toLocaleDateString("zh-CN")}</td></tr><tr><th>名称</th><th>规格</th><th>单价</th><th>数量</th><th>价格</th></tr>${rows}<tr><td colspan="4">总计</td><td>${total.toFixed(
      2
    )}</td></tr><tr><td>备注</td><td colspan="4">${escapeHtml(meta.note)}</td></tr></table></body></html>`;

    downloadBlob(new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" }), `${company.slug}-出货单.xls`);
  }

  function downloadPng() {
    const width = 1200;
    const rowHeight = 46;
    const height = 240 + Math.max(items.length, 1) * rowHeight + 80;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setMessage("当前浏览器无法生成图片。");
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#17201c";
    ctx.textBaseline = "middle";
    ctx.font = "700 38px Microsoft YaHei, Arial";
    ctx.textAlign = "center";
    ctx.fillText(meta.title || "出货单", width / 2, 58);

    ctx.textAlign = "left";
    ctx.font = "20px Microsoft YaHei, Arial";
    ctx.fillText(`企业：${company.name}`, 60, 112);
    ctx.fillText(`客户：${meta.customer_name || "-"}`, 430, 112);
    ctx.fillText(`日期：${new Date().toLocaleDateString("zh-CN")}`, 780, 112);

    const columns = [
      { title: "名称", x: 60, width: 350 },
      { title: "规格", x: 410, width: 260 },
      { title: "单价", x: 670, width: 130 },
      { title: "数量", x: 800, width: 110 },
      { title: "价格", x: 910, width: 210 }
    ];
    let y = 160;
    ctx.fillStyle = "#f1f4f2";
    ctx.fillRect(50, y - 24, 1100, rowHeight);
    ctx.fillStyle = "#17201c";
    ctx.font = "700 20px Microsoft YaHei, Arial";
    columns.forEach((column) => drawText(ctx, column.title, column.x, y, column.width - 18));

    ctx.font = "18px Microsoft YaHei, Arial";
    items.forEach((item) => {
      const quantity = normalizeQuantity(Number(item.quantity || 1));
      const lineTotal = Number(item.unit_price || 0) * quantity;
      y += rowHeight;
      ctx.strokeStyle = "#dde4df";
      ctx.beginPath();
      ctx.moveTo(50, y - 24);
      ctx.lineTo(1150, y - 24);
      ctx.stroke();
      drawText(ctx, item.name, columns[0].x, y, columns[0].width - 18);
      drawText(ctx, item.specification, columns[1].x, y, columns[1].width - 18);
      drawText(ctx, formatPrice(Number(item.unit_price || 0)), columns[2].x, y, columns[2].width - 18);
      drawText(ctx, String(quantity), columns[3].x, y, columns[3].width - 18);
      drawText(ctx, formatPrice(lineTotal), columns[4].x, y, columns[4].width - 18);
    });

    y += rowHeight;
    ctx.font = "700 22px Microsoft YaHei, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`总计 ${formatPrice(total)}`, 1120, y);
    ctx.textAlign = "left";
    ctx.font = "18px Microsoft YaHei, Arial";
    drawText(ctx, `备注：${meta.note || "-"}`, 60, y + 44, 1060);

    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage("图片生成失败。");
        return;
      }
      downloadBlob(blob, `${company.slug}-出货单.png`);
    }, "image/png");
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>货</span>
          <div>
            <strong>货物产品册</strong>
            <small>出货单</small>
          </div>
        </div>
        <nav>
          <a href={`/${company.slug}`}>产品列表</a>
          <a href={`/${company.slug}/upload`}>上传产品</a>
          <a className="active" href={`/${company.slug}/shipments`}>
            出货单
          </a>
        </nav>
        <button className="sidebar-button" onClick={logout} type="button">
          <LogOut size={16} />
          退出
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>出货单</h1>
            <p>{company.name}</p>
          </div>
          <div className="admin-top-actions">
            <a className="ghost-action" href={`/${company.slug}`}>
              <ArrowLeft size={16} />
              返回产品列表
            </a>
          </div>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message">{message}</div> : null}

        {items.length === 0 ? (
          <section className="admin-panel shipment-empty-panel">
            <FileSpreadsheet size={26} />
            <h2>暂无临时出货单</h2>
            <a className="primary-action" href={`/${company.slug}`}>
              返回产品列表
            </a>
          </section>
        ) : (
          <section className="shipment-layout">
            <section className="admin-panel shipment-editor">
              <div className="panel-title">
                <FileSpreadsheet size={18} />
                <h2>编辑出货单</h2>
              </div>
              <div className="field-grid two">
                <label>
                  标题
                  <input value={meta.title} onChange={(event) => setMeta({ ...meta, title: event.target.value })} />
                </label>
                <label>
                  客户
                  <input
                    value={meta.customer_name}
                    onChange={(event) => setMeta({ ...meta, customer_name: event.target.value })}
                  />
                </label>
              </div>
              <div className="shipment-table">
                <div className="shipment-head">
                  <span>名称</span>
                  <span>规格</span>
                  <span>单价</span>
                  <span>数量</span>
                  <span>价格</span>
                </div>
                {items.map((item, index) => {
                  const quantity = normalizeQuantity(Number(item.quantity || 1));

                  return (
                    <div className="shipment-line" key={`${item.product_id}-${index}`}>
                      <input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
                      <input
                        value={item.specification}
                        onChange={(event) => updateItem(index, { specification: event.target.value })}
                      />
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.unit_price}
                        onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })}
                      />
                      <input
                        min="1"
                        step="1"
                        type="number"
                        value={quantity}
                        onChange={(event) => updateItem(index, { quantity: normalizeQuantity(Number(event.target.value)) })}
                      />
                      <strong>{formatPrice(Number(item.unit_price || 0) * quantity)}</strong>
                    </div>
                  );
                })}
              </div>
              <label className="wide">
                备注
                <textarea value={meta.note} onChange={(event) => setMeta({ ...meta, note: event.target.value })} />
              </label>
              <div className="shipment-actions">
                <strong>合计 {formatPrice(total)}</strong>
                <button className="ghost-action" onClick={downloadPng} type="button">
                  <ImageDown size={16} />
                  下载图片
                </button>
                <button className="ghost-action" onClick={downloadExcel} type="button">
                  <Download size={16} />
                  下载 Excel
                </button>
                <button className="danger-action" onClick={clearDraft} type="button">
                  <Trash2 size={16} />
                  清空
                </button>
              </div>
            </section>

            <section className="print-sheet admin-panel">
              <h2>{meta.title || "出货单"}</h2>
              <p>
                企业：{company.name}　客户：{meta.customer_name || "-"}　日期：
                {new Date().toLocaleDateString("zh-CN")}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>规格</th>
                    <th>单价</th>
                    <th>数量</th>
                    <th>价格</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const quantity = normalizeQuantity(Number(item.quantity || 1));
                    return (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.specification}</td>
                        <td>{formatPrice(Number(item.unit_price || 0))}</td>
                        <td>{quantity}</td>
                        <td>{formatPrice(Number(item.unit_price || 0) * quantity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>总计</td>
                    <td>{formatPrice(total)}</td>
                  </tr>
                </tfoot>
              </table>
              <p>{meta.note}</p>
            </section>
          </section>
        )}
      </section>
    </main>
  );
}
