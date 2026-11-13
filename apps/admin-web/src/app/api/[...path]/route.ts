import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  GATEWAY_URL,
  REFRESH_COOKIE,
  refreshTokens,
  setSessionCookies,
  type TokenPair,
} from "../../../lib/session";

/**
 * The browser calls /api/v1/... on this site. This adds the admin's token from the httpOnly cookie
 * and forwards to the gateway, so the browser never holds a token and no CORS setup is needed.
 */
async function forward(request: NextRequest, path: string[]) {
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  // Lets a retried refund or order return the first result instead of acting twice
  const idempotencyKey = request.headers.get("idempotency-key");
  const call = (token: string | undefined) =>
    fetch(`${GATEWAY_URL}/${path.join("/")}${request.nextUrl.search}`, {
      method: request.method,
      headers: {
        accept: "application/json",
        // Keep the caller's type so a CSV import arrives as text/csv, not JSON
        ...(body
          ? { "content-type": request.headers.get("content-type") ?? "application/json" }
          : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body,
    });

  let renewed: TokenPair | null = null;
  let res = await call(request.cookies.get(ACCESS_COOKIE)?.value);
  if (res.status === 401) {
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    renewed = refresh ? await refreshTokens(refresh) : null;
    if (renewed) res = await call(renewed.accessToken);
  }

  const out = new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
  if (renewed) setSessionCookies(out, renewed);
  else if (res.status === 401) clearSessionCookies(out);
  return out;
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (request: NextRequest, { params }: Ctx) =>
  forward(request, (await params).path);
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
