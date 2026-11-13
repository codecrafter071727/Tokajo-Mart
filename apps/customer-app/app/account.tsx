import React, { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../src/theme";
import { useAuthStore } from "../src/store/auth";
import { signOut } from "../src/lib/auth";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { useOrders } from "../src/lib/orderQueries";
import { statusAt } from "../src/lib/orders";
import { formatPaise } from "../src/lib/pricing";
import { useAddressStore } from "../src/store/addresses";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const orders = useOrders().data ?? [];
  const addressCount = useAddressStore((s) => s.addresses.length);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const now = new Date();
  const delivered = orders.filter((o) => statusAt(o, now) === "delivered");
  // Savings only count on orders that went through
  const saved = delivered.reduce((sum, o) => sum + o.savingsPaise, 0);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  React.useEffect(() => {
    if (!confirmLogout) return;
    const t = setTimeout(() => setConfirmLogout(false), 4000);
    return () => clearTimeout(t);
  }, [confirmLogout]);

  const logout = () => {
    if (!confirmLogout) return setConfirmLogout(true);
    void signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Account" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing[32] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            {initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <Ionicons name="person" size={26} color={Colors.brandText} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name || "Customer"}
            </Text>
            <Text style={styles.phone}>{user.phone}</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          <Tile
            icon="bag-handle-outline"
            label="Your orders"
            onPress={() => router.push("/orders/list")}
          />
          <Tile
            icon="location-outline"
            label="Addresses"
            onPress={() => router.push("/addresses")}
          />
          <Tile
            icon="grid-outline"
            label="Categories"
            onPress={() => router.push("/(tabs)/categories")}
          />
        </View>

        <View style={styles.stats}>
          <Stat value={String(orders.length)} label="Orders" />
          <View style={styles.statDivider} />
          <Stat value={String(delivered.length)} label="Delivered" />
          <View style={styles.statDivider} />
          <Stat value={formatPaise(saved)} label="Saved" accent />
        </View>

        <Text style={styles.groupTitle}>YOUR INFORMATION</Text>
        <View style={styles.group}>
          <Row
            icon="receipt-outline"
            label="Your orders"
            hint={orders.length ? `${orders.length} so far` : "Track and reorder"}
            onPress={() => router.push("/orders/list")}
          />
          <Row
            icon="book-outline"
            label="Address book"
            hint={`${addressCount} saved`}
            onPress={() => router.push("/addresses")}
            last
          />
        </View>

        <Text style={styles.groupTitle}>OTHER INFORMATION</Text>
        <View style={styles.group}>
          <Row
            icon="share-social-outline"
            label="Share the app"
            onPress={() =>
              void Share.share({
                message: "Groceries in minutes with Tokajo Mart. Try it!",
              }).catch(() => undefined)
            }
          />
          <Row
            icon="trash-outline"
            label="Delete account"
            hint="Remove your account and personal data"
            onPress={() => router.push("/delete-account")}
          />
          <Row
            icon={confirmLogout ? "alert-circle-outline" : "log-out-outline"}
            label={confirmLogout ? "Tap again to log out" : "Log out"}
            onPress={logout}
            danger
            last
          />
        </View>

        <Text style={styles.footer}>Tokajo Mart{"\n"}India's last minute app</Text>
      </ScrollView>
    </View>
  );
}

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={Colors.textPrimary} />
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && { color: Colors.brandText }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {danger ? null : <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { padding: Spacing[12], gap: Spacing[12] },
  pressed: { opacity: 0.7 },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[8],
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "900", color: Colors.brandText },
  name: { ...typography.title, fontWeight: "800", color: Colors.textPrimary },
  phone: { ...typography.body, color: Colors.textTertiary, marginTop: 1 },

  tiles: { flexDirection: "row", gap: Spacing[8] },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing[14],
    alignItems: "center",
    gap: 6,
  },
  tileText: { ...typography.caption, fontWeight: "700", color: Colors.textPrimary },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing[14],
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: {
    ...typography.subtitle,
    fontWeight: "900",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  statLabel: { ...typography.caption, fontWeight: "500", color: Colors.textTertiary },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  groupTitle: {
    ...typography.micro,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.textTertiary,
    marginTop: Spacing[8],
    marginLeft: Spacing[4],
    marginBottom: -Spacing[4],
  },
  group: { backgroundColor: Colors.surface, borderRadius: Radius.md, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingHorizontal: Spacing[14],
    minHeight: 56,
    paddingVertical: Spacing[10],
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...typography.bodyStrong, color: Colors.textPrimary },
  rowHint: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary, marginTop: 1 },

  footer: {
    marginTop: Spacing[24],
    marginLeft: Spacing[4],
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#C4CDCB",
  },
});
