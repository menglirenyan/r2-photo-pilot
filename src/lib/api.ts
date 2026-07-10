import { NextResponse } from "next/server";
import { getAuthSession, type AuthSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function requireAdmin() {
  const session = await getAuthSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "未登录或登录已过期。" }, { status: 401 }),
      supabase: null,
      session: null
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "Supabase 未配置，当前只能查看演示数据。" }, { status: 503 }),
      supabase: null,
      session: null
    };
  }

  return { response: null, supabase, session };
}

export async function requirePlatformAdmin() {
  const result = await requireAdmin();
  if (result.response || !result.session) return result;

  if (result.session.role !== "admin") {
    return {
      response: NextResponse.json({ error: "只有平台管理员可以管理用户。" }, { status: 403 }),
      supabase: null,
      session: null
    };
  }

  return result;
}

export async function canAccessCompany(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  session: AuthSession,
  companyId: string
) {
  if (session.role === "admin") return true;

  const { data } = await supabase.from("companies").select("slug").eq("id", companyId).single();
  return data?.slug === session.companySlug;
}

export async function requireCompanyAccess(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  session: AuthSession,
  companyId: string
) {
  if (await canAccessCompany(supabase, session, companyId)) return null;

  return NextResponse.json({ error: "不能管理其他企业的数据。" }, { status: 403 });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function databaseError(error: { code?: string | null }, conflictMessage = "数据已存在，请检查后重试。") {
  if (error.code === "23505") return jsonError(conflictMessage, 409);
  if (error.code === "23503") return jsonError("数据仍被其他记录使用，暂时不能删除。", 409);
  return jsonError("数据库操作失败，请稍后重试。", 500);
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}
