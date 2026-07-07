import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return {
      response: NextResponse.json({ error: "未登录或登录已过期。" }, { status: 401 }),
      supabase: null
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "Supabase 未配置，当前只能查看演示数据。" }, { status: 503 }),
      supabase: null
    };
  }

  return { response: null, supabase };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}
