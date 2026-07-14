"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LogOut,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
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

const pageSize = 5;
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
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const filteredCompanies = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return companyList.filter((company) => {
      const matchesStatus = statusFilter === "all" || company.status === statusFilter;
      const matchesQuery =
        !keyword ||
        company.name.toLocaleLowerCase().includes(keyword) ||
        (company.login_username || "").toLocaleLowerCase().includes(keyword) ||
        (company.contact_name || "").toLocaleLowerCase().includes(keyword);
      return matchesStatus && matchesQuery;
    });
  }, [companyList, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const visibleCompanies = filteredCompanies.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [query, statusFilter]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    const response = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(companyForm)
    });
    setIsSaving(false);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    const payload = (await response.json()) as { company: Company };
    setCompanyList((current) => [payload.company, ...current]);
    setCompanyForm(initialCompanyForm);
    setIsCreateOpen(false);
    setMessage("用户已添加。");
  }

  async function updateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCompany) return;
    setMessage("");
    setIsSaving(true);
    const response = await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editingCompany,
        ...(editPassword ? { login_password: editPassword } : {})
      })
    });
    setIsSaving(false);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    const payload = (await response.json()) as { company: Company };
    setCompanyList((current) => current.map((item) => (item.id === payload.company.id ? payload.company : item)));
    setEditingCompany(null);
    setEditPassword("");
    setMessage("用户资料已更新。");
  }

  async function deleteCompany(company: Company) {
    const confirmed = window.confirm(`确认删除“${company.name}”？该用户下的分类、产品和历史单据也会被删除。`);
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
    setEditingCompany(null);
    setMessage("用户已删除。");
  }

  function closeCreate() {
    if (isSaving) return;
    setIsCreateOpen(false);
    setCompanyForm(initialCompanyForm);
  }

  function closeEdit() {
    if (isSaving) return;
    setEditingCompany(null);
    setEditPassword("");
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span>货</span><div><strong>货物产品册</strong><small>用户管理</small></div></div>
        <nav><a href="#companies">用户</a></nav>
        <button className="sidebar-button" onClick={logout} type="button"><LogOut size={16} />退出</button>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div><h1>用户管理</h1><p>查找企业、查看到期状态，按需进入详情完成管理。</p></div>
          <span className="admin-count">共 {companyList.length} 个用户</span>
        </header>

        {!configured ? <div className="admin-warning">当前未配置 Supabase，页面展示演示数据；写入操作会被后端拒绝。</div> : null}
        {message ? <div className="admin-message" role="status">{message}</div> : null}

        <section className="admin-panel company-directory" id="companies">
          <div className="directory-head">
            <div className="panel-title"><CalendarDays size={18} /><div><h2>用户列表</h2><p>每页显示 5 个客户，点击详情后编辑完整资料。</p></div></div>
            <button className="primary-action" disabled={!configured} onClick={() => setIsCreateOpen(true)} type="button"><Plus size={16} />添加用户</button>
          </div>

          <div className="company-toolbar">
            <label className="company-search"><Search size={17} /><input aria-label="搜索用户" onChange={(event) => setQuery(event.target.value)} placeholder="搜索企业名称、账号或联系人" type="search" value={query} /></label>
            <label className="company-filter"><span>状态</span><select aria-label="按状态筛选" onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}><option value="all">全部</option><option value="active">已开通</option><option value="inactive">未开通</option></select></label>
          </div>

          <div className="company-table" role="table" aria-label="用户列表">
            <div className="company-table-head" role="row"><span>企业名称</span><span>联系方式</span><span>截止日期</span><span>状态</span><span>操作</span></div>
            {visibleCompanies.map((company) => (
              <article className="company-table-row" key={company.id} role="row">
                <strong title={company.name}>{company.name}</strong>
                <span>{company.contact_name || "未填写"}</span>
                <span>{compactDate(company.paid_until)}</span>
                <span><i className={company.status === "active" ? "company-status active" : "company-status"}>{company.status === "active" ? "已开通" : "未开通"}</i></span>
                <button className="detail-action" onClick={() => { setEditingCompany({ ...company }); setEditPassword(""); }} type="button">查看详情</button>
              </article>
            ))}
            {visibleCompanies.length === 0 ? <div className="empty-admin">没有找到符合条件的用户。</div> : null}
          </div>

          <footer className="company-pagination">
            <span>已显示 {filteredCompanies.length} 个结果</span>
            <div><button aria-label="上一页" disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft size={16} /></button><b>{page} / {pageCount}</b><button aria-label="下一页" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight size={16} /></button></div>
          </footer>
        </section>
      </section>

      {isCreateOpen ? (
        <div className="admin-modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreate(); }}>
          <form aria-labelledby="create-company-title" className="admin-modal" onSubmit={createCompany} role="dialog" aria-modal="true">
            <div className="admin-modal-head"><div><span className="modal-kicker"><Building2 size={15} />新客户</span><h2 id="create-company-title">添加用户</h2><p>创建企业登录账号并设置服务有效期。</p></div><button aria-label="关闭" className="modal-close" onClick={closeCreate} type="button"><X size={20} /></button></div>
            <CompanyFields form={companyForm} onChange={setCompanyForm} passwordLabel="初始密码" />
            <div className="admin-modal-actions"><button className="ghost-action" onClick={closeCreate} type="button">取消</button><button className="primary-action" disabled={isSaving} type="submit"><Plus size={16} />{isSaving ? "添加中…" : "添加用户"}</button></div>
          </form>
        </div>
      ) : null}

      {editingCompany ? (
        <div className="admin-modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit(); }}>
          <form aria-labelledby="edit-company-title" className="admin-modal" onSubmit={updateCompany} role="dialog" aria-modal="true">
            <div className="admin-modal-head"><div><span className="modal-kicker">客户详情</span><h2 id="edit-company-title">{editingCompany.name}</h2><p>账号、状态与内部资料仅供平台运营管理。</p></div><button aria-label="关闭" className="modal-close" onClick={closeEdit} type="button"><X size={20} /></button></div>
            <CompanyFields form={{ ...editingCompany, login_password: editPassword, paid_until: editingCompany.paid_until || "", contact_name: editingCompany.contact_name || "", contact_note: editingCompany.contact_note || "", status: editingCompany.status as "active" | "inactive" }} onChange={(next) => { setEditingCompany((current) => current ? { ...current, name: next.name, login_username: next.login_username, status: next.status, paid_until: next.paid_until || null, contact_name: next.contact_name, contact_note: next.contact_note } : current); setEditPassword(next.login_password); }} passwordLabel="新密码（留空不改）" />
            <div className="admin-modal-links"><a className="ghost-action" href={`/${editingCompany.slug}`}><ImagePlus size={15} />管理产品/图片</a><a className="ghost-action" href={`/c/${editingCompany.slug}`} rel="noreferrer" target="_blank"><BookOpen size={15} />公开产品册</a></div>
            <div className="admin-modal-actions split"><button className="danger-action" onClick={() => deleteCompany(editingCompany)} type="button"><Trash2 size={15} />删除用户</button><div><button className="ghost-action" onClick={closeEdit} type="button">取消</button><button className="primary-action" disabled={isSaving} type="submit">{isSaving ? "保存中…" : "保存修改"}</button></div></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function CompanyFields({ form, onChange, passwordLabel }: { form: CompanyForm; onChange: (form: CompanyForm) => void; passwordLabel: string }) {
  return <div className="field-grid two company-modal-fields">
    <label>用户名称<input required value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} /></label>
    <label>登录账号<input autoComplete="username" placeholder="例如 sales-team" required value={form.login_username} onChange={(event) => onChange({ ...form, login_username: event.target.value })} /></label>
    <label>{passwordLabel}<input autoComplete="new-password" minLength={6} type="password" value={form.login_password} onChange={(event) => onChange({ ...form, login_password: event.target.value })} /></label>
    <label>状态<select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as "active" | "inactive" })}><option value="inactive">未开通</option><option value="active">已开通</option></select></label>
    <label>可用到期日<input type="date" value={form.paid_until} onChange={(event) => onChange({ ...form, paid_until: event.target.value })} /></label>
    <label>内部联系人<input value={form.contact_name} onChange={(event) => onChange({ ...form, contact_name: event.target.value })} /></label>
    <label className="company-note-field">内部备注<textarea rows={3} value={form.contact_note} onChange={(event) => onChange({ ...form, contact_note: event.target.value })} /></label>
  </div>;
}
