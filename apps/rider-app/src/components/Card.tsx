import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space, typography } from "../theme";

export function Card({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  /** Shown on the title row, for example a counter */
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.ink[500],
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
