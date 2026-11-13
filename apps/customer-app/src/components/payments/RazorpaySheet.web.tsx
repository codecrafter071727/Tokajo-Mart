import { useEffect, useRef } from "react";
import type { CheckoutResponse } from "@qc/contracts";
import {
  checkoutOptions,
  fromRazorpayFailure,
  fromRazorpaySuccess,
  RAZORPAY_SCRIPT_URL,
  type CheckoutResult,
} from "../../lib/payments";

type Props = {
  checkout: CheckoutResponse | null;
  onResult: (result: CheckoutResult) => void;
};

type RazorpayInstance = { open: () => void; on: (event: string, fn: (r: unknown) => void) => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let scriptPromise: Promise<RazorpayCtor> | null = null;

/** Loads checkout.js once. A failed load can be tried again. */
function loadRazorpay(): Promise<RazorpayCtor> {
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const ctor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error("Razorpay did not load"));
    };
    script.onerror = () => reject(new Error("Razorpay did not load"));
    document.head.appendChild(script);
  }).catch((e: unknown) => {
    scriptPromise = null;
    throw e;
  });
  return scriptPromise;
}

/** Razorpay Checkout in the browser: Razorpay draws its own overlay, so this renders nothing. */
export function RazorpaySheet({ checkout, onResult }: Props) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!checkout) return;
    let reported = false;
    const report = (result: CheckoutResult) => {
      if (reported) return;
      reported = true;
      onResultRef.current(result);
    };
    loadRazorpay()
      .then((Razorpay) => {
        // The sheet lets the customer retry after a failure, so it only counts if they then close it
        let lastFailure: CheckoutResult | null = null;
        const rzp = new Razorpay({
          ...checkoutOptions(checkout),
          handler: (response: unknown) => report(fromRazorpaySuccess(response)),
          modal: {
            ondismiss: () => report(lastFailure ?? { kind: "dismissed" }),
            confirm_close: true,
          },
        });
        rzp.on("payment.failed", (response) => {
          lastFailure = fromRazorpayFailure(response);
        });
        rzp.open();
      })
      .catch(() =>
        report({
          kind: "failed",
          description: "Could not load the payment page. Check your connection.",
        }),
      );
  }, [checkout]);

  return null;
}
