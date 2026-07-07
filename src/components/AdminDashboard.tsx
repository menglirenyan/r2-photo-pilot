"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  ImagePlus,
  LogOut,
  PackagePlus,
  Plus,
  Printer,
  Save,
  Trash2,
  XCircle
} from "lucide-react";
import { compactDate, formatPrice } from "@/lib/format";
import type { AdminSnapshot, Category, Company, Product, ShipmentDraftItem, ShipmentSheet } from "@/types";

type AdminDashboardProps = AdminSnapshot;

type ProductForm = {
  category_id: string;
  name: string;
  specification: string;
  unit_price: string;
  description: string;
};

type CompanyForm = {
  name: string;
  slug: string;
  status: "active" | "inactive";
  paid_until: string;
  contact_name: string;
  contact_note: string;
};

const initialProductForm: ProductForm = {
  category_id: "",
  name: "",
  specification: "",
  unit_price: "",
  description: ""
};

const initialCompanyForm: CompanyForm = {
  name: "",
  slug: "",
  status: "inactive",
  paid_until: "",
  contact_name: "",
  contact_note: ""
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "操作失败。";
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }

  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
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

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) resolve(nextBlob);
      else reject(new Error("图片压缩失败。"));
    }, "image/jpeg", 0.84);
  });

  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  return { file: compressed, width, height };
}

export function AdminDashboard({ companies, categories, products, shipmentSheets, configured }: AdminDashboardProps) {
  const router = useRouter();
  const [companyList, setCompanyList] = useState(companies);
  const [categoryList, setCategoryList] = useState(categories);
  const [productList, setProductList] = useState(products);
  const [shipments, setShipments] = useState(shipmentSheets);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id || "");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(initialCompanyForm);
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "" });
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shipmentItems, setShipmentItems] = useState<ShipmentDraftItem[]>([]);
  const [shipmentMeta, setShipmentMeta] = useState({ title: "出货单", customer_name: "", note: "" });

  const selectedCompany = companyList.find((company) => company.id === selectedCompanyId) ?? companyList[0] ?? null;
  const companyCategories = useMemo(
    () => categoryList.filter((category) => category.company_id === selectedCompany?.id),
    [categoryList, selectedCompany?.id]
  );
  const companyProducts = useMemo(
    () => productList.filter((product) => product.company_id === selectedCompany?.id),
    [productList, selectedCompany?.id]
  );
  const shipmentTotal = useMemo(
    () => shipmentItems.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 1), 0),
    [shipmentItems]
  );

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(companyForm)
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const payload = (await response.json()) as { company: Company };
    setCompanyList((current) => [payload.company, ...current]);
    setSelectedCompanyId(payload.company.id);
    setCompanyForm(initialCompanyForm);
    setMessage("用户已添加。");
  }

  function updateCompanyLocal(companyId: string, patch: Partial<Company>) {
    setCompanyList((current) => current.map((item) => (item.id === companyId ? { ...item, ...patch } : item)));
  }

  async function updateCompany(company: Company, patch: Partial<Company> = {}) {
    setMessage("");
    const nextCompany = { ...company, ...patch };
    const response = await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextCompany)
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const payload = (await response.json()) as { company: Company };
    setCompanyList((current) => current.map((item) => (item.id === payload.company.id ? payload.company : item)));
    setMessage("用户可用时间已更新。");
  }

  async function deleteCompany(company: Company) {
    const confirmed = window.confirm(`确认删除“${company.name}”？该用户下的分类、产品和出货单也会被删除。`);
    if (!confirmed) return;

    setMessage("");
    const response = await fetch("/api/admin/companies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: company.id })
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const nextCompanies = companyList.filter((item) => item.id !== company.id);
    setCompanyList(nextCompanies);
    setCategoryList((current) => current.filter((item) => item.company_id !== company.id));
    setProductList((current) => current.filter((item) => item.company_id !== company.id));
    setShipments((current) => current.filter((item) => item.company_id !== company.id));
    setSelectedCompanyId((current) => (current === company.id ? nextCompanies[0]?.id || "" : current));
    setMessage("用户已删除。");
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompany) return;
    setMessage("");

    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...categoryForm, company_id: selectedCompany.id })
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const payload = (await response.json()) as { category: Category };
    setCategoryList((current) => [...current, payload.category]);
    setCategoryForm({ name: "", code: "" });
    setProductForm((current) => ({ ...current, category_id: current.category_id || payload.category.id }));
    setMessage("分类已创建。");
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompany || !selectedFile) {
      setMessage("请选择企业和产品图片。");
      return;
    }

    setMessage("正在压缩并上传图片...");

    try {
      const compressed = await compressImage(selectedFile);
      const signResponse = await fetch("/api/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          fileName: compressed.file.name,
          contentType: compressed.file.type,
          size: compressed.file.size
        })
      });

      if (!signResponse.ok) throw new Error(await readError(signResponse));
      const signed = (await signResponse.json()) as { signedUrl: string; publicUrl: string; objectKey: string };

      const uploadResponse = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.file.type },
        body: compressed.file
      });

      if (!uploadResponse.ok) throw new Error("R2 图片上传失败。");

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          company_id: selectedCompany.id,
          image_url: signed.publicUrl,
          object_key: signed.objectKey,
          image_width: compressed.width,
          image_height: compressed.height
        })
      });

      if (!response.ok) throw new Error(await readError(response));

      const payload = (await response.json()) as { product: Product };
      setProductList((current) => [payload.product, ...current]);
      setProductForm({ ...initialProductForm, category_id: productForm.category_id });
      setSelectedFile(null);
      setMessage(`产品已创建，编号 ${payload.product.product_code}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "产品创建失败。");
    }
  }

  async function toggleProduct(product: Product) {
    const nextStatus = product.status === "active" ? "hidden" : "active";
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const payload = (await response.json()) as { product: Product };
    setProductList((current) => current.map((item) => (item.id === product.id ? payload.product : item)));
  }

  function addShipmentItem(product: Product) {
    setShipmentItems((current) => [
      ...current,
      {
        product_id: product.id,
        name: product.name,
        specification: product.specification,
        unit_price: product.unit_price ?? 0,
        quantity: 1
      }
    ]);
  }

  function updateShipmentItem(index: number, patch: Partial<ShipmentDraftItem>) {
    setShipmentItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function saveShipment() {
    if (!selectedCompany || shipmentItems.length === 0) {
      setMessage("请先选择出货产品。");
      return;
    }

    const response = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...shipmentMeta, company_id: selectedCompany.id, items: shipmentItems })
    });

    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    const payload = (await response.json()) as { shipmentSheet: ShipmentSheet };
    setShipments((current) => [payload.shipmentSheet, ...current]);
    setShipmentItems([]);
    setMessage("出货单已保存。");
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>货</span>
          <div>
            <strong>货物产品册</strong>
            <small>运营后台</small>
          </div>
        </div>
        <nav>
          <a href="#companies">用户</a>
          <a href="#products">产品</a>
          <a href="#shipments">出货单</a>
        </nav>
        <button className="sidebar-button" onClick={logout} type="button">
          <LogOut size={16} />
          退出
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>用户产品册代管</h1>
            <p>账号密码登录后，手动添加用户、设置可用时间和开通状态。</p>
          </div>
          <select
            disabled={companyList.length === 0}
            value={selectedCompanyId}
            onChange={(event) => {
              setSelectedCompanyId(event.target.value);
              setProductForm((current) => ({ ...current, category_id: "" }));
            }}
          >
            {companyList.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message">{message}</div> : null}

        <section className="admin-grid" id="companies">
          <form className="admin-panel" onSubmit={createCompany}>
            <div className="panel-title">
              <Building2 size={18} />
              <h2>添加用户</h2>
            </div>
            <div className="field-grid two">
              <label>
                用户名称
                <input value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} />
              </label>
              <label>
                链接标识
                <input
                  placeholder="demo-factory"
                  value={companyForm.slug}
                  onChange={(event) => setCompanyForm({ ...companyForm, slug: event.target.value })}
                />
              </label>
              <label>
                状态
                <select
                  value={companyForm.status}
                  onChange={(event) => setCompanyForm({ ...companyForm, status: event.target.value as "active" | "inactive" })}
                >
                  <option value="inactive">未开通</option>
                  <option value="active">已开通</option>
                </select>
              </label>
              <label>
                可用到期日
                <input
                  type="date"
                  value={companyForm.paid_until}
                  onChange={(event) => setCompanyForm({ ...companyForm, paid_until: event.target.value })}
                />
              </label>
              <label>
                联系人
                <input
                  value={companyForm.contact_name}
                  onChange={(event) => setCompanyForm({ ...companyForm, contact_name: event.target.value })}
                />
              </label>
              <label>
                备注
                <input
                  value={companyForm.contact_note}
                  onChange={(event) => setCompanyForm({ ...companyForm, contact_note: event.target.value })}
                />
              </label>
            </div>
            <button className="primary-action" disabled={isPending} type="submit">
              <Plus size={16} />
              添加用户
            </button>
          </form>

          <section className="admin-panel">
            <div className="panel-title">
              <CalendarDays size={18} />
              <h2>用户可用时间</h2>
            </div>
            <div className="company-list">
              {companyList.map((company) => (
                <article className="company-row" key={company.id}>
                  <div className="company-summary">
                    <strong>{company.name}</strong>
                    <span>/c/{company.slug}</span>
                    <small>当前到期：{compactDate(company.paid_until)}</small>
                  </div>
                  <div className="company-controls">
                    <label>
                      状态
                      <select
                        value={company.status}
                        onChange={(event) => updateCompanyLocal(company.id, { status: event.target.value as "active" | "inactive" })}
                      >
                        <option value="inactive">未开通</option>
                        <option value="active">已开通</option>
                      </select>
                    </label>
                    <label>
                      可用到
                      <input
                        type="date"
                        value={company.paid_until || ""}
                        onChange={(event) => updateCompanyLocal(company.id, { paid_until: event.target.value || null })}
                      />
                    </label>
                    <button
                      className={company.status === "active" ? "status-toggle active" : "status-toggle"}
                      onClick={() => updateCompany(company)}
                      type="button"
                    >
                      {company.status === "active" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      保存
                    </button>
                    <button className="danger-action" onClick={() => deleteCompany(company)} type="button">
                      <Trash2 size={15} />
                      删除
                    </button>
                  </div>
                </article>
              ))}
              {companyList.length === 0 ? <div className="empty-admin">暂无用户，请先添加。</div> : null}
            </div>
          </section>
        </section>

        <section className="admin-grid product-admin" id="products">
          <section className="admin-panel">
            <div className="panel-title">
              <PackagePlus size={18} />
              <h2>分类与产品上传</h2>
            </div>
            <form className="inline-form" onSubmit={createCategory}>
              <input
                placeholder="分类名，如 五金配件"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              />
              <input
                placeholder="代码，如 HW"
                value={categoryForm.code}
                onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })}
              />
              <button type="submit">新增分类</button>
            </form>

            <form className="product-form" onSubmit={createProduct}>
              <label>
                分类
                <select
                  required
                  value={productForm.category_id}
                  onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value })}
                >
                  <option value="">请选择</option>
                  {companyCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.code})
                    </option>
                  ))}
                </select>
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
                <span>{selectedFile ? selectedFile.name : "选择产品图片"}</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
              <button className="primary-action" type="submit">
                <Save size={16} />
                上传并创建产品
              </button>
            </form>
          </section>

          <section className="admin-panel product-table-panel">
            <div className="panel-title">
              <ImagePlus size={18} />
              <h2>产品列表</h2>
            </div>
            <div className="product-table">
              {companyProducts.map((product) => (
                <article className="product-row" data-product-code={product.product_code} key={product.id}>
                  <div className="admin-thumb">
                    <Image src={product.image_url} alt={product.name} fill sizes="72px" />
                  </div>
                  <div>
                    <strong>
                      {product.product_code} · {product.name}
                    </strong>
                    <span>{product.specification || "未填规格"}</span>
                    <small>{product.unit_price !== null ? formatPrice(product.unit_price) : "未填单价"}</small>
                  </div>
                  <button data-testid={`add-shipment-${product.product_code}`} onClick={() => addShipmentItem(product)} type="button">
                    加入出货单
                  </button>
                  <button className="ghost-action" onClick={() => toggleProduct(product)} type="button">
                    {product.status === "active" ? "隐藏" : "上架"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="shipment-layout" id="shipments">
          <section className="admin-panel shipment-editor">
            <div className="panel-title">
              <FileText size={18} />
              <h2>出货单编辑器</h2>
            </div>
            <div className="field-grid two">
              <label>
                标题
                <input value={shipmentMeta.title} onChange={(event) => setShipmentMeta({ ...shipmentMeta, title: event.target.value })} />
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
              {shipmentItems.map((item, index) => (
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
                    value={item.quantity}
                    onChange={(event) => updateShipmentItem(index, { quantity: Number(event.target.value) })}
                  />
                  <strong>{formatPrice(Number(item.unit_price || 0) * Number(item.quantity || 1))}</strong>
                </div>
              ))}
              {shipmentItems.length === 0 ? <div className="empty-admin">从产品列表点击“加入出货单”。</div> : null}
            </div>
            <label className="wide">
              备注
              <textarea value={shipmentMeta.note} onChange={(event) => setShipmentMeta({ ...shipmentMeta, note: event.target.value })} />
            </label>
            <div className="shipment-actions">
              <strong>合计 {formatPrice(shipmentTotal)}</strong>
              <button className="ghost-action" onClick={() => window.print()} type="button">
                <Printer size={16} />
                打印
              </button>
              <button className="primary-action" onClick={saveShipment} type="button">
                保存出货单
              </button>
            </div>
          </section>

          <section className="print-sheet admin-panel">
            <h2>{shipmentMeta.title || "出货单"}</h2>
            <p>
              企业：{selectedCompany?.name || "-"}　客户：{shipmentMeta.customer_name || "-"}　日期：
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
                {shipmentItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.specification}</td>
                    <td>{formatPrice(item.unit_price)}</td>
                    <td>{item.quantity}</td>
                    <td>{formatPrice(item.unit_price * item.quantity)}</td>
                  </tr>
                ))}
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

          <section className="admin-panel">
            <div className="panel-title">
              <FileText size={18} />
              <h2>最近出货单</h2>
            </div>
            <div className="shipment-list">
              {shipments.map((shipment) => (
                <article key={shipment.id}>
                  <strong>{shipment.title}</strong>
                  <span>{shipment.customer_name || "未填客户"}</span>
                  <small>
                    {formatPrice(shipment.total_price)} · {new Date(shipment.created_at).toLocaleString("zh-CN")}
                  </small>
                </article>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
