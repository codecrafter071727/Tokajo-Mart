import { colors, elev, radius, space, typography } from "./tokens";

export { colors, elev, radius, space, typography };

/** Rider UI is used one handed, in sunlight, often walking: big targets and high contrast. */
export const TOUCH = 56;

/**
 * Text and icons on the brand green (#42C86E). White on it is 2.2:1 and fails, ink is 7.7:1.
 * Rule: dark on green, never white on green.
 */
export const onBrand = colors.ink[900];

/** Native driver where it exists; the web has none and warns if asked. */
export { USE_NATIVE_DRIVER } from "./web";
