import { useSession } from "../store/session";
import { DeliveryError } from "./delivery";

/** The gateway. When unset the app runs on demo data with no server. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const REAL_BACKEND = API_URL.length > 0;

type ErrorBody = { error?: { code?: string; message?: string; details?: { reason?: string } } };

/** A failed call, with the server's own message and reason when it sent one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function send(path: string, init: RequestInit & { token?: string | null }) {
  const { token, ...rest } = init;
  try {
    return await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        accept: "application/json",
        ...(rest.body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection.", 0, "NETWORK");
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (ErrorBody & T) | null;
  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status}).`,
      res.status,
      body?.error?.details?.reason ?? body?.error?.code,
    );
  }
  return body as T;
}

/** Calls without a session: sign in. */
export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(await send(path, { method: "POST", body: JSON.stringify(body) }));
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, so a burst of 401s does not spend the refresh token twice. */
function refresh(): Promise<boolean> {
  refreshing ??= useSession
    .getState()
    .refreshTokens()
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Calls with the rider's token. A 401 refreshes once and retries, then signs the rider out. */
export async function authed<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const run = () =>
    send(path, {
      method: init.method ?? "GET",
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      token: useSession.getState().accessToken,
    });
  let res = await run();
  if (res.status === 401) {
    if (await refresh()) res = await run();
    if (res.status === 401) {
      useSession.getState().signOut();
      throw new ApiError("Your session ended. Sign in again.", 401, "UNAUTHORIZED");
    }
  }
  return parse<T>(res);
}

/** Turns a server failure into the error type the screens already know how to show. */
export function toDeliveryError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const known = [
    "INVALID_TRANSITION",
    "ITEMS_NOT_CHECKED",
    "WRONG_CODE",
    "CODE_LOCKED",
    "OFFER_EXPIRED",
    "NETWORK",
    "UNAUTHORIZED",
  ] as const;
  const reason = known.find((r) => r === error.reason);
  return reason ? new DeliveryError(reason, error.message) : error;
}
