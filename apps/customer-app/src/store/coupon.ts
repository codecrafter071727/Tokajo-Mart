import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CouponTerms } from "@qc/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The coupon the customer applied, kept with the cart until the order is placed or it is removed. */
export type AppliedCoupon = CouponTerms & { title: string };

type CouponState = {
  applied: AppliedCoupon | null;
  apply: (coupon: AppliedCoupon) => void;
  remove: () => void;
};

export const useCouponStore = create<CouponState>()(
  persist(
    (set) => ({
      applied: null,
      apply: (coupon) => set({ applied: coupon }),
      remove: () => set({ applied: null }),
    }),
    { name: "qc-coupon", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
