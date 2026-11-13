import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerAddress } from "@qc/contracts";

// The sync talks to the gateway through apiFetch; replace it with an in-memory server
const server = {
  rows: [] as CustomerAddress[],
  calls: [] as { method: string; path: string; body?: unknown }[],
};
let nextId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

vi.mock("../src/lib/session", () => ({
  backendEnabled: true,
  apiFetch: vi.fn(
    async (method: string, path: string, options: { body?: Record<string, unknown> } = {}) => {
      server.calls.push({ method, path, body: options.body });
      const now = new Date().toISOString();
      if (method === "GET") return { items: server.rows };
      if (method === "POST" && path === "/v1/identity/me/addresses") {
        const body = options.body as Record<string, unknown>;
        const row = {
          id: uuid(),
          kind: body.kind,
          label: body.label ?? "",
          line1: body.line1,
          line2: body.line2 ?? "",
          landmark: "",
          instructions: body.instructions ?? "",
          lat: body.lat,
          lng: body.lng,
          pincode: body.pincode ?? null,
          areaId: body.areaId ?? null,
          isDefault: Boolean(body.isDefault) || server.rows.length === 0,
          createdAt: now,
          updatedAt: now,
        } as CustomerAddress;
        if (row.isDefault) server.rows = server.rows.map((r) => ({ ...r, isDefault: false }));
        server.rows.push(row);
        return row;
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  ),
}));
vi.mock("../src/store/auth", () => ({
  useAuthStore: { getState: () => ({ accessToken: "token", user: { id: "u-1" } }) },
}));

const { syncAddressBook, updateOnServer } = await import("../src/lib/addressSync");
const { initialBook, addAddress, isServerId } = await import("../src/lib/addresses");

beforeEach(() => {
  server.rows = [];
  server.calls = [];
});

const row = (over: Partial<CustomerAddress>): CustomerAddress => ({
  id: uuid(),
  kind: "home",
  label: "",
  line1: "Flat 9, Lake Road",
  line2: "",
  landmark: "",
  instructions: "",
  lat: 28.6208,
  lng: 77.3649,
  pincode: "201309",
  areaId: "noida-62",
  isDefault: true,
  createdAt: "2026-11-13T10:00:00.000Z",
  updatedAt: "2026-11-13T10:00:00.000Z",
  ...over,
});

describe("loading the account's addresses", () => {
  it("uses the server's addresses and selects the default when the old choice is gone", async () => {
    server.rows = [
      row({ isDefault: false, line1: "First" }),
      row({ isDefault: true, line1: "Default" }),
    ];
    const book = await syncAddressBook(initialBook(), false);
    expect(book.addresses.map((a) => a.line1)).toEqual(["First", "Default"]);
    expect(book.addresses.find((a) => a.id === book.selectedId)?.line1).toBe("Default");
  });

  it("keeps the starting addresses when the account has none and nothing to move", async () => {
    const book = await syncAddressBook(initialBook(), true);
    expect(book.addresses.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
    expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("moves addresses saved on this device up once, without the untouched starting ones", async () => {
    const local = addAddress(
      initialBook(),
      {
        kind: "other",
        label: "Gym",
        line1: "Plot 4, Sector 63",
        line2: "",
        instructions: "",
        areaId: "noida-63",
      },
      "addr-local",
    );
    const book = await syncAddressBook(local, true);
    const posts = server.calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toMatchObject({
      kind: "other",
      label: "Gym",
      areaId: "noida-63",
      pincode: "201301",
      isDefault: true,
    });
    // The moved address stays selected, now under its server id
    const selected = book.addresses.find((a) => a.id === book.selectedId);
    expect(selected?.line1).toBe("Plot 4, Sector 63");
    expect(isServerId(book.selectedId)).toBe(true);
  });

  it("does not upload an address the account already has", async () => {
    server.rows = [
      row({ line1: "Plot 4, Sector 63", lat: 28.6301, lng: 77.3801, areaId: "noida-63" }),
    ];
    const local = addAddress(
      initialBook(),
      {
        kind: "home",
        label: "",
        line1: "plot 4, sector 63 ",
        line2: "",
        instructions: "",
        areaId: "noida-63",
      },
      "addr-dup",
    );
    await syncAddressBook(local, true);
    expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("does not move anything after the first time", async () => {
    const local = addAddress(
      initialBook(),
      {
        kind: "work",
        label: "",
        line1: "Office 2, Sector 62",
        line2: "",
        instructions: "",
        areaId: "noida-62",
      },
      "addr-later",
    );
    await syncAddressBook(local, false);
    expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

describe("saving a change", () => {
  it("creates a starting address on the account the first time it is edited", async () => {
    const seed = initialBook().addresses[0]!;
    const saved = await updateOnServer({ ...seed, instructions: "Ring twice" });
    expect(isServerId(saved.id)).toBe(true);
    expect(server.calls[0]).toMatchObject({ method: "POST" });
    expect(saved.instructions).toBe("Ring twice");
  });
});
