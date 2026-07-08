"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  ImageDown,
  ImagePlus,
  LogOut,
  Pencil,
  Save,
  Trash2,
  X
} from "lucide-react";
import { ProductCardContent, ProductCatalogView } from "@/components/ProductCatalogView";
import { shipmentCacheKey, shipmentCacheTtlMs, type ShipmentCachePayload } from "@/lib/shipment-cache";
import { formatPrice } from "@/lib/format";
import type { Category, Company, Product, ProductStatus, ShipmentDraftItem } from "@/types";

type CompanyProductListWorkspaceProps = {
  categories: Category[];
  company: Company;
  configured: boolean;
  products: Product[];
};

type ProductEditForm = {
  description: string;
  name: string;
  specification: string;
  status: ProductStatus;
  unit_price: string;
};

type ShipmentMeta = {
  customer_name: string;
  note: string;
  title: string;
};

const initialShipmentMeta: ShipmentMeta = {
  customer_name: "",
  note: "",
  title: "出货单"
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "操作失败。";
}

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

function toEditForm(product: Product): ProductEditForm {
  return {
    description: product.description,
    name: product.name,
    specification: product.specification,
    status: product.status,
    unit_price: product.unit_price === null ? "" : String(product.unit_price)
  };
}

export function CompanyProductListWorkspace({
  categories,
  company,
  configured,
  products
}: CompanyProductListWorkspaceProps) {
  const router = useRouter();
  const [productList, setProductList] = useState(products);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null);
  const [shipmentItems, setShipmentItems] = useState<ShipmentDraftItem[]>([]);
  const [shipmentMeta, setShipmentMeta] = useState<ShipmentMeta>(initialShipmentMeta);
  const [shipmentExpiresAt, setShipmentExpiresAt] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const selectedProducts = useMemo(
    () => productList.filter((product) => selectedIds.includes(product.id)),
    [productList, selectedIds]
  );
  const editingProduct = productList.find((product) => product.id === editingId) ?? null;
  const shipmentTotal = useMemo(
    () =>
      shipmentItems.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * normalizeQuantity(Number(item.quantity || 1)),
        0
      ),
    [shipmentItems]
  );

  useEffect(() => {
    const cached = window.sessionStorage.getItem(shipmentCacheKey(company.slug));
    if (!cached) return;

    try {
      const payload = JSON.parse(cached) as ShipmentCachePayload;
      if (payload.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(shipmentCacheKey(company.slug));
        return;
      }
      setShipmentItems(payload.items);
      setShipmentExpiresAt(payload.expiresAt);
    } catch {
      window.sessionStorage.removeItem(shipmentCacheKey(company.slug));
    }
  }, [company.slug]);

  useEffect(() => {
    if (!shipmentExpiresAt) return;
    const timer = window.setTimeout(
      () => {
        window.sessionStorage.removeItem(shipmentCacheKey(company.slug));
        setShipmentItems([]);
        setShipmentExpiresAt(null);
        setMessage("临时出货单已过期并自动清理。");
      },
      Math.max(0, shipmentExpiresAt - Date.now())
    );

    return () => window.clearTimeout(timer);
  }, [company.slug, shipmentExpiresAt]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(`/${company.slug}`);
  }

  function toggleProductSelection(productId: string) {
    setMessage("");
    setSelectedIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]
    );
  }

  function startEditSelected() {
    if (selectedProducts.length !== 1) {
      setMessage("请选择 1 个产品后再修改。");
      return;
    }

    const product = selectedProducts[0];
    setEditingId(product.id);
    setEditForm(toEditForm(product));
    setMessage("");
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct || !editForm) return;

    const response = await fetch(`/api/admin/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        unit_price: editForm.unit_price.trim() === "" ? null : editForm.unit_price
      })
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const payload = (await response.json()) as { product: Product };
    setProductList((current) => current.map((product) => (product.id === payload.product.id ? payload.product : product)));
    setEditingId("");
    setEditForm(null);
    setMessage("产品已更新。");
  }

  async function deleteSelectedProducts() {
    if (selectedProducts.length === 0) {
      setMessage("请先选择要删除的产品。");
      return;
    }

    const confirmed = window.confirm(`确认删除已选择的 ${selectedProducts.length} 个产品？`);
    if (!confirmed) return;

    for (const product of selectedProducts) {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
    }

    setProductList((current) => current.filter((product) => !selectedIds.includes(product.id)));
    setSelectedIds([]);
    setEditingId("");
    setEditForm(null);
    setMessage("已删除所选产品。");
  }

  function generateShipmentDraft() {
    if (selectedProducts.length === 0) {
      setMessage("请先选择要出货的产品。");
      return;
    }

    const now = Date.now();
    const payload: ShipmentCachePayload = {
      company: { id: company.id, name: company.name, slug: company.slug },
      createdAt: now,
      expiresAt: now + shipmentCacheTtlMs,
      items: selectedProducts.map((product) => ({
        product_id: product.id,
        name: product.name,
        specification: product.specification,
        unit_price: product.unit_price ?? 0,
        quantity: 1
      }))
    };

    window.sessionStorage.setItem(shipmentCacheKey(company.slug), JSON.stringify(payload));
    setShipmentItems(payload.items);
    setShipmentExpiresAt(payload.expiresAt);
    setMessage("临时出货单已生成，可在当前页面编辑并下载。");
    window.setTimeout(() => document.getElementById("shipment-draft")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function updateShipmentItem(index: number, patch: Partial<ShipmentDraftItem>) {
    setShipmentItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function clearShipmentDraft() {
    window.sessionStorage.removeItem(shipmentCacheKey(company.slug));
    setShipmentItems([]);
    setShipmentExpiresAt(null);
    setMessage("临时出货单已清空。");
  }

  function downloadShipmentExcel() {
    const rows = shipmentItems
      .map((item) => {
        const quantity = normalizeQuantity(Number(item.quantity || 1));
        const lineTotal = Number(item.unit_price || 0) * quantity;
        return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.specification)}</td><td>${item.unit_price}</td><td>${quantity}</td><td>${lineTotal.toFixed(2)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><caption>${escapeHtml(
      shipmentMeta.title || "出货单"
    )}</caption><tr><td>企业</td><td>${escapeHtml(company.name)}</td><td>客户</td><td>${escapeHtml(
      shipmentMeta.customer_name || "-"
    )}</td><td>日期</td><td>${new Date().toLocaleDateString("zh-CN")}</td></tr><tr><th>名称</th><th>规格</th><th>单价</th><th>数量</th><th>价格</th></tr>${rows}<tr><td colspan="4">总计</td><td>${shipmentTotal.toFixed(
      2
    )}</td></tr><tr><td>备注</td><td colspan="4">${escapeHtml(shipmentMeta.note)}</td></tr></table></body></html>`;

    downloadBlob(new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" }), `${company.slug}-出货单.xls`);
  }

  function downloadShipmentPng() {
    const width = 1200;
    const rowHeight = 46;
    const height = 240 + Math.max(shipmentItems.length, 1) * rowHeight + 80;
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
    ctx.fillText(shipmentMeta.title || "出货单", width / 2, 58);

    ctx.textAlign = "left";
    ctx.font = "20px Microsoft YaHei, Arial";
    ctx.fillText(`企业：${company.name}`, 60, 112);
    ctx.fillText(`客户：${shipmentMeta.customer_name || "-"}`, 430, 112);
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
    shipmentItems.forEach((item) => {
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
    ctx.fillText(`总计 ${formatPrice(shipmentTotal)}`, 1120, y);
    ctx.textAlign = "left";
    ctx.font = "18px Microsoft YaHei, Arial";
    drawText(ctx, `备注：${shipmentMeta.note || "-"}`, 60, y + 44, 1060);

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
            <small>企业后台</small>
          </div>
        </div>
        <nav>
          <a className="active" href={`/${company.slug}`}>
            产品列表
          </a>
          <a href={`/${company.slug}/upload`}>上传产品</a>
        </nav>
        <button className="sidebar-button" onClick={logout} type="button">
          <LogOut size={16} />
          退出
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>产品列表</h1>
            <p>{company.name}</p>
          </div>
          <div className="admin-top-actions">
            <a className="primary-action" href={`/${company.slug}/upload`}>
              <ImagePlus size={16} />
              上传产品
            </a>
            <a className="ghost-action" href={`/${company.slug}/浏览页`}>
              <Eye size={16} />
              查看浏览页
            </a>
          </div>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message">{message}</div> : null}

        <section className="admin-catalog-workspace">
          <div className="catalog-admin-bar">
            <span>{selectedProducts.length > 0 ? `已选择 ${selectedProducts.length} 个产品` : "未选择产品"}</span>
            <div>
              <button disabled={selectedProducts.length !== 1} onClick={startEditSelected} type="button">
                <Pencil size={15} />
                修改
              </button>
              <button disabled={selectedProducts.length === 0} onClick={deleteSelectedProducts} type="button">
                <Trash2 size={15} />
                删除
              </button>
              <button disabled={selectedProducts.length === 0} onClick={generateShipmentDraft} type="button">
                <FileText size={15} />
                生成出货单
              </button>
              {selectedProducts.length > 0 ? (
                <button onClick={() => setSelectedIds([])} type="button">
                  <X size={15} />
                  取消选择
                </button>
              ) : null}
            </div>
          </div>

          {editingProduct && editForm ? (
            <section className="admin-panel product-edit-panel">
              <div className="panel-title panel-title-between">
                <span>
                  <Pencil size={18} />
                  <h2>修改产品</h2>
                </span>
                <button
                  className="ghost-action"
                  onClick={() => {
                    setEditingId("");
                    setEditForm(null);
                  }}
                  type="button"
                >
                  <X size={15} />
                  关闭
                </button>
              </div>
              <form className="product-form" onSubmit={saveProductEdit}>
                <label>
                  名称
                  <input
                    required
                    value={editForm.name}
                    onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  />
                </label>
                <label>
                  规格
                  <input
                    value={editForm.specification}
                    onChange={(event) => setEditForm({ ...editForm, specification: event.target.value })}
                  />
                </label>
                <label>
                  单价
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={editForm.unit_price}
                    onChange={(event) => setEditForm({ ...editForm, unit_price: event.target.value })}
                  />
                </label>
                <label>
                  状态
                  <select
                    value={editForm.status}
                    onChange={(event) => setEditForm({ ...editForm, status: event.target.value as ProductStatus })}
                  >
                    <option value="active">上架</option>
                    <option value="hidden">隐藏</option>
                  </select>
                </label>
                <label className="wide">
                  描述
                  <textarea
                    value={editForm.description}
                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                  />
                </label>
                <button className="primary-action" type="submit">
                  <Save size={16} />
                  保存修改
                </button>
              </form>
            </section>
          ) : null}

          {shipmentItems.length > 0 ? (
            <section className="shipment-layout" id="shipment-draft">
              <section className="admin-panel shipment-editor">
                <div className="panel-title">
                  <FileSpreadsheet size={18} />
                  <h2>临时出货单</h2>
                </div>
                <div className="field-grid two">
                  <label>
                    标题
                    <input
                      value={shipmentMeta.title}
                      onChange={(event) => setShipmentMeta({ ...shipmentMeta, title: event.target.value })}
                    />
                  </label>
                  <label>
                    客户
                    <input
                      value={shipmentMeta.customer_name}
                      onChange={(event) => setShipmentMeta({ ...shipmentMeta, customer_name: event.target.value })}
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
                  {shipmentItems.map((item, index) => {
                    const quantity = normalizeQuantity(Number(item.quantity || 1));

                    return (
                      <div className="shipment-line" key={`${item.product_id}-${index}`}>
                        <input value={item.name} onChange={(event) => updateShipmentItem(index, { name: event.target.value })} />
                        <input
                          value={item.specification}
                          onChange={(event) => updateShipmentItem(index, { specification: event.target.value })}
                        />
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.unit_price}
                          onChange={(event) => updateShipmentItem(index, { unit_price: Number(event.target.value) })}
                        />
                        <input
                          min="1"
                          step="1"
                          type="number"
                          value={quantity}
                          onChange={(event) => updateShipmentItem(index, { quantity: normalizeQuantity(Number(event.target.value)) })}
                        />
                        <strong>{formatPrice(Number(item.unit_price || 0) * quantity)}</strong>
                      </div>
                    );
                  })}
                </div>
                <label className="wide">
                  备注
                  <textarea
                    value={shipmentMeta.note}
                    onChange={(event) => setShipmentMeta({ ...shipmentMeta, note: event.target.value })}
                  />
                </label>
                <div className="shipment-actions">
                  <strong>合计 {formatPrice(shipmentTotal)}</strong>
                  <button className="ghost-action" onClick={downloadShipmentPng} type="button">
                    <ImageDown size={16} />
                    下载图片
                  </button>
                  <button className="ghost-action" onClick={downloadShipmentExcel} type="button">
                    <Download size={16} />
                    下载 Excel
                  </button>
                  <button className="danger-action" onClick={clearShipmentDraft} type="button">
                    <Trash2 size={16} />
                    清空
                  </button>
                </div>
              </section>

              <section className="print-sheet admin-panel">
                <h2>{shipmentMeta.title || "出货单"}</h2>
                <p>
                  企业：{company.name}　客户：{shipmentMeta.customer_name || "-"}　日期：
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
                    {shipmentItems.map((item, index) => {
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
                      <td>{formatPrice(shipmentTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p>{shipmentMeta.note}</p>
              </section>
            </section>
          ) : null}

          <ProductCatalogView
            categories={categories}
            company={company}
            countNote="后台管理"
            emptyText="暂无产品，请先上传产品。"
            products={productList}
            renderProduct={(product) => {
              const selected = selectedIds.includes(product.id);

              return (
                <button
                  className={selected ? "product-card product-card-button product-card-selected" : "product-card product-card-button"}
                  data-product-code={product.product_code}
                  data-testid={`product-select-${product.product_code}`}
                  onClick={() => toggleProductSelection(product.id)}
                  type="button"
                >
                  <span className={selected ? "product-select-check selected" : "product-select-check"}>
                    {selected ? <Check size={14} /> : null}
                  </span>
                  {product.status === "hidden" ? <span className="product-status-badge">已隐藏</span> : null}
                  <ProductCardContent product={product} />
                </button>
              );
            }}
          />
        </section>
      </section>
    </main>
  );
}
