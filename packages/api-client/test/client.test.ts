import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "../src";

const category = {
  id: "dairy",
  name: "Dairy & Breakfast",
  emoji: "🥛",
  color: "#FFF8E1",
  imageUrl: null,
  imageFit: "cover",
  sortOrder: 1,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function client(
  fetchImpl: typeof fetch,
  extra: Partial<Parameters<typeof createApiClient>[0]> = {},
) {
  return createApiClient({ baseUrl: "http://api.test/", fetch: fetchImpl, ...extra });
}

describe("api client", () => {
  it("parses a valid response and builds the URL and query string", async () => {
    const fetchMock = vi.fn(async () => json({ items: [], nextCursor: null }));
    const result = await client(fetchMock as unknown as typeof fetch).catalog.listProducts({
      categoryId: "dairy",
      q: "milk & eggs",
      limit: 10,
    });
    expect(result).toEqual({ items: [], nextCursor: null });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      "http://api.test/v1/catalog/products?categoryId=dairy&q=milk%20%26%20eggs&limit=10",
    );
  });

  it("sends the bearer token when one is available", async () => {
    const fetchMock = vi.fn(async () => json({ items: [category] }));
    await client(fetchMock as unknown as typeof fetch, {
      getAccessToken: async () => "tok",
    }).catalog.listCategories();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("turns an API error body into a typed, non-retryable error for 4xx", async () => {
    const fetchMock = vi.fn(async () =>
      json({ error: { code: "NOT_FOUND", message: "Product not found.", requestId: "r1" } }, 404),
    );
    const error = await client(fetchMock as unknown as typeof fetch)
      .catalog.getProduct("x")
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      requestId: "r1",
      retryable: false,
    });
  });

  it("marks 5xx as retryable", async () => {
    const fetchMock = vi.fn(async () => json({ nope: true }, 503));
    const error = await client(fetchMock as unknown as typeof fetch)
      .catalog.listCategories()
      .catch((e) => e);
    expect(error.retryable).toBe(true);
  });

  it("reports a network failure as NETWORK_ERROR (retryable)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    const error = await client(fetchMock as unknown as typeof fetch)
      .catalog.listCategories()
      .catch((e) => e);
    expect(error).toMatchObject({ code: "NETWORK_ERROR", retryable: true });
  });

  it("rejects a response that does not match the contract", async () => {
    const fetchMock = vi.fn(async () => json({ items: [{ id: "x" }] }));
    const error = await client(fetchMock as unknown as typeof fetch)
      .catalog.listCategories()
      .catch((e) => e);
    expect(error).toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("times out slow requests", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const error = await client(fetchMock as unknown as typeof fetch, { timeoutMs: 20 })
      .catalog.listCategories()
      .catch((e) => e);
    expect(error).toMatchObject({ code: "TIMEOUT", retryable: true });
  });

  it("does not wrap a caller cancellation as an API error", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const api = client(fetchMock as unknown as typeof fetch);
    // Cancel while the request is in flight
    const inFlight = api.catalog.listCategories({ signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    const error = await inFlight.catch((e) => e);
    expect(error).not.toBeInstanceOf(ApiClientError);
    expect(error.name).toBe("AbortError");
  });

  it("does not send a request the caller already cancelled", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => json({ items: [] }));
    const api = client(fetchMock as unknown as typeof fetch, {
      getAccessToken: async () => {
        controller.abort(); // the screen unmounts while the token is being read
        return "tok";
      },
    });
    const error = await api.catalog.listCategories({ signal: controller.signal }).catch((e) => e);
    expect(error.name).toBe("AbortError");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends each service to its own origin when overrides are set, and the rest to baseUrl", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/inventory/")
        ? json({ serviceable: true, warehouseId: "w", etaMins: 9, reason: null })
        : json({ items: [] }),
    );
    const api = client(fetchMock as unknown as typeof fetch, {
      serviceUrls: { inventory: "http://inventory.test:4003/" },
    });
    await api.inventory.serviceability({ lat: 1, lng: 2 });
    await api.catalog.listCategories();
    const urls = fetchMock.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls[0]).toBe("http://inventory.test:4003/v1/inventory/serviceability?lat=1&lng=2");
    expect(urls[1]).toBe("http://api.test/v1/catalog/categories");
  });

  it("sends a PATCH with a JSON body and parses the updated product", async () => {
    const product = {
      id: "p1",
      name: "Banana",
      unit: "6 pcs",
      pricePaise: 2500,
      mrpPaise: 3500,
      discountPercent: 29,
      categoryId: "fruits",
      emoji: "🍌",
      imageUrl: null,
      imageFit: "cover",
      deliveryMins: 10,
      optionsCount: null,
      description: null,
    };
    const fetchMock = vi.fn(async () => json(product));
    const result = await client(fetchMock as unknown as typeof fetch).catalog.updateProduct("p1", {
      pricePaise: 2500,
    });
    expect(result.pricePaise).toBe(2500);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/v1/catalog/products/p1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ pricePaise: 2500 }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("does not send a body or content type on GET", async () => {
    const fetchMock = vi.fn(async () => json({ items: [] }));
    await client(fetchMock as unknown as typeof fetch).catalog.listCategories();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });
});
