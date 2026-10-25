import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { AddButton } from "../../src/components/AddButton";
import { useCartStore } from "../../src/store/cart";
import { getSuggestedProducts } from "../../src/lib/mockData";

const TIP_AMOUNTS = [0, 20, 30, 50];

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());
  const totalMrp = useCartStore((s) => s.totalMrp());
  const totalSavings = useCartStore((s) => s.totalSavings());
  const [selectedTip, setSelectedTip] = useState(20);

  const deliveryFee = totalPrice >= 99 ? 0 : 29;
  const handlingFee = 5;
  const grandTotal = totalPrice + deliveryFee + handlingFee + selectedTip;

  const suggestedProducts = getSuggestedProducts(items.map((i) => i.id));

  if (items.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty!</Text>
          <Text style={styles.emptySubtitle}>Add items to your cart to proceed with delivery</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push("/(tabs)")}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Cart</Text>
        <Text style={styles.headerSubtitle}>
          {totalItems} item{totalItems !== 1 ? "s" : ""}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery strip */}
        <View style={styles.deliveryStrip}>
          <View style={styles.deliveryStripLeft}>
            <View style={styles.clockIconBg}>
              <Text style={styles.clockEmoji}>⏱</Text>
            </View>
            <View>
              <Text style={styles.deliveryTimeText}>Delivery in 10 minutes</Text>
              <Text style={styles.shipmentText}>
                Shipment of {totalItems} item{totalItems !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <View style={styles.etaPill}>
            <Text style={styles.etaPillText}>ON TIME</Text>
          </View>
        </View>

        {/* Cart items */}
        <View style={styles.card}>
          {items.map((item, index) => (
            <View key={item.id}>
              <View style={styles.cartItem}>
                <View style={styles.cartItemImage}>
                  <Text style={styles.cartItemEmoji}>{item.image}</Text>
                </View>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.cartItemUnit}>{item.unit}</Text>
                  <View style={styles.cartItemPriceRow}>
                    <Text style={styles.cartItemPrice}>₹{item.price * item.quantity}</Text>
                    {item.mrp > item.price && (
                      <Text style={styles.cartItemMrp}>₹{item.mrp * item.quantity}</Text>
                    )}
                  </View>
                </View>
                <AddButton productId={item.id} productData={item} size="md" />
              </View>
              {index < items.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Before you checkout (suggestions) */}
        {suggestedProducts.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsTitle}>Before you checkout</Text>
            <FlatList
              data={suggestedProducts}
              keyExtractor={(p) => p.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsList}
              ItemSeparatorComponent={() => <View style={{ width: Spacing[8] }} />}
              renderItem={({ item }) => (
                <View style={styles.suggestionCard}>
                  <View style={styles.suggestionImgBg}>
                    <Text style={styles.suggestionEmoji}>{item.image}</Text>
                  </View>
                  <Text style={styles.suggestionName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.suggestionUnit}>{item.unit}</Text>
                  <View style={styles.suggestionPriceRow}>
                    <Text style={styles.suggestionPrice}>₹{item.price}</Text>
                    <AddButton productId={item.id} productData={item} size="sm" />
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* Tip section */}
        <View style={styles.card}>
          <View style={styles.tipHeader}>
            <Text style={styles.tipTitle}>🙏 Tip your delivery partner</Text>
            <Text style={styles.tipSubtitle}>
              They work hard to deliver on time. Show your appreciation!
            </Text>
          </View>
          <View style={styles.tipChips}>
            {TIP_AMOUNTS.map((amount) => (
              <Pressable
                key={amount}
                style={[styles.tipChip, selectedTip === amount && styles.tipChipActive]}
                onPress={() => setSelectedTip(amount)}
              >
                <Text
                  style={[styles.tipChipText, selectedTip === amount && styles.tipChipTextActive]}
                >
                  {amount === 0 ? "None" : `₹${amount}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Bill details */}
        <View style={styles.card}>
          <Text style={styles.billTitle}>Bill details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item total</Text>
            <View style={styles.billRight}>
              {totalSavings > 0 && <Text style={styles.billMrp}>₹{totalMrp}</Text>}
              <Text style={styles.billValue}>₹{totalPrice}</Text>
            </View>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery charge</Text>
            {deliveryFee === 0 ? (
              <View style={styles.billFreeRow}>
                <Text style={styles.billFreeOriginal}>₹29</Text>
                <Text style={styles.billFree}>FREE</Text>
              </View>
            ) : (
              <Text style={styles.billValue}>₹{deliveryFee}</Text>
            )}
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Handling charge</Text>
            <Text style={styles.billValue}>₹{handlingFee}</Text>
          </View>

          {selectedTip > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery partner tip</Text>
              <Text style={styles.billValue}>₹{selectedTip}</Text>
            </View>
          )}

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>Grand total</Text>
            <Text style={styles.billTotalValue}>₹{grandTotal}</Text>
          </View>

          {totalSavings > 0 && (
            <View style={styles.savingsStrip}>
              <Text style={styles.savingsText}>🎉 You saved ₹{totalSavings} on this order</Text>
            </View>
          )}
        </View>

        {/* Cancellation policy */}
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Cancellation policy</Text>
          <Text style={styles.policyText}>
            Orders can be cancelled within 60 seconds of placement for a full refund. After that, a
            nominal fee may apply. Items that are out of stock will be automatically refunded.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom bar — address + total + proceed */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing[8] }]}>
        {/* Address row */}
        <Pressable style={styles.bottomAddressRow}>
          <Text style={styles.bottomAddressEmoji}>📍</Text>
          <Text style={styles.bottomAddressText} numberOfLines={1}>
            Delivering to <Text style={styles.bottomAddressBold}>Home</Text> — 123, MG Road
          </Text>
          <Text style={styles.bottomAddressChevron}>›</Text>
        </Pressable>
        {/* Total + button */}
        <View style={styles.bottomBarRow}>
          <View style={styles.bottomBarLeft}>
            <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
            <Text style={styles.bottomTotalLabel}>Total (incl. all taxes)</Text>
          </View>
          <Pressable style={styles.proceedBtn} onPress={() => router.push("/checkout")}>
            <Text style={styles.proceedBtnText}>Proceed to Pay ›</Text>
          </Pressable>
        </View>
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
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing[8],
  },
  headerTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    gap: Spacing[12],
    padding: Spacing[12],
  },

  // Delivery strip
  deliveryStrip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Shadow.card,
  },
  deliveryStripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[10],
  },
  clockIconBg: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.yellowTint,
    alignItems: "center",
    justifyContent: "center",
  },
  clockEmoji: {
    fontSize: 18,
  },
  deliveryTimeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  shipmentText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  etaPill: {
    backgroundColor: Colors.greenTint,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  etaPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.brandGreen,
    letterSpacing: 0.5,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Cart item
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingVertical: Spacing[8],
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemEmoji: {
    fontSize: 36,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: FontSize.productName,
    fontWeight: FontWeight.productName,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  cartItemUnit: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cartItemPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
    marginTop: Spacing[4],
  },
  cartItemPrice: {
    fontSize: FontSize.price,
    fontWeight: FontWeight.price,
    color: Colors.textPrimary,
  },
  cartItemMrp: {
    fontSize: 11,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing[4],
  },

  // Suggestions
  suggestionsSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingTop: Spacing[16],
    paddingBottom: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionsTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[12],
    paddingHorizontal: Spacing[16],
  },
  suggestionsList: {
    paddingHorizontal: Spacing[16],
  },
  suggestionCard: {
    width: 130,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing[8],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing[4],
  },
  suggestionImgBg: {
    height: 64,
    backgroundColor: Colors.canvas,
    borderRadius: Radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionEmoji: {
    fontSize: 32,
    textAlign: "center",
  },
  suggestionName: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
    lineHeight: 14,
  },
  suggestionUnit: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  suggestionPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing[4],
  },
  suggestionPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  // Tip
  tipHeader: {
    marginBottom: Spacing[12],
  },
  tipTitle: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing[4],
  },
  tipSubtitle: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  tipChips: {
    flexDirection: "row",
    gap: Spacing[8],
  },
  tipChip: {
    flex: 1,
    paddingVertical: Spacing[8],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  tipChipActive: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.greenTint,
  },
  tipChipText: {
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tipChipTextActive: {
    color: Colors.brandGreen,
  },

  // Bill
  billTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[16],
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing[8],
  },
  billLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.body,
    color: Colors.textSecondary,
  },
  billRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
  },
  billMrp: {
    fontSize: 12,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
  billValue: {
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  billFreeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
  },
  billFreeOriginal: {
    fontSize: 12,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
  billFree: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
  },
  billDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing[12],
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
  savingsStrip: {
    marginTop: Spacing[12],
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.sm,
    padding: Spacing[10] ?? 10,
  },
  savingsText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandGreen,
    textAlign: "center",
  },

  // Policy
  policyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  policyTitle: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing[8],
  },
  policyText: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[8],
    gap: Spacing[8],
    ...Shadow.sticky,
  },
  bottomAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[6],
    paddingVertical: Spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bottomAddressEmoji: { fontSize: 13 },
  bottomAddressText: {
    flex: 1,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  bottomAddressBold: {
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  bottomAddressChevron: {
    fontSize: 16,
    color: Colors.textTertiary,
  },
  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing[16],
  },
  bottomBarLeft: {
    flex: 1,
  },
  bottomTotal: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  proceedBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[24],
    paddingVertical: Spacing[14] ?? 14,
    alignItems: "center",
    justifyContent: "center",
  },
  proceedBtnText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[12],
    padding: Spacing[24],
  },
  emptyEmoji: {
    fontSize: 80,
  },
  emptyTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  shopBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[24],
    paddingVertical: Spacing[14] ?? 14,
    marginTop: Spacing[8],
  },
  shopBtnText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
});
