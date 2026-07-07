import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAdminAuthenticated } from "@/lib/auth";

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
  const target = `/admin?company=${encodeURIComponent(companySlug)}`;

  if (await isAdminAuthenticated()) {
    redirect(target);
  }

  return <LoginForm redirectTo={target} description={`${companySlug} 产品册管理入口。`} />;
}
