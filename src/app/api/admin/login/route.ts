import { NextResponse } from "next/server";
import {
  createAdminSession,
  createCompanySession,
  isAdminCredentialsValid,
  isPasswordHashValid
} from "@/lib/auth";
import { isProductionRuntime } from "@/lib/runtime-config";
import { sampleCompany } from "@/lib/sample-data";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string; companySlug?: string };
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const companySlug = (body.companySlug ?? "").trim();

  if (companySlug) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      if (!isProductionRuntime() && companySlug === sampleCompany.slug && username === sampleCompany.login_username && password === "demo123") {
        await createCompanySession(sampleCompany.slug);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ error: "Supabase 未配置，不能登录企业后台。" }, { status: 503 });
    }

    const { data: company, error } = await supabase
      .from("companies")
      .select("slug,login_username,password_hash")
      .eq("slug", companySlug)
      .single();

    if (
      error ||
      !company ||
      company.login_username !== username ||
      !isPasswordHashValid(password, company.password_hash || "")
    ) {
      return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
    }

    await createCompanySession(company.slug);
    return NextResponse.json({ ok: true });
  }

  if (!isAdminCredentialsValid(username, password)) {
    return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
