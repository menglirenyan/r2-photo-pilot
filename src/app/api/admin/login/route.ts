import { NextResponse } from "next/server";
import { createAdminSession, isAdminCredentialsValid } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  if (!isAdminCredentialsValid((body.username ?? "").trim(), body.password ?? "")) {
    return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
