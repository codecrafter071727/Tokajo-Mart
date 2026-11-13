import type { AddressListResponse, CustomerAddress } from "@qc/contracts";
import { useAuthStore } from "../store/auth";
import {
  bookFromServer,
  fromServer,
  isServerId,
  pendingUploads,
  toServer,
  type AddressBook,
  type SavedAddress,
} from "./addresses";
import { queryClient } from "./queryClient";
import { apiFetch, backendEnabled } from "./session";

/**
 * The account's addresses live in the identity service. The app keeps a copy in its address
 * store so every screen reads them instantly, changes them optimistically, and puts them back
 * from the server when a save fails.
 */
export const addressesQueryKey = ["identity", "addresses"] as const;

/** Only a signed in customer with a real backend has addresses on the server. */
export const addressesSyncEnabled = () =>
  backendEnabled && Boolean(useAuthStore.getState().accessToken);

const base = "/v1/identity/me/addresses";

async function fetchServer(): Promise<SavedAddress[]> {
  const res = await queryClient.fetchQuery({
    queryKey: addressesQueryKey,
    queryFn: () => apiFetch<AddressListResponse>("GET", base),
    staleTime: 0,
    retry: 2,
  });
  return res.items.map(fromServer);
}

const remember = (items: CustomerAddress[]) =>
  queryClient.setQueryData<AddressListResponse>(addressesQueryKey, { items });

export async function createOnServer(a: SavedAddress, makeDefault = false): Promise<SavedAddress> {
  const row = await apiFetch<CustomerAddress>("POST", base, {
    body: { ...toServer(a), isDefault: makeDefault },
  });
  void queryClient.invalidateQueries({ queryKey: addressesQueryKey });
  return fromServer(row);
}

/** Saves a change. An address that is not on the server yet (a starting one) is created instead. */
export async function updateOnServer(a: SavedAddress): Promise<SavedAddress> {
  if (!isServerId(a.id)) return createOnServer(a, true);
  const { kind, label, line1, line2, instructions, lat, lng, pincode, areaId } = toServer(a);
  const row = await apiFetch<CustomerAddress>("PATCH", `${base}/${a.id}`, {
    body: { kind, label, line1, line2, instructions, lat, lng, pincode, areaId },
  });
  void queryClient.invalidateQueries({ queryKey: addressesQueryKey });
  return fromServer(row);
}

export async function deleteOnServer(id: string): Promise<void> {
  if (!isServerId(id)) return;
  const res = await apiFetch<AddressListResponse>("DELETE", `${base}/${id}`);
  remember(res.items);
}

export async function makeDefaultOnServer(id: string): Promise<void> {
  if (!isServerId(id)) return;
  const res = await apiFetch<AddressListResponse>("POST", `${base}/${id}/default`);
  remember(res.items);
}

/**
 * Loads the account's addresses into the address book. The first time on this device it also
 * moves up anything the customer saved before signing in, skipping duplicates and the untouched
 * starting addresses, and keeps their choice selected.
 */
export async function syncAddressBook(
  local: AddressBook,
  firstTime: boolean,
): Promise<AddressBook> {
  let server = await fetchServer();
  if (firstTime) {
    const uploads = pendingUploads(local.addresses, server);
    if (uploads.length > 0) {
      const selected = local.selectedId;
      const created: { from: string; saved: SavedAddress }[] = [];
      for (const a of uploads) {
        created.push({ from: a.id, saved: await createOnServer(a, a.id === selected) });
      }
      server = await fetchServer();
      const moved = created.find((c) => c.from === selected);
      return bookFromServer(server, {
        addresses: local.addresses,
        selectedId: moved ? moved.saved.id : local.selectedId,
      });
    }
  }
  return bookFromServer(server, local);
}
