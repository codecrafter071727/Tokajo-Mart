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

type AddressState = AddressBook & {
  /** Adds an address, selects it, and returns its id */
  add: (draft: AddressDraft) => string;
  update: (id: string, draft: AddressDraft) => void;
  /** False when it was refused because it is the last address */
  remove: (id: string) => boolean;
  select: (id: string) => void;
};

const newId = () => `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      ...initialBook(),
      add: (draft) => {
        const id = newId();
        set((s) => addAddress(s, draft, id));
        return id;
      },
      update: (id, draft) => set((s) => updateAddress(s, id, draft)),
      remove: (id) => {
        const before = get().addresses.length;
        set((s) => removeAddress(s, id));
        return get().addresses.length < before;
      },
      select: (id) => set((s) => selectAddress(s, id)),
    }),
    {
      name: "qc-addresses",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ addresses: s.addresses, selectedId: s.selectedId }),
      migrate: (persisted) => migrateAddressBook(persisted),
    },
  ),
);

/** The address orders and the header use. */
export function useSelectedAddress(): SavedAddress {
  return useAddressStore((s) => selectedOf(s));
}
