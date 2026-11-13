// Theme exports — tokens from DESIGN.md. Colors map keeps older screens working.

import { colors, space, radius, typography, elev, motion } from "./tokens";

export { colors, space, radius, typography, elev, motion };
export { TAB_BAR_CONTENT, TAB_RESERVE } from "./tabs";
/** @deprecated Prefer `typography` — kept for DESIGN.md naming. */
export { typography as type };

/** Legacy alias map remapped onto the Dash teal tokens. Prefer `colors` / `type` / `space`. */
export const Colors = {
  brandYellow: colors.brand[50],
  brandGreen: colors.brand[600],
  brandBlack: colors.ink[900],
  greenTint: colors.brand[50],
  greenBorder: colors.brand[600],
  yellowTint: colors.accent[100],
  canvas: colors.surface[100],
  surface: colors.surface[0],
  border: colors.line[300],
  textPrimary: colors.ink[900],
  textSecondary: colors.ink[700],
  textTertiary: colors.ink[500],
  offerBlue: colors.info,
  discountGreen: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  disabledBg: colors.surface[100],
  disabledText: colors.ink[500],
  accent: colors.accent[500],
  accentText: colors.accent[900],
  brandPressed: colors.brand[700],
  /** #42C86E is too light for text on white (2.2:1); use this for green text and icons */
  brandText: colors.brand[700],
  brandTint: colors.brand[100],
  brandActive: colors.brand[500],
  /**
   * Text and icons on a solid #42C86E surface. White on it is 2.2:1 and fails; ink is 7.7:1.
   * Rule: dark on green, never white on green.
   */
  onBrand: colors.ink[900],
  onBrandMuted: "rgba(20,32,30,0.7)",
  /** Pressed state for green buttons: lighter, so dark text keeps its contrast */
  brandFillPressed: colors.brand[500],
} as const;

export const Fonts = {
  family: "System",
} as const;

export const FontSize = {
  display: typography.display.fontSize,
  h1: typography.titleLg.fontSize,
  h2: typography.title.fontSize,
  body: typography.body.fontSize,
  productName: typography.bodyStrong.fontSize,
  caption: typography.caption.fontSize,
  micro: typography.micro.fontSize,
  price: typography.price.fontSize,
} as const;

export const FontWeight = {
  display: typography.display.fontWeight,
  h1: typography.titleLg.fontWeight,
  h2: typography.title.fontWeight,
  body: "500" as const,
  productName: typography.bodyStrong.fontWeight,
  caption: typography.caption.fontWeight,
  micro: typography.micro.fontWeight,
  price: typography.price.fontWeight,
};

export const Spacing = {
  2: 2,
  4: space[1],
  6: 6,
  8: space[2],
  10: 10,
  12: space[3],
  14: 14,
  16: space[4],
  20: space[5],
  24: space[6],
  32: space[8],
  48: 48,
} as const;

export const Radius = {
  xs: 4,
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
  pill: radius.full,
} as const;

export const Shadow = {
  card: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sticky: elev[2],
  sheet: elev[2],
  header: elev[1],
} as const;

export const Motion = {
  fast: motion.add,
  base: motion.cartBar,
} as const;
