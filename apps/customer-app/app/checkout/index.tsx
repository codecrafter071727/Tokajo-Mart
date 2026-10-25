import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { useCartStore } from "../../src/store/cart";

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI / GPay / PhonePe", emoji: "📲" },
  { id: "card", label: "Credit / Debit Card", emoji: "💳" },
  { id: "cod", label: "Cash on Delivery", emoji: "💵" },
  { id: "wallet", label: "Tokajo Wallet", emoji: "👛" },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedPayment, setSelectedPayment] = useState("upi");
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const totalSavings = useCartStore((s) => s.totalSavings());
  const clearCart = useCartStore((s) => s.clearCart);

  const deliveryFee = totalPrice >= 99 ? 0 : 29;
  const handlingFee = 5;
  const grandTotal = totalPrice + deliveryFee + handlingFee;

  const handlePlaceOrder = () => {
    Alert.alert(
      "🎉 Order Placed!",
      `Your order will be delivered in 10 minutes.\n\nOrder total: ₹${grandTotal}`,
      [
        {
          text: "Track Order",
          onPress: () => {
            clearCart();
            router.replace("/(tabs)/account");
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery address */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>📍 Delivery address</Text>
            <Pressable>
              <Text style={styles.changeBtn}>Change</Text>
            </Pressable>
          </View>
          <Text style={styles.addressName}>Home</Text>
          <Text style={styles.addressDetail}>123, MG Road, Indiranagar, Bengaluru — 560038</Text>
          <View style={styles.addressTag}>
            <Text style={styles.addressTagText}>Delivery in 10 minutes</Text>
          </View>
        </View>

        {/* Order summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛒 Order summary</Text>
          {items.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={styles.orderItemEmoji}>{item.image}</Text>
              <Text style={styles.orderItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.orderItemQty}>×{item.quantity}</Text>
              <Text style={styles.orderItemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          {items.length > 4 && <Text style={styles.moreItems}>+{items.length - 4} more items</Text>}
        </View>

        {/* Payment method */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💳 Payment method</Text>
          {PAYMENT_METHODS.map((method) => (
            <Pressable
              key={method.id}
              style={[
                styles.paymentMethod,
                selectedPayment === method.id && styles.paymentMethodActive,
              ]}
              onPress={() => setSelectedPayment(method.id)}
            >
              <View style={styles.paymentRadio}>
                {selectedPayment === method.id && <View style={styles.paymentRadioFill} />}
              </View>
              <Text style={styles.paymentEmoji}>{method.emoji}</Text>
              <Text style={styles.paymentLabel}>{method.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Coupons */}
        <Pressable style={styles.couponCard}>
          <Text style={styles.couponEmoji}>🎟️</Text>
          <Text style={styles.couponText}>Apply coupon / promo code</Text>
          <Text style={styles.couponChevron}>›</Text>
        </Pressable>

        {/* Bill summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Bill summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items total</Text>
            <Text style={styles.billValue}>₹{totalPrice}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery</Text>
            {deliveryFee === 0 ? (
              <Text style={styles.billFree}>FREE</Text>
            ) : (
              <Text style={styles.billValue}>₹{deliveryFee}</Text>
            )}
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform fee</Text>
            <Text style={styles.billValue}>₹{handlingFee}</Text>
          </View>
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>Grand Total</Text>
            <Text style={styles.billTotalValue}>₹{grandTotal}</Text>
          </View>
          {totalSavings > 0 && (
            <View style={styles.savingsRow}>
              <Text style={styles.savingsText}>🎉 You save ₹{totalSavings}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing[8] }]}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
          <Text style={styles.bottomSub}>
            {selectedPayment === "cod" ? "Pay on delivery" : "Online payment"}
          </Text>
        </View>
        <Pressable style={styles.placeOrderBtn} onPress={handlePlaceOrder}>
          <Text style={styles.placeOrderText}>Place Order ›</Text>
        </Pressable>
      </View>
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
  backBtn: {
    padding: Spacing[4],
  },
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
  scroll: { flex: 1 },
  scrollContent: {
    gap: Spacing[12],
    padding: Spacing[12],
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing[8],
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[4],
  },
  changeBtn: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
  },
  addressName: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  addressDetail: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  addressTag: {
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    alignSelf: "flex-start",
    marginTop: Spacing[4],
  },
  addressTagText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
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
    color: Colors.textPrimary,
    fontWeight: "600",
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
    minWidth: 48,
    textAlign: "right",
  },
  moreItems: {
    fontSize: FontSize.caption,
    color: Colors.brandGreen,
    fontWeight: "600",
    marginTop: Spacing[4],
  },

  // Payment methods
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingVertical: Spacing[12],
    paddingHorizontal: Spacing[12],
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentMethodActive: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.greenTint,
  },
  paymentRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentRadioFill: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.brandGreen,
  },
  paymentEmoji: {
    fontSize: 20,
  },
  paymentLabel: {
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Coupon card
  couponCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  couponEmoji: {
    fontSize: 20,
  },
  couponText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.brandGreen,
  },
  couponChevron: {
    fontSize: 20,
    color: Colors.textTertiary,
  },

  // Bill
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  billValue: {
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  billFree: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
  },
  billDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing[4],
  },
  billTotalLabel: {
    fontSize: FontSize.body,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  billTotalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  savingsRow: {
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.xs,
    padding: Spacing[8],
    marginTop: Spacing[4],
  },
  savingsText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
    textAlign: "center",
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[12],
    gap: Spacing[16],
    ...Shadow.sticky,
  },
  bottomInfo: {
    flex: 1,
  },
  bottomTotal: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  bottomSub: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  placeOrderBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[24],
    paddingVertical: Spacing[14] ?? 14,
    alignItems: "center",
    justifyContent: "center",
  },
  placeOrderText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
});
