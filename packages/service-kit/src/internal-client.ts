import { INTERNAL_KEY_HEADER } from "./internal-auth";

/** A failed call to another service, with whatever structured error it sent back. */
export class InternalCallError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "InternalCallError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when trying again might help: the other service was down, slow or overloaded. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export type InternalClientOptions = {
  baseUrl: string;
  apiKey: string | undefined;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export type InternalClient = {
  get<T>(path: string, init?: CallInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: CallInit): Promise<T>;
};

export type CallInit = {
  /** Carried through so one customer request can be followed across services in the logs */
  requestId?: string;
  signal?: AbortSignal;
};

export function createInternalClient(options: InternalClientOptions): InternalClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 5000;
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function call<T>(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    init: CallInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    init.signal?.addEventListener("abort", () => controller.abort());

    const headers: Record<string, string> = { accept: "application/json" };
    if (options.apiKey) headers[INTERNAL_KEY_HEADER] = options.apiKey;
    if (init.requestId) headers["x-request-id"] = init.requestId;
    if (body !== undefined) headers["content-type"] = "application/json";

    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new InternalCallError(`Could not reach ${baseUrl}.`, 0, "SERVICE_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const error = (
        payload as { error?: { code?: string; message?: string; details?: unknown } } | undefined
      )?.error;
      throw new InternalCallError(
        error?.message ?? `Call to ${path} failed (${response.status}).`,
        response.status,
        error?.code ?? "INTERNAL_ERROR",
        error?.details,
      );
    }
    return payload as T;
  }

  return {
    get: (path, init) => call("GET", path, undefined, init),
    post: (path, body, init) => call("POST", path, body, init),
  };
}
