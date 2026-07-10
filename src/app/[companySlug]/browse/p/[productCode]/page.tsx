import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ companySlug: string; productCode: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { companySlug, productCode } = await params;
  redirect(`/c/${companySlug}/p/${productCode}`);
}
