"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  FileText,
  ImagePlus,
  Pencil,
  Phone,
  Save,
  Trash2,
  X
} from "lucide-react";
import { CompanyAdminNavigation } from "@/components/CompanyAdminNavigation";
import { ProductCardContent, ProductCatalogView } from "@/components/ProductCatalogView";
import { QuotationComposer } from "@/components/QuotationComposer";
import { SafeImage } from "@/components/SafeImage";
import { compressProductImage, uploadProductImageToR2 } from "@/lib/client-image-upload";
import type { Category, Company, Product, ProductStatus, SignUploadResponse } from "@/types";

type CompanyProductListWorkspaceProps = {
  categories: Category[];
  company: Company;
  configured: boolean;
  isPlatformAdmin?: boolean;
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
  isPlatformAdmin = false,
  products
}: CompanyProductListWorkspaceProps) {
  const [productList, setProductList] = useState(products);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementPreviewUrl, setReplacementPreviewUrl] = useState("");
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [quotationSeed, setQuotationSeed] = useState<{ nonce: number; products: Product[] } | null>(null);
  const [hasQuotationDraft, setHasQuotationDraft] = useState(false);
  const [phonePanelOpen, setPhonePanelOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(company.public_contact_phone);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [message, setMessage] = useState("");

  const selectedProducts = useMemo(
    () => productList.filter((product) => selectedIds.includes(product.id)),
    [productList, selectedIds]
  );
  const editingProduct = productList.find((product) => product.id === editingId) ?? null;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "quotation") {
      setQuotationOpen(true);
    }
  }, [company.slug]);

  useEffect(() => {
    if (!replacementFile) {
      setReplacementPreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(replacementFile);
    setReplacementPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [replacementFile]);

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
    setReplacementFile(null);
    setEditUploadProgress(null);
    setMessage("");
  }

  function closeProductEdit() {
    if (isSavingEdit) return;
    setEditingId("");
    setEditForm(null);
    setReplacementFile(null);
    setEditUploadProgress(null);
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct || !editForm || isSavingEdit) return;

    setIsSavingEdit(true);
    setEditUploadProgress(null);

    try {
      const patch: Record<string, unknown> = {
        ...editForm,
        unit_price: editForm.unit_price.trim() === "" ? null : editForm.unit_price
      };

      if (replacementFile) {
        setMessage("正在准备新图片...");
        setEditUploadProgress(0);
        const compressed = await compressProductImage(replacementFile);
        const signResponse = await fetch("/api/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: editingProduct.company_id,
            fileName: compressed.file.name,
            contentType: compressed.file.type,
            size: compressed.file.size
          })
        });

        if (!signResponse.ok) throw new Error(await readError(signResponse));
        const signed = (await signResponse.json()) as SignUploadResponse;

        await uploadProductImageToR2(signed.signedUrl, compressed.file, (percent) => {
          setEditUploadProgress(percent);
          setMessage(`正在上传新图片 ${percent}%`);
        });

        setEditUploadProgress(100);
        setMessage("正在保存产品和新图片...");
        Object.assign(patch, {
          image_url: signed.publicUrl,
          object_key: signed.objectKey,
          image_width: compressed.width,
          image_height: compressed.height
        });
      }

      const response = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });

      if (!response.ok) throw new Error(await readError(response));

      const payload = (await response.json()) as { product: Product };
      setProductList((current) =>
        current.map((product) => (product.id === payload.product.id ? payload.product : product))
      );
      setEditingId("");
      setEditForm(null);
      setReplacementFile(null);
      setEditUploadProgress(null);
      setMessage(replacementFile ? "产品和图片已更新。" : "产品已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "产品更新失败。");
    } finally {
      setIsSavingEdit(false);
    }
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
    setReplacementFile(null);
    setEditUploadProgress(null);
    setMessage("已删除所选产品。");
  }

  function openQuotation() {
    if (selectedProducts.length > 0) {
      setQuotationSeed({ nonce: Date.now(), products: selectedProducts });
      setQuotationOpen(true);
      return;
    }
    if (hasQuotationDraft) {
      setQuotationOpen(true);
      return;
    }
    setMessage("请先选择需要报价的产品。");
  }

  async function savePublicContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingPhone) return;

    setIsSavingPhone(true);
    setMessage("");
    const publicContactPhone = phoneDraft.trim();

    try {
      const response = await fetch("/api/admin/company-contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.id,
          public_contact_phone: publicContactPhone
        })
      });

      if (!response.ok) throw new Error(await readError(response));

      const payload = (await response.json()) as { company: Pick<Company, "public_contact_phone"> };
      setPhoneDraft(payload.company.public_contact_phone);
      setMessage(
        publicContactPhone
          ? "公开联系方式已保存。"
          : "公开联系方式已清除，产品册将不再显示联系方式。"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公开联系方式保存失败。");
    } finally {
      setIsSavingPhone(false);
    }
  }

  return (
    <main className="admin-shell">
      <CompanyAdminNavigation active="products" company={company} isPlatformAdmin={isPlatformAdmin} />

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>产品列表</h1>
            <p>{company.name}</p>
          </div>
          <div className="admin-top-actions">
            <button
              aria-controls="public-contact-panel"
              aria-expanded={phonePanelOpen}
              className="ghost-action"
              data-testid="public-contact-toggle"
              onClick={() => setPhonePanelOpen((current) => !current)}
              type="button"
            >
              <Phone size={16} />
              公开联系方式
            </button>
            <button className="primary-action" data-testid="quotation-top-open" onClick={openQuotation} type="button">
              <FileText size={16} />
              生成报价单
            </button>
            <a className="primary-action" href={`/${company.slug}/upload`}>
              <ImagePlus size={16} />
              上传产品
            </a>
            <a className="ghost-action" href={`/c/${company.slug}`}>
              <Eye size={16} />
              查看浏览页
            </a>
          </div>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message" role="status">{message}</div> : null}

        {phonePanelOpen ? (
          <section className="admin-panel public-contact-panel" data-testid="public-contact-panel" id="public-contact-panel">
            <div className="panel-title panel-title-between">
              <span>
                <Phone size={18} />
                <h2>产品册公开电话</h2>
              </span>
              <button
                className="ghost-action"
                disabled={isSavingPhone}
                onClick={() => setPhonePanelOpen(false)}
                type="button"
              >
                <X size={15} />
                关闭
              </button>
            </div>
            <form aria-busy={isSavingPhone} className="inline-form" onSubmit={savePublicContact}>
              <label htmlFor="public-contact-phone">
                电话号码
                <input
                  autoComplete="tel"
                  data-testid="public-contact-phone"
                  disabled={isSavingPhone}
                  id="public-contact-phone"
                  inputMode="tel"
                  maxLength={50}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                  placeholder="例如 138 0000 0000"
                  type="tel"
                  value={phoneDraft}
                />
              </label>
              <button
                className="primary-action"
                data-testid="public-contact-save"
                disabled={!configured || isSavingPhone}
                type="submit"
              >
                <Save size={16} />
                {isSavingPhone ? "正在保存..." : "保存"}
              </button>
            </form>
            <p>
              此电话仅用于游客产品册，与平台后台的内部联系人、内部备注无关；留空保存后，游客端不显示“联系方式”按钮。
            </p>
          </section>
        ) : null}

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
              <button
                data-testid="quotation-open"
                disabled={selectedProducts.length === 0 && !hasQuotationDraft}
                onClick={openQuotation}
                type="button"
              >
                <FileText size={15} />
                {selectedProducts.length > 0
                  ? `生成报价单（${selectedProducts.length}）`
                  : hasQuotationDraft
                    ? "继续报价单"
                    : "生成报价单"}
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
                  disabled={isSavingEdit}
                  onClick={closeProductEdit}
                  type="button"
                >
                  <X size={15} />
                  关闭
                </button>
              </div>
              <form aria-busy={isSavingEdit} className="product-form" onSubmit={saveProductEdit}>
                <div className="product-image-edit-grid">
                  <section className="product-image-edit-card" aria-label="当前产品图片">
                    <span>当前图片</span>
                    <div className="product-image-edit-preview">
                      <SafeImage
                        alt={`${editingProduct.name} 当前图片`}
                        sizes="(max-width: 540px) 100vw, 360px"
                        src={editingProduct.image_url}
                      />
                    </div>
                  </section>
                  <section className="product-image-edit-card" aria-label="待替换产品图片">
                    <span>{replacementPreviewUrl ? "新图片预览" : "替换图片"}</span>
                    {replacementPreviewUrl ? (
                      <div className="product-image-edit-preview">
                        <SafeImage
                          key={replacementPreviewUrl}
                          alt={`${editingProduct.name} 新图片预览`}
                          sizes="(max-width: 540px) 100vw, 360px"
                          src={replacementPreviewUrl}
                        />
                      </div>
                    ) : (
                      <div className="product-image-edit-preview product-image-edit-placeholder">
                        <ImagePlus size={28} />
                        <span>不选择则保留当前图片</span>
                      </div>
                    )}
                    <label className="upload-field product-image-replace-field">
                      <ImagePlus size={17} />
                      <span>{replacementFile ? replacementFile.name : "选择新的产品图片"}</span>
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        data-testid="product-image-replacement"
                        disabled={isSavingEdit}
                        onChange={(event) => {
                          setReplacementFile(event.target.files?.[0] ?? null);
                          setEditUploadProgress(null);
                        }}
                        type="file"
                      />
                    </label>
                  </section>
                </div>
                {editUploadProgress !== null ? (
                  <div className="product-image-upload-progress" role="status">
                    <span>新图片上传进度 {editUploadProgress}%</span>
                    <progress max={100} value={editUploadProgress} />
                  </div>
                ) : null}
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
                <button className="primary-action" disabled={!configured || isSavingEdit} type="submit">
                  <Save size={16} />
                  {isSavingEdit ? "正在保存..." : "保存修改"}
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
        <QuotationComposer
          company={company}
          onClose={() => setQuotationOpen(false)}
          onDraftChange={setHasQuotationDraft}
          onMessage={setMessage}
          open={quotationOpen}
          seed={quotationSeed}
        />
      </section>
    </main>
  );
}
