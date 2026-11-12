/**
 * Calls the gateway through this site's /api proxy, which adds the admin's token (and renews it
 * once if it ran out). Throws a GwError with the server's own message, so screens can show it.
 */
export class GwError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "GwError";
    this.status = status;
    this.details = details;
  }
}

export async function gw<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new GwError("Could not reach the server. Check your connection.", 0);
  }
  const payload: unknown = await res.json().catch(() => null);
  if (res.status === 401) {
    // The proxy could not renew the session: send the admin back to sign in
    window.location.assign("/login");
    throw new GwError("Your session ended. Sign in again.", 401);
  }
  if (!res.ok) {
    const error = (payload as { error?: { message?: string; details?: unknown } } | null)?.error;
    throw new GwError(
      error?.message ?? `Something went wrong (${res.status}).`,
      res.status,
      error?.details,
    );
  }
  return payload as T;
}

export const errorMessage = (error: unknown): string =>
  error instanceof GwError ? error.message : "Something went wrong. Try again.";

/** Builds a query string from the values that are set. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
