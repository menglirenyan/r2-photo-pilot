"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, ImagePlus, LogOut, PackagePlus, Save } from "lucide-react";
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

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("原图不能超过 25MB，请先在手机相册中适当裁剪。");
  }

  const bitmap = await createImageBitmap(file);
  const maxEdge = 960;
  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片压缩。");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) resolve(nextBlob);
      else reject(new Error("图片压缩失败。"));
    }, "image/webp", 0.74);
  });

  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
  return { file: compressed, width, height };
}

function uploadToR2(signedUrl: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("Cache-Control", "public, max-age=31536000, immutable");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("图片上传失败：无法连接图片存储，请检查网络后重试。"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("图片上传失败：图片存储拒绝了本次上传。"));
    };
    xhr.send(file);
  });
}

export function ProductUploadWorkspace({ company, categories, configured }: ProductUploadWorkspaceProps) {
  const router = useRouter();
  const [categoryList, setCategoryList] = useState(categories);
  const [categoryInput, setCategoryInput] = useState("");
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(`/${company.slug}`);
  }

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

    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: company.id, name })
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = (await response.json()) as { category: Category };
    setCategoryList((current) => [...current, payload.category]);
    setProductForm((current) => ({ ...current, category_id: payload.category.id }));
    setCategoryInput(payload.category.name);
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
      const compressed = await compressImage(selectedFile);
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

      await uploadToR2(signed.signedUrl, compressed.file, (percent) => {
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
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>货</span>
          <div>
            <strong>货物产品册</strong>
            <small>上传产品</small>
          </div>
        </div>
        <nav>
          <a href={`/${company.slug}`}>产品</a>
          <a className="active" href={`/${company.slug}/upload`}>
            上传产品
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
            <h1>上传产品</h1>
            <p>{company.name} 的产品图片、分类、规格和价格录入。</p>
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
              <label>
                分类
                <input
                  list="product-category-options"
                  placeholder="选择已有分类或输入新分类"
                  required
                  value={categoryInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCategoryInput(value);
                    setProductForm({ ...productForm, category_id: findCategory(value)?.id || "" });
                  }}
                />
                <datalist id="product-category-options">
                  {categoryList.map((category) => (
                    <option key={category.id} label={category.code} value={category.name} />
                  ))}
                </datalist>
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
              <label className="upload-field">
                <ImagePlus size={17} />
                <span>{selectedFile ? selectedFile.name : "选择产品图片（自动压缩）"}</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  type="file"
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
