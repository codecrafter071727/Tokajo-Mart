import { NextResponse, type NextRequest } from "next/server";

// Pages need a session cookie. The real check happens at the gateway on every API call.
export function middleware(request: NextRequest) {
  const signedIn = request.cookies.has("qc_at") || request.cookies.has("qc_rt");
  const onLogin = request.nextUrl.pathname === "/login";
  if (!signedIn && !onLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (signedIn && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

// The install files must load without a session: browsers fetch the manifest without cookies
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)"],
};
