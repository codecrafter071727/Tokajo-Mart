import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./lib/session";

/** Every page needs a session. A lapsed access token with a refresh token left is renewed first. */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (request.cookies.get(ACCESS_COOKIE)) return NextResponse.next();

  const target = new URL(
    request.cookies.get(REFRESH_COOKIE) ? "/session/refresh" : "/login",
    request.url,
  );
  target.searchParams.set("next", pathname + search);
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in again." } },
      { status: 401 },
    );
  }
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!login|session|_next|favicon.ico|.*\\..*).*)"],
};
