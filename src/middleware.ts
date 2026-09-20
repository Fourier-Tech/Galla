import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname.startsWith("/login");
  const isDashboardPage = pathname.startsWith("/dashboard");

  // Galla has no public landing page. Direct to /dashboard if logged in, else /login
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = token ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  // Redirect any legacy /register requests straight to /login
  if (pathname.startsWith("/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isDashboardPage && !token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && token) {
    if (request.nextUrl.searchParams.has("error") || request.nextUrl.searchParams.has("expired")) {
      const response = NextResponse.next();
      response.cookies.delete("authjs.session-token");
      response.cookies.delete("__Secure-authjs.session-token");
      response.cookies.delete("next-auth.session-token");
      response.cookies.delete("__Secure-next-auth.session-token");
      return response;
    }
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/register"],
};
