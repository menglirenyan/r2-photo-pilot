import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCatalog } from "@/components/PublicCatalog";
import { getPublicCatalog } from "@/lib/data";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug } = await params;
  const catalog = await getPublicCatalog(companySlug);

  return {
    title: catalog ? `${catalog.company.name}产品册` : "产品册不可访问",
    description: catalog ? `${catalog.company.name}公开产品信息` : "企业产品册不存在或未开通。"
  };
}

export default async function CompanyCatalogPage({ params }: PageProps) {
  const { companySlug } = await params;
  const catalog = await getPublicCatalog(companySlug);

  if (!catalog) notFound();

  if (!catalog.isAccessible) {
    return (
      <main className="catalog-unavailable">
        <section>
          <span className="catalog-mark">{catalog.company.name.slice(0, 1)}</span>
          <h1>{catalog.company.name}</h1>
          <p>该企业产品册暂未开通或已到期。</p>
        </section>
      </main>
    );
  }

  return <PublicCatalog categories={catalog.categories} company={catalog.company} products={catalog.products} />;
}
