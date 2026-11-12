import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { USER } from "../../../../lib/session";

export async function GET() {
  const raw = (await cookies()).get(USER)?.value;
  if (!raw) return NextResponse.json({ error: { message: "Sign in." } }, { status: 401 });
  try {
    return NextResponse.json({ user: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ error: { message: "Sign in." } }, { status: 401 });
  }
}
