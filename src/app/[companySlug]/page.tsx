import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isCompanyOrAdminAuthenticated } from "@/lib/auth";
import { getCompanyAdminSnapshot } from "@/lib/data";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug } = await params;

  return {
    title: `${companySlug} 管理入口`,
    description: "企业产品册管理入口。"
  };
}

export default async function CompanyAdminEntryPage({ params }: PageProps) {
  const { companySlug } = await params;

  if (!(await isCompanyOrAdminAuthenticated(companySlug))) {
    return (
      <LoginForm
        companySlug={companySlug}
        defaultUsername=""
        redirectTo={`/${companySlug}`}
        description={`${companySlug} 企业后台登录。`}
      />
    );
  }

  const snapshot = await getCompanyAdminSnapshot(companySlug);
  if (!snapshot) notFound();

  return <AdminDashboard {...snapshot} mode="company" initialCompanySlug={companySlug} />;
}
