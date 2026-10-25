import { create } from "zustand";

export interface CartItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  mrp: number;
  image: string;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  incrementItem: (id: string) => void;
  decrementItem: (id: string) => void;
  clearCart: () => void;
  getQuantity: (id: string) => number;
  totalItems: () => number;
  totalPrice: () => number;
  totalMrp: () => number;
  totalSavings: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        };
      }
      return { items: [...state.items, { ...product, quantity: 1 }] };
    });
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },

  incrementItem: (id) => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)),
    }));
  },

  decrementItem: (id) => {
    set((state) => {
      const item = state.items.find((i) => i.id === id);
      if (!item) return state;
      if (item.quantity <= 1) {
        return { items: state.items.filter((i) => i.id !== id) };
      }
      return {
        items: state.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i)),
      };
    });
  },

  clearCart: () => set({ items: [] }),

  getQuantity: (id) => {
    const item = get().items.find((i) => i.id === id);
    return item ? item.quantity : 0;
  },

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  totalMrp: () => get().items.reduce((sum, i) => sum + i.mrp * i.quantity, 0),

  totalSavings: () => get().items.reduce((sum, i) => sum + (i.mrp - i.price) * i.quantity, 0),
}));
