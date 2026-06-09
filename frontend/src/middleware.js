import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-pathname", pathname);

  if (pathname.startsWith("/display")) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  if (pathname === "/logo.png" || pathname.startsWith("/icons/")) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  const token = request.cookies.get("accessToken");
  const isAuthPage = pathname.startsWith("/login");

  // Jika tidak ada token dan bukan di halaman login, lempar ke login
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  // Tentukan rute mana saja yang butuh proteksi (hindari rute statis/api)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
