/** Browser side calls. They go to this site's /api/gw proxy, which adds the token. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/gw${path}`, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch(() => {
    throw new ApiError(0, "Cannot reach the server. Check the connection.");
  });
  const json = await res.json().catch(() => null);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.message ?? "Something went wrong.",
      json?.error?.details,
    );
  }
  return json as T;
}
