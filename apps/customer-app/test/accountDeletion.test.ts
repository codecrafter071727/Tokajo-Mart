import { beforeEach, describe, expect, it, vi } from "vitest";

// Everything the deletion touches is replaced, so the test checks the order of work only
const calls: string[] = [];
let failWith: Error | null = null;

vi.mock("../src/lib/session", () => ({
  backendEnabled: true,
  apiFetch: vi.fn(async (method: string, path: string, options: { body?: unknown } = {}) => {
    calls.push(`${method} ${path} ${JSON.stringify(options.body ?? {})}`);
    if (failWith) throw failWith;
    return { deleted: true, deletedAt: "2026-11-13T10:00:00.000Z" };
  }),
}));
vi.mock("../src/lib/queryClient", () => ({
  queryClient: { clear: () => calls.push("query cache cleared") },
}));
vi.mock("../src/lib/addresses", () => ({ initialBook: () => ({ addresses: [], selectedId: "" }) }));
vi.mock("../src/store/auth", () => ({
  useAuthStore: { getState: () => ({ logout: () => calls.push("signed out") }) },
}));
vi.mock("../src/store/cart", () => ({
  useCartStore: { getState: () => ({ clearCart: () => calls.push("cart cleared") }) },
}));
vi.mock("../src/store/coupon", () => ({
  useCouponStore: { getState: () => ({ remove: () => calls.push("coupon cleared") }) },
}));
vi.mock("../src/store/searches", () => ({
  useSearchStore: { getState: () => ({ clear: () => calls.push("searches cleared") }) },
}));
vi.mock("../src/store/addresses", () => ({
  useAddressStore: { setState: () => calls.push("addresses cleared") },
}));

const { canConfirmDeletion, deleteAccount } = await import("../src/lib/accountDeletion");

beforeEach(() => {
  calls.length = 0;
  failWith = null;
});

describe("confirming", () => {
  it("needs the word DELETE, in any case, nothing else", () => {
    expect(canConfirmDeletion("DELETE")).toBe(true);
    expect(canConfirmDeletion("  delete ")).toBe(true);
    expect(canConfirmDeletion("DELET")).toBe(false);
    expect(canConfirmDeletion("DELETE ME")).toBe(false);
    expect(canConfirmDeletion("")).toBe(false);
  });
});

describe("deleting", () => {
  it("asks the server first, then forgets everything on the phone", async () => {
    await deleteAccount("Privacy concerns");
    expect(calls[0]).toBe('POST /v1/identity/me/delete {"reason":"Privacy concerns"}');
    expect(calls.slice(1)).toEqual([
      "signed out",
      "cart cleared",
      "coupon cleared",
      "searches cleared",
      "addresses cleared",
      "query cache cleared",
    ]);
  });

  it("keeps the person signed in when the server refuses, so they can see why", async () => {
    failWith = new Error("You have an order in progress (QC-1).");
    await expect(deleteAccount()).rejects.toThrow("order in progress");
    expect(calls).toEqual(["POST /v1/identity/me/delete {}"]);
  });
});
