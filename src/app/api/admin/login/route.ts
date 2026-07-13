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
import { readJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const body = await readJsonBody<{
    username?: string;
    password?: string;
    companySlug?: string;
    loginMode?: "auto" | "platform" | "company";
  }>(request);
  if (!body) return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const companySlug = (body.companySlug ?? "").trim();

  if (
    body.loginMode !== undefined &&
    body.loginMode !== "auto" &&
    body.loginMode !== "platform" &&
    body.loginMode !== "company"
  ) {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const loginMode = body.loginMode ?? (companySlug ? "company" : "platform");
  const isAutoLogin = loginMode === "auto";
  const isCompanyLogin = loginMode === "company";
  const shouldCheckCompany = isAutoLogin || isCompanyLogin;

  if ((isCompanyLogin && !companySlug) || (!isCompanyLogin && companySlug)) {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  if (!username || !password || username.length > 80 || password.length > 512) {
    return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
  }

  if (isAutoLogin && isAdminCredentialsValid(username, password)) {
    await createAdminSession();
    return NextResponse.json({ ok: true, redirectTo: "/admin" });
  }

  if (shouldCheckCompany) {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      const isSampleCompany = !companySlug || companySlug === sampleCompany.slug;
      if (
        !isProductionRuntime() &&
        isSampleCompany &&
        username.toLocaleLowerCase() === sampleCompany.login_username.toLocaleLowerCase() &&
        password === "demo123"
      ) {
        await createCompanySession(sampleCompany.slug);
        return NextResponse.json({ ok: true, redirectTo: `/${sampleCompany.slug}` });
      }

      if (companySlug) {
        return NextResponse.json({ error: "Supabase 未配置，不能登录企业后台。" }, { status: 503 });
      }

      return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
    }

    const companyQuery = supabase.from("companies").select("slug,login_username,password_hash");
    const { data: company, error } = companySlug
      ? await companyQuery.eq("slug", companySlug).single()
      : await companyQuery.eq("login_username", username.toLocaleLowerCase()).maybeSingle();

    if (
      error ||
      !company ||
      company.login_username.toLocaleLowerCase() !== username.toLocaleLowerCase() ||
      !isPasswordHashValid(password, company.password_hash || "")
    ) {
      return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
    }

    await createCompanySession(company.slug);
    return NextResponse.json({ ok: true, redirectTo: `/${company.slug}` });
  }

  if (!isAdminCredentialsValid(username, password)) {
    return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
