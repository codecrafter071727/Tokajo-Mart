import {
  apiErrorSchema,
  availabilityResponseSchema,
  listCategoriesResponseSchema,
  listProductsResponseSchema,
  productSchema,
  serviceabilityResponseSchema,
  type AvailabilityResponse,
  type ErrorCode,
  type ListCategoriesResponse,
  type ListProductsQuery,
  type ListProductsResponse,
  type Product,
  type ServiceabilityQuery,
  type ServiceabilityResponse,
} from "@qc/contracts";

export type ApiClientErrorCode = ErrorCode | "NETWORK_ERROR" | "TIMEOUT" | "INVALID_RESPONSE";

export class ApiClientError extends Error {
  readonly code: ApiClientErrorCode;
  readonly status: number | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    code: ApiClientErrorCode,
    extra: { status?: number; requestId?: string } = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = extra.status;
    this.requestId = extra.requestId;
  }

  /** True when trying again might succeed (network trouble, timeouts, rate limits, 5xx). */
  get retryable(): boolean {
    return (
      this.code === "NETWORK_ERROR" ||
      this.code === "TIMEOUT" ||
      this.code === "RATE_LIMITED" ||
      (this.status !== undefined && this.status >= 500)
    );
  }
}

export type ServiceName = "catalog" | "inventory";

export type ApiClientOptions = {
  /** Gateway origin, for example "http://192.168.1.5:4000". No trailing slash needed. */
  baseUrl: string;
  /**
   * Per service origin overrides, for running services directly while the gateway does not route
   * to them yet. Anything not listed here goes to `baseUrl`.
   */
  serviceUrls?: Partial<Record<ServiceName, string>>;
  /** Called per request, so a refreshed token is always used. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  /** Defaults to the global fetch. Injected in tests. */
  fetch?: typeof fetch;
  /** Per request timeout. Defaults to 10 seconds. */
  timeoutMs?: number;
};

export type RequestOptions = {
  /** Pass the signal TanStack Query gives you so cancelled screens cancel the request. */
  signal?: AbortSignal;
};

type Parser<T> = { parse: (data: unknown) => T };

function toQueryString(query: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function createApiClient(options: ApiClientOptions) {
  const trim = (url: string) => url.replace(/\/+$/, "");
  const baseUrl = trim(options.baseUrl);
  const originFor = (service: ServiceName) => {
    const override = options.serviceUrls?.[service];
    return override ? trim(override) : baseUrl;
  };
  const timeoutMs = options.timeoutMs ?? 10_000;
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function get<T>(
    service: ServiceName,
    path: string,
    schema: Parser<T>,
    query: Record<string, string | number | undefined> = {},
    { signal }: RequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const token = await options.getAccessToken?.();
      if (controller.signal.aborted && !timedOut) {
        // The caller gave up while we were waiting for the token: do not send the request.
        throw Object.assign(new Error("Aborted"), { name: "AbortError" });
      }
      const headers: Record<string, string> = { accept: "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;

      let response: Response;
      try {
        response = await doFetch(`${originFor(service)}${path}${toQueryString(query)}`, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
      } catch (cause) {
        if (signal?.aborted) throw cause; // the caller cancelled: not an error to report
        if (timedOut) {
          throw new ApiClientError("The request timed out.", "TIMEOUT");
        }
        throw new ApiClientError("Could not reach the server.", "NETWORK_ERROR");
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }

      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(body);
        if (parsed.success) {
          const { code, message, requestId } = parsed.data.error;
          throw new ApiClientError(message, code, { status: response.status, requestId });
        }
        throw new ApiClientError(`Request failed (${response.status}).`, "INTERNAL_ERROR", {
          status: response.status,
        });
      }

      try {
        return schema.parse(body);
      } catch {
        throw new ApiClientError("The server sent an unexpected response.", "INVALID_RESPONSE", {
          status: response.status,
        });
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    catalog: {
      listCategories: (opts?: RequestOptions): Promise<ListCategoriesResponse> =>
        get("catalog", "/v1/catalog/categories", listCategoriesResponseSchema, {}, opts),

      listProducts: (
        query: ListProductsQuery = {},
        opts?: RequestOptions,
      ): Promise<ListProductsResponse> =>
        get("catalog", "/v1/catalog/products", listProductsResponseSchema, { ...query }, opts),

      getProduct: (id: string, opts?: RequestOptions): Promise<Product> =>
        get("catalog", `/v1/catalog/products/${encodeURIComponent(id)}`, productSchema, {}, opts),
    },

    inventory: {
      serviceability: (
        query: ServiceabilityQuery,
        opts?: RequestOptions,
      ): Promise<ServiceabilityResponse> =>
        get(
          "inventory",
          "/v1/inventory/serviceability",
          serviceabilityResponseSchema,
          { ...query },
          opts,
        ),

      availability: (
        warehouseId: string,
        productIds: string[],
        opts?: RequestOptions,
      ): Promise<AvailabilityResponse> =>
        get(
          "inventory",
          "/v1/inventory/availability",
          availabilityResponseSchema,
          { warehouseId, productIds: productIds.join(",") },
          opts,
        ),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
