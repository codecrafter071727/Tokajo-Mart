import { useAuthStore } from "../store/auth";
import { HttpError } from "./httpError";

export { HttpError };

/**
 * Talks to the gateway for sign in and orders. When EXPO_PUBLIC_API_URL is not set the app runs on
 * bundled fixtures and a demo sign in, so Expo Go works with no backend.
 */
const gateway = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

export const backendEnabled = Boolean(gateway);

/** The gateway address, for the few calls that cannot go through apiFetch (images with a token). */
export const gatewayBase = gateway ?? "";

const TIMEOUT_MS = 10_000;

async function send(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
  token: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${gateway}${path}`, {
      method,
      headers: {
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new HttpError("Could not reach the server. Check your connection.", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

// One refresh at a time: refresh tokens rotate, so two parallel refreshes would lock each other out
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) return false;
    try {
      const res = await send("POST", "/v1/identity/auth/refresh", { refreshToken }, {}, null);
      if (!res.ok) {
        // The session was ended (logged out elsewhere, blocked, expired): go back to sign in
        if (res.status === 401 || res.status === 403) logout();
        return false;
      }
      const session = (await res.json()) as { accessToken: string; refreshToken: string };
      setTokens(session.accessToken, session.refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Calls the gateway as the signed in user. On a 401 it refreshes the session once and retries. */
export async function apiFetch<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: { body?: unknown; headers?: Record<string, string>; auth?: boolean } = {},
): Promise<T> {
  const wantsAuth = options.auth !== false;
  const run = () =>
    send(
      method,
      path,
      options.body,
      options.headers ?? {},
      wantsAuth ? useAuthStore.getState().accessToken : null,
    );

  let res = await run();
  if (res.status === 401 && wantsAuth && useAuthStore.getState().refreshToken) {
    if (await refreshSession()) res = await run();
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  if (!res.ok) {
    const error = (
      payload as { error?: { code?: string; message?: string; details?: unknown } } | undefined
    )?.error;
    if (res.status === 401 && wantsAuth) useAuthStore.getState().logout();
    throw new HttpError(
      error?.message ?? `Something went wrong (${res.status}).`,
      res.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.details,
    );
  }
  return payload as T;
}
