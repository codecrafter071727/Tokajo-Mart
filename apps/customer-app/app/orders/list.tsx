import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { Ionicons } from "@expo/vector-icons";
import { useNow, useOrders } from "../../src/lib/orderQueries";
import { statusAt, type Order, type OrderStatus } from "../../src/lib/orders";
import { formatPaise } from "../../src/lib/pricing";
import { useCartStore } from "../../src/store/cart";
import { ErrorState } from "../../src/components/StateViews";
import { ProductImage } from "../../src/components/ProductImage";
import { ScreenHeader } from "../../src/components/ScreenHeader";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: IconName }
> = {
  placed: {
    label: "Order placed",
    color: "#8A5A00",
    bg: Colors.yellowTint,
    icon: "receipt-outline",
  },
  confirmed: {
    label: "Confirmed",
    color: Colors.offerBlue,
    bg: "#EEF4FF",
    icon: "checkmark-circle-outline",
  },
  picking: { label: "Packing", color: Colors.offerBlue, bg: "#EEF4FF", icon: "bag-handle-outline" },
  on_the_way: { label: "On the way", color: Colors.offerBlue, bg: "#EEF4FF", icon: "bicycle" },
  delivered: {
    label: "Delivered",
    color: Colors.brandText,
    bg: Colors.greenTint,
    icon: "checkmark-circle",
  },
  cancelled: { label: "Cancelled", color: Colors.danger, bg: "#FFF0F1", icon: "close-circle" },
};

/** Online payment states the coarse status above does not tell apart. */
const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: IconName }> =
  {
    pending_payment: {
      label: "Payment pending",
      color: "#8A5A00",
      bg: Colors.yellowTint,
      icon: "time-outline",
    },
    expired: {
      label: "Not paid",
      color: Colors.textSecondary,
      bg: Colors.canvas,
      icon: "time-outline",
    },
    payment_failed: {
      label: "Not paid",
      color: Colors.textSecondary,
      bg: Colors.canvas,
      icon: "time-outline",
    },
  };

const FILTERS = ["All", "Active", "Delivered", "Cancelled"] as const;
type Filter = (typeof FILTERS)[number];

const matchesFilter = (status: OrderStatus, filter: Filter) =>
  filter === "All" ||
  (filter === "Active" && status !== "delivered" && status !== "cancelled") ||
  (filter === "Delivered" && status === "delivered") ||
  (filter === "Cancelled" && status === "cancelled");

const formatWhen = (iso: string, now: Date) => {
  const d = new Date(iso);
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return days <= 0
    ? `Today, ${time}`
    : days === 1
      ? `Yesterday, ${time}`
      : `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
};

function OrderCard({ order, now }: { order: Order; now: Date }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const incrementItem = useCartStore((s) => s.incrementItem);
  const status = statusAt(order, now);
  const cfg = PAYMENT_CONFIG[order.server?.status ?? ""] ?? STATUS_CONFIG[status];
  const awaitingPayment = order.server?.status === "pending_payment";
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const active = status !== "delivered" && status !== "cancelled";

  const reorder = () => {
    for (const item of order.items) {
      addItem({
        id: item.productId,
        name: item.name,
        unit: item.unit,
        price: item.unitPricePaise / 100,
        mrp: item.mrpPaise / 100,
        image: item.emoji,
        imageUrl: item.imageUrl,
      });
      for (let n = 1; n < item.quantity; n += 1) incrementItem(item.productId);
    }
    router.push("/(tabs)/cart");
  };

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: "/orders/[id]", params: { id: order.id } })}
      accessibilityLabel={`Order ${order.id}, ${cfg.label}`}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>Order #{order.server?.number ?? order.id}</Text>
          <Text style={styles.orderDate}>{formatWhen(order.placedAt, now)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={14} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.thumbRow}>
        {order.items.slice(0, 4).map((i) => (
          <View key={i.productId} style={styles.thumb}>
            <ProductImage
              imageUrl={i.imageUrl}
              fit="contain"
              emoji={i.emoji}
              emojiSize={20}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
        {order.items.length > 4 ? (
          <View style={[styles.thumb, styles.thumbMore]}>
            <Text style={styles.thumbMoreText}>+{order.items.length - 4}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.itemsPreview} numberOfLines={1}>
        {order.items.map((i) => i.name).join("  ·  ")}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>
          {itemCount} item{itemCount !== 1 ? "s" : ""}
          {"  ·  "}
          <Text style={styles.totalValue}>{formatPaise(order.totalPaise)}</Text>
          {order.payment === "online" && !awaitingPayment && status !== "cancelled" ? (
            <Text style={styles.paidTag}>{"  ·  "}Paid online</Text>
          ) : null}
        </Text>
        <View style={styles.actionRow}>
          {active && (
            <Pressable
              style={styles.trackBtn}
              onPress={() =>
                router.push({
                  pathname: "/orders/[id]",
                  params: awaitingPayment ? { id: order.id, pay: "1" } : { id: order.id },
                })
              }
            >
              <Text style={styles.trackBtnText}>{awaitingPayment ? "Pay now" : "Track order"}</Text>
            </Pressable>
          )}
          {status === "delivered" && (
            <Pressable style={styles.reorderBtn} onPress={reorder} accessibilityLabel="Reorder">
              <Text style={styles.reorderBtnText}>Reorder</Text>
            </Pressable>
          )}
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersListScreen() {
  const insets = useSafeAreaInsets();
  const ordersQuery = useOrders();
  const now = useNow(1000);
  const [filter, setFilter] = useState<Filter>("All");
  const shown = (ordersQuery.data ?? []).filter((o) => matchesFilter(statusAt(o, now), filter));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="My orders" />

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {ordersQuery.isPending ? (
        <ActivityIndicator style={{ marginTop: Spacing[32] }} color={Colors.brandGreen} />
      ) : ordersQuery.isError ? (
        <ErrorState
          error={ordersQuery.error}
          title="Could not load your orders"
          onRetry={() => void ordersQuery.refetch()}
        />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[styles.list, { paddingBottom: 32 + insets.bottom }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing[12] }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>
                {filter === "All" ? "No orders yet" : `No ${filter.toLowerCase()} orders`}
              </Text>
              <Text style={styles.emptySubtitle}>Your orders will appear here</Text>
            </View>
          }
          renderItem={({ item }) => <OrderCard order={item} now={now} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paidTag: { color: Colors.brandText, fontWeight: "700" },
  thumbRow: { flexDirection: "row", gap: Spacing[8] },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbMore: { backgroundColor: Colors.canvas },
  thumbMoreText: { fontSize: FontSize.caption, fontWeight: "800", color: Colors.textSecondary },
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
    color: Colors.onBrand,
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
    color: Colors.onBrand,
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
    color: Colors.brandText,
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
