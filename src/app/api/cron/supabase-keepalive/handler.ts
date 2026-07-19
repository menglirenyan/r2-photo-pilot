import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

function jsonResponse(body: { ok: boolean }, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function handleSupabaseKeepalive(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return jsonResponse({ ok: false }, 401);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return jsonResponse({ ok: false }, 503);
  }

  const { error } = await supabase.from("companies").select("id").limit(1);

  if (error) {
    console.error("Supabase keepalive query failed.", {
      code: error.code,
      message: error.message
    });
    return jsonResponse({ ok: false }, 500);
  }

  return jsonResponse({ ok: true }, 200);
}
