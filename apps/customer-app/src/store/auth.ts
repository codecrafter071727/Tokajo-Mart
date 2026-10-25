import { create } from "zustand";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  totalSaved: number;
  ordersPlaced: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  user: UserProfile;
  login: (phone: string, name?: string) => void;
  logout: () => void;
  completeOnboarding: () => void;
  updateWalletBalance: (amount: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: true,
  hasSeenOnboarding: true,
  user: {
    id: "u1",
    name: "Vishu Pratap",
    phone: "+91 98765 43210",
    walletBalance: 150,
    totalSaved: 240,
    ordersPlaced: 12,
  },

  login: (phone: string, name = "Vishu Pratap") => {
    set({
      isAuthenticated: true,
      user: {
        id: "u1",
        name,
        phone: phone.startsWith("+91") ? phone : `+91 ${phone}`,
        walletBalance: 150,
        totalSaved: 240,
        ordersPlaced: 12,
      },
    });
  },

  logout: () => {
    set({
      isAuthenticated: false,
    });
  },

  completeOnboarding: () => {
    set({
      hasSeenOnboarding: true,
    });
  },

  updateWalletBalance: (amount: number) => {
    set((state) => ({
      user: {
        ...state.user,
        walletBalance: state.user.walletBalance + amount,
      },
    }));
  },
}));
