import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../../src/theme";
import { Ionicons } from "@expo/vector-icons";
import { useNow, useOrder } from "../../src/lib/orderQueries";
import { etaMinutes, statusAt, type OrderStatus } from "../../src/lib/orders";
import { formatPaise } from "../../src/lib/pricing";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ORDER_STEPS: { key: OrderStatus; label: string; icon: IconName }[] = [
  { key: "placed", label: "Order placed", icon: "receipt-outline" },
  { key: "confirmed", label: "Order confirmed", icon: "checkmark-circle-outline" },
  { key: "picking", label: "Picking items", icon: "bag-handle-outline" },
  { key: "on_the_way", label: "On the way", icon: "bicycle" },
  { key: "delivered", label: "Delivered", icon: "gift-outline" },
];

/** Demo rider until the delivery service assigns a real one. Matches the rider app's demo login. */
const DEMO_RIDER = { name: "Ravi Kumar", rating: 4.8 };

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = useOrder(id);
  const now = useNow(1000);
  const order = orderQuery.data;

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {orderQuery.isPending ? "Loading order" : "Order not found"}
          </Text>
        </View>
      </View>
    );
  }

  const status = statusAt(order, now);
  const cancelled = status === "cancelled";
  const delivered = status === "delivered";
  const inFlight = !cancelled && !delivered;
  const currentStepIdx = ORDER_STEPS.findIndex((s) => s.key === status);
  const eta = etaMinutes(order, now);
  const hasRider = status === "on_the_way" || delivered;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Track Order</Text>
        <Text style={styles.orderId}>#{order.id}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Map placeholder */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={48} color={Colors.brandText} />
          <Text style={styles.mapText}>Live tracking map</Text>
          <Text style={styles.mapSubtext}>
            {status === "on_the_way"
              ? `Your rider is about ${eta} min away`
              : delivered
                ? "Delivered"
                : cancelled
                  ? "This order was cancelled"
                  : "We will show your rider once they pick up your order"}
          </Text>
        </View>

        {/* ETA card */}
        <View style={[styles.card, styles.etaCard]}>
          <View style={styles.etaLeft}>
            <Text style={styles.etaTime}>
              {cancelled ? "Cancelled" : delivered ? "Delivered" : `${eta} min`}
            </Text>
            <Text style={styles.etaLabel}>
              {cancelled
                ? "No charge for this order"
                : delivered
                  ? "Your order was delivered"
                  : "Estimated delivery time"}
            </Text>
          </View>
          <View style={styles.etaBadge}>
            <Ionicons name="bicycle" size={26} color={Colors.brandText} />
          </View>
        </View>

        {/* Delivery code: the customer reads this out to the rider at the door */}
        {inFlight ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery code</Text>
            <Text
              style={styles.deliveryCode}
              accessibilityLabel={`Delivery code ${order.deliveryCode.split("").join(" ")}`}
            >
              {order.deliveryCode}
            </Text>
            <Text style={styles.codeHint}>
              Tell this to your delivery partner when they arrive.
            </Text>
          </View>
        ) : null}

        {/* Delivery partner */}
        {hasRider ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery partner</Text>
            <View style={styles.riderRow}>
              <View style={styles.riderAvatar}>
                <Ionicons name="person" size={24} color={Colors.brandText} />
              </View>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>{DEMO_RIDER.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="star" size={13} color={Colors.accent} />
                  <Text style={styles.riderRating}>{DEMO_RIDER.rating}</Text>
                </View>
              </View>
              <Pressable style={styles.callBtn}>
                <Ionicons name="call" size={16} color={Colors.surface} />
                <Text style={styles.callBtnText}>Call</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Status timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order status</Text>
          {ORDER_STEPS.map((step, i) => {
            const done = i <= currentStepIdx;
            const isLast = i === ORDER_STEPS.length - 1;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepDot, done ? styles.stepDotDone : styles.stepDotPending]}>
                    {done ? <Ionicons name="checkmark" size={14} color={Colors.surface} /> : null}
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.stepLine,
                        done && i < currentStepIdx ? styles.stepLineDone : styles.stepLinePending,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={done ? Colors.brandText : Colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      done ? styles.stepLabelDone : styles.stepLabelPending,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Order items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ordered</Text>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.orderItem}>
              <Text style={styles.orderItemEmoji}>{item.emoji}</Text>
              <Text style={styles.orderItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.orderItemQty}>×{item.quantity}</Text>
              <Text style={styles.orderItemPrice}>
                {formatPaise(item.unitPricePaise * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.orderTotalRow}>
            <Text style={styles.orderTotalLabel}>
              {cancelled ? "Total" : delivered ? "Total paid" : "To pay on delivery"}
            </Text>
            <Text style={styles.orderTotalValue}>{formatPaise(order.totalPaise)}</Text>
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery address</Text>
          <Text style={styles.addressText}>
            {order.address.tag}: {order.address.line1}, {order.address.line2}
          </Text>
        </View>

        {/* Help */}
        <View style={styles.helpCard}>
          <Pressable style={styles.helpBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.brandText} />
            <Text style={styles.helpBtnText}>Chat with us</Text>
          </Pressable>
          <View style={styles.helpDivider} />
          <Pressable style={styles.helpBtn}>
            <Ionicons name="help-circle-outline" size={18} color={Colors.brandText} />
            <Text style={styles.helpBtnText}>Help with order</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  deliveryCode: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 12,
    color: Colors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  codeHint: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: "center",
  },
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
    flex: 1,
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
  },
  orderId: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  scroll: { flex: 1 },
  scrollContent: {
    gap: Spacing[12],
    padding: Spacing[12],
  },

  // Map
  mapPlaceholder: {
    height: 200,
    backgroundColor: "#E8F0F8",
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[8],
    overflow: "hidden",
  },
  mapEmoji: {
    fontSize: 56,
  },
  mapText: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  mapSubtext: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },

  // Cards
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing[8],
  },
  cardTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[4],
  },

  // ETA card
  etaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.yellowTint,
    borderColor: Colors.accent,
  },
  etaLeft: { flex: 1 },
  etaTime: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.brandBlack,
  },
  etaLabel: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: Spacing[2],
  },
  etaBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  etaBadgeEmoji: {
    fontSize: 28,
  },

  // Rider
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  riderAvatarEmoji: {
    fontSize: 24,
  },
  riderInfo: { flex: 1 },
  riderName: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  riderRating: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
  },
  callBtnEmoji: {
    fontSize: 14,
  },
  callBtnText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandText,
  },

  // Status steps
  stepRow: {
    flexDirection: "row",
    gap: Spacing[12],
    minHeight: 48,
  },
  stepLeft: {
    alignItems: "center",
    width: 24,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  stepDotDone: {
    backgroundColor: Colors.brandGreen,
    borderColor: Colors.brandGreen,
  },
  stepDotPending: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  stepDotEmoji: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.surface,
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginVertical: Spacing[2],
  },
  stepLineDone: {
    backgroundColor: Colors.brandGreen,
  },
  stepLinePending: {
    backgroundColor: Colors.border,
  },
  stepContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
    paddingBottom: Spacing[12],
  },
  stepEmoji: {
    fontSize: 16,
  },
  stepLabel: {
    fontSize: FontSize.body,
    fontWeight: "600",
  },
  stepLabelDone: {
    color: Colors.textPrimary,
  },
  stepLabelPending: {
    color: Colors.textTertiary,
  },

  // Order items
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
    paddingVertical: Spacing[4],
  },
  orderItemEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  orderItemName: {
    flex: 1,
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  orderItemQty: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    width: 24,
    textAlign: "center",
  },
  orderItemPrice: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.textPrimary,
    minWidth: 40,
    textAlign: "right",
  },
  orderTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing[8],
    marginTop: Spacing[4],
  },
  orderTotalLabel: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  orderTotalValue: {
    fontSize: FontSize.body,
    fontWeight: "800",
    color: Colors.textPrimary,
  },

  // Address
  addressText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Help
  helpCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  helpBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[8],
    paddingVertical: Spacing[16],
  },
  helpDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  helpBtnEmoji: {
    fontSize: 18,
  },
  helpBtnText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandText,
  },
});
