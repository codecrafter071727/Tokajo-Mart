import type { InvoiceLinkResponse } from "@qc/contracts";
import { Linking, Platform } from "react-native";
import { apiFetch, gatewayBase } from "./session";

/** "/v1/invoices/abc" on the gateway at "http://host:4000" becomes a full address. */
export const invoiceUrl = (base: string, path: string) => `${base.replace(/\/+$/, "")}${path}`;

/**
 * Opens a delivered order's invoice. The server hands out a link that works for 10 minutes without
 * a sign in token, so the phone's own browser or PDF viewer can open it (no extra native module,
 * so it also works in Expo Go). On the web the PDF is downloaded instead.
 */
export async function openInvoice(orderId: string, orderNumber: string): Promise<void> {
  const link = await apiFetch<InvoiceLinkResponse>(
    "POST",
    `/v1/orders/${encodeURIComponent(orderId)}/invoice-link`,
    { body: {} },
  );
  const url = invoiceUrl(gatewayBase, link.url);
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not download the invoice. Try again.");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `tokajo-invoice-${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return;
  }
  await Linking.openURL(url);
}
