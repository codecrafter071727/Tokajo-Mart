import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addAddress,
  initialBook,
  migrateAddressBook,
  removeAddress,
  selectAddress,
  selectedOf,
  updateAddress,
  type AddressBook,
  type AddressDraft,
  type SavedAddress,
} from "../lib/addresses";
import {
  addressesSyncEnabled,
  createOnServer,
  deleteOnServer,
  makeDefaultOnServer,
  syncAddressBook,
  updateOnServer,
} from "../lib/addressSync";
import { useAuthStore } from "./auth";

type AddressState = AddressBook & {
  /** Account ids whose device addresses were already moved to the server (done once each) */
  syncedUsers: string[];
  /** Set while the account's addresses are loading for the first time on this device */
  syncing: boolean;
  /** The last thing that failed to save, for a quiet notice on the address screens */
  syncError: string | null;
  /** Adds an address, selects it, and returns its id */
  add: (draft: AddressDraft) => string;
  update: (id: string, draft: AddressDraft) => void;
  /** False when it was refused because it is the last address */
  remove: (id: string) => boolean;
  select: (id: string) => void;
  /** Loads the account's addresses (and moves device ones up once). Safe to call any time. */
  refresh: () => Promise<void>;
  clearSyncError: () => void;
};

const newId = () => `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const message = (e: unknown) =>
  e instanceof Error && e.message ? e.message : "Could not save your address. Try again.";

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => {
      const book = (): AddressBook => ({
        addresses: get().addresses,
        selectedId: get().selectedId,
      });
      /** After a failed save, the server is the truth: reload it to undo the optimistic change. */
      const rollback = (e: unknown) => {
        set({ syncError: message(e) });
        void get().refresh();
      };

      return {
        ...initialBook(),
        syncedUsers: [],
        syncing: false,
        syncError: null,

        add: (draft) => {
          const id = newId();
          set((s) => addAddress(s, draft, id));
          if (addressesSyncEnabled()) {
            const added = book().addresses.find((a) => a.id === id) as SavedAddress;
            createOnServer(added, true)
              .then((saved) => set((s) => replaceSavedId(s, id, saved)))
              .catch((e) => {
                set((s) => ({ ...removeLocal(s, id), syncError: message(e) }));
              });
          }
          return id;
        },

        update: (id, draft) => {
          set((s) => updateAddress(s, id, draft));
          if (!addressesSyncEnabled()) return;
          const changed = book().addresses.find((a) => a.id === id);
          if (!changed) return;
          // A starting address the customer edits becomes theirs: save it to the account
          const save = updateOnServer(changed);
          save
            .then((saved) => {
              if (saved.id !== id) set((s) => replaceSavedId(s, id, saved));
            })
            .catch(rollback);
        },

        remove: (id) => {
          const before = get().addresses.length;
          set((s) => removeAddress(s, id));
          const removed = get().addresses.length < before;
          if (removed && addressesSyncEnabled()) deleteOnServer(id).catch(rollback);
          return removed;
        },

        select: (id) => {
          set((s) => selectAddress(s, id));
          if (addressesSyncEnabled()) makeDefaultOnServer(id).catch(() => undefined);
        },

        refresh: async () => {
          const userId = useAuthStore.getState().user.id;
          if (!addressesSyncEnabled() || !userId) return;
          const firstTime = !get().syncedUsers.includes(userId);
          if (firstTime) set({ syncing: true });
          try {
            const next = await syncAddressBook(book(), firstTime);
            set((s) => ({
              ...next,
              syncing: false,
              syncedUsers: firstTime ? [...s.syncedUsers, userId] : s.syncedUsers,
            }));
          } catch (e) {
            set({ syncing: false, syncError: firstTime ? message(e) : get().syncError });
          }
        },

        clearSyncError: () => set({ syncError: null }),
      };
    },
    {
      name: "qc-addresses",
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        addresses: s.addresses,
        selectedId: s.selectedId,
        syncedUsers: s.syncedUsers,
      }),
      migrate: (persisted) => {
        const synced = (persisted as { syncedUsers?: unknown } | null)?.syncedUsers;
        return {
          ...migrateAddressBook(persisted),
          syncedUsers: Array.isArray(synced) ? synced.filter((x) => typeof x === "string") : [],
        };
      },
    },
  ),
);

function replaceSavedId(s: AddressBook, from: string, saved: SavedAddress): AddressBook {
  return {
    addresses: s.addresses.map((a) => (a.id === from ? saved : a)),
    selectedId: s.selectedId === from ? saved.id : s.selectedId,
  };
}

/** Takes back an address the server refused, even if it was the only one being added. */
function removeLocal(s: AddressBook, id: string): AddressBook {
  const addresses = s.addresses.filter((a) => a.id !== id);
  if (addresses.length === 0) return initialBook();
  return {
    addresses,
    selectedId: s.selectedId === id ? (addresses[0] as SavedAddress).id : s.selectedId,
  };
}

/** The address orders and the header use. */
export function useSelectedAddress(): SavedAddress {
  return useAddressStore((s) => selectedOf(s));
}

// Load the account's addresses when a customer signs in, and forget them when they sign out, so
// the next person on this phone never sees someone else's addresses.
let lastUser: string | null = null;
function onAuthChange() {
  // Until the saved addresses are read, a sync would be overwritten by them: wait for hydration
  if (useAddressStore.persist?.hasHydrated && !useAddressStore.persist.hasHydrated()) return;
  const { accessToken, user } = useAuthStore.getState();
  const signedIn = accessToken ? user.id : null;
  if (signedIn === lastUser) return;
  const signedOut = lastUser !== null && signedIn === null;
  lastUser = signedIn;
  if (signedOut) {
    useAddressStore.setState({ ...initialBook(), syncError: null, syncing: false });
    return;
  }
  if (signedIn) void useAddressStore.getState().refresh();
}
useAuthStore.subscribe(onAuthChange);
// Both stores read their saved state asynchronously: check again once each has loaded
useAuthStore.persist?.onFinishHydration?.(onAuthChange);
useAddressStore.persist?.onFinishHydration?.(onAuthChange);
onAuthChange();
