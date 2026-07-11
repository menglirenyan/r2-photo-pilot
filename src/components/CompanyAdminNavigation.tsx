"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, ImagePlus, List, LogOut, Menu, X } from "lucide-react";
import type { Company } from "@/types";

type CompanyAdminNavigationProps = {
  active: "products" | "upload";
  company: Pick<Company, "name" | "slug">;
};

export function CompanyAdminNavigation({ active, company }: CompanyAdminNavigationProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(`/${company.slug}`);
  }

  const links = (
    <nav aria-label="企业后台导航">
      <a className={active === "products" ? "active" : ""} href={`/${company.slug}`}>
        <List size={17} />
        产品列表
      </a>
      <a className={active === "upload" ? "active" : ""} href={`/${company.slug}/upload`}>
        <ImagePlus size={17} />
        上传产品
      </a>
      <a href={`/${company.slug}?mode=quotation`}>
        <FileText size={17} />
        生成报价单
      </a>
      <a href={`/c/${company.slug}`}>
        <BookOpen size={17} />
        查看产品册
      </a>
    </nav>
  );

  return (
    <>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>货</span>
          <div>
            <strong>货物产品册</strong>
            <small>{company.name}</small>
          </div>
        </div>
        {links}
        <button className="sidebar-button" onClick={logout} type="button">
          <LogOut size={16} />
          退出登录
        </button>
      </aside>

      <header className="company-mobile-nav">
        <a className="mobile-brand" href={`/${company.slug}`}>
          <span>货</span>
          <strong>{company.name}</strong>
        </a>
        <button aria-expanded={open} aria-label={open ? "关闭导航" : "打开导航"} onClick={() => setOpen(!open)} type="button">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        {open ? (
          <div className="mobile-nav-panel">
            {links}
            <button className="mobile-logout" onClick={logout} type="button">
              <LogOut size={16} />
              退出登录
            </button>
          </div>
        ) : null}
      </header>
    </>
  );
}
