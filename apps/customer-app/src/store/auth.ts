import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  totalSaved: number;
  ordersPlaced: number;
}

/** Demo mode accepts this code for any number. The real flow uses Supabase phone OTP. */
export const DEMO_OTP = "1234";

export interface AuthState {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  /** False until the saved session has been read, so the route guard never redirects too early */
  hasHydrated: boolean;
  user: UserProfile;
  login: (phone: string, name?: string) => void;
  logout: () => void;
  completeOnboarding: () => void;
  updateWalletBalance: (amount: number) => void;
}

const GUEST: UserProfile = {
  id: "u1",
  name: "Vishu Pratap",
  phone: "",
  walletBalance: 150,
  totalSaved: 240,
  ordersPlaced: 12,
};

/** Keychain / Keystore backed storage, so the session is not readable from the app's files. */
const secureStorage: StateStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      hasSeenOnboarding: false,
      hasHydrated: false,
      user: GUEST,

      login: (phone: string, name = GUEST.name) => {
        set({
          isAuthenticated: true,
          user: { ...GUEST, name, phone: phone.startsWith("+91") ? phone : `+91 ${phone}` },
        });
      },

      logout: () => {
        set({ isAuthenticated: false });
      },

      completeOnboarding: () => {
        set({ hasSeenOnboarding: true });
      },

      updateWalletBalance: (amount: number) => {
        set((state) => ({
          user: { ...state.user, walletBalance: state.user.walletBalance + amount },
        }));
      },
    }),
    {
      name: "qc-customer-session",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        hasSeenOnboarding: state.hasSeenOnboarding,
        user: state.user,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
