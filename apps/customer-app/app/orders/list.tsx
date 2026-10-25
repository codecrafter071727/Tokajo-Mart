import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";

type OrderStatus = "delivered" | "on_the_way" | "cancelled" | "placed";

interface OrderSummary {
  id: string;
  date: string;
  items: string[];
  total: number;
  status: OrderStatus;
  itemCount: number;
}

const MOCK_ORDERS: OrderSummary[] = [
  {
    id: "ORD001",
    date: "Today, 3:15 PM",
    items: ["🍌 Fresho Banana", "🥛 Amul Milk", "🥔 Lay's Chips"],
    total: 99,
    status: "on_the_way",
    itemCount: 3,
  },
  {
    id: "ORD002",
    date: "Yesterday, 11:30 AM",
    items: ["🍅 Tomato", "🧅 Onion", "🫑 Capsicum", "🍞 Bread"],
    total: 142,
    status: "delivered",
    itemCount: 4,
  },
  {
    id: "ORD003",
    date: "22 Oct, 7:45 PM",
    items: ["🥤 Coca-Cola", "🍿 Popcorn", "🍪 Cookies"],
    total: 78,
    status: "delivered",
    itemCount: 3,
  },
  {
    id: "ORD004",
    date: "19 Oct, 2:00 PM",
    items: ["🧴 Shampoo", "🧹 Broom"],
    total: 210,
    status: "delivered",
    itemCount: 2,
  },
  {
    id: "ORD005",
    date: "15 Oct, 9:10 AM",
    items: ["🥛 Mother Dairy Milk", "🧈 Amul Butter"],
    total: 74,
    status: "cancelled",
    itemCount: 2,
  },
];

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; emoji: string }
> = {
  delivered: {
    label: "Delivered",
    color: Colors.brandGreen,
    bg: Colors.greenTint,
    emoji: "✅",
  },
  on_the_way: {
    label: "On the way",
    color: Colors.offerBlue,
    bg: "#EEF4FF",
    emoji: "🛵",
  },
  placed: {
    label: "Order placed",
    color: "#E8A000",
    bg: Colors.yellowTint,
    emoji: "📋",
  },
  cancelled: {
    label: "Cancelled",
    color: Colors.danger,
    bg: "#FFF0F1",
    emoji: "❌",
  },
};

function OrderCard({ order }: { order: OrderSummary }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[order.status];

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/orders/${order.id}`)}>
      {/* Order header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>Order #{order.id}</Text>
          <Text style={styles.orderDate}>{order.date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={styles.statusEmoji}>{cfg.emoji}</Text>
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Items preview */}
      <Text style={styles.itemsPreview} numberOfLines={2}>
        {order.items.slice(0, 3).join("  ·  ")}
        {order.itemCount > 3 ? `  +${order.itemCount - 3} more` : ""}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>
          {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
          {"  ·  "}
          <Text style={styles.totalValue}>₹{order.total}</Text>
        </Text>
        <View style={styles.actionRow}>
          {order.status === "on_the_way" && (
            <Pressable style={styles.trackBtn} onPress={() => router.push(`/orders/${order.id}`)}>
              <Text style={styles.trackBtnText}>Track order</Text>
            </Pressable>
          )}
          {order.status === "delivered" && (
            <Pressable style={styles.reorderBtn}>
              <Text style={styles.reorderBtnText}>Reorder</Text>
            </Pressable>
          )}
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {["All", "Active", "Delivered", "Cancelled"].map((f, i) => (
          <Pressable key={f} style={[styles.filterChip, i === 0 && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, i === 0 && styles.filterChipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={MOCK_ORDERS}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[styles.list, { paddingBottom: 32 + insets.bottom }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing[12] }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>Your past orders will appear here</Text>
          </View>
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing[8],
  },
  backBtn: { padding: Spacing[4] },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
  },

  // Filter chips
  filterRow: {
    flexDirection: "row",
    gap: Spacing[8],
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    paddingHorizontal: Spacing[14],
    paddingVertical: Spacing[6] ?? 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.brandGreen,
    borderColor: Colors.brandGreen,
  },
  filterChipText: {
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.surface,
  },

  // List
  list: {
    padding: Spacing[12],
  },

  // Order card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[16],
    gap: Spacing[12],
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderId: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    borderRadius: Radius.pill,
  },
  statusEmoji: {
    fontSize: 12,
  },
  statusText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  itemsPreview: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  totalValue: {
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
  },
  trackBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[6] ?? 6,
  },
  trackBtnText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.surface,
  },
  reorderBtn: {
    borderWidth: 1,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[6] ?? 6,
  },
  reorderBtnText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textTertiary,
    fontWeight: "700",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing[12],
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
