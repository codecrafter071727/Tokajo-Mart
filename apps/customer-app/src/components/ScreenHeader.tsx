import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, typography } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  /** Extra controls on the right, for example a text button */
  right?: React.ReactNode;
  /** Where to go when there is no screen to go back to (a deep link) */
  fallback?: string;
};

/** The one header for pushed screens: back arrow, title, optional right side. */
export function ScreenHeader({ title, subtitle, right, fallback = "/(tabs)" }: Props) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1, paddingRight: Spacing[12] },
  title: { fontSize: 18, lineHeight: 22, fontWeight: "800", color: Colors.textPrimary },
  subtitle: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary },
  right: { paddingRight: Spacing[12] },
});
