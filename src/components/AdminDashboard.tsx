"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, CheckCircle2, LogOut, Plus, Trash2, XCircle } from "lucide-react";
import { compactDate } from "@/lib/format";
import type { AdminSnapshot, Company } from "@/types";

type AdminDashboardProps = Pick<AdminSnapshot, "companies" | "configured">;

type CompanyForm = {
  contact_name: string;
  contact_note: string;
  login_password: string;
  login_username: string;
  name: string;
  paid_until: string;
  status: "active" | "inactive";
};

type CompanyUpdatePatch = Partial<Company> & {
  login_password?: string;
};

const initialCompanyForm: CompanyForm = {
  contact_name: "",
  contact_note: "",
  login_password: "",
  login_username: "",
  name: "",
  paid_until: "",
  status: "inactive"
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "操作失败。";
}

export function AdminDashboard({ companies, configured }: AdminDashboardProps) {
  const router = useRouter();
  const [companyList, setCompanyList] = useState(companies);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(initialCompanyForm);
  const [message, setMessage] = useState("");
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

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
    setCompanyForm(initialCompanyForm);
    setMessage(`用户已添加，企业编号 ${payload.company.slug}。`);
  }

  function updateCompanyLocal(companyId: string, patch: Partial<Company>) {
    setCompanyList((current) => current.map((item) => (item.id === companyId ? { ...item, ...patch } : item)));
  }

  async function updateCompany(company: Company, patch: CompanyUpdatePatch = {}) {
    setMessage("");
    const response = await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...company, ...patch })
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

    setCompanyList((current) => current.filter((item) => item.id !== company.id));
    setMessage("用户已删除。");
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>货</span>
          <div>
            <strong>货物产品册</strong>
            <small>用户管理</small>
          </div>
        </div>
        <nav>
          <a href="#companies">用户</a>
        </nav>
        <button className="sidebar-button" onClick={logout} type="button">
          <LogOut size={16} />
          退出
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div>
            <h1>用户管理</h1>
            <p>添加企业用户，设置登录账号、初始密码、开通状态和可用时间。企业编号按顺序自动生成。</p>
          </div>
          <span className="admin-count">共 {companyList.length} 个用户</span>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message" role="status">{message}</div> : null}

        <section className="admin-grid" id="companies">
          <form className="admin-panel" onSubmit={createCompany}>
            <div className="panel-title">
              <Building2 size={18} />
              <h2>添加用户</h2>
            </div>
            <div className="field-grid two">
              <label>
                用户名称
                <input required value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} />
              </label>
              <label>
                登录账号
                <input
                  autoComplete="username"
                  placeholder="例如 factory001"
                  required
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
            <button className="primary-action" disabled={!configured} type="submit">
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
                    <small>公开目录：/c/{company.slug}</small>
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
      </section>
    </main>
  );
}
