import type { DeleteAccountResponse } from "@qc/contracts";
import { initialBook } from "./addresses";
import { queryClient } from "./queryClient";
import { apiFetch, backendEnabled } from "./session";
import { useAddressStore } from "../store/addresses";
import { useAuthStore } from "../store/auth";
import { useCartStore } from "../store/cart";
import { useCouponStore } from "../store/coupon";
import { useSearchStore } from "../store/searches";

/** The word the customer types to confirm. Any case and surrounding spaces are fine. */
export const CONFIRM_WORD = "DELETE";
export const canConfirmDeletion = (typed: string) => typed.trim().toUpperCase() === CONFIRM_WORD;

/** Reasons offered on the screen. Optional, and only used to improve the app. */
export const DELETION_REASONS = [
  "I don't use the app any more",
  "Delivery was too slow",
  "Prices or offers",
  "Privacy concerns",
  "I have another account",
] as const;

/** Clears everything this phone remembers about the person, so the next sign in starts clean. */
export function forgetEverythingOnThisDevice(): void {
  useAuthStore.getState().logout();
  useCartStore.getState().clearCart();
  useCouponStore.getState().remove();
  useSearchStore.getState().clear();
  useAddressStore.setState({ ...initialBook(), syncedUsers: [], syncError: null, syncing: false });
  queryClient.clear();
}

/**
 * Deletes the account on the server (it refuses while an order is in progress, with a message to
 * show), then forgets everything on this phone. Without a backend there is nothing on a server,
 * so only the phone is cleared.
 */
export async function deleteAccount(reason?: string): Promise<DeleteAccountResponse | null> {
  let result: DeleteAccountResponse | null = null;
  if (backendEnabled) {
    result = await apiFetch<DeleteAccountResponse>("POST", "/v1/identity/me/delete", {
      body: reason ? { reason } : {},
    });
  }
  forgetEverythingOnThisDevice();
  return result;
}
