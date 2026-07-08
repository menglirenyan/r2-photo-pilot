import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { ProductUploadWorkspace } from "@/components/ProductUploadWorkspace";
import { isCompanyOrAdminAuthenticated } from "@/lib/auth";
import { getCompanyAdminSnapshot } from "@/lib/data";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug } = await params;

  return {
    title: `${companySlug} 上传产品`,
    description: "企业产品图片上传入口。"
  };
}

export default async function CompanyProductUploadPage({ params }: PageProps) {
  const { companySlug } = await params;

  if (!(await isCompanyOrAdminAuthenticated(companySlug))) {
    return (
      <LoginForm
        companySlug={companySlug}
        defaultUsername=""
        redirectTo={`/${companySlug}/upload`}
        description={`${companySlug} 上传产品登录。`}
      />
    );
  }

  const snapshot = await getCompanyAdminSnapshot(companySlug);
  const company = snapshot?.companies[0];
  if (!snapshot || !company) notFound();

  return <ProductUploadWorkspace company={company} categories={snapshot.categories} configured={snapshot.configured} />;
}
