import { NextResponse } from "next/server";
import { GATEWAY_URL, setSessionCookies, type TokenPair } from "../../../lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ message: "Enter your email and password." }, { status: 400 });
  }
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/v1/identity/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return NextResponse.json({ message: "Cannot reach the server." }, { status: 502 });
  }
  const data = (await res.json().catch(() => null)) as
    | (TokenPair & { user: { role: string; name: string } })
    | { error?: { message?: string } }
    | null;
  if (!res.ok || !data || !("user" in data)) {
    const message = (data as { error?: { message?: string } } | null)?.error?.message;
    return NextResponse.json(
      { message: message ?? "Could not sign in." },
      { status: res.status === 429 ? 429 : 401 },
    );
  }
  // This site is for platform admins. Warehouse staff have their own app.
  if (data.user.role !== "admin") {
    return NextResponse.json({ message: "This account is not an admin." }, { status: 403 });
  }
  const response = NextResponse.json({ name: data.user.name });
  setSessionCookies(response, data);
  return response;
}
