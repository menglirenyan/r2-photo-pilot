"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  ImagePlus,
  LogOut,
  Plus,
  Printer,
  Trash2,
  XCircle
} from "lucide-react";
import { compactDate, formatPrice } from "@/lib/format";
import type { AdminSnapshot, Company, Product, ShipmentDraftItem, ShipmentSheet } from "@/types";

type AdminDashboardProps = AdminSnapshot & {
  initialCompanySlug?: string;
  mode?: "admin" | "company";
};

type CompanyForm = {
  name: string;
  login_username: string;
  login_password: string;
  status: "active" | "inactive";
  paid_until: string;
  contact_name: string;
  contact_note: string;
};

const initialCompanyForm: CompanyForm = {
  name: "",
  login_username: "",
  login_password: "",
  status: "inactive",
  paid_until: "",
  contact_name: "",
  contact_note: ""
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "操作失败。";
}

type CompanyUpdatePatch = Partial<Company> & {
  login_password?: string;
};

export function AdminDashboard({
  companies,
  products,
  shipmentSheets,
  configured,
  initialCompanySlug,
  mode = "admin"
}: AdminDashboardProps) {
  const router = useRouter();
  const isPlatformAdmin = mode === "admin";
  const isCompanyMode = mode === "company";
  const initialCompany =
    companies.find((company) => company.slug === initialCompanySlug) ?? companies[0] ?? null;
  const [companyList, setCompanyList] = useState(companies);
  const [productList, setProductList] = useState(products);
  const [shipments, setShipments] = useState(shipmentSheets);
  const [message, setMessage] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompany?.id || "");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(initialCompanyForm);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [shipmentItems, setShipmentItems] = useState<ShipmentDraftItem[]>([]);
  const [shipmentMeta, setShipmentMeta] = useState({ title: "出货单", customer_name: "", note: "" });

  const selectedCompany = companyList.find((company) => company.id === selectedCompanyId) ?? companyList[0] ?? null;
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
    router.push(isCompanyMode && selectedCompany ? `/${selectedCompany.slug}` : "/admin/login");
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPlatformAdmin) return;
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
    setMessage(`用户已添加，企业编号 ${payload.company.slug}。`);
  }

  function updateCompanyLocal(companyId: string, patch: Partial<Company>) {
    setCompanyList((current) => current.map((item) => (item.id === companyId ? { ...item, ...patch } : item)));
  }

  async function updateCompany(company: Company, patch: CompanyUpdatePatch = {}) {
    if (!isPlatformAdmin) return;
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
    setPasswordDrafts((current) => {
      const next = { ...current };
      delete next[payload.company.id];
      return next;
    });
    setMessage("用户资料已更新。");
  }

  async function deleteCompany(company: Company) {
    if (!isPlatformAdmin) return;
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
    setProductList((current) => current.filter((item) => item.company_id !== company.id));
    setShipments((current) => current.filter((item) => item.company_id !== company.id));
    setSelectedCompanyId((current) => (current === company.id ? nextCompanies[0]?.id || "" : current));
    setMessage("用户已删除。");
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
            <small>{isPlatformAdmin ? "用户管理" : "企业后台"}</small>
          </div>
        </div>
        <nav>
          {isPlatformAdmin ? (
            <a href="#companies">用户</a>
          ) : (
            <>
              <a href="#products">产品</a>
              {selectedCompany ? <a href={`/${selectedCompany.slug}/upload`}>上传产品</a> : null}
              <a href="#shipments">出货单</a>
            </>
          )}
        </nav>
        <button className="sidebar-button" onClick={logout} type="button">
          <LogOut size={16} />
          退出
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>{isPlatformAdmin ? "用户管理" : "企业产品册管理"}</h1>
            <p>
              {isPlatformAdmin
                ? "添加企业用户，设置登录账号、初始密码、开通状态和可用时间。企业编号按顺序自动生成。"
                : `${selectedCompany?.name || "企业"} 的分类、产品图片和出货单管理。`}
            </p>
          </div>
          {isCompanyMode && selectedCompany ? (
            <div className="admin-top-actions">
              <a className="primary-action" href={`/${selectedCompany.slug}/upload`}>
                <ImagePlus size={16} />
                上传产品
              </a>
              <a className="ghost-action" href={`/${selectedCompany.slug}/浏览页`}>
                <Eye size={16} />
                查看浏览页
              </a>
            </div>
          ) : (
            <span className="admin-count">共 {companyList.length} 个用户</span>
          )}
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message">{message}</div> : null}

        {isPlatformAdmin ? (
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
                登录账号
                <input
                  autoComplete="username"
                  placeholder="例如 factory001"
                  value={companyForm.login_username}
                  onChange={(event) => setCompanyForm({ ...companyForm, login_username: event.target.value })}
                />
              </label>
              <label>
                初始密码
                <input
                  autoComplete="new-password"
                  minLength={6}
                  type="password"
                  value={companyForm.login_password}
                  onChange={(event) => setCompanyForm({ ...companyForm, login_password: event.target.value })}
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
            <button className="primary-action" type="submit">
              <Plus size={16} />
              添加用户
            </button>
          </form>

          <section className="admin-panel">
            <div className="panel-title">
              <CalendarDays size={18} />
              <h2>用户列表</h2>
            </div>
            <div className="company-list">
              {companyList.map((company) => (
                <article className="company-row" key={company.id}>
                  <div className="company-summary">
                    <strong>{company.name}</strong>
                    <span>编号：{company.slug}</span>
                    <small>登录账号：{company.login_username || "-"}</small>
                    <small>浏览页：/{company.slug}/浏览页</small>
                    <small>当前到期：{compactDate(company.paid_until)}</small>
                  </div>
                  <div className="company-controls">
                    <label>
                      登录账号
                      <input
                        value={company.login_username || ""}
                        onChange={(event) => updateCompanyLocal(company.id, { login_username: event.target.value })}
                      />
                    </label>
                    <label>
                      新密码
                      <input
                        autoComplete="new-password"
                        minLength={6}
                        placeholder="留空不改"
                        type="password"
                        value={passwordDrafts[company.id] || ""}
                        onChange={(event) =>
                          setPasswordDrafts((current) => ({ ...current, [company.id]: event.target.value }))
                        }
                      />
                    </label>
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
                      onClick={() =>
                        updateCompany(
                          company,
                          passwordDrafts[company.id] ? { login_password: passwordDrafts[company.id] } : {}
                        )
                      }
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
        ) : null}

        {isCompanyMode ? (
          <>
        <section className="admin-panel product-table-panel" id="products">
            <div className="panel-title panel-title-between">
              <span>
                <ImagePlus size={18} />
                <h2>产品列表</h2>
              </span>
              {selectedCompany ? (
                <a className="primary-action" href={`/${selectedCompany.slug}/upload`}>
                  <ImagePlus size={16} />
                  上传产品
                </a>
              ) : null}
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
              {companyProducts.length === 0 ? <div className="empty-admin">暂无产品，先进入上传产品页面。</div> : null}
            </div>
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
          </>
        ) : null}
      </section>
    </main>
  );
}
