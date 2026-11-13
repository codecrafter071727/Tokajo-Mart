import type {
  AddProductImageBody,
  AdminProduct,
  AdminProductDetail,
  CatalogImportResult,
  CreateProductGroupBody,
  ProductGroup,
  ProductImage,
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

  productDetail: (id: string) =>
    call<AdminProductDetail>("GET", `/v1/catalog/admin/products/${encodeURIComponent(id)}`),

  // Product groups: the variants of one item (500 ml and 1 L of the same milk)
  groups: async () =>
    (await call<{ items: ProductGroup[] }>("GET", "/v1/catalog/admin/product-groups")).items,
  createGroup: (body: CreateProductGroupBody) =>
    call<ProductGroup>("POST", "/v1/catalog/admin/product-groups", body),

  // Extra product photos. The main photo stays the product's own image link.
  addImage: (id: string, body: AddProductImageBody) =>
    call<{ items: ProductImage[] }>(
      "POST",
      `/v1/catalog/admin/products/${encodeURIComponent(id)}/images`,
      body,
    ),
  reorderImages: (id: string, ids: string[]) =>
    call<{ items: ProductImage[] }>(
      "PUT",
      `/v1/catalog/admin/products/${encodeURIComponent(id)}/images/order`,
      { ids },
    ),
  makePrimary: (id: string, imageId: string) =>
    call<{ items: ProductImage[] }>(
      "POST",
      `/v1/catalog/admin/products/${encodeURIComponent(id)}/images/${imageId}/primary`,
      {},
    ),
  removeImage: (id: string, imageId: string) =>
    call<{ items: ProductImage[] }>(
      "DELETE",
      `/v1/catalog/admin/products/${encodeURIComponent(id)}/images/${imageId}`,
    ),

  importCsv: (csv: string, dryRun: boolean) => importCsv(csv, dryRun),
  exportCsv,

  banners: async () => (await call<{ items: Banner[] }>("GET", "/v1/catalog/admin/banners")).items,
  createBanner: (body: CreateBannerBody) => call<Banner>("POST", "/v1/catalog/banners", body),
  updateBanner: (id: string, body: UpdateBannerBody) =>
    call<Banner>("PATCH", `/v1/catalog/banners/${id}`, body),
  deleteBanner: (id: string) => call<unknown>("DELETE", `/v1/catalog/banners/${id}`),
};

/** Sends a CSV file as text/csv. A failed apply comes back as an error with per row details. */
async function importCsv(csv: string, dryRun: boolean): Promise<CatalogImportResult> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/catalog/admin/import?dryRun=${dryRun ? "true" : "false"}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "text/csv" },
      body: csv,
    });
  } catch {
    throw new AdminApiError("Could not reach the server. Check your connection.", 0);
  }
  const payload = (await res.json().catch(() => null)) as
    (CatalogImportResult & { error?: { message?: string; details?: unknown } }) | null;
  if (res.ok && payload) return payload;
  // Apply refuses a file with problems: show the rows the same way the dry run does
  const details = payload?.error?.details;
  if (res.status === 400 && Array.isArray(details)) {
    return {
      dryRun,
      ok: false,
      rows: 0,
      creates: 0,
      updates: 0,
      groupsCreated: [],
      errors: details as CatalogImportResult["errors"],
    };
  }
  throw new AdminApiError(payload?.error?.message ?? `Import failed (${res.status}).`, res.status);
}

/** Downloads every product on sale as catalog.csv. */
async function exportCsv(): Promise<void> {
  const res = await fetch("/api/v1/catalog/admin/export", { headers: { accept: "text/csv" } });
  if (!res.ok) throw new AdminApiError(`Export failed (${res.status}).`, res.status);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `catalog-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

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
