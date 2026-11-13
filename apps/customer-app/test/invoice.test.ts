import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Linking: { openURL: vi.fn() }, Platform: { OS: "ios" } }));
vi.mock("../src/lib/session", () => ({ apiFetch: vi.fn(), gatewayBase: "" }));

const { invoiceUrl } = await import("../src/lib/invoice");

describe("invoice links", () => {
  it("joins the gateway address and the link path without double slashes", () => {
    expect(invoiceUrl("http://localhost:4000/", "/v1/invoices/abc.1.sig")).toBe(
      "http://localhost:4000/v1/invoices/abc.1.sig",
    );
    expect(invoiceUrl("https://api.tokajo.in", "/v1/invoices/x")).toBe(
      "https://api.tokajo.in/v1/invoices/x",
    );
  });
});
