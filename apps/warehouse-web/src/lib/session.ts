import type { NextResponse } from "next/server";

/** Server side only. The tokens live in httpOnly cookies, so page scripts never see them. */
export const GATEWAY_URL =
  process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
export const AT = "qc_at";
export const RT = "qc_rt";
export const USER = "qc_user";

export const ALLOWED_ROLES = ["warehouse_staff", "warehouse_manager", "admin"] as const;

export type SessionUser = {
  id: string;
  name: string;
  role: (typeof ALLOWED_ROLES)[number];
  warehouseId: string | null;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser & { role: string };
};

const base = { httpOnly: true, sameSite: "lax" as const, path: "/" };
const secure = process.env.NODE_ENV === "production";

export function setSession(res: NextResponse, auth: AuthPayload): void {
  res.cookies.set(AT, auth.accessToken, { ...base, secure, maxAge: auth.expiresIn });
  res.cookies.set(RT, auth.refreshToken, { ...base, secure, maxAge: 30 * 86400 });
  const user: SessionUser = {
    id: auth.user.id,
    name: auth.user.name,
    role: auth.user.role as SessionUser["role"],
    warehouseId: auth.user.warehouseId,
  };
  // The name and role are not secret and the screens need them, so this one is readable
  res.cookies.set(USER, JSON.stringify(user), {
    ...base,
    httpOnly: false,
    secure,
    maxAge: 30 * 86400,
  });
}

export function clearSession(res: NextResponse): void {
  for (const name of [AT, RT, USER]) res.cookies.set(name, "", { ...base, maxAge: 0 });
}
