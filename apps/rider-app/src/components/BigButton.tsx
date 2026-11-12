import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, space, TOUCH, typography } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
};

export function BigButton({ label, onPress, variant = "primary", icon, loading, disabled }: Props) {
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.brand[600], fg: colors.ink[900], border: colors.brand[600] },
    secondary: { bg: colors.surface[0], fg: colors.ink[900], border: colors.line[300] },
    danger: { bg: colors.surface[0], fg: colors.danger, border: colors.danger },
  }[variant];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={22} color={palette.fg} /> : null}
            <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[5],
  },
  row: { flexDirection: "row", alignItems: "center", gap: space[2] },
  label: { ...typography.subtitle, fontWeight: "800" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  inactive: { opacity: 0.45 },
});
