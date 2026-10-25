import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { useAuthStore } from "../../src/store/auth";

const MENU_ITEMS = [
  { emoji: "📦", label: "My Orders", subtitle: "Track, reorder & invoices", route: "/orders/list" },
  { emoji: "📍", label: "Saved Addresses", subtitle: "Indiranagar, HSR Layout...", route: null },
  { emoji: "💳", label: "Payment Modes", subtitle: "UPI, Cards, Netbanking", route: null },
  { emoji: "🎁", label: "Offers & Coupons", subtitle: "Exclusive deals for you", route: null },
  {
    emoji: "⭐",
    label: "Rate Us on Play Store",
    subtitle: "Love the speed? Let us know",
    route: null,
  },
  {
    emoji: "🔔",
    label: "Notification Preferences",
    subtitle: "Order updates & alerts",
    route: null,
  },
  { emoji: "❓", label: "Customer Support & FAQs", subtitle: "24/7 instant chat", route: null },
  { emoji: "📋", label: "Terms, Privacy & Policies", subtitle: "Tokajo Mart v0.1.0", route: null },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Account</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profilePhone}>{user.phone}</Text>
          </View>
          <Pressable style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* ── Tokajo Wallet Card ────────────────────────── */}
        <View style={styles.walletCard}>
          <View style={styles.walletLeft}>
            <View style={styles.walletIconBg}>
              <Text style={styles.walletIconEmoji}>👛</Text>
            </View>
            <View>
              <View style={styles.walletTitleRow}>
                <Text style={styles.walletTitle}>Tokajo Wallet</Text>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.walletBalance}>₹{user.walletBalance.toFixed(2)}</Text>
            </View>
          </View>
          <Pressable style={styles.addMoneyBtn}>
            <Text style={styles.addMoneyText}>+ Add Money</Text>
          </Pressable>
        </View>

        {/* ── Referral Promo Card ──────────────────────── */}
        <View style={styles.referralCard}>
          <View style={styles.referralLeft}>
            <Text style={styles.referralEmoji}>🎁</Text>
            <View style={styles.referralTextContainer}>
              <Text style={styles.referralTitle}>Invite Friends & Earn ₹100</Text>
              <Text style={styles.referralSubtitle}>
                Get ₹100 instant cashback on your friend's first order
              </Text>
            </View>
          </View>
          <Pressable style={styles.referralBtn}>
            <Text style={styles.referralBtnText}>Invite</Text>
          </Pressable>
        </View>

        {/* Savings summary */}
        <View style={styles.savingsCard}>
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>₹{user.totalSaved}</Text>
            <Text style={styles.savingsLabel}>Total saved</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>{user.ordersPlaced}</Text>
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
                <View style={styles.menuIconCircle}>
                  <Text style={styles.menuEmoji}>{item.emoji}</Text>
                </View>
                <View style={styles.menuLabelContainer}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.subtitle && <Text style={styles.menuSubLabel}>{item.subtitle}</Text>}
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </Pressable>
              {index < MENU_ITEMS.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace("/(auth)/login");
          }}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.version}>Tokajo Mart · Made with ❤️ for fast delivery</Text>
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
    paddingVertical: Spacing[14],
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
    ...Shadow.card,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brandYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 26,
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
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[6],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#F9FAFC",
  },
  editBtnText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
  },

  // Wallet Card
  walletCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[14],
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Shadow.card,
  },
  walletLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  walletIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.greenTint,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  walletIconEmoji: {
    fontSize: 22,
  },
  walletTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walletTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  activePill: {
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  activePillText: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.brandGreen,
  },
  walletBalance: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  addMoneyBtn: {
    backgroundColor: Colors.greenTint,
    borderWidth: 1,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[10],
    paddingVertical: Spacing[6],
  },
  addMoneyText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.brandGreen,
  },

  // Referral Card
  referralCard: {
    backgroundColor: Colors.yellowTint,
    borderRadius: Radius.md,
    padding: Spacing[14],
    borderWidth: 1,
    borderColor: Colors.brandYellow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  referralLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[10],
    flex: 1,
    marginRight: Spacing[8],
  },
  referralEmoji: {
    fontSize: 28,
  },
  referralTextContainer: {
    flex: 1,
  },
  referralTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.brandBlack,
  },
  referralSubtitle: {
    fontSize: 11,
    color: "#665200",
    marginTop: 2,
    lineHeight: 15,
  },
  referralBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
  },
  referralBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.surface,
  },

  // Savings summary
  savingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  savingsStat: {
    alignItems: "center",
  },
  savingsValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.brandGreen,
  },
  savingsLabel: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },

  // Menu items
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[14],
    gap: Spacing[12],
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  menuEmoji: {
    fontSize: 18,
  },
  menuLabelContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  menuSubLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 18,
    color: Colors.textTertiary,
    fontWeight: "700",
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 64,
  },

  // Logout
  logoutBtn: {
    backgroundColor: "#FFF0F1",
    borderRadius: Radius.md,
    paddingVertical: Spacing[14],
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD6D9",
    marginTop: Spacing[4],
  },
  logoutText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.danger,
  },
  version: {
    textAlign: "center",
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: Spacing[8],
  },
});
