import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCatalog } from "@/components/PublicCatalog";
import { getPublicCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug } = await params;
  const catalog = await getPublicCatalog(companySlug);

  if (!catalog) {
    return {
      title: "产品册不可访问",
      description: "企业产品册不存在或当前不可访问。",
      robots: { index: false, follow: false }
    };
  }

  return {
    title: `${catalog.company.name}产品册`,
    description: `${catalog.company.name}公开产品信息`
  };
}

export default async function CompanyCatalogPage({ params }: PageProps) {
  const { companySlug } = await params;
  const catalog = await getPublicCatalog(companySlug);

  if (!catalog) notFound();

  return (
    <PublicCatalog
      categories={catalog.categories}
      company={{
        name: catalog.company.name,
        slug: catalog.company.slug,
        public_contact_phone: catalog.company.public_contact_phone
      }}
      products={catalog.products}
    />
  );
}
