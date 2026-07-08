"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, FileText, ImagePlus, LogOut, Pencil, Save, Trash2, X } from "lucide-react";
import { ProductCardContent, ProductCatalogView } from "@/components/ProductCatalogView";
import { shipmentCacheKey, shipmentCacheTtlMs, type ShipmentCachePayload } from "@/lib/shipment-cache";
import type { Category, Company, Product, ProductStatus } from "@/types";

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

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "操作失败。";
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
  const [message, setMessage] = useState("");

  const selectedProducts = useMemo(
    () => productList.filter((product) => selectedIds.includes(product.id)),
    [productList, selectedIds]
  );
  const editingProduct = productList.find((product) => product.id === editingId) ?? null;

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
    router.push(`/${company.slug}/shipments`);
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
          <a href={`/${company.slug}/shipments`}>出货单</a>
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
            <a className="ghost-action" href={`/${company.slug}/shipments`}>
              <FileText size={16} />
              出货单
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
