import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const snapshot = await getAdminSnapshot();
  return <AdminDashboard {...snapshot} />;
}
