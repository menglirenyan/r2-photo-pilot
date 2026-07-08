import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { ShipmentWorkspace } from "@/components/ShipmentWorkspace";
import { isCompanyOrAdminAuthenticated } from "@/lib/auth";
import { getCompanyAdminSnapshot } from "@/lib/data";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug } = await params;

  return {
    title: `${companySlug} 出货单`,
    description: "企业临时出货单下载入口。"
  };
}

export default async function CompanyShipmentPage({ params }: PageProps) {
  const { companySlug } = await params;

  if (!(await isCompanyOrAdminAuthenticated(companySlug))) {
    return (
      <LoginForm
        companySlug={companySlug}
        defaultUsername=""
        redirectTo={`/${companySlug}/shipments`}
        description={`${companySlug} 出货单登录。`}
      />
    );
  }

  const snapshot = await getCompanyAdminSnapshot(companySlug);
  const company = snapshot?.companies[0];
  if (!snapshot || !company) notFound();

  return <ShipmentWorkspace company={company} configured={snapshot.configured} />;
}
