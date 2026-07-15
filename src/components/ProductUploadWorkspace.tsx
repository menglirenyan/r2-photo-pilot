"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Eye, ImagePlus, PackagePlus, Save } from "lucide-react";
import { CompanyAdminNavigation } from "@/components/CompanyAdminNavigation";
import { compressProductImage, uploadProductImageToR2 } from "@/lib/client-image-upload";
import { getCompanyExpiryReminder } from "@/lib/format";
import type { Category, Company, Product } from "@/types";

type ProductForm = {
  category_id: string;
  name: string;
  specification: string;
  unit_price: string;
  description: string;
};

type ProductUploadWorkspaceProps = {
  company: Company;
  categories: Category[];
  configured: boolean;
  isPlatformAdmin?: boolean;
};

const initialProductForm: ProductForm = {
  category_id: "",
  name: "",
  specification: "",
  unit_price: "",
  description: ""
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "操作失败。";
}

export function ProductUploadWorkspace({
  company,
  categories,
  configured,
  isPlatformAdmin = false
}: ProductUploadWorkspaceProps) {
  const [categoryList, setCategoryList] = useState(categories);
  const [categoryInput, setCategoryInput] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expiryReminder = getCompanyExpiryReminder(company.paid_until);

  useEffect(() => {
    if (!selectedFile) {
      setImagePreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  function findCategory(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    return (
      categoryList.find(
        (category) => category.name.toLowerCase() === normalized || category.code.toLowerCase() === normalized
      ) ?? null
    );
  }

  async function resolveCategory() {
    const existingCategory = findCategory(categoryInput);
    if (existingCategory) return existingCategory;

    const name = categoryInput.trim();
    if (!name) throw new Error("请选择或输入分类。");
    const code = categoryCode.trim().toUpperCase();
    if (code && !/^[A-Z0-9]{1,12}$/.test(code)) {
      throw new Error("分类代码需为 1-12 位英文或数字，例如 HW。");
    }

    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: company.id, name, code })
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = (await response.json()) as { category: Category };
    setCategoryList((current) => [...current, payload.category]);
    setProductForm((current) => ({ ...current, category_id: payload.category.id }));
    setCategoryInput(payload.category.name);
    setCategoryCode(payload.category.code);
    return payload.category;
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!selectedFile) {
      setMessage("请选择产品图片。");
      return;
    }

    setMessage("正在上传图片...");
    setIsSubmitting(true);

    try {
      const compressed = await compressProductImage(selectedFile);
      const signResponse = await fetch("/api/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          fileName: compressed.file.name,
          contentType: compressed.file.type,
          size: compressed.file.size
        })
      });

      if (!signResponse.ok) throw new Error(await readError(signResponse));
      const signed = (await signResponse.json()) as { signedUrl: string; publicUrl: string; objectKey: string };

      await uploadProductImageToR2(signed.signedUrl, compressed.file, (percent) => {
        setMessage(`正在上传图片 ${percent}%`);
      });

      setMessage("正在保存产品...");
      const category = await resolveCategory();
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          category_id: category.id,
          company_id: company.id,
          image_url: signed.publicUrl,
          object_key: signed.objectKey,
          image_width: compressed.width,
          image_height: compressed.height
        })
      });

      if (!response.ok) throw new Error(await readError(response));

      const payload = (await response.json()) as { product: Product };
      setProductForm({ ...initialProductForm, category_id: category.id });
      setSelectedFile(null);
      setMessage(`产品已创建，编号 ${payload.product.product_code}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "产品创建失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-shell">
      <CompanyAdminNavigation active="upload" company={company} isPlatformAdmin={isPlatformAdmin} />

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>上传产品</h1>
            <p>{company.name} 的产品图片、分类、规格和价格录入。</p>
            <div className={`company-expiry-reminder ${expiryReminder.tone}`} role="status">
              <CalendarClock aria-hidden="true" size={14} />
              <strong>{expiryReminder.label}</strong>
              <span>{expiryReminder.detail}</span>
            </div>
          </div>
          <div className="admin-top-actions">
            <a className="ghost-action" href={`/${company.slug}`}>
              <ArrowLeft size={16} />
              返回产品列表
            </a>
            <a className="ghost-action" href={`/c/${company.slug}`}>
              <Eye size={16} />
              查看浏览页
            </a>
          </div>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message" role="status">{message}</div> : null}

        <section className="upload-layout">
          <section className="admin-panel upload-product-panel">
            <div className="panel-title">
              <PackagePlus size={18} />
              <h2>分类与产品上传</h2>
            </div>

            <form aria-busy={isSubmitting} className="product-form" onSubmit={createProduct}>
              <section className="product-image-first" aria-label="产品图片">
                <div className={imagePreviewUrl ? "product-upload-preview has-image" : "product-upload-preview"}>
                  {imagePreviewUrl ? (
                    <Image
                      alt="待上传产品图片预览"
                      fill
                      sizes="(max-width: 680px) calc(100vw - 64px), 700px"
                      src={imagePreviewUrl}
                      unoptimized
                    />
                  ) : (
                    <div className="product-upload-placeholder">
                      <ImagePlus aria-hidden="true" size={28} />
                      <strong>先选择产品图片</strong>
                      <span>图片会持续显示在这里，方便对照填写产品信息。</span>
                    </div>
                  )}
                </div>
                <label className="upload-field product-image-picker">
                  <ImagePlus size={17} />
                  <span>{selectedFile ? "重新选择产品图片" : "选择产品图片（自动压缩）"}</span>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                {selectedFile ? <span className="product-image-file-name">已选择：{selectedFile.name}</span> : null}
              </section>
              <label>
                分类
                <input
                  list="product-category-options"
                  placeholder="选择已有分类或输入新分类"
                  required
                  value={categoryInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    const existingCategory = findCategory(value);
                    setCategoryInput(value);
                    setCategoryCode(existingCategory?.code || "");
                    setProductForm({ ...productForm, category_id: existingCategory?.id || "" });
                  }}
                />
                <datalist id="product-category-options">
                  {categoryList.map((category) => (
                    <option key={category.id} label={category.code} value={category.name} />
                  ))}
                </datalist>
              </label>
              <label>
                分类代码
                <input
                  autoCapitalize="characters"
                  maxLength={12}
                  pattern="[A-Za-z0-9]{0,12}"
                  placeholder="可空，默认使用分类中文全拼"
                  readOnly={Boolean(productForm.category_id)}
                  value={categoryCode}
                  onChange={(event) => setCategoryCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                />
                <small>留空时自动生成，例如“圆桌”生成 YUANZHUO。</small>
              </label>
              <label>
                名称
                <input
                  required
                  value={productForm.name}
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                />
              </label>
              <label>
                规格
                <input
                  value={productForm.specification}
                  onChange={(event) => setProductForm({ ...productForm, specification: event.target.value })}
                />
              </label>
              <label>
                单价（可空）
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={productForm.unit_price}
                  onChange={(event) => setProductForm({ ...productForm, unit_price: event.target.value })}
                />
              </label>
              <label className="wide">
                描述
                <textarea
                  value={productForm.description}
                  onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                />
              </label>
              <button className="primary-action" disabled={!configured || isSubmitting} type="submit">
                <Save size={16} />
                {isSubmitting ? "正在处理..." : "上传并创建产品"}
              </button>
            </form>
          </section>
        </section>
      </section>
    </main>
  );
}
