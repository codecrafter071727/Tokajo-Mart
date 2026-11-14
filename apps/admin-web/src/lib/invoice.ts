/**
 * Downloads a delivered order's invoice PDF through this site's /api proxy, which adds the
 * admin's token. The file is saved with the order number in its name.
 */
export async function downloadInvoice(orderId: string, orderNumber: string): Promise<void> {
  const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/invoice.pdf`);
  if (!res.ok) {
    let message = "Could not download the invoice.";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // not JSON, keep the plain message
    }
    throw new Error(message);
  }
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = `milcki-invoice-${orderNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
