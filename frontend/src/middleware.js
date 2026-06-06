import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/display")) return NextResponse.next();

  const token = request.cookies.get("accessToken");
  const isAuthPage = pathname.startsWith("/login");

  // Jika tidak ada token dan bukan di halaman login, lempar ke login
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Tentukan rute mana saja yang butuh proteksi (hindari rute statis/api)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
