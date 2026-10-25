import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";

type OrderStatus = "placed" | "confirmed" | "picking" | "on_the_way" | "delivered";

const ORDER_STEPS: { key: OrderStatus; label: string; emoji: string }[] = [
  { key: "placed", label: "Order placed", emoji: "📋" },
  { key: "confirmed", label: "Order confirmed", emoji: "✅" },
  { key: "picking", label: "Picking items", emoji: "📦" },
  { key: "on_the_way", label: "On the way", emoji: "🛵" },
  { key: "delivered", label: "Delivered", emoji: "🎉" },
];

const MOCK_ORDERS = [
  {
    id: "ORD001",
    status: "on_the_way" as OrderStatus,
    date: "Today, 3:15 PM",
    items: [
      { name: "Fresho Banana", qty: 2, price: 50, emoji: "🍌" },
      { name: "Amul Milk 500ml", qty: 1, price: 29, emoji: "🥛" },
      { name: "Lay's Chips", qty: 1, price: 20, emoji: "🥔" },
    ],
    total: 99,
    deliveryAddress: "123, MG Road, Bengaluru",
    eta: "3 minutes",
    rider: { name: "Rahul K", rating: 4.8 },
  },
];

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderFound = MOCK_ORDERS.find((o) => o.id === id) ?? MOCK_ORDERS[0];

  if (!orderFound) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Order not found</Text>
        </View>
      </View>
    );
  }

  const order = orderFound;
  const currentStepIdx = ORDER_STEPS.findIndex((s) => s.key === order.status);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
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
          <Text style={styles.mapEmoji}>🗺️</Text>
          <Text style={styles.mapText}>Live tracking map</Text>
          <Text style={styles.mapSubtext}>Your rider is {order.eta} away</Text>
        </View>

        {/* ETA card */}
        <View style={[styles.card, styles.etaCard]}>
          <View style={styles.etaLeft}>
            <Text style={styles.etaTime}>
              {order.status === "delivered" ? "🎉 Delivered" : `🕐 ${order.eta}`}
            </Text>
            <Text style={styles.etaLabel}>
              {order.status === "delivered"
                ? "Your order was delivered"
                : "Estimated delivery time"}
            </Text>
          </View>
          <View style={styles.etaBadge}>
            <Text style={styles.etaBadgeEmoji}>🛵</Text>
          </View>
        </View>

        {/* Delivery partner */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery partner</Text>
          <View style={styles.riderRow}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderAvatarEmoji}>🧑‍🦱</Text>
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{order.rider.name}</Text>
              <Text style={styles.riderRating}>⭐ {order.rider.rating}</Text>
            </View>
            <Pressable style={styles.callBtn}>
              <Text style={styles.callBtnEmoji}>📞</Text>
              <Text style={styles.callBtnText}>Call</Text>
            </Pressable>
          </View>
        </View>

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
                    <Text style={styles.stepDotEmoji}>{done ? "✓" : ""}</Text>
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
                  <Text style={styles.stepEmoji}>{step.emoji}</Text>
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
          {order.items.map((item, i) => (
            <View key={i} style={styles.orderItem}>
              <Text style={styles.orderItemEmoji}>{item.emoji}</Text>
              <Text style={styles.orderItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.orderItemQty}>×{item.qty}</Text>
              <Text style={styles.orderItemPrice}>₹{item.price}</Text>
            </View>
          ))}
          <View style={styles.orderTotalRow}>
            <Text style={styles.orderTotalLabel}>Total paid</Text>
            <Text style={styles.orderTotalValue}>₹{order.total}</Text>
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Delivery address</Text>
          <Text style={styles.addressText}>{order.deliveryAddress}</Text>
        </View>

        {/* Help */}
        <View style={styles.helpCard}>
          <Pressable style={styles.helpBtn}>
            <Text style={styles.helpBtnEmoji}>💬</Text>
            <Text style={styles.helpBtnText}>Chat with us</Text>
          </Pressable>
          <View style={styles.helpDivider} />
          <Pressable style={styles.helpBtn}>
            <Text style={styles.helpBtnEmoji}>❓</Text>
            <Text style={styles.helpBtnText}>Help with order</Text>
          </Pressable>
        </View>
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
    borderColor: Colors.brandYellow,
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
    backgroundColor: Colors.brandYellow,
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
    color: Colors.brandGreen,
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
    color: Colors.brandGreen,
  },
});
