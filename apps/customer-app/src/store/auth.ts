import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useEffect, useState } from "react";
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

/** Demo mode (no backend configured) accepts this code for any number. */
export const DEMO_OTP = "1234";

export interface AuthState {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  user: UserProfile;
  /** Set when signed in against the real backend, null in fixture demo mode */
  accessToken: string | null;
  refreshToken: string | null;
  /** Demo sign in used when no backend is configured */
  login: (phone: string, name?: string) => void;
  /** Sign in with a real session from the identity service */
  signIn: (session: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; name: string; phone: string | null };
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
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
const nativeStorage: StateStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/** The web has no secure store, so the browser preview keeps the session in localStorage. */
const webStorage: StateStorage = {
  getItem: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // storage can be blocked (private mode): the session just will not persist
    }
  },
  removeItem: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // nothing to clean up
    }
  },
};

const secureStorage = Platform.OS === "web" ? webStorage : nativeStorage;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      hasSeenOnboarding: false,
      user: GUEST,
      accessToken: null,
      refreshToken: null,

      signIn: ({ accessToken, refreshToken, user }) => {
        set({
          isAuthenticated: true,
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone ?? "",
            walletBalance: 0,
            totalSaved: 0,
            ordersPlaced: 0,
          },
        });
      },

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      login: (phone: string, name = GUEST.name) => {
        set({
          isAuthenticated: true,
          user: { ...GUEST, name, phone: phone.startsWith("+91") ? phone : `+91 ${phone}` },
        });
      },

      logout: () => {
        set({ isAuthenticated: false, accessToken: null, refreshToken: null });
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
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

/**
 * True once the saved session has been read, so the route guard never redirects too early.
 * Asks zustand directly, which is right for both slow storage (phone) and instant storage (web).
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useAuthStore.persist.hasHydrated());
    return unsubscribe;
  }, []);
  return hydrated;
}
