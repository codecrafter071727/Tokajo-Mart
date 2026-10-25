import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";

const MENU_ITEMS = [
  { emoji: "📦", label: "My Orders", route: "/orders/list" },
  { emoji: "📍", label: "Saved Addresses", route: null },
  { emoji: "💳", label: "Payment Methods", route: null },
  { emoji: "🎁", label: "Offers & Coupons", route: null },
  { emoji: "👥", label: "Refer a Friend", route: null },
  { emoji: "⭐", label: "Rate the App", route: null },
  { emoji: "🔔", label: "Notifications", route: null },
  { emoji: "❓", label: "Help & Support", route: null },
  { emoji: "📋", label: "Terms & Privacy", route: null },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Vishu Pratap</Text>
            <Text style={styles.profilePhone}>+91 98765 43210</Text>
          </View>
          <Pressable style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* Savings summary */}
        <View style={styles.savingsCard}>
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>₹240</Text>
            <Text style={styles.savingsLabel}>Total saved</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>12</Text>
            <Text style={styles.savingsLabel}>Orders placed</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>4.8★</Text>
            <Text style={styles.savingsLabel}>Avg rating</Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item.label}>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  if (item.route) router.push(item.route as never);
                }}
              >
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuChevron}>›</Text>
              </Pressable>
              {index < MENU_ITEMS.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </View>

        {/* App version */}
        <Text style={styles.version}>Tokajo Mart v0.1.0</Text>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    gap: Spacing[12],
    padding: Spacing[12],
  },

  // Profile card
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  profilePhone: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[8],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.brandGreen,
  },
  editBtnText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
  },

  // Savings card
  savingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  savingsStat: {
    flex: 1,
    alignItems: "center",
  },
  savingsValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.brandGreen,
  },
  savingsLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },

  // Menu
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[14] ?? 14,
    gap: Spacing[12],
  },
  menuEmoji: {
    fontSize: 20,
    width: 28,
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.body,
    color: Colors.textPrimary,
  },
  menuChevron: {
    fontSize: 20,
    color: Colors.textTertiary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 56,
  },

  // Footer
  version: {
    fontSize: FontSize.caption,
    color: Colors.textTertiary,
    textAlign: "center",
  },
  logoutBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  logoutText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.danger,
  },
});
