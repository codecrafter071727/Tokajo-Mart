import React, { useMemo } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TAB_BAR_CONTENT } from "../../src/theme/tabs";
import { useProducts, useServiceability } from "../../src/lib/queries";
import { Colors, Radius, Shadow, Spacing, typography } from "../../src/theme";
import { AddButton } from "../../src/components/AddButton";
import { ProductCard } from "../../src/components/ProductCard";
import { ProductImage } from "../../src/components/ProductImage";
import { useCartStore } from "../../src/store/cart";
import { useCouponStore } from "../../src/store/coupon";
import { CouponSection } from "../../src/components/CouponSection";
import { useSelectedAddress } from "../../src/store/addresses";
import { addressSummary, addressTag } from "../../src/lib/addresses";
import { KIND_ICON } from "../../src/lib/addressIcons";
import {
  DELIVERY_FEE_PAISE,
  FREE_DELIVERY_MIN_PAISE,
  formatPaise,
  priceCart,
  toPriceLines,
} from "../../src/lib/pricing";

const TIPS = [
  { rupees: 20, emoji: "😊" },
  { rupees: 30, emoji: "🤩" },
  { rupees: 50, emoji: "😍" },
];

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems());
  const tipRupees = useCartStore((s) => s.tipRupees);
  const setTip = useCartStore((s) => s.setTip);
  const address = useSelectedAddress();
  const eta = useServiceability().data;

  const applied = useCouponStore((s) => s.applied);

  // One pricing function for the cart, checkout and the order, so the totals always agree
  const lines = toPriceLines(items);
  const bill = priceCart(lines, tipRupees * 100, applied);
  const couponItems = items.map((i) => ({ productId: i.id, quantity: i.quantity }));
  const progress = Math.min(1, bill.itemTotalPaise / FREE_DELIVERY_MIN_PAISE);

  // Suggestions are real catalog items that are not in the cart yet, cheapest first
  const products = useProducts({ limit: 100 }).data;
  const suggestions = useMemo(() => {
    const inCart = new Set(items.map((i) => i.id));
    return (products ?? [])
      .filter((p) => !inCart.has(p.id))
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);
  }, [products, items]);

  const bottomGap = Platform.OS === "ios" ? insets.bottom : TAB_BAR_CONTENT + insets.bottom;

  if (items.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My cart</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyArt}>
            <Ionicons name="bag-handle-outline" size={52} color={Colors.brandText} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Fresh groceries and daily needs, at your door in minutes.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)")}
            accessibilityRole="button"
          >
            <Text style={styles.emptyCtaText}>Start shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { line1, line2 } = addressSummary(address);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My cart</Text>
        <Text style={styles.headerSub}>
          {totalItems} item{totalItems !== 1 ? "s" : ""}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing[24] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Free delivery nudge */}
        <View style={[styles.nudge, bill.deliveryFeePaise === 0 && styles.nudgeDone]}>
          <View style={styles.nudgeRow}>
            <Ionicons
              name={bill.deliveryFeePaise === 0 ? "checkmark-circle" : "bicycle"}
              size={16}
              color={Colors.brandText}
            />
            <Text style={styles.nudgeText}>
              {bill.deliveryFeePaise === 0 ? (
                <>
                  Yay! You got <Text style={styles.bold}>FREE delivery</Text>
                </>
              ) : (
                <>
                  Add <Text style={styles.bold}>{formatPaise(bill.toFreeDeliveryPaise)}</Text> more
                  for FREE delivery
                </>
              )}
            </Text>
          </View>
          {bill.deliveryFeePaise > 0 ? (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
          ) : null}
        </View>

        {/* Shipment with its items */}
        <View style={styles.card}>
          <View style={styles.shipHeader}>
            <View style={styles.shipIcon}>
              <Ionicons name="timer" size={20} color={Colors.brandText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shipTitle}>
                {eta?.serviceable
                  ? `Delivery in ${eta.etaMins} minutes`
                  : "Delivery time unavailable"}
              </Text>
              <Text style={styles.shipSub}>
                Shipment of {totalItems} item{totalItems !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.thumb}>
                <ProductImage
                  imageUrl={item.imageUrl}
                  fit={item.imageFit}
                  emoji={item.image}
                  emojiSize={30}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.rowUnit}>{item.unit}</Text>
              </View>
              <View style={styles.rowRight}>
                <AddButton productId={item.id} productData={item} size="sm" />
                <View style={styles.rowPrice}>
                  {item.mrp > item.price ? (
                    <Text style={styles.rowMrp}>₹{item.mrp * item.quantity}</Text>
                  ) : null}
                  <Text style={styles.rowPriceText}>₹{item.price * item.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {suggestions.length > 0 ? (
          <View style={styles.suggest}>
            <Text style={styles.sectionTitle}>You might have missed</Text>
            <FlatList
              data={suggestions}
              keyExtractor={(p) => p.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestList}
              ItemSeparatorComponent={() => <View style={{ width: Spacing[8] }} />}
              renderItem={({ item }) => (
                <View style={styles.suggestCard}>
                  <ProductCard product={item} />
                </View>
              )}
            />
          </View>
        ) : null}

        <CouponSection lines={lines} items={couponItems} tipPaise={tipRupees * 100} bill={bill} />

        {/* Bill */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill details</Text>
          <BillRow icon="document-text-outline" label="Items total">
            {bill.savingsPaise > 0 ? (
              <Text style={styles.strike}>{formatPaise(bill.mrpTotalPaise)}</Text>
            ) : null}
            <Text style={styles.billValue}>{formatPaise(bill.itemTotalPaise)}</Text>
          </BillRow>
          <BillRow icon="bicycle-outline" label="Delivery charge">
            {bill.deliveryFeePaise === 0 ? (
              <>
                <Text style={styles.strike}>{formatPaise(DELIVERY_FEE_PAISE)}</Text>
                <Text style={[styles.billValue, styles.free]}>FREE</Text>
              </>
            ) : (
              <Text style={styles.billValue}>{formatPaise(bill.deliveryFeePaise)}</Text>
            )}
          </BillRow>
          <BillRow icon="bag-handle-outline" label="Handling charge">
            <Text style={styles.billValue}>{formatPaise(bill.handlingFeePaise)}</Text>
          </BillRow>
          {bill.tipPaise > 0 ? (
            <BillRow icon="heart-outline" label="Tip for your delivery partner">
              <Text style={styles.billValue}>{formatPaise(bill.tipPaise)}</Text>
            </BillRow>
          ) : null}
          {bill.discountPaise > 0 && bill.appliedCoupon ? (
            <BillRow icon="pricetag-outline" label={`Coupon (${bill.appliedCoupon.code})`}>
              <Text style={[styles.billValue, styles.free]}>
                -{formatPaise(bill.discountPaise)}
              </Text>
            </BillRow>
          ) : null}
          <View style={styles.billDivider} />
          <View style={styles.billTotalRow}>
            <Text style={styles.billTotalLabel}>Grand total</Text>
            <Text style={styles.billTotalValue}>{formatPaise(bill.totalPaise)}</Text>
          </View>
          {bill.savingsPaise + bill.couponSavingsPaise > 0 ? (
            <View style={styles.savings}>
              <Text style={styles.savingsText}>Your total savings</Text>
              <Text style={styles.savingsValue}>
                {formatPaise(bill.savingsPaise + bill.couponSavingsPaise)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tip */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tip your delivery partner</Text>
          <Text style={styles.muted}>Your kindness means a lot. 100% of the tip goes to them.</Text>
          <View style={styles.tips}>
            {TIPS.map((t) => {
              const active = tipRupees === t.rupees;
              return (
                <Pressable
                  key={t.rupees}
                  style={[styles.tip, active && styles.tipActive]}
                  onPress={() => setTip(active ? 0 : t.rupees)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Tip ${t.rupees} rupees`}
                >
                  <Text style={styles.tipEmoji}>{t.emoji}</Text>
                  <Text style={[styles.tipText, active && styles.tipTextActive]}>₹{t.rupees}</Text>
                  {active ? <Ionicons name="close" size={12} color={Colors.brandText} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cancellation policy</Text>
          <Text style={styles.muted}>
            You can cancel until the store starts packing your order. After that it is on its way to
            you and can no longer be cancelled.
          </Text>
        </View>
      </ScrollView>

      {/* Address and pay, pinned above the tab bar */}
      <View style={[styles.footer, { marginBottom: bottomGap }]}>
        <Pressable
          style={styles.addr}
          onPress={() => router.push("/addresses")}
          accessibilityRole="button"
          accessibilityLabel={`Delivering to ${addressTag(address)}. Change address`}
        >
          <View style={styles.addrIcon}>
            <Ionicons name={KIND_ICON[address.kind]} size={16} color={Colors.brandText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addrTitle} numberOfLines={1}>
              Delivering to <Text style={styles.bold}>{addressTag(address)}</Text>
            </Text>
            <Text style={styles.addrLine} numberOfLines={1}>
              {[line1, line2].filter(Boolean).join(", ")}
            </Text>
          </View>
          <Text style={styles.change}>Change</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.pay, pressed && styles.payPressed]}
          onPress={() => router.push("/checkout")}
          accessibilityRole="button"
          accessibilityLabel={`Total ${formatPaise(bill.totalPaise)}. Proceed to checkout`}
        >
          <View>
            <Text style={styles.payTotal}>{formatPaise(bill.totalPaise)}</Text>
            <Text style={styles.payTotalLabel}>TOTAL</Text>
          </View>
          <View style={styles.payRight}>
            <Text style={styles.payText}>Proceed to pay</Text>
            <Ionicons name="caret-forward" size={14} color={Colors.onBrand} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function BillRow({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.billRow}>
      <Ionicons name={icon} size={15} color={Colors.textSecondary} />
      <Text style={styles.billLabel}>{label}</Text>
      <View style={styles.billRight}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing[8],
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[14],
    backgroundColor: Colors.surface,
  },
  headerTitle: { ...typography.title, fontWeight: "800", color: Colors.textPrimary },
  headerSub: { ...typography.caption, color: Colors.textTertiary },
  scroll: { flex: 1 },
  content: { padding: Spacing[12], gap: Spacing[12] },
  pressed: { opacity: 0.85 },
  bold: { fontWeight: "800", color: Colors.textPrimary },

  nudge: {
    backgroundColor: "#EAF6FF",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[10],
    gap: Spacing[8],
  },
  nudgeDone: { backgroundColor: Colors.greenTint },
  nudgeRow: { flexDirection: "row", alignItems: "center", gap: Spacing[8] },
  nudgeText: { ...typography.caption, fontWeight: "600", color: Colors.textSecondary, flex: 1 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(35,138,71,0.15)",
    overflow: "hidden",
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: Colors.brandGreen },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[14],
  },
  sectionTitle: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  muted: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary, marginTop: 4 },

  shipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingBottom: Spacing[12],
  },
  shipIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  shipTitle: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  shipSub: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary, marginTop: 1 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingVertical: Spacing[10],
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#EDF1F0",
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  rowInfo: { flex: 1 },
  rowName: { ...typography.bodyStrong, fontSize: 13, lineHeight: 17, color: Colors.textPrimary },
  rowUnit: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 6 },
  rowPrice: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  rowMrp: {
    fontSize: 11,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  rowPriceText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },

  suggest: { gap: Spacing[10] },
  suggestList: { paddingRight: Spacing[4] },
  suggestCard: { width: 136 },

  billRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
    marginTop: Spacing[10],
  },
  billLabel: { ...typography.body, color: Colors.textSecondary, flex: 1 },
  billRight: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  billValue: { ...typography.body, color: Colors.textPrimary, fontVariant: ["tabular-nums"] },
  strike: {
    ...typography.caption,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
  free: { color: Colors.offerBlue, fontWeight: "800" },
  billDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing[12] },
  billTotalRow: { flexDirection: "row", justifyContent: "space-between" },
  billTotalLabel: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  billTotalValue: {
    ...typography.subtitle,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  savings: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#EAF6FF",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
    marginTop: Spacing[12],
  },
  savingsText: { ...typography.bodyStrong, color: Colors.offerBlue },
  savingsValue: { ...typography.bodyStrong, fontWeight: "800", color: Colors.offerBlue },

  tips: { flexDirection: "row", gap: Spacing[8], marginTop: Spacing[12] },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    height: 36,
  },
  tipActive: { borderColor: Colors.brandGreen, backgroundColor: Colors.greenTint },
  tipEmoji: { fontSize: 15 },
  tipText: { ...typography.bodyStrong, color: Colors.textPrimary },
  tipTextActive: { color: Colors.brandText, fontWeight: "800" },

  footer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing[12],
    paddingTop: Spacing[10],
    paddingBottom: Spacing[10],
    gap: Spacing[10],
    ...Shadow.sticky,
  },
  addr: { flexDirection: "row", alignItems: "center", gap: Spacing[10], paddingHorizontal: 4 },
  addrIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  addrTitle: { ...typography.caption, color: Colors.textSecondary },
  addrLine: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary },
  change: { ...typography.bodyStrong, fontWeight: "800", color: Colors.brandText },
  pay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[16],
    height: 56,
  },
  payPressed: { backgroundColor: Colors.brandFillPressed },
  payTotal: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: Colors.onBrand,
    fontVariant: ["tabular-nums"],
  },
  payTotalLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: Colors.onBrandMuted,
  },
  payRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  payText: { fontSize: 16, fontWeight: "800", color: Colors.onBrand },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing[32] },
  emptyArt: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing[20],
  },
  emptyTitle: { ...typography.title, fontWeight: "800", color: Colors.textPrimary },
  emptyText: {
    ...typography.body,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: Spacing[8],
  },
  emptyCta: {
    marginTop: Spacing[24],
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[32],
    height: 48,
    justifyContent: "center",
  },
  emptyCtaText: { fontSize: 15, fontWeight: "800", color: Colors.onBrand },
});
