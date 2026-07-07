import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "旧图片上传验证接口已下线。请使用 /c/[companySlug] 浏览产品，或登录 /admin 管理产品。"
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: "旧图片上传验证接口已下线。产品写入请使用后台产品接口。"
    },
    { status: 410 }
  );
}
