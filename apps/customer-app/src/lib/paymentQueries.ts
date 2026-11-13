import type { CheckoutResponse, Payment, VerifyPaymentBody } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { HttpError } from "./httpError";
import { describePaymentError, type CheckoutResult } from "./payments";
import { apiFetch, backendEnabled } from "./session";

export const paymentsApi = {
  checkout: (orderId: string) =>
    apiFetch<CheckoutResponse>(
      "POST",
      `/v1/payments/orders/${encodeURIComponent(orderId)}/checkout`,
      { body: {} },
    ),
  verify: (body: VerifyPaymentBody) => apiFetch<Payment>("POST", "/v1/payments/verify", { body }),
  async status(orderId: string): Promise<Payment | null> {
    try {
      return await apiFetch<Payment>("GET", `/v1/payments/orders/${encodeURIComponent(orderId)}`);
    } catch (e) {
      // No payment row yet (the sheet was never opened) is not an error
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  },
};

/** Whether to offer online payment at checkout, as the payment service reports it. */
export async function onlinePaymentsAvailable(): Promise<boolean> {
  if (!backendEnabled) return false;
  try {
    const config = await apiFetch<{ onlineEnabled: boolean }>("GET", "/v1/payments/config");
    return config.onlineEnabled;
  } catch {
    // If we cannot tell, offer cash on delivery only rather than a payment that may fail
    return false;
  }
}

export function useOnlinePaymentsAvailable() {
  return useQuery({
    queryKey: ["payments", "available"],
    queryFn: onlinePaymentsAvailable,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** The payment record for an online order, polled while it is still open. */
export function usePaymentStatus(orderId: string | undefined, enabled: boolean, poll: boolean) {
  return useQuery({
    queryKey: ["payments", orderId],
    enabled: Boolean(orderId) && enabled && backendEnabled,
    queryFn: () => paymentsApi.status(orderId as string),
    refetchInterval: poll ? 5000 : false,
  });
}

/** Where the pay flow is. "open" means the Razorpay sheet is showing. */
export type PayState =
  | { step: "idle" }
  | { step: "starting" }
  | { step: "open"; checkout: CheckoutResponse }
  | { step: "verifying" }
  | { step: "paid" }
  | { step: "dismissed" }
  | { step: "error"; message: string };

/**
 * Starts the Razorpay sheet for one order and finishes the payment. Opening it again reuses the
 * same Razorpay order on the server, so a retry never charges twice.
 */
export function usePayOrder(orderId: string | undefined) {
  const client = useQueryClient();
  const [state, setState] = useState<PayState>({ step: "idle" });

  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["orders"] }),
      client.invalidateQueries({ queryKey: ["payments", orderId] }),
    ]);
  }, [client, orderId]);

  const start = useMutation({
    mutationFn: () => paymentsApi.checkout(orderId as string),
    onMutate: () => setState({ step: "starting" }),
    onSuccess: (checkout) => setState({ step: "open", checkout }),
    onError: (e) => {
      setState({ step: "error", message: describePaymentError(e) });
      void refresh();
    },
  });

  const finish = useCallback(
    async (result: CheckoutResult) => {
      if (result.kind === "dismissed") {
        setState({ step: "dismissed" });
        return;
      }
      if (result.kind === "failed") {
        setState({ step: "error", message: result.description });
        void refresh();
        return;
      }
      setState({ step: "verifying" });
      try {
        await paymentsApi.verify({
          razorpayOrderId: result.razorpayOrderId,
          razorpayPaymentId: result.razorpayPaymentId,
          razorpaySignature: result.razorpaySignature,
        });
        setState({ step: "paid" });
      } catch (e) {
        // The webhook may still confirm it, so the order screen keeps polling either way
        setState({ step: "error", message: describePaymentError(e) });
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  return {
    state,
    pay: () => {
      if (!orderId || start.isPending) return;
      start.mutate();
    },
    finish,
    reset: () => setState({ step: "idle" }),
  };
}
