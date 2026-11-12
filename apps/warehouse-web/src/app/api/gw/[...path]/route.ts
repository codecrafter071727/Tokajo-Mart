import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  AT,
  clearSession,
  GATEWAY_URL,
  RT,
  setSession,
  type AuthPayload,
} from "../../../../lib/session";

/**
 * Forwards /api/gw/v1/... to the gateway with the signed in user's token. When the access token has
 * expired it refreshes once and retries, so a long shift never drops to the login page.
 */
async function forward(
  request: NextRequest,
  path: string[],
  token: string | undefined,
  body: ArrayBuffer | undefined,
) {
  const headers: Record<string, string> = { accept: "application/json" };
  const type = request.headers.get("content-type");
  if (type) headers["content-type"] = type;
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${GATEWAY_URL}/${path.join("/")}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body,
  });
}

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path[0] !== "v1")
    return NextResponse.json({ error: { message: "Not found." } }, { status: 404 });
  const jar = await cookies();
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  let refreshed: AuthPayload | null = null;
  let token = jar.get(AT)?.value;
  let upstream: Response | null = token
    ? await forward(request, path, token, body).catch(() => null)
    : null;

  if (!token || upstream?.status === 401) {
    const refreshToken = jar.get(RT)?.value;
    if (refreshToken) {
      const r = await fetch(`${GATEWAY_URL}/v1/identity/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
      if (r?.ok) {
        refreshed = (await r.json()) as AuthPayload;
        token = refreshed.accessToken;
        upstream = await forward(request, path, token, body).catch(() => null);
      }
    }
  }
  if (!upstream) {
    return NextResponse.json(
      { error: { message: "The server is not reachable." } },
      { status: 502 },
    );
  }

  const res = new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
  if (refreshed) setSession(res, refreshed);
  else if (upstream.status === 401) clearSession(res);
  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
