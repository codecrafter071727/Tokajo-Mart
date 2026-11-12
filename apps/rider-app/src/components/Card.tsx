import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space, typography } from "../theme";

export function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line[300],
    padding: space[4],
    gap: space[3],
  },
  title: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.ink[500],
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
