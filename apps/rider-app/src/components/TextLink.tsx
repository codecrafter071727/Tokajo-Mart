import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, typography } from "../theme";

/** A quiet secondary action. Still a 44 point target, so it is easy to hit. */
export function TextLink({
  label,
  onPress,
  disabled,
  tone = "brand",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "brand" | "muted" | "danger";
}) {
  const color =
    tone === "danger" ? colors.danger : tone === "muted" ? colors.ink[700] : colors.brand[800];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  label: { ...typography.subtitle, fontWeight: "800" },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
