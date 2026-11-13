// Copied from apps/customer-app/src/theme/tokens.ts (DESIGN.md says the token file is shared).
// Move both into a shared package when a third consumer appears.
// Design tokens: the only place hex values live (see DESIGN.md section 14)

export const colors = {
  brand: {
    50: "#F1FCF5",
    100: "#DCF7E6",
    200: "#B2EBC7",
    500: "#5BD686",
    600: "#42C86E",
    700: "#238A47",
    800: "#17642F",
    900: "#0C3D1D",
  },
  accent: {
    100: "#FFF3CC",
    500: "#FFB400",
    900: "#5C4000",
  },
  ink: {
    900: "#14201E",
    700: "#3B4A47",
    500: "#6B7A77",
    300: "#A9B5B2",
  },
  line: {
    300: "#DDE5E3",
  },
  surface: {
    0: "#FFFFFF",
    100: "#F3F6F5",
  },
  /** The night side of the app: offline state and the active delivery header */
  night: {
    900: "#0F1A17",
    700: "#22302C",
  },
  dangerTint: "#FDECEC",
  success: "#15803D",
  warning: "#B45309",
  danger: "#C62828",
  info: "#1D6FD8",
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  hero: { fontSize: 44, lineHeight: 50, fontWeight: "800" as const },
  display: { fontSize: 28, lineHeight: 34, fontWeight: "800" as const },
  titleLg: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  price: { fontSize: 15, lineHeight: 20, fontWeight: "700" as const },
  priceStrike: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  micro: { fontSize: 10, lineHeight: 12, fontWeight: "600" as const },
} as const;

export const elev = {
  0: {
    borderWidth: 1,
    borderColor: colors.line[300],
  },
  1: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  2: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const motion = {
  add: 120,
  cartBar: 200,
  quantity: 150,
  sheet: 240,
  press: 80,
} as const;
