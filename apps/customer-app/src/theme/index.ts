// Tokajo Mart Design System — based on DESIGN.md (Blinkit style)

export const Colors = {
  brandYellow: "#F8CB46",
  brandGreen: "#0C831F",
  brandBlack: "#1C1C1C",
  greenTint: "#F7FFF9",
  greenBorder: "#318616",
  yellowTint: "#FFF9E5",
  canvas: "#F4F6FB",
  surface: "#FFFFFF",
  border: "#E8E8E8",
  textPrimary: "#1C1C1C",
  textSecondary: "#666666",
  textTertiary: "#9C9C9C",
  offerBlue: "#256FEF",
  discountGreen: "#0C831F",
  danger: "#E23744",
  disabledBg: "#F0F0F0",
  disabledText: "#B0B0B0",
} as const;

export const Fonts = {
  family: "System", // Expo uses System; replace with Okra/Inter if loaded
} as const;

export const FontSize = {
  display: 24,
  h1: 20,
  h2: 16,
  body: 14,
  productName: 13,
  caption: 12,
  micro: 10,
  price: 13,
} as const;

export const FontWeight = {
  display: "800" as const,
  h1: "800" as const,
  h2: "700" as const,
  body: "500" as const,
  productName: "600" as const,
  caption: "500" as const,
  micro: "700" as const,
  price: "700" as const,
};

export const Spacing = {
  2: 2,
  4: 4,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  48: 48,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const Shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sticky: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

export const Motion = {
  fast: 120,
  base: 200,
} as const;
