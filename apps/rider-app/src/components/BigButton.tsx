import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, onBrand, radius, space, TOUCH, typography } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "dark";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Icon after the label, for "go forward" actions */
  trailingIcon?: React.ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  /** Small text under the label, for example why the button is not ready yet */
  hint?: string;
};

const PALETTE = {
  primary: { bg: colors.brand[600], fg: onBrand, border: colors.brand[600] },
  secondary: { bg: colors.surface[0], fg: colors.ink[900], border: colors.line[300] },
  danger: { bg: colors.surface[0], fg: colors.danger, border: colors.danger },
  dark: { bg: colors.night[900], fg: colors.surface[0], border: colors.night[900] },
};

/** The rider's main control: always at least 56 points tall, one clear verb. */
export function BigButton({
  label,
  onPress,
  variant = "primary",
  icon,
  trailingIcon,
  loading,
  disabled,
  hint,
}: Props) {
  const inactive = disabled || loading;
  // A disabled button is grey, not a faded brand colour, so it never looks tappable in sunlight
  const palette =
    disabled && !loading
      ? { bg: colors.surface[100], fg: colors.ink[500], border: colors.line[300] }
      : PALETTE[variant];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        variant === "primary" && !disabled && styles.lift,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.inner}>
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={22} color={palette.fg} /> : null}
            <Text style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
              {label}
            </Text>
            {trailingIcon ? <Ionicons name={trailingIcon} size={22} color={palette.fg} /> : null}
          </View>
          {hint ? <Text style={[styles.hint, { color: palette.fg }]}>{hint}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[5],
    paddingVertical: space[2],
  },
  lift: {
    shadowColor: colors.brand[800],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  inner: { alignItems: "center", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space[2] },
  label: { ...typography.title, fontSize: 17, fontWeight: "800" },
  hint: { ...typography.caption, fontWeight: "600", opacity: 0.85 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
