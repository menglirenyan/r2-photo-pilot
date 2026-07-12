import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { ProductUploadWorkspace } from "@/components/ProductUploadWorkspace";
import { getAuthSession } from "@/lib/auth";
import { getCompanyAdminSnapshot } from "@/lib/data";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export const metadata: Metadata = {
  title: "上传产品",
  description: "企业产品图片上传入口。",
  robots: { index: false, follow: false }
};

export default async function CompanyProductUploadPage({ params }: PageProps) {
  const { companySlug } = await params;
  const session = await getAuthSession();
  const canAccess =
    session?.role === "admin" || (session?.role === "company" && session.companySlug === companySlug);

  if (!canAccess) {
    return (
      <LoginForm
        companySlug={companySlug}
        defaultUsername=""
        redirectTo={`/${companySlug}/upload`}
        description="请输入企业账号和密码进入产品上传后台。"
      />
    );
  }

  const snapshot = await getCompanyAdminSnapshot(companySlug);
  const company = snapshot?.companies[0];
  if (!snapshot || !company) notFound();

  return (
    <ProductUploadWorkspace
      company={company}
      categories={snapshot.categories}
      configured={snapshot.configured}
      isPlatformAdmin={session?.role === "admin"}
    />
  );
}
