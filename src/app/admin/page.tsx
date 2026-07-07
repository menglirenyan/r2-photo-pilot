import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data";

type AdminPageProps = {
  searchParams?: Promise<{ company?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const params = searchParams ? await searchParams : {};
  const snapshot = await getAdminSnapshot();
  return <AdminDashboard {...snapshot} initialCompanySlug={params.company} />;
}
