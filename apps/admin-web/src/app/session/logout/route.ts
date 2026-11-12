import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookies, GATEWAY_URL, REFRESH_COOKIE } from "../../../lib/session";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${GATEWAY_URL}/v1/identity/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
