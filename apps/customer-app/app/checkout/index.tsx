import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { addressSummary, addressTag, type SavedAddress } from "../../src/lib/addresses";
import { useAddressStore, useSelectedAddress } from "../../src/store/addresses";
import { KIND_ICON } from "../../src/lib/addressIcons";
import { useOnlinePaymentsAvailable } from "../../src/lib/paymentQueries";
import { useCouponStore } from "../../src/store/coupon";
import { CouponSection } from "../../src/components/CouponSection";
import { isCouponError } from "../../src/lib/coupons";

type PaymentChoice = "online" | "cod";

const PAYMENT_METHODS: {
  id: PaymentChoice;
  label: string;
  detail: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    id: "online",
    label: "Pay online",
    detail: "UPI, cards and netbanking, secured by Razorpay",
    icon: "flash-outline",
  },
  {
    id: "cod",
    label: "Cash on delivery",
    detail: "Pay the rider by cash or UPI",
    icon: "cash-outline",
  },
];

// ─── Address Bottom Sheet ─────────────────────────────────────────────────────

function AddressSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  const insets = useSafeAreaInsets();
  const addresses = useAddressStore((st) => st.addresses);
  const selectedId = useAddressStore((st) => st.selectedId);
  const select = useAddressStore((st) => st.select);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Scrim - tap to close */}
      <Pressable style={sheetStyles.scrim} onPress={onClose} />

      <View style={[sheetStyles.panel, { paddingBottom: insets.bottom + Spacing[16] }]}>
        {/* Grabber handle */}
        <View style={sheetStyles.grabber} />

        <Text style={sheetStyles.title}>Select delivery address</Text>

        {addresses.map((addr: SavedAddress) => {
          const { line1, line2 } = addressSummary(addr);
          return (
            <Pressable
              key={addr.id}
              style={[sheetStyles.addrRow, selectedId === addr.id && sheetStyles.addrRowActive]}
              onPress={() => {
                select(addr.id);
                onClose();
              }}
            >
              <View style={sheetStyles.radioOuter}>
                {selectedId === addr.id && <View style={sheetStyles.radioInner} />}
              </View>
              <Ionicons name={KIND_ICON[addr.kind]} size={20} color={Colors.brandText} />
              <View style={sheetStyles.addrText}>
                <Text style={sheetStyles.addrTag}>{addressTag(addr)}</Text>
                <Text style={sheetStyles.addrLine}>{line1}</Text>
                <Text style={sheetStyles.addrLine}>{line2}</Text>
              </View>
            </Pressable>
          );
        })}

        <Pressable style={sheetStyles.addNewBtn} onPress={onAdd}>
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
  const onlineAvailable = useOnlinePaymentsAvailable();
  const onlineOn = onlineAvailable.data === true;
  const [selectedPayment, setSelectedPayment] = useState<PaymentChoice>("cod");
  const chosenByUser = useRef(false);
  // Online is the default once we know it is switched on, unless the customer already picked
  useEffect(() => {
    if (onlineOn && !chosenByUser.current) setSelectedPayment("online");
    if (onlineAvailable.data === false) setSelectedPayment("cod");
  }, [onlineOn, onlineAvailable.data]);
  const payOnline = selectedPayment === "online" && onlineOn;
  const [placeError, setPlaceError] = useState<string | null>(null);
  // One key per checkout screen: a double tap or a retry returns the same order, never a second one
  const idempotencyKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const placeOrder = usePlaceOrder();
  const eta = useServiceability().data;
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);

  const items = useCartStore((s) => s.items);
  const tipRupees = useCartStore((s) => s.tipRupees);
  const clearCart = useCartStore((s) => s.clearCart);

  const applied = useCouponStore((s) => s.applied);
  const removeCoupon = useCouponStore((s) => s.remove);

  // The same pricing the cart used, including the tip and coupon, so the total never changes here
  const lines = toPriceLines(items);
  const bill = priceCart(lines, tipRupees * 100, applied);

  const selectedAddress = useSelectedAddress();
  const { line1: addressLine1, line2: addressLine2 } = addressSummary(selectedAddress);
  // The server decides, but an address we know is outside every area never reaches checkout
  const outsideArea = eta ? !eta.serviceable : false;

  const handlePlaceOrder = () => {
    if (placeOrder.isPending || items.length === 0 || outsideArea) return;
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
          tag: addressTag(selectedAddress),
          line1: addressLine1,
          line2: addressLine2,
        },
        location: {
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
          instructions: selectedAddress.instructions || null,
        },
        payment: payOnline ? "online" : "cod",
        promisedMins: eta?.etaMins ?? 10,
        // Only the code goes to the server, which prices the discount itself
        ...(bill.appliedCoupon ? { couponCode: bill.appliedCoupon.code } : {}),
      },
      {
        onSuccess: (order) => {
          clearCart();
          removeCoupon();
          // An online order goes straight into the payment sheet on its tracking screen
          router.replace({
            pathname: "/orders/[id]",
            params: payOnline ? { id: order.id, pay: "1" } : { id: order.id },
          });
        },
        onError: (error) => {
          if (isCouponError(error)) {
            // The code stopped working (used up, expired): drop it so the next tap goes through
            removeCoupon();
            setPlaceError(
              `${(error as Error).message} The coupon was removed. Check the new total and place the order again.`,
            );
            return;
          }
          setPlaceError(
            error instanceof OrderError
              ? error.message
              : describeOrderError(error, Object.fromEntries(items.map((i) => [i.id, i.name]))),
          );
        },
      },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Address sheet */}
      <AddressSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        onAdd={() => {
          setAddressSheetVisible(false);
          router.push("/addresses/edit");
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
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
            <Ionicons name={KIND_ICON[selectedAddress.kind]} size={16} color={Colors.brandText} />
            <Text style={styles.addressName}>{addressTag(selectedAddress)}</Text>
          </View>
          <Text style={styles.addressDetail}>
            {addressLine1},{"\n"}
            {addressLine2}
          </Text>
          <View style={[styles.addressTag, outsideArea && styles.addressTagBlocked]}>
            <Text style={[styles.addressTagText, outsideArea && styles.addressTagTextBlocked]}>
              {outsideArea
                ? "We do not deliver here yet. Choose another address."
                : eta?.serviceable
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
            const available = method.id === "cod" || onlineOn;
            const selected = selectedPayment === method.id;
            return (
              <Pressable
                key={method.id}
                style={[
                  styles.paymentMethod,
                  selected && styles.paymentMethodActive,
                  !available && styles.paymentMethodDisabled,
                ]}
                disabled={!available}
                accessibilityRole="radio"
                accessibilityState={{ disabled: !available, selected }}
                onPress={() => {
                  chosenByUser.current = true;
                  setSelectedPayment(method.id);
                }}
              >
                <View style={styles.paymentRadio}>
                  {selected && <View style={styles.paymentRadioFill} />}
                </View>
                <Ionicons
                  name={method.icon}
                  size={22}
                  color={available ? Colors.brandText : Colors.textTertiary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentLabel}>{method.label}</Text>
                  <Text style={styles.paymentDetail} numberOfLines={2}>
                    {method.id === "online" && !available
                      ? onlineAvailable.isPending
                        ? "Checking availability"
                        : "Not available right now. Choose cash on delivery."
                      : method.detail}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <CouponSection
          lines={lines}
          items={items.map((i) => ({ productId: i.id, quantity: i.quantity }))}
          tipPaise={tipRupees * 100}
          bill={bill}
        />

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
          {bill.discountPaise > 0 && bill.appliedCoupon && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Coupon ({bill.appliedCoupon.code})</Text>
              <Text style={styles.billFree}>-{formatPaise(bill.discountPaise)}</Text>
            </View>
          )}
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>Grand total</Text>
            <Text style={styles.billTotalValue}>{formatPaise(bill.totalPaise)}</Text>
          </View>
          {bill.savingsPaise + bill.couponSavingsPaise > 0 && (
            <View style={styles.savingsRow}>
              <Text style={styles.savingsText}>
                You save {formatPaise(bill.savingsPaise + bill.couponSavingsPaise)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing[10] }]}>
        {placeError ? (
          <View style={styles.placeError} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.placeErrorText}>{placeError}</Text>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.placeOrderBtn,
            pressed && styles.placeOrderPressed,
            (placeOrder.isPending || items.length === 0 || outsideArea) &&
              styles.placeOrderBtnDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={placeOrder.isPending || items.length === 0 || outsideArea}
          accessibilityRole="button"
          accessibilityLabel={`Place order, ${formatPaise(bill.totalPaise)}, ${payOnline ? "pay online" : "pay on delivery"}`}
          accessibilityState={{ busy: placeOrder.isPending }}
        >
          <View>
            <Text style={styles.bottomTotal}>{formatPaise(bill.totalPaise)}</Text>
            <Text style={styles.bottomSub}>{payOnline ? "PAY ONLINE" : "PAY ON DELIVERY"}</Text>
          </View>
          {placeOrder.isPending ? (
            <ActivityIndicator color={Colors.onBrand} />
          ) : (
            <View style={styles.placeRight}>
              <Text style={styles.placeOrderText}>
                {payOnline ? "Proceed to pay" : "Place order"}
              </Text>
              <Ionicons name="caret-forward" size={14} color={Colors.onBrand} />
            </View>
          )}
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
  paymentDetail: {
    fontSize: FontSize.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  placeError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDF1F1",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
  },
  placeErrorText: { flex: 1, fontSize: FontSize.caption, fontWeight: "700", color: Colors.danger },
  placeOrderBtnDisabled: {
    backgroundColor: "#C9D3D1",
  },
  placeOrderPressed: { backgroundColor: Colors.brandFillPressed },
  placeRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[8],
    height: 56,
    gap: Spacing[4],
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
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
    padding: Spacing[14],
    gap: Spacing[8],
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
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
  addressTagBlocked: { backgroundColor: Colors.canvas },
  addressTagTextBlocked: { color: Colors.danger },
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
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing[12],
    paddingTop: Spacing[10],
    gap: Spacing[8],
    ...Shadow.sticky,
  },
  bottomTotal: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: Colors.onBrand,
    fontVariant: ["tabular-nums"],
  },
  bottomSub: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: Colors.onBrandMuted,
  },
  placeOrderBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[16],
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeOrderText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onBrand,
  },
});
