import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSession, GATEWAY_URL, RT } from "../../../../lib/session";

export async function POST() {
  const refreshToken = (await cookies()).get(RT)?.value;
  if (refreshToken) {
    await fetch(`${GATEWAY_URL}/v1/identity/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
