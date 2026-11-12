import type React from "react";
import type { ViewProps } from "react-native";
import Animated from "react-native-reanimated";

/**
 * `Animated.View` with a style prop that accepts animated styles.
 *
 * The workspace has two copies of @types/react (18 for the web apps, 19 for mobile) and
 * Reanimated's types resolve to the wrong one, which makes `Animated.View` reject `children` and
 * mixed style arrays. Describing it by its real shape here keeps that one cast in one place.
 * Remove this file once the @types/react versions are unified.
 */
export const AnimatedView = Animated.View as unknown as React.ComponentType<
  React.PropsWithChildren<Omit<ViewProps, "style"> & { style?: unknown }>
>;
