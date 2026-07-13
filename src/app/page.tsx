import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getAuthSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "后台登录 | 货物产品册",
  description: "货物产品册后台统一登录入口。",
  robots: { index: false, follow: false }
};

export default async function Home() {
  const session = await getAuthSession();

  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "company") redirect(`/${session.companySlug}`);

  return (
    <LoginForm
      defaultUsername=""
      description="输入账号和密码，系统会自动进入对应的管理后台。"
      mode="auto"
    />
  );
}
