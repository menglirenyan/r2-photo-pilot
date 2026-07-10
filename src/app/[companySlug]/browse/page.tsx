import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ companySlug: string }>;
};

export default async function CompanyCatalogPage({ params }: PageProps) {
  const { companySlug } = await params;
  redirect(`/c/${companySlug}`);
}
