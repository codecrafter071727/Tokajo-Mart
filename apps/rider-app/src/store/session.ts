import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { AuthResponse, OtpRequestResponse } from "@qc/contracts";
import { ApiError, publicPost, REAL_BACKEND } from "../lib/api";

export type Rider = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
};

/** Demo mode (no server) accepts this code for any phone number. */
export const DEMO_OTP = "123456";

export class SignInError extends Error {}

type SessionState = {
  rider: Rider | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Asks the server to send a code. Resolves with whether the server is in demo mode. */
  requestCode: (phone: string) => Promise<{ demoMode: boolean }>;
  signIn: (phone: string, code: string) => Promise<void>;
  /** Swaps the refresh token for a new pair. False when the session cannot be continued. */
  refreshTokens: () => Promise<boolean>;
  signOut: () => void;
};

/** Keychain / Keystore backed storage on the phone, localStorage in the browser preview. */
const nativeStorage: StateStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
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
      // blocked storage: the session just will not persist
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

const FIXTURE_RIDER: Rider = {
  id: "rider-demo",
  name: "Ravi Kumar",
  phone: "+919810000011",
  vehicle: "Bike, DL 8S 4521",
  rating: 4.8,
};

const fromServer = (user: AuthResponse["user"]): Rider => ({
  id: user.id,
  name: user.name,
  phone: user.phone ?? "",
  vehicle: "Bike",
  rating: 4.8,
});

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      rider: null,
      accessToken: null,
      refreshToken: null,

      requestCode: async (phone) => {
        if (!REAL_BACKEND) return { demoMode: true };
        try {
          const res = await publicPost<OtpRequestResponse>("/v1/identity/auth/otp/request", {
            phone: `+91${phone}`,
            role: "rider",
          });
          return { demoMode: res.demoMode };
        } catch (e) {
          throw new SignInError(e instanceof ApiError ? e.message : "Could not send the code.");
        }
      },

      signIn: async (phone, code) => {
        if (!/^\d{10}$/.test(phone)) throw new SignInError("Enter a 10 digit mobile number.");
        if (!REAL_BACKEND) {
          if (code !== DEMO_OTP) throw new SignInError("That code is not right. Try again.");
          set({ rider: { ...FIXTURE_RIDER, phone: `+91${phone}` } });
          return;
        }
        try {
          const res = await publicPost<AuthResponse>("/v1/identity/auth/otp/verify", {
            phone: `+91${phone}`,
            role: "rider",
            code,
          });
          set({
            rider: fromServer(res.user),
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          });
        } catch (e) {
          throw new SignInError(e instanceof ApiError ? e.message : "Could not sign in.");
        }
      },

      refreshTokens: async () => {
        const token = get().refreshToken;
        if (!token) return false;
        try {
          const res = await publicPost<AuthResponse>("/v1/identity/auth/refresh", {
            refreshToken: token,
          });
          set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
          return true;
        } catch {
          return false;
        }
      },

      signOut: () => {
        const token = get().refreshToken;
        if (REAL_BACKEND && token) {
          void publicPost("/v1/identity/auth/logout", { refreshToken: token }).catch(() => {});
        }
        set({ rider: null, accessToken: null, refreshToken: null });
      },
    }),
    {
      name: "qc-rider-session",
      storage: createJSONStorage(() => (Platform.OS === "web" ? webStorage : nativeStorage)),
      // Demo sessions are not kept, so switching to a real server never starts from a fake rider
      partialize: (s) =>
        REAL_BACKEND
          ? { rider: s.rider, accessToken: s.accessToken, refreshToken: s.refreshToken }
          : {},
    },
  ),
);
