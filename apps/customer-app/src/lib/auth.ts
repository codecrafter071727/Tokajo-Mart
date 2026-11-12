import { useAuthStore } from "../store/auth";
import { apiFetch } from "./session";
import { queryClient } from "./queryClient";

type OtpRequestResponse = { expiresInSeconds: number; codeLength: number; demoMode: boolean };
type Session = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; phone: string | null };
};

/** The login screen takes 10 digits; the service wants +91 and no spaces. */
export const toE164 = (phone: string) => `+91${phone.replace(/\D/g, "").slice(-10)}`;

export const requestOtp = (phone: string) =>
  apiFetch<OtpRequestResponse>("POST", "/v1/identity/auth/otp/request", {
    body: { phone: toE164(phone), role: "customer" },
    auth: false,
  });

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const session = await apiFetch<Session>("POST", "/v1/identity/auth/otp/verify", {
    body: { phone: toE164(phone), role: "customer", code, name: "Customer" },
    auth: false,
  });
  useAuthStore.getState().signIn(session);
}

/** Ends the session on the server too, so a stolen refresh token stops working. */
export async function signOut(): Promise<void> {
  const { refreshToken, logout } = useAuthStore.getState();
  logout();
  // The next person to sign in must not see this person's cached orders
  queryClient.clear();
  if (refreshToken) {
    await apiFetch("POST", "/v1/identity/auth/logout", {
      body: { refreshToken },
      auth: false,
    }).catch(() => undefined);
  }
}
