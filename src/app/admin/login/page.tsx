import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAdminAuthenticated } from "@/lib/auth";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return <LoginForm />;
}
