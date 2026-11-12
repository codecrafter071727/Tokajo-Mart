import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { useCartStore } from "../../src/store/cart";
import { formatPaise, priceCart, toPriceLines } from "../../src/lib/pricing";
import { usePlaceOrder } from "../../src/lib/orderQueries";
import { useServiceability } from "../../src/lib/queries";
import type { OrderItem } from "../../src/lib/orders";
import { describeOrderError } from "../../src/lib/orderMapping";
import { OrderError } from "../../src/lib/orders";
import { Ionicons } from "@expo/vector-icons";
import { ProductImage } from "../../src/components/ProductImage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Address {
  id: string;
  tag: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  line1: string;
  line2: string;
  lat: number;
  lng: number;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const SAVED_ADDRESSES: Address[] = [
  {
    id: "a1",
    tag: "Home",
    icon: "home",
    line1: "B-12, Sector 62",
    line2: "Noida - 201309",
    lat: 28.6208,
    lng: 77.3649,
  },
  {
    id: "a2",
    tag: "Work",
    icon: "business",
    line1: "Tower 3, Logix Cyber Park, Sector 62",
    line2: "Noida - 201309",
    lat: 28.6262,
    lng: 77.3722,
  },
  {
    id: "a3",
    tag: "Parents",
    icon: "people",
    line1: "7B, Sector 63",
    line2: "Noida - 201301",
    lat: 28.6301,
    lng: 77.3801,
  },
];

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI / GPay / PhonePe", icon: "phone-portrait-outline" as const },
  { id: "card", label: "Credit / Debit Card", icon: "card-outline" as const },
  { id: "cod", label: "Cash on Delivery", icon: "cash-outline" as const },
  { id: "wallet", label: "Tokajo Wallet", icon: "wallet-outline" as const },
];

// ─── Address Bottom Sheet ─────────────────────────────────────────────────────

function AddressSheet({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Scrim - tap to close */}
      <Pressable style={sheetStyles.scrim} onPress={onClose} />

      <View style={[sheetStyles.panel, { paddingBottom: insets.bottom + Spacing[16] }]}>
        {/* Grabber handle */}
        <View style={sheetStyles.grabber} />

        <Text style={sheetStyles.title}>Select delivery address</Text>

        {SAVED_ADDRESSES.map((addr) => (
          <Pressable
            key={addr.id}
            style={[sheetStyles.addrRow, selectedId === addr.id && sheetStyles.addrRowActive]}
            onPress={() => {
              onSelect(addr.id);
              onClose();
            }}
          >
            <View style={sheetStyles.radioOuter}>
              {selectedId === addr.id && <View style={sheetStyles.radioInner} />}
            </View>
            <Ionicons name={addr.icon} size={20} color={Colors.brandText} />
            <View style={sheetStyles.addrText}>
              <Text style={sheetStyles.addrTag}>{addr.tag}</Text>
              <Text style={sheetStyles.addrLine}>{addr.line1}</Text>
              <Text style={sheetStyles.addrLine}>{addr.line2}</Text>
            </View>
          </Pressable>
        ))}

        <Pressable style={sheetStyles.addNewBtn} onPress={onClose}>
          <Text style={sheetStyles.addNewText}>+ Add new address</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing[12],
    paddingHorizontal: Spacing[16],
    ...Shadow.sheet,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing[16],
  },
  title: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[16],
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[12],
    padding: Spacing[12],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[10],
  },
  addrRowActive: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.greenTint,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.brandGreen,
  },
  addrEmoji: { fontSize: 20, marginTop: 1 },
  addrText: { flex: 1 },
  addrTag: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  addrLine: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  addNewBtn: {
    paddingVertical: Spacing[14],
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.brandGreen,
    borderStyle: "dashed",
    marginTop: Spacing[4],
    marginBottom: Spacing[4],
  },
  addNewText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.brandText,
  },
});

// ─── Checkout Screen ──────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedPayment, setSelectedPayment] = useState("cod");
  const [placeError, setPlaceError] = useState<string | null>(null);
  // One key per checkout screen: a double tap or a retry returns the same order, never a second one
  const idempotencyKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const placeOrder = usePlaceOrder();
  const eta = useServiceability().data;
  const [selectedAddressId, setSelectedAddressId] = useState("a1");
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);

  const items = useCartStore((s) => s.items);
  const tipRupees = useCartStore((s) => s.tipRupees);
  const clearCart = useCartStore((s) => s.clearCart);

  // The same pricing the cart used, including the tip, so the total never changes at checkout
  const bill = priceCart(toPriceLines(items), tipRupees * 100);

  const selectedAddress =
    SAVED_ADDRESSES.find((a) => a.id === selectedAddressId) ?? SAVED_ADDRESSES[0];

  const handlePlaceOrder = () => {
    if (placeOrder.isPending || items.length === 0 || !selectedAddress) return;
    setPlaceError(null);
    const orderItems: OrderItem[] = items.map((i) => ({
      productId: i.id,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      unitPricePaise: Math.round(i.price * 100),
      mrpPaise: Math.round(i.mrp * 100),
      emoji: i.image,
      imageUrl: i.imageUrl,
    }));
    placeOrder.mutate(
      {
        idempotencyKey: idempotencyKey.current,
        items: orderItems,
        tipPaise: tipRupees * 100,
        address: {
          tag: selectedAddress.tag,
          line1: selectedAddress.line1,
          line2: selectedAddress.line2,
        },
        location: { lat: selectedAddress.lat, lng: selectedAddress.lng },
        payment: "cod",
        promisedMins: eta?.etaMins ?? 10,
      },
      {
        onSuccess: (order) => {
          clearCart();
          router.replace({ pathname: "/orders/[id]", params: { id: order.id } });
        },
        onError: (error) =>
          setPlaceError(
            error instanceof OrderError
              ? error.message
              : describeOrderError(error, Object.fromEntries(items.map((i) => [i.id, i.name]))),
          ),
      },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Address sheet */}
      <AddressSheet
        visible={addressSheetVisible}
        selectedId={selectedAddressId}
        onSelect={setSelectedAddressId}
        onClose={() => setAddressSheetVisible(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
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
            <Text style={styles.cardTitle}>Delivery address</Text>
            <Pressable onPress={() => setAddressSheetVisible(true)}>
              <Text style={styles.changeBtn}>Change</Text>
            </Pressable>
          </View>
          <View style={styles.addrTagRow}>
            <Ionicons name={selectedAddress?.icon ?? "home"} size={16} color={Colors.brandText} />
            <Text style={styles.addressName}>{selectedAddress?.tag}</Text>
          </View>
          <Text style={styles.addressDetail}>
            {selectedAddress?.line1},{"\n"}
            {selectedAddress?.line2}
          </Text>
          <View style={styles.addressTag}>
            <Text style={styles.addressTagText}>
              {eta?.serviceable
                ? `Delivery in ${eta.etaMins} minutes`
                : "Delivery time unavailable"}
            </Text>
          </View>
        </View>

        {/* Order summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order summary</Text>
          {items.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <ProductImage
                imageUrl={item.imageUrl}
                fit={item.imageFit}
                emoji={item.image}
                emojiSize={18}
                style={styles.orderItemImg}
              />
              <Text style={styles.orderItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.orderItemQty}>×{item.quantity}</Text>
              <Text style={styles.orderItemPrice}>
                {formatPaise(Math.round(item.price * 100) * item.quantity)}
              </Text>
            </View>
          ))}
          {items.length > 4 && <Text style={styles.moreItems}>+{items.length - 4} more items</Text>}
        </View>

        {/* Payment method */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment method</Text>
          {PAYMENT_METHODS.map((method) => {
            const available = method.id === "cod";
            return (
              <Pressable
                key={method.id}
                style={[
                  styles.paymentMethod,
                  selectedPayment === method.id && styles.paymentMethodActive,
                  !available && styles.paymentMethodDisabled,
                ]}
                disabled={!available}
                accessibilityState={{
                  disabled: !available,
                  selected: selectedPayment === method.id,
                }}
                onPress={() => setSelectedPayment(method.id)}
              >
                <View style={styles.paymentRadio}>
                  {selectedPayment === method.id && <View style={styles.paymentRadioFill} />}
                </View>
                <Ionicons
                  name={method.icon}
                  size={22}
                  color={available ? Colors.brandText : Colors.textTertiary}
                />
                <Text style={styles.paymentLabel}>{method.label}</Text>
                {!available ? (
                  <Text style={styles.soon} numberOfLines={1}>
                    Soon
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Coupons */}
        <Pressable style={styles.couponCard}>
          <Ionicons name="pricetag" size={20} color={Colors.brandText} />
          <Text style={styles.couponText}>Apply coupon / promo code</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        {/* Bill summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items total</Text>
            <Text style={styles.billValue}>{formatPaise(bill.itemTotalPaise)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery</Text>
            {bill.deliveryFeePaise === 0 ? (
              <Text style={styles.billFree}>FREE</Text>
            ) : (
              <Text style={styles.billValue}>{formatPaise(bill.deliveryFeePaise)}</Text>
            )}
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Handling charge</Text>
            <Text style={styles.billValue}>{formatPaise(bill.handlingFeePaise)}</Text>
          </View>
          {bill.tipPaise > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery partner tip</Text>
              <Text style={styles.billValue}>{formatPaise(bill.tipPaise)}</Text>
            </View>
          )}
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>Grand total</Text>
            <Text style={styles.billTotalValue}>{formatPaise(bill.totalPaise)}</Text>
          </View>
          {bill.savingsPaise > 0 && (
            <View style={styles.savingsRow}>
              <Text style={styles.savingsText}>You save {formatPaise(bill.savingsPaise)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing[8] }]}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomTotal}>{formatPaise(bill.totalPaise)}</Text>
          <Text style={styles.bottomSub}>
            {items.length === 0 ? "Your cart is empty" : "Pay on delivery"}
          </Text>
        </View>
        {placeError ? (
          <Text style={styles.placeError} accessibilityRole="alert">
            {placeError}
          </Text>
        ) : null}
        <Pressable
          style={[
            styles.placeOrderBtn,
            (placeOrder.isPending || items.length === 0) && styles.placeOrderBtnDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={placeOrder.isPending || items.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Place order"
        >
          <Text style={styles.placeOrderText}>
            {placeOrder.isPending ? "Placing order" : "Place order"}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.surface} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  paymentMethodDisabled: {
    opacity: 0.55,
  },
  soon: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.textTertiary,
  },
  placeError: {
    position: "absolute",
    top: -28,
    left: Spacing[16],
    right: Spacing[16],
    textAlign: "center",
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.danger,
  },
  placeOrderBtnDisabled: {
    opacity: 0.5,
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
    color: Colors.brandText,
  },
  addrTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[6] ?? 6,
  },
  addrEmoji: { fontSize: 16 },
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
    color: Colors.brandText,
  },

  // Order items
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
    paddingVertical: Spacing[4],
  },
  orderItemImg: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: Spacing[8],
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
    minWidth: 48,
    textAlign: "right",
  },
  moreItems: {
    fontSize: FontSize.caption,
    color: Colors.brandText,
    fontWeight: "600",
    marginTop: Spacing[4],
  },

  // Payment
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
  paymentEmoji: { fontSize: 20 },
  paymentLabel: {
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Coupon
  couponCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  couponEmoji: { fontSize: 20 },
  couponText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.brandText,
  },
  couponChevron: { fontSize: 20, color: Colors.textTertiary },

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
    color: Colors.brandText,
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
    color: Colors.brandText,
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
  bottomInfo: { flex: 1 },
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
    paddingVertical: Spacing[14],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeOrderText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
});
