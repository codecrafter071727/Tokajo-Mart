import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { rememberSearch } from "../lib/recentSearches";

type SearchState = {
  recent: string[];
  remember: (term: string) => void;
  clear: () => void;
};

/** What this customer searched for before, kept on the device. */
export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recent: [],
      remember: (term) => set((s) => ({ recent: rememberSearch(s.recent, term) })),
      clear: () => set({ recent: [] }),
    }),
    { name: "qc-customer-searches", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
