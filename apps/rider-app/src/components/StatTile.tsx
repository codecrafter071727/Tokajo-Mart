import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";

/** One number with a label underneath. Used in rows of two or three. */
export function StatTile({
  value,
  label,
  tone = "light",
  grow = 1,
}: {
  value: string;
  label: string;
  tone?: "light" | "onBrand";
  /** Relative width, so a money value gets more room than a count */
  grow?: number;
}) {
  return (
    <View
      style={[styles.tile, { flex: grow }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text
        style={[styles.value, tone === "onBrand" && styles.valueOnBrand]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.label, tone === "onBrand" && styles.labelOnBrand]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "flex-start", gap: 2, minWidth: 0 },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  valueOnBrand: { color: colors.ink[900] },
  label: { ...typography.caption, fontWeight: "700", color: colors.ink[500] },
  labelOnBrand: { color: colors.brand[900] },
});
