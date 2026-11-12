import { create } from "zustand";

export type Rider = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
};

/** Demo mode accepts this code for any phone number. The real flow uses Supabase phone OTP. */
export const DEMO_OTP = "123456";

type SessionState = {
  rider: Rider | null;
  signIn: (phone: string, otp: string) => void;
  signOut: () => void;
};

export class SignInError extends Error {}

export const useSession = create<SessionState>((set) => ({
  rider: null,

  signIn: (phone, otp) => {
    if (!/^\d{10}$/.test(phone)) throw new SignInError("Enter a 10 digit mobile number.");
    if (otp !== DEMO_OTP) throw new SignInError("That code is not right. Try again.");
    set({
      rider: {
        id: "rider-demo",
        name: "Ravi Kumar",
        phone: `+91${phone}`,
        vehicle: "Bike, DL 8S 4521",
        rating: 4.8,
      },
    });
  },

  signOut: () => set({ rider: null }),
}));
