import type {
  AdminProduct,
  Banner,
  Category,
  CreateBannerBody,
  CreateCategoryBody,
  CreateProductBody,
  UpdateBannerBody,
  UpdateCategoryBody,
  UpdateProductBody,
} from "@qc/contracts";

/** A failed call, with the message the service sent (already written for people). */
export class AdminApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    throw new AdminApiError("Could not reach the server. Check your connection.", 0);
  }
  const payload = (await res.json().catch(() => null)) as {
    error?: { message?: string; details?: unknown };
  } | null;
  if (!res.ok) {
    const fieldMessage = Array.isArray(payload?.error?.details)
      ? (payload?.error?.details as { message?: string }[])[0]?.message
      : undefined;
    throw new AdminApiError(
      payload?.error?.message && payload.error.message !== "Request validation failed."
        ? payload.error.message
        : (fieldMessage ?? payload?.error?.message ?? `Request failed (${res.status}).`),
      res.status,
    );
  }
  return payload as T;
}

export type ProductFilter = { q?: string; categoryId?: string };

export const catalogAdmin = {
  categories: async () =>
    (await call<{ items: Category[] }>("GET", "/v1/catalog/categories")).items,
  products: (filter: ProductFilter, cursor?: string) => {
    const params = new URLSearchParams({ limit: "30" });
    if (filter.q) params.set("q", filter.q);
    if (filter.categoryId) params.set("categoryId", filter.categoryId);
    if (cursor) params.set("cursor", cursor);
    return call<{ items: AdminProduct[]; nextCursor: string | null }>(
      "GET",
      `/v1/catalog/admin/products?${params}`,
    );
  },
  product: (id: string) => call<AdminProduct>("GET", `/v1/catalog/products/${id}`),
  createProduct: (body: CreateProductBody) =>
    call<AdminProduct>("POST", "/v1/catalog/products", body),
  updateProduct: (id: string, body: UpdateProductBody) =>
    call<AdminProduct>("PATCH", `/v1/catalog/products/${id}`, body),
  archiveProduct: (id: string) => call<unknown>("DELETE", `/v1/catalog/products/${id}`),
  restoreProduct: (id: string) => call<unknown>("POST", `/v1/catalog/products/${id}/restore`, {}),

  createCategory: (body: CreateCategoryBody) =>
    call<Category>("POST", "/v1/catalog/categories", body),
  updateCategory: (id: string, body: UpdateCategoryBody) =>
    call<Category>("PATCH", `/v1/catalog/categories/${id}`, body),
  deleteCategory: (id: string) => call<unknown>("DELETE", `/v1/catalog/categories/${id}`),

  banners: async () => (await call<{ items: Banner[] }>("GET", "/v1/catalog/admin/banners")).items,
  createBanner: (body: CreateBannerBody) => call<Banner>("POST", "/v1/catalog/banners", body),
  updateBanner: (id: string, body: UpdateBannerBody) =>
    call<Banner>("PATCH", `/v1/catalog/banners/${id}`, body),
  deleteBanner: (id: string) => call<unknown>("DELETE", `/v1/catalog/banners/${id}`),
};

// --- Form helpers ----------------------------------------------------------------------------

/** Rupees as typed ("29.50") to whole paise. */
export const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);

/** Paise to the string an input shows: 2950 -> "29.5", 3000 -> "30". */
export const fromPaise = (paise: number) => String(paise / 100);

/** An empty box means "none" on the wire. */
export const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());

/** A datetime-local box value ("2026-11-13T10:30") to an ISO time with offset, or null. */
export const localToIso = (value: string) => (value === "" ? null : new Date(value).toISOString());

/** An ISO time to what a datetime-local box shows, in the browser's time zone. */
export function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
