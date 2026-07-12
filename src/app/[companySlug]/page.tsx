import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { CompanyProductListWorkspace } from "@/components/CompanyProductListWorkspace";
import { getAuthSession } from "@/lib/auth";
import { getCompanyAdminSnapshot } from "@/lib/data";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export const metadata: Metadata = {
  title: "企业产品列表",
  description: "企业产品列表管理入口。",
  robots: { index: false, follow: false }
};

export default async function CompanyAdminEntryPage({ params }: PageProps) {
  const { companySlug } = await params;
  const session = await getAuthSession();
  const canAccess =
    session?.role === "admin" || (session?.role === "company" && session.companySlug === companySlug);

  if (!canAccess) {
    return (
      <LoginForm
        companySlug={companySlug}
        defaultUsername=""
        redirectTo={`/${companySlug}`}
        description="请输入企业账号和密码进入产品管理后台。"
      />
    );
  }

  const snapshot = await getCompanyAdminSnapshot(companySlug);
  const company = snapshot?.companies[0];
  if (!snapshot || !company) notFound();

  return (
    <CompanyProductListWorkspace
      categories={snapshot.categories}
      company={company}
      configured={snapshot.configured}
      isPlatformAdmin={session?.role === "admin"}
      products={snapshot.products}
    />
  );
}
