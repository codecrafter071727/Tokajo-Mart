import { NextResponse } from "next/server";
import { ALLOWED_ROLES, GATEWAY_URL, setSession, type AuthPayload } from "../../../../lib/session";

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${GATEWAY_URL}/v1/identity/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }).catch(() => null);
  if (!upstream) {
    return NextResponse.json(
      { error: { message: "The server is not reachable." } },
      { status: 502 },
    );
  }
  const json = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: { message: json?.error?.message ?? "Sign in failed." } },
      { status: upstream.status },
    );
  }
  const auth = json as AuthPayload;
  if (!(ALLOWED_ROLES as readonly string[]).includes(auth.user.role)) {
    return NextResponse.json(
      { error: { message: "This app is for warehouse staff and admins." } },
      { status: 403 },
    );
  }
  const res = NextResponse.json({ user: auth.user });
  setSession(res, auth);
  return res;
}
