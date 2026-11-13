import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme";
import { useInboxAvailable, useUnreadCount } from "../lib/notifications";

/** The bell in the home header, with an unread badge. Hidden when there is no inbox (demo mode). */
export function NotificationBell({ small }: { small?: boolean }) {
  const router = useRouter();
  const available = useInboxAvailable();
  const unread = useUnreadCount().data ?? 0;
  if (!available) return null;
  const size = small ? 36 : 40;
  return (
    <Pressable
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }]}
      onPress={() => router.push("/notifications")}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      hitSlop={4}
    >
      <Ionicons name="notifications-outline" size={small ? 18 : 20} color={Colors.brandText} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: Colors.surface, fontSize: 10, fontWeight: "800" },
});
