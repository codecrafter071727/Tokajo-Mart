import { NextResponse, type NextRequest } from "next/server";
import {
  clearSessionCookies,
  REFRESH_COOKIE,
  refreshTokens,
  safeNext,
  setSessionCookies,
} from "../../../lib/session";

/** Renews a lapsed access token, then returns to the page that was asked for. */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const tokens = refreshToken ? await refreshTokens(refreshToken) : null;
  if (!tokens) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearSessionCookies(response);
    return response;
  }
  const response = NextResponse.redirect(new URL(next, request.url));
  setSessionCookies(response, tokens);
  return response;
}
