import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { REAL_BACKEND } from "../lib/api";
import { useLocationStatus } from "../lib/locationSharing";
import { colors, radius, space, typography } from "../theme";

/** Tells the rider whether the customer can see them on the map, and how to fix it if not. */
export function LocationNote() {
  const status = useLocationStatus((s) => s.status);
  if (!REAL_BACKEND || status === "off") return null;

  if (status === "denied" || status === "unavailable") {
    return (
      <View style={[styles.box, styles.warn]} accessibilityRole="alert">
        <Ionicons name="location-outline" size={20} color={colors.warning} />
        <View style={styles.flex}>
          <Text style={styles.warnTitle}>Location is off</Text>
          <Text style={styles.text}>
            The customer only sees the store on their map. Turn on location for this app so they
            know when you are close.
          </Text>
          {status === "denied" && Platform.OS !== "web" ? (
            <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button">
              <Text style={styles.link}>Open settings</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.ok]} accessibilityRole="summary">
      <View style={styles.dot} />
      <Text style={styles.okText}>
        {status === "sharing"
          ? "Sharing your live location with the customer"
          : "Turning on location sharing"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    borderRadius: radius.md,
    padding: space[3],
  },
  warn: { backgroundColor: colors.accent[100] },
  ok: { backgroundColor: colors.brand[50], alignItems: "center" },
  flex: { flex: 1, gap: space[1] },
  warnTitle: { ...typography.bodyStrong, color: colors.accent[900] },
  text: { ...typography.body, color: colors.ink[700] },
  link: { ...typography.bodyStrong, color: colors.brand[800], textDecorationLine: "underline" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
  okText: { ...typography.caption, color: colors.brand[800], flex: 1 },
});
