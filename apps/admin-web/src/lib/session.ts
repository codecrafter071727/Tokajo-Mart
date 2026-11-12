import type { NextResponse } from "next/server";

/** Where the browser's calls go. Only the Next server talks to it, so the browser never sees a token. */
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:4000";

export const ACCESS_COOKIE = "qc_admin_access";
export const REFRESH_COOKIE = "qc_admin_refresh";

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Tokens live in httpOnly cookies: page scripts (and so any injected script) cannot read them. */
export function setSessionCookies(response: NextResponse, tokens: TokenPair): void {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: tokens.expiresIn });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: 30 * 86_400 });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/identity/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenPair;
  } catch {
    return null;
  }
}

/** Only same-site relative paths, so a login link cannot bounce someone to another site. */
export const safeNext = (value: string | null): string =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
