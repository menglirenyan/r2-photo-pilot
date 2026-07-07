import { NextResponse, type NextRequest } from "next/server";

function safeDecodePath(pathname: string) {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

export function proxy(request: NextRequest) {
  const pathname = safeDecodePath(request.nextUrl.pathname);

  if (!pathname.includes("/浏览页")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname.replace("/浏览页", "/browse");
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
